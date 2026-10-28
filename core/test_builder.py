"""
Studio de Recette & Générateur de Cahiers d'Homologation Monétique Personnalisés (Custom Test Builder).
Permet aux équipes QA et aux ingénieurs monétiques de concevoir des scénarios sur mesure
et de générer des Procès-Verbaux (PV) de recette officiels signés.
Conçu & Réalisé par M. Oury — Ingénieur IT Banking & Architecte Monétique - CBS.
"""

import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from core.iso8583 import ISO8583Message, create_0200_auth, create_0400_reversal, create_0800_echo, mask_pan, DE_39_DESCRIPTIONS
from core.decision_engine import decision_engine


class CustomTestScenarioBuilder:
    """
    Constructeur de scénarios personnalisés d'homologation et générateur de PV de recette certifiés.
    """

    @staticmethod
    def execute_custom_scenario(scenario_def: Dict[str, Any]) -> Dict[str, Any]:
        """
        Exécute un scénario personnalisé contre le moteur d'autorisation monétique.
        """
        name = scenario_def.get("name", "Scénario Personnalisé")
        channel = scenario_def.get("channel", "TPE")
        mti = scenario_def.get("mti", "0200")
        pan = scenario_def.get("pan", "4000123456780001")
        amount = int(scenario_def.get("amount", 25000))
        currency = scenario_def.get("currency", "952")
        stan = scenario_def.get("stan", "000001")
        pos_entry_mode = scenario_def.get("pos_entry_mode", "051")
        pin = scenario_def.get("pin", "1234")
        expected_de39 = scenario_def.get("expected_de39", "00")
        overrides = scenario_def.get("field_overrides") or {}

        # Construction du message
        if mti == "0800":
            msg = create_0800_echo(stan=stan)
        elif mti in ("0400", "0420"):
            msg = create_0400_reversal(pan=pan, amount=amount, orig_stan="000000", stan=stan)
        else:
            msg = create_0200_auth(
                pan=pan,
                amount=amount,
                currency=currency,
                pin=pin,
                stan=stan,
                pos_entry_mode=pos_entry_mode,
                channel=channel
            )

        # Application des overrides forcés
        for de_k, de_v in overrides.items():
            try:
                msg.set_field(int(de_k), str(de_v))
            except Exception:
                pass

        # Exécution de la décision via le moteur d'arbitrage
        tx_data = {
            "pan": pan,
            "amount": amount,
            "currency": currency,
            "stan": stan,
            "pin": pin,
            "pos_entry_mode": pos_entry_mode,
            "channel": channel,
            "terminal_id": msg.get_field(41, "TERM0001"),
            "proc_code": msg.get_field(3, "000000"),
            "mcc": msg.get_field(18, "5411"),
            "pos_condition_code": msg.get_field(25, "00"),
            "de48": msg.get_field(48, ""),
        }
        de39_obtained, de38_obtained, rule_triggered, extra_meta = decision_engine.authorize_transaction(tx_data)
        passed = de39_obtained == expected_de39

        meta = DE_39_DESCRIPTIONS.get(de39_obtained, {})
        resp_mti = "0210" if mti == "0200" else ("0110" if mti == "0100" else ("0810" if mti == "0800" else "0430"))
        resp_msg = ISO8583Message(mti=resp_mti)
        for k, v in msg.fields.items():
            if k not in (52, 53):
                resp_msg.set_field(k, v)
        resp_msg.set_field(39, de39_obtained)
        if de38_obtained:
            resp_msg.set_field(38, de38_obtained)

        return {
            "scenario_name": name,
            "channel": channel,
            "mti": mti,
            "pan_masked": mask_pan(pan),
            "amount": amount,
            "expected_de39": expected_de39,
            "obtained_de39": de39_obtained,
            "de39_label": meta.get("label", "Code inconnu"),
            "test_verdict": "PASS" if passed else "FAIL",
            "passed": passed,
            "rule_triggered": rule_triggered,
            "raw_request_ascii": msg.pack().decode("ascii", errors="replace"),
            "raw_response_ascii": resp_msg.pack().decode("ascii", errors="replace"),
            "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        }

    @staticmethod
    def generate_pv_report_markdown(results: List[Dict[str, Any]], campaign_name: str = "Campagne de Recette Monétique") -> str:
        """
        Génère un Procès-Verbal officiel de recette au format Markdown haute fidélité.
        """
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        total = len(results)
        passed_count = sum(1 for r in results if r.get("passed", False))
        failed_count = total - passed_count
        pass_rate = (passed_count / total * 100) if total > 0 else 0.0

        rows = []
        for i, r in enumerate(results, 1):
            status_emoji = "✅ PASS" if r.get("passed") else "❌ FAIL"
            rows.append(
                f"| {i} | {r.get('scenario_name')} | {r.get('channel')} | {r.get('mti')} | "
                f"`{r.get('pan_masked')}` | {r.get('amount'):,} FCFA | `{r.get('expected_de39')}` | "
                f"`{r.get('obtained_de39')}` | **{status_emoji}** | {r.get('rule_triggered')} |"
            )

        table_content = "\n".join(rows)

        report = f"""# PROCÈS-VERBAL D'HOMOLOGATION & CERTIFICATION MONÉTIQUE
**Document Officiel de Qualification de l'Hôte d'Autorisation ISO 8583**

- **Nom de la Campagne :** {campaign_name}
- **Date & Heure d'Exécution :** {now_str}
- **Normes Appliquées :** ISO 8583:1987/1993 • GIM-UEMOA • EMV Book 2 • PCI-DSS v4.0
- **Responsable de Qualification :** M. Oury — Ingénieur IT Banking & Architecte Monétique - CBS

---

## 1. Synthèse des Résultats d'Homologation

| Métrique | Valeur Obtenue | Objectif de Conformité | Statut |
| :--- | :---: | :---: | :---: |
| **Total des Cas Exécutés** | **{total}** | Minimum requis | Conforme |
| **Cas Validés avec Succès** | **{passed_count}** | {total} attendus | {'✅ Conforme' if failed_count == 0 else '⚠️ Anomalies détectées'} |
| **Cas en Échec** | **{failed_count}** | 0 toléré en production | {'✅ Aucun' if failed_count == 0 else '❌ Action requise'} |
| **Taux de Réussite Global** | **{pass_rate:.1f} %** | 100.0 % | {'✅ CERTIFIÉ BON POUR SERVICE' if pass_rate == 100.0 else '⚠️ RÉSERVES ÉMISES'} |

---

## 2. Tableau Détaillé des Épreuves & Verdicts

| N° | Scénario | Canal | MTI | Carte (PAN) | Montant | Attendu | Obtenu | Verdict | Règle Hôte |
| :-: | :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
{table_content}

---

## 3. Visa et Signature de l'Architecte

Le présent procès-verbal atteste de la conformité des règles d'arbitrage de l'Hôte d'Autorisation bancaire par rapport au cahier des charges de la banque et aux normes interbancaires.

**Signé électroniquement le {now_str} par :**  
**M. Oury**  
*Ingénieur IT Banking & Architecte Monétique - CBS*  
*Expertise Systèmes Monétiques, Switch Interbancaire & Sécurité Bancaire*
"""
        return report


test_builder = CustomTestScenarioBuilder()
