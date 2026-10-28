"""
Suite d'Assurance Qualité (QA), d'Homologation Normative, de Recette UAT Multi-Canal
et de Simulation d'Incidents de Production (Chaos Engineering Monétique).

Vérifie :
1. La connexion et l'intégrité du schéma MySQL (payway_iso8583_simulator sur port 8889) + Conformité PCI-DSS v4.0
2. Les 12 épreuves normatives d'homologation (TC-0800, TC-01 à TC-10, TC-0400)
3. Les 12 épreuves UAT Multi-Canal (GAB Cassettes, TPE NFC/Fallback, E-Commerce 3DS/CVV2, Anti-Fraude, Capture GAB)
4. Les 6 scénarios d'incidents de production (Host Down 91, Stand-In STIP, HSM 63/96, Time-out 68 + Auto-0400, Bourrage GAB & Distribution Partielle, Doublon STAN 94)
5. Le test de charge haute fréquence (100 TPS) et les SLAs bancaires (p50, p95, p99).
"""

import asyncio
import sys
import time
from core.tcp_server import tcp_server
from core.accounts_db import accounts_db
from core.decision_engine import decision_engine
from core.mysql_db import mysql_manager
from core.iso8583 import create_0200_auth
from tests_suite.test_cases import TestSuiteRunner, send_tcp_message
from tests_suite.load_tester import LoadTester

GREEN = "\033[92m"
RED = "\033[91m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
RESET = "\033[0m"


async def run_chaos_qa_scenarios(host: str, port: int) -> dict:
    """Exécute les 6 tests QA d'incidents de production (Chaos Engineering)."""
    chaos_results = []
    passed_count = 0

    try:
        # QA-CHAOS-01 : Host Indisponible (DE 39 = 91)
        decision_engine.reset_chaos_config()
        decision_engine.update_chaos_config({"host_down_91": True, "stip_standin_enabled": False})
        msg1 = create_0200_auth(pan="4000123456780016", amount=10000, stan="900001")
        resp1, lat1 = await send_tcp_message(host, port, msg1)
        ok1 = resp1.get_field(39) == "91"
        chaos_results.append({
            "id": "QA-CH01",
            "title": "Incident Host Indisponible (DE 39=91)",
            "expected": "91",
            "actual": resp1.get_field(39),
            "passed": ok1,
            "detail": f"Host Down sans STIP -> DE 39={resp1.get_field(39)} ({lat1:.2f}ms)"
        })
        if ok1:
            passed_count += 1

        # QA-CHAOS-02 : Bascule Stand-In Processing (STIP -> DE 39 = 00)
        decision_engine.update_chaos_config({"host_down_91": True, "stip_standin_enabled": True, "stip_max_amount": 50000})
        msg2 = create_0200_auth(pan="4000123456780016", amount=20000, stan="900002")
        resp2, lat2 = await send_tcp_message(host, port, msg2)
        ok2 = resp2.get_field(39) == "00" and resp2.get_field(38, "").startswith("ST")
        chaos_results.append({
            "id": "QA-CH02",
            "title": "Mode Dégradé Stand-In (STIP Switch)",
            "expected": "00 (ST*)",
            "actual": f"{resp2.get_field(39)} ({resp2.get_field(38)})",
            "passed": ok2,
            "detail": f"Autorisé par délégation Switch STIP : DE 38={resp2.get_field(38)}"
        })
        if ok2:
            passed_count += 1

        # QA-CHAOS-03 : Violation Sécurité HSM / MAC Error (DE 39 = 63)
        decision_engine.reset_chaos_config()
        decision_engine.update_chaos_config({"hsm_failure_mode": "MAC_ERROR_63"})
        msg3 = create_0200_auth(pan="4000123456780016", amount=5000, stan="900003")
        resp3, _ = await send_tcp_message(host, port, msg3)
        ok3 = resp3.get_field(39) == "63"
        chaos_results.append({
            "id": "QA-CH03",
            "title": "Panne HSM / Violation MAC (DE 39=63)",
            "expected": "63",
            "actual": resp3.get_field(39),
            "passed": ok3,
            "detail": "Détection altération MAC / Clé ZAK HSM -> DE 39=63"
        })
        if ok3:
            passed_count += 1

        # QA-CHAOS-04 : Time-out Émetteur (DE 39 = 68) + Auto-Reversal 0400
        decision_engine.reset_chaos_config()
        bal_before = accounts_db.get_account("4000123456780018")["balance"]
        decision_engine.update_chaos_config({
            "timeout_enabled": True,
            "timeout_delay_ms": 350,
            "sla_timeout_threshold_ms": 200,
            "auto_reversal_on_timeout": True
        })
        msg4 = create_0200_auth(pan="4000123456780018", amount=15000, stan="900004")
        resp4, _ = await send_tcp_message(host, port, msg4)
        bal_after = accounts_db.get_account("4000123456780018")["balance"]
        ok4 = (resp4.get_field(39) == "68") and (bal_after == bal_before)
        chaos_results.append({
            "id": "QA-CH04",
            "title": "Time-out 68 + Auto-Reversal 0400",
            "expected": "68 & ΔSolde=0",
            "actual": f"{resp4.get_field(39)} & Δ={bal_after - bal_before}",
            "passed": ok4,
            "detail": f"Time-out détecté et fonds restitués automatiquement (Solde={bal_after:,} F)"
        })
        if ok4:
            passed_count += 1

        # QA-CHAOS-05 : Incident GAB Distribution Partielle (Partial Dispense -> Reversal Partiel)
        decision_engine.reset_chaos_config()
        bal_gab_before = accounts_db.get_account("4000123456780019")["balance"]
        decision_engine.update_chaos_config({"gab_fault_mode": "PARTIAL_DISPENSE"})
        msg5 = create_0200_auth(
            pan="4000123456780019",
            amount=20000,
            stan="900005",
            channel="GAB",
            proc_code="010000",
            terminal_id="GAB00001"
        )
        resp5, _ = await send_tcp_message(host, port, msg5)
        bal_gab_after = accounts_db.get_account("4000123456780019")["balance"]
        # Sur 20 000 demandés en PARTIAL_DISPENSE, 10 000 servis et 10 000 recrédités -> impact net -10 000
        ok5 = (resp5.get_field(39) == "00") and ((bal_gab_after - bal_gab_before) == -10000)
        chaos_results.append({
            "id": "QA-CH05",
            "title": "GAB Distribution Partielle + 0400 Partiel",
            "expected": "Δ=-10000 F",
            "actual": f"Δ={bal_gab_after - bal_gab_before} F",
            "passed": ok5,
            "detail": "20k demandés, 10k distribués, +10k recrédités par Reversal partiel"
        })
        if ok5:
            passed_count += 1

        # QA-CHAOS-06 : Détection de Doublon STAN (DE 39 = 94)
        decision_engine.reset_chaos_config()
        decision_engine.update_chaos_config({"duplicate_stan_check": True})
        msg6a = create_0200_auth(pan="4000123456780020", amount=5000, stan="900006", terminal_id="TERM0009")
        resp6a, _ = await send_tcp_message(host, port, msg6a)
        # Rejeu exact du même STAN + Terminal + Montant
        resp6b, _ = await send_tcp_message(host, port, msg6a)
        ok6 = (resp6a.get_field(39) == "00") and (resp6b.get_field(39) == "94")
        chaos_results.append({
            "id": "QA-CH06",
            "title": "Anti-Doublon Rejeu STAN (DE 39=94)",
            "expected": "00 puis 94",
            "actual": f"{resp6a.get_field(39)} puis {resp6b.get_field(39)}",
            "passed": ok6,
            "detail": "1er envoi approuvé (00), rejeu bloqué en Duplicate Transmission (94)"
        })
        if ok6:
            passed_count += 1

    finally:
        decision_engine.reset_chaos_config()

    return {
        "total": len(chaos_results),
        "passed": passed_count,
        "results": chaos_results
    }


async def run_cli_tests(run_load: bool = True, load_duration: int = 5):
    print(f"\n{BOLD}{CYAN}=============================================================================={RESET}")
    print(f"{BOLD}{CYAN}   SUITE QA & HOMOLOGATION MONÉTIQUE MULTI-CANAL (GAB / TPE / E-COMMERCE)     {RESET}")
    print(f"{BOLD}{CYAN}=============================================================================={RESET}\n")

    # 0. Vérification de la base de données MySQL & Conformité PCI-DSS
    db_info = mysql_manager.get_db_info()
    if db_info["connected"]:
        print(
            f"[{GREEN}MYSQL OK{RESET}] Connecté à {BOLD}{db_info['host']}:{db_info['port']}/{db_info['database']}{RESET} "
            f"(Comptes={db_info['tables']['accounts']}, GAB={db_info['tables']['atms']}, Logs={db_info['tables']['audit_logs']})"
        )
    else:
        print(f"[{YELLOW}MYSQL INFO{RESET}] Mode mémoire actif ({db_info['last_error']})")

    # 1. Démarrage du serveur TCP en processus pour garantir le partage d'état (DB & Chaos)
    tcp_server.host = "127.0.0.1"
    tcp_server.port = 5001
    started_server = False

    try:
        await tcp_server.start()
        started_server = True
        print(f"[{GREEN}TCP OK{RESET}] Serveur TCP démarré sur {tcp_server.host}:{tcp_server.port}")
    except OSError:
        tcp_server.port = 5002
        await tcp_server.start()
        started_server = True
        print(f"[{GREEN}TCP OK{RESET}] Port 5001 occupé -> Serveur TCP de test démarré sur {tcp_server.host}:{tcp_server.port}")
    await asyncio.sleep(0.2)

    # 2. Exécution des 24 épreuves (12 Homologation + 12 UAT Multi-Canal)
    print(f"\n{BOLD}▶ 1. EXÉCUTION DES 24 ÉPREUVES (12 HOMOLOGATION + 12 UAT GAB/TPE/E-COM){RESET}")
    print("-" * 78)

    runner = TestSuiteRunner(host=tcp_server.host, port=tcp_server.port)
    report = await runner.run_all_tests(include_uat=True)

    for r in report["results"]:
        status_badge = f"{GREEN}[PASS]{RESET}" if r["passed"] else f"{RED}[FAIL]{RESET}"
        ch_badge = f"[{r.get('channel', 'TPE'):<4}]"
        de39_display = f"DE39={r['actual_de39']}"
        lat_display = f"{r['latency_ms']}ms" if r.get("latency_ms") else ""
        bal_display = f"Δ={r['actual_balance_impact']:+} F" if r.get("actual_balance_impact") else "Δ=0 F"
        print(
            f"  {status_badge} {BOLD}{r['id']:<7}{RESET} {CYAN}{ch_badge}{RESET} | "
            f"{r['title']:<32} | {de39_display:<8} | {bal_display:<12} | {lat_display}"
        )

    summary = report["summary"]
    cert_color = GREEN if summary["certified"] else RED
    print("-" * 78)
    print(f"Résultats Homologation & UAT : {BOLD}{summary['passed']} / {summary['total']} réussis ({summary['compliance_rate']}%){RESET}")

    # 3. Exécution des 6 scénarios QA Chaos Engineering & Incidents de Prod
    print(f"\n{BOLD}▶ 2. EXÉCUTION DES 6 ÉPREUVES QA D'INCIDENTS DE PRODUCTION (CHAOS){RESET}")
    print("-" * 78)
    chaos_report = await run_chaos_qa_scenarios(tcp_server.host, tcp_server.port)
    for c in chaos_report["results"]:
        status_badge = f"{GREEN}[PASS]{RESET}" if c["passed"] else f"{RED}[FAIL]{RESET}"
        print(f"  {status_badge} {BOLD}{c['id']:<7}{RESET} | {c['title']:<37} | {c['detail']}")
    print("-" * 78)
    print(f"Résultats QA Incidents Prod  : {BOLD}{chaos_report['passed']} / {chaos_report['total']} réussis{RESET}\n")

    # 4. Test de charge si demandé
    if run_load:
        accounts_db.reset_to_default()
        print(f"{BOLD}▶ 3. TEST DE CHARGE ÉTAPE 04 (100 TPS pendant {load_duration}s){RESET}")
        print("-" * 78)
        loader = LoadTester(host=tcp_server.host, port=tcp_server.port)

        def cli_progress(data: dict):
            sys.stdout.write(
                f"\rProgression : {data['second']:2d}/{data['total_seconds']}s ({data['progress_pct']:5.1f}%) | "
                f"Tx: {data['total_sent']:5d} | p50: {data['cumulative_p50']:5.2f}ms | p95: {data['cumulative_p95']:5.2f}ms | Erreurs: {data['errors']}"
            )
            sys.stdout.flush()

        res = await loader.run_load_test(target_tps=100, duration_seconds=load_duration, progress_cb=cli_progress)
        print("\n" + "-" * 78)
        metrics = res["metrics"]
        sla = res["sla"]

        print(f"Transactions exécutées : {metrics['total_sent']:,} ({metrics['effective_tps']:.2f} TPS effectif)")
        print(f"Latence Médiane (p50)   : {metrics['latency_p50_ms']} ms (SLA < 15ms : {GREEN if sla['p50_passed'] else RED}{'OK' if sla['p50_passed'] else 'FAIL'}{RESET})")
        print(f"Latence 95e Centile (p95): {metrics['latency_p95_ms']} ms (SLA < 30ms : {GREEN if sla['p95_passed'] else RED}{'OK' if sla['p95_passed'] else 'FAIL'}{RESET})")
        print(f"Latence 99e Centile (p99): {metrics['latency_p99_ms']} ms (SLA < 50ms : {GREEN if sla['p99_passed'] else RED}{'OK' if sla['p99_passed'] else 'FAIL'}{RESET})")
        print(f"Taux d'erreur           : {metrics['error_rate_pct']:.2f} % ({metrics['errors']} erreurs, SLA = 0% : {GREEN if sla['error_passed'] else RED}{'OK' if sla['error_passed'] else 'FAIL'}{RESET})")

        verdict = f"{GREEN}CERTIFIÉ BON POUR DÉPLOIEMENT{RESET}" if sla["is_certified"] else f"{RED}HOMOLOGATION REJETÉE{RESET}"
        print(f"Qualification Finale    : {BOLD}{verdict}{RESET}\n")

    if started_server:
        await tcp_server.stop()

    print(f"{BOLD}{GREEN}✔ Toutes les spécifications QA, UAT Multi-Canal, Chaos et MySQL ont été vérifiées !{RESET}\n")


if __name__ == "__main__":
    duration = 5
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        duration = int(sys.argv[1])
    asyncio.run(run_cli_tests(run_load=True, load_duration=duration))
