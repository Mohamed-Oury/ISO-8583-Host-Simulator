"""
Moteur de Décision Métier d'un Émetteur Monétique Bancaire (Host Simulator Multi-Canal).
Implémente :
- La matrice d'arbitrage hiérarchique étendue (Règles R01 à R18 : Sécurité, Limites, GAB, TPE, E-Commerce 3DS/CVV2, Anti-Fraude).
- Le simulateur d'incidents de production (Chaos Engineering : Time-out 68 + Auto-Reversal 0400, Host Down 91 + Stand-In STIP, Panne HSM 63/96, Bourrage GAB & Reversal Partiel, Doublon STAN 94).
- Le calcul détaillé des temps de latence par maillon (Terminal -> Acquéreur -> Switch -> HSM -> Host/MySQL).
- La persistance MySQL conforme PCI-DSS v4.0.
"""

import random
import re
import string
import threading
import time
from typing import Dict, Tuple, Optional, Any, List
from core.accounts_db import AccountsDatabase, accounts_db
from core.iso8583 import mask_pan, mask_sensitive_de48, DE_39_DESCRIPTIONS
from core.mysql_db import mysql_manager


DEFAULT_CHAOS_CONFIG = {
    "host_down_91": False,
    "stip_standin_enabled": False,
    "stip_max_amount": 50000,
    "timeout_enabled": False,
    "timeout_delay_ms": 350,
    "sla_timeout_threshold_ms": 250,
    "auto_reversal_on_timeout": True,
    "hsm_failure_mode": "NONE",       # NONE | HSM_DOWN_96 | MAC_ERROR_63 | ZPK_DESYNC_55
    "gab_fault_mode": "NONE",         # NONE | CASH_JAM | PARTIAL_DISPENSE | CASSETTE_EMPTY
    "duplicate_stan_check": False,
    "format_error_30_sim": False,
    "routing_error_92_sim": False,
    "artificial_latency_ms": 0,
    "artificial_jitter_ms": 0,
}


class DecisionEngine:
    def __init__(self, db: AccountsDatabase = accounts_db):
        self.db = db
        self.processed_transactions: Dict[str, dict] = {}
        self.audit_history: List[dict] = []
        self._lock = threading.RLock()
        self.chaos_config: Dict[str, Any] = dict(DEFAULT_CHAOS_CONFIG)
        self.persist_to_mysql = True

    def get_chaos_config(self) -> Dict[str, Any]:
        with self._lock:
            return dict(self.chaos_config)

    def update_chaos_config(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            for k, v in updates.items():
                if k in self.chaos_config and v is not None:
                    self.chaos_config[k] = v
            mysql_manager.save_chaos_config(self.chaos_config)
            return dict(self.chaos_config)

    def reset_chaos_config(self) -> Dict[str, Any]:
        with self._lock:
            self.chaos_config = dict(DEFAULT_CHAOS_CONFIG)
            mysql_manager.save_chaos_config(self.chaos_config)
            return dict(self.chaos_config)

    def clear_history(self):
        with self._lock:
            self.processed_transactions.clear()
            self.audit_history.clear()
            mysql_manager.clear_audit_logs_mysql()

    @staticmethod
    def _parse_de48_kv(de48: str) -> Dict[str, str]:
        """Extrait les paires clé=valeur du champ privé DE 48 (ex: CVV2=123;3DS=Y;ECI=05)."""
        result: Dict[str, str] = {}
        if not de48:
            return result
        for part in str(de48).split(";"):
            if "=" in part:
                k, v = part.split("=", 1)
                result[k.strip().upper()] = v.strip()
        return result

    def compute_latency_breakdown(self, channel: str, host_exec_ms: float) -> Dict[str, float]:
        """
        Calcule une décomposition réaliste des temps de latence par maillon monétique :
        Terminal -> Acquéreur -> Switch Interbancaire -> HSM Crypto -> Host Émetteur / CBS.
        """
        ch = (channel or "TPE").upper()
        if ch == "GAB":
            access_ms = round(random.uniform(6.0, 14.0), 2)     # Liaison louée / VSAT / Fibre GAB
            acquirer_ms = round(random.uniform(2.0, 4.5), 2)    # Contrôleur monétique GAB
        elif ch == "ECOM":
            access_ms = round(random.uniform(14.0, 28.0), 2)    # Passerelle HTTPS / MPI 3-D Secure
            acquirer_ms = round(random.uniform(3.5, 7.0), 2)    # Passerelle Acquéreur E-Commerce
        else:
            access_ms = round(random.uniform(10.0, 22.0), 2)    # GPRS / 4G / IP TPE
            acquirer_ms = round(random.uniform(2.5, 5.5), 2)    # Concentrateur TPE Acquéreur

        switch_ms = round(random.uniform(3.0, 7.5), 2)          # Switch Interbancaire (GIM / Visa / MC)
        hsm_ms = round(random.uniform(1.2, 3.8), 2)             # Module HSM PayShield (PIN Block / MAC / ARQC)

        extra_lat = float(self.chaos_config.get("artificial_latency_ms", 0))
        jitter = float(self.chaos_config.get("artificial_jitter_ms", 0))
        if jitter > 0:
            extra_lat += random.uniform(0, jitter)

        if self.chaos_config.get("timeout_enabled"):
            extra_lat += float(self.chaos_config.get("timeout_delay_ms", 350))

        host_cbs_ms = round(max(0.4, host_exec_ms) + extra_lat, 2)
        total_simulated_ms = round(access_ms + acquirer_ms + switch_ms + hsm_ms + host_cbs_ms, 2)

        return {
            "access_network_ms": access_ms,
            "acquirer_ms": acquirer_ms,
            "switch_ms": switch_ms,
            "hsm_crypto_ms": hsm_ms,
            "issuer_host_cbs_ms": host_cbs_ms,
            "socket_rtt_ms": round(host_exec_ms, 2),
            "total_chain_ms": total_simulated_ms,
        }

    def authorize_transaction(self, tx_data: dict) -> Tuple[str, str, str, Dict[str, Any]]:
        """
        Évalue une demande 0200 selon la séquence hiérarchique d'arbitrage (R00 Chaos + R01 à R18).
        Retourne (DE_39, DE_38, rule_triggered, extra_meta).
        """
        t0 = time.perf_counter()
        pan = str(tx_data.get("pan", "")).strip()
        amount = int(tx_data.get("amount", 0))
        currency = str(tx_data.get("currency", "952")).strip()
        pin = str(tx_data.get("pin", "")).strip()
        tx_date = str(tx_data.get("tx_date", time.strftime("%y%m"))).strip()
        stan = str(tx_data.get("stan", "000001")).zfill(6)
        terminal_id = str(tx_data.get("terminal_id", "TERM0001")).strip()
        proc_code = str(tx_data.get("proc_code", "000000")).strip()
        mcc = str(tx_data.get("mcc", "")).strip()
        pos_entry_mode = str(tx_data.get("pos_entry_mode", "051")).strip()
        pos_condition_code = str(tx_data.get("pos_condition_code", "00")).strip()
        de48 = str(tx_data.get("de48", "")).strip()
        mac = str(tx_data.get("mac", "")).strip()
        channel = str(tx_data.get("channel", "")).upper().strip()

        if not channel:
            if pos_condition_code == "02" or mcc == "6011" or proc_code.startswith(("01", "31", "38")) or terminal_id.upper().startswith(("GAB", "ATM")):
                channel = "GAB"
            elif pos_condition_code == "59" or pos_entry_mode in ("812", "012") or "CHANNEL=ECOM" in de48.upper() or terminal_id.upper().startswith("ECOM"):
                channel = "ECOM"
            else:
                channel = "TPE"

        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        de48_kv = self._parse_de48_kv(de48)
        extra_meta: Dict[str, Any] = {
            "channel": channel,
            "proc_code": proc_code,
            "pos_entry_mode": pos_entry_mode,
            "de54_balance": "",
            "atm_notes": {},
            "auto_reversal": None,
            "stip_applied": False,
        }

        with self._lock:
            chaos = self.chaos_config

            # =========================================================================
            # R00 : CONTRÔLES TECHNIQUES, CHAOS ENGINEERING & DISPONIBILITÉ SYSTÈME
            # =========================================================================

            # 0.a Simulation Erreur de Format ISO 8583 (DE 39 = '30')
            if chaos.get("format_error_30_sim") or not pan.isdigit() or len(pan) < 12:
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "30", "", "R00-FMT: Erreur de Format Trame (DE 39 = 30)",
                    "Trame ISO 8583 mal formée ou PAN non numérique", extra_meta
                )

            # 0.b Simulation Erreur de Routage BIN (DE 39 = '92')
            if chaos.get("routing_error_92_sim") or not pan.startswith(("400012", "510012")):
                if chaos.get("routing_error_92_sim") or pan.startswith("999999"):
                    return self._finalize_decision(
                        t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                        "92", "", "R00-RTG: Erreur Routage BIN (DE 39 = 92)",
                        f"BIN {pan[:6]} non routable sur le Switch Interbancaire", extra_meta
                    )

            # 0.c Indisponibilité Host Émetteur (DE 39 = '91') & Mode Dégradé Stand-In (STIP)
            if chaos.get("host_down_91"):
                if chaos.get("stip_standin_enabled") and amount <= int(chaos.get("stip_max_amount", 50000)):
                    # Le Switch autorise en Stand-In Processing (STIP) si la carte est connue et active
                    if self.db.exists(pan):
                        acc_stip = self.db.get_raw_account(pan)
                        if acc_stip and acc_stip.get("status") == "ACTIVE" and acc_stip.get("balance", 0) >= amount:
                            acc_stip["balance"] -= amount
                            acc_stip["daily_spent"] += amount
                            if self.persist_to_mysql:
                                self.db.persist_account(pan)
                            stip_auth = "ST" + "".join(random.choices(string.digits, k=4))
                            extra_meta["stip_applied"] = True
                            tx_key = f"{stan}_{terminal_id}"
                            self.processed_transactions[tx_key] = {
                                "pan": pan, "amount": amount, "currency": currency,
                                "auth_code": stip_auth, "stan": stan, "terminal_id": terminal_id,
                                "timestamp": timestamp, "status": "APPROVED", "channel": channel
                            }
                            return self._finalize_decision(
                                t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                                "00", stip_auth, "STIP: Approbation par Délégation Switch (Stand-In)",
                                f"Host indisponible — Autorisé en Stand-In (STIP <= {chaos['stip_max_amount']} F)",
                                extra_meta
                            )
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "91", "", "R00-HOST: Émetteur Indisponible (DE 39 = 91)",
                    "Host d'autorisation hors-ligne (Switch Inoperative / STIP non applicable)", extra_meta
                )

            # 0.d Pannes HSM Cryptographique (DE 39 = '96' ou '63')
            hsm_mode = chaos.get("hsm_failure_mode", "NONE")
            if hsm_mode == "HSM_DOWN_96":
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "96", "", "R00-HSM: Panne Matérielle HSM (DE 39 = 96)",
                    "Module HSM Thales PayShield hors ligne (Timeout TCP port 1500)", extra_meta
                )
            if hsm_mode == "MAC_ERROR_63" or mac == "BADMAC":
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "63", "", "R00-MAC: Violation Sécurité MAC / Clé ZAK (DE 39 = 63)",
                    "Échec de vérification du code MAC (DE 64) par le HSM", extra_meta
                )

            # 0.e Détection de Doublon STAN (DE 39 = '94' Duplicate Transmission)
            tx_key = f"{stan}_{terminal_id}"
            if chaos.get("duplicate_stan_check") or de48_kv.get("SIM_DUP") == "1":
                existing = self.processed_transactions.get(tx_key)
                if existing and existing.get("status") == "APPROVED" and existing.get("amount") == amount:
                    return self._finalize_decision(
                        t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                        "94", "", "R00-DUP: Transmission en Doublon (DE 39 = 94)",
                        f"Doublon détecté : STAN {stan} sur terminal {terminal_id} déjà approuvé", extra_meta
                    )

            # =========================================================================
            # ARBITRAGE MÉTIER HIÉRARCHIQUE (R01 À R14)
            # =========================================================================

            # RÈGLE 1 (Priorité 1) : Existence du PAN dans le référentiel
            if not self.db.exists(pan):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "14", "", "R01: Existence du PAN",
                    "Carte Inconnue dans le référentiel émetteur (No Such Card)", extra_meta
                )

            account = self.db.get_raw_account(pan)

            # RÈGLE 2 (Priorité 2) : Carte Volée (43), Perdue (41) ou à Capturer (04)
            status = account.get("status", "ACTIVE")
            if status in ["STOLEN", "LOST", "CAPTURE"]:
                if status == "STOLEN":
                    code, rname = "43", "R02: Carte Volée (43)"
                elif status == "LOST":
                    code, rname = "41", "R02: Carte Perdue (41)"
                else:
                    code, rname = "04", "R02: Capture Carte GAB (04)"
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    code, "", rname, f"Opposition carte active : statut {status}", extra_meta
                )

            # RÈGLE 3 (Priorité 3) : Validité Temporelle / Date d'expiration (YYMM)
            card_exp = account.get("exp", "9912")
            if card_exp < tx_date:
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "54", "", "R03: Validité Temporelle (Carte expirée)",
                    f"Carte expirée (Exp: {card_exp} < Date Tx: {tx_date})", extra_meta
                )

            # RÈGLE 4 (Priorité 4) : Seuil de Tentatives PIN Dépassé (>= 3)
            if account.get("pin_tries", 0) >= 3:
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "75", "", "R04: Tentatives PIN dépassées (Compteur >= 3)",
                    f"Compteur faux PIN saturé ({account['pin_tries']}/3)", extra_meta
                )

            # RÈGLE 5 (Priorité 5) : Conformité du code secret PIN (ou Désynchronisation ZPK HSM)
            # Note : en E-Commerce (812) ou Sans-Contact NFC <= limite sans PIN, pas de vérification PIN sauf si PIN transmis
            requires_pin = (channel == "GAB") or (channel == "TPE" and pos_entry_mode != "071")
            if hsm_mode == "ZPK_DESYNC_55" and (pin or requires_pin):
                account["pin_tries"] += 1
                if self.persist_to_mysql:
                    self.db.persist_account(pan)
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "55", "", "R05-HSM: Désynchronisation Clé ZPK (PIN Block Illisible)",
                    f"Clé ZPK HSM désynchronisée -> PIN rejeté (Essai {account['pin_tries']}/3)", extra_meta
                )

            if pin and account.get("pin") != pin:
                account["pin_tries"] += 1
                if self.persist_to_mysql:
                    self.db.persist_account(pan)
                if account["pin_tries"] >= 3:
                    return self._finalize_decision(
                        t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                        "75", "", "R04: Tentatives PIN (3e échec, carte bloquée)",
                        "3e tentative PIN erronée consécutive -> Blocage sécuritaire", extra_meta
                    )
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "55", "", f"R05: PIN Incorrect (Incrémentation à {account['pin_tries']}/3)",
                    f"Code PIN erroné (Essai {account['pin_tries']}/3)", extra_meta
                )
            elif pin and account.get("pin") == pin:
                if account.get("pin_tries", 0) > 0:
                    account["pin_tries"] = 0
                    if self.persist_to_mysql:
                        self.db.persist_account(pan)

            # RÈGLE 6 (Priorité 6) : Conformité Devise (952 XOF exigé sauf si option internationale active)
            if currency != "952" and not account.get("international_enabled", False):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "58", "", "R06: Conformité Devise (952 exigé)",
                    f"Devise {currency} non autorisée (Carte nationale XOF 952)", extra_meta
                )

            # RÈGLE 7 (Priorité 7) : Plafond Unitaire par opération
            if amount > account.get("max_tx_limit", 300000):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "61", "", "R07: Plafond Unitaire Dépassé",
                    f"Montant {amount} FCFA > Plafond unitaire {account['max_tx_limit']} FCFA", extra_meta
                )

            # RÈGLE 8 (Priorité 8) : Plafond Journalier 24h & Plafond Sans-Contact NFC (071)
            if channel == "TPE" and pos_entry_mode == "071" and not pin:
                nfc_limit = account.get("contactless_limit", 15000)
                if amount > nfc_limit:
                    return self._finalize_decision(
                        t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                        "65", "", "R08-NFC: Seuil Sans-Contact Dépassé (Insertion Puce + PIN requise)",
                        f"Montant NFC {amount} FCFA > Seuil sans-contact {nfc_limit} FCFA", extra_meta
                    )

            if proc_code != "310000" and (account.get("daily_spent", 0) + amount > account.get("daily_ceiling", 1000000)):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "65", "", "R08: Plafond Journalier Atteint",
                    f"Cumul 24h ({account['daily_spent']} + {amount}) > Plafond {account['daily_ceiling']} FCFA", extra_meta
                )

            # RÈGLE 9 (Priorité 9) : Solde Disponible Comptable (sauf consultation solde 310000 ou remboursement 200000)
            if proc_code not in ("310000", "200000") and amount > account.get("balance", 0):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "51", "", "R09: Solde Disponible Insuffisant",
                    f"Montant {amount} FCFA > Solde disponible {account['balance']} FCFA", extra_meta
                )

            # RÈGLE 10 (Priorité 10) : Statut Administratif (SUSPENDED/FROZEN/WATCHLIST) & Droits par Canal
            if status == "WATCHLIST":
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "01", "", "R10-WCH: Carte sous Surveillance (Refer to Issuer)",
                    "Statut WATCHLIST : autorisation vocale centre monétique requise", extra_meta
                )

            if status in ["SUSPENDED", "FROZEN"]:
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "57", "", f"R10: Carte {status}",
                    f"Carte bloquée administrativement (Statut {status})", extra_meta
                )

            if channel == "GAB" and not account.get("channel_gab_enabled", True):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "57", "", "R10-GAB: Canal Retrait GAB Désactivé sur la Carte",
                    "Porteur non autorisé aux retraits GAB (channel_gab_enabled=False)", extra_meta
                )
            if channel == "TPE" and not account.get("channel_tpe_enabled", True):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "57", "", "R10-TPE: Canal Paiement TPE Désactivé (Carte Retrait Seul)",
                    "Carte restreinte aux GAB uniquement (channel_tpe_enabled=False)", extra_meta
                )
            if channel == "ECOM" and not account.get("channel_ecom_enabled", True):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "57", "", "R10-ECOM: Paiement En Ligne E-Commerce Verrouillé",
                    "Option E-Commerce désactivée par le porteur (channel_ecom_enabled=False)", extra_meta
                )

            # RÈGLE 11 (Priorité 11) : Règles Anti-Fraude, Vélocité & Fallback Piste Magnétique (DE 22 = 801)
            if pos_entry_mode == "801":
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "59", "", "R11-EMV: Fallback Piste Magnétique Interdit (DE 22 = 801)",
                    "Tentative de lecture piste magnétique sur carte EMV à puce active", extra_meta
                )

            if account.get("velocity_tx_1h", 0) >= account.get("velocity_max_1h", 50):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "59", "", "R11-VEL: Alerte Vélocité Anti-Fraude Dépassée",
                    f"Nombre max de transactions par heure atteint ({account['velocity_tx_1h']}/{account['velocity_max_1h']})",
                    extra_meta
                )

            # RÈGLE 12 (Priorité 12) : Contrôles Spécifiques E-Commerce (CVV2 & 3-D Secure)
            if channel == "ECOM":
                cvv_provided = de48_kv.get("CVV2") or de48_kv.get("CVC2")
                if cvv_provided and cvv_provided != str(account.get("cvv2", "123")):
                    return self._finalize_decision(
                        t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                        "05", "", "R12-CVV: Cryptogramme CVV2 E-Commerce Incorrect",
                        "Le code CVV2 saisi en ligne ne concorde pas avec celui de la carte", extra_meta
                    )
                tds_flag = de48_kv.get("3DS", "Y").upper()
                eci_val = de48_kv.get("ECI", "05")
                if (tds_flag == "N" or eci_val == "07" or not account.get("threeds_enrolled", True)) and amount > 25000:
                    return self._finalize_decision(
                        t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                        "05", "", "R12-3DS: Authentification Forte 3-D Secure Requise",
                        f"Transaction E-Commerce de {amount} FCFA sans 3-D Secure (ECI {eci_val}) refusée", extra_meta
                    )

            # RÈGLE 13 (Priorité 13) : Contrôles Spécifiques GAB (Consultation Solde, Coupures & Cassettes)
            if channel == "GAB":
                if proc_code == "310000":
                    # Consultation de solde sur GAB : aucun débit, renvoi du solde dans DE 54
                    auth_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
                    bal_str = str(account["balance"]).zfill(12)
                    extra_meta["de54_balance"] = f"0102952C{bal_str}"
                    return self._finalize_decision(
                        t0, timestamp, pan, 0, currency, stan, terminal_id, channel,
                        "00", auth_code, "GAB-BAL: Consultation de Solde GAB (DE 54)",
                        f"Consultation solde GAB approuvée. Solde disponible : {account['balance']:,} FCFA", extra_meta
                    )

                if proc_code == "010000":
                    gab_fault = chaos.get("gab_fault_mode", "NONE")
                    if gab_fault == "CASSETTE_EMPTY":
                        return self._finalize_decision(
                            t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                            "13", "", "R13-GAB: Cassettes GAB Épuisées (Indisponibilité Coupures)",
                            "Impossible de distribuer les billets : cassettes du GAB vides", extra_meta
                        )

                    can_dispense, notes_map, notes_desc = self.db.compute_atm_notes_dispense(
                        terminal_id, amount, commit=True
                    )
                    if not can_dispense:
                        return self._finalize_decision(
                            t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                            "13", "", "R13-GAB: Montant Non Multiple des Coupures GAB",
                            notes_desc, extra_meta
                        )
                    extra_meta["atm_notes"] = notes_map

            # Vérification de montant nul sur achat/retrait classique (hors test de charge ou consultation / changement PIN)
            if amount <= 0 and proc_code not in ("310000", "380000", "900000"):
                return self._finalize_decision(
                    t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                    "13", "", "R13-AMT: Montant Transaction Invalide (<= 0)",
                    "Montant nul non autorisé pour un achat ou retrait", extra_meta
                )

            # =========================================================================
            # GESTION DU TIME-OUT ÉMETTEUR (DE 39 = '68') + AUTO-REVERSAL 0400
            # =========================================================================
            if chaos.get("timeout_enabled"):
                delay_ms = float(chaos.get("timeout_delay_ms", 350))
                threshold_ms = float(chaos.get("sla_timeout_threshold_ms", 250))
                if delay_ms >= threshold_ms:
                    # Le Host débite tardivement, le Switch coupe en Time-out 68 et émet un Auto-Reversal 0400
                    account["balance"] -= amount
                    account["daily_spent"] += amount
                    late_auth = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
                    self.processed_transactions[tx_key] = {
                        "pan": pan, "amount": amount, "currency": currency,
                        "auth_code": late_auth, "stan": stan, "terminal_id": terminal_id,
                        "timestamp": timestamp, "status": "APPROVED", "channel": channel
                    }
                    if chaos.get("auto_reversal_on_timeout", True):
                        de90_auto = f"0200{stan.zfill(6)}{time.strftime('%m%d%H%M%S')}0000000000100000000001"
                        rev_code, rev_tx = self.process_reversal(de90_auto, reversal_amount=amount)
                        extra_meta["auto_reversal"] = {
                            "triggered": True,
                            "reason": "TIME_OUT_68_AUTO_REVERSAL",
                            "reversal_de39": rev_code,
                            "restored_amount": amount,
                        }
                    return self._finalize_decision(
                        t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                        "68", "", "R00-TMO: Time-out Émetteur Dépassé (DE 39 = 68 + Auto-0400)",
                        f"Latence Host ({delay_ms:.0f} ms) > Seuil SLA ({threshold_ms:.0f} ms) -> Reversal 0400 auto exécuté",
                        extra_meta
                    )

            # =========================================================================
            # APPROBATION FINANCIÈRE ATOMIQUE (DE 39 = '00')
            # =========================================================================
            mti_val = str(tx_data.get("mti", "0200")).strip()
            auth_rule_title = "APPROBATION (DE 39 = 00)"

            if mti_val in ("0100", "0120"):
                # Pré-autorisation : blocage provision / contrôle plafonds, mais pas de débit immédiat
                account["daily_spent"] += amount
                auth_rule_title = f"{mti_val}: Pré-Autorisation Validée (Provision bloquée sans débit)"
            elif proc_code == "200000":
                # Remboursement marchand TPE : crédit du compte
                account["balance"] += amount
                auth_rule_title = "200000: Remboursement Porteur Validé (+ Crédit)"
            elif proc_code == "900000":
                # Changement de Code PIN GAB
                new_pin_val = de48_kv.get("NEW_PIN") or tx_data.get("new_pin") or "5678"
                account["pin"] = str(new_pin_val).strip()
                account["pin_tries"] = 0
                auth_rule_title = f"900000: Changement Code PIN GAB Validé (Nouveau PIN: {account['pin']})"
            elif proc_code == "380000":
                # Mini-Relevé GAB
                bal_str = str(account["balance"]).zfill(12)
                extra_meta["de54_balance"] = f"0102952C{bal_str}"
                auth_rule_title = "380000: Mini-Relevé 5 Dernières Opérations Délivré"
            elif proc_code == "400000":
                # Virement compte à compte
                account["balance"] -= amount
                account["daily_spent"] += amount
                dest_pan = de48_kv.get("DEST_PAN") or "4000123456780002"
                dest_acc = self.db.get_account(dest_pan)
                if dest_acc:
                    dest_acc["balance"] += amount
                auth_rule_title = f"400000: Virement Vers {dest_pan[-4:]} Validé"
            elif proc_code == "500000":
                # Paiement Facture / Télécom
                account["balance"] -= amount
                account["daily_spent"] += amount
                auth_rule_title = "500000: Paiement Facture / Top-Up Approuvé"
            elif proc_code == "090000":
                # Achat avec Cashback
                cashback_amt = int(tx_data.get("cashback_amount") or de48_kv.get("CASHBACK", 5000))
                total_spent = amount + cashback_amt
                account["balance"] -= total_spent
                account["daily_spent"] += total_spent
                auth_rule_title = f"090000: Achat ({amount:,} F) + Cashback ({cashback_amt:,} F) Validé"
            else:
                account["balance"] -= amount
                account["daily_spent"] += amount
                if pos_entry_mode == "071":
                    account["contactless_spent"] = account.get("contactless_spent", 0) + amount

            if self.persist_to_mysql:
                self.db.persist_account(pan)

            auth_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

            self.processed_transactions[tx_key] = {
                "pan": pan,
                "amount": amount,
                "currency": currency,
                "auth_code": auth_code,
                "stan": stan,
                "terminal_id": terminal_id,
                "timestamp": timestamp,
                "status": "APPROVED",
                "channel": channel,
                "mti": mti_val,
                "proc_code": proc_code
            }

            # Simulation d'incident mécanique GAB post-autorisation (Bourrage billets ou Distribution partielle)
            gab_fault = chaos.get("gab_fault_mode", "NONE")
            if channel == "GAB" and proc_code == "010000" and gab_fault in ("CASH_JAM", "PARTIAL_DISPENSE"):
                de90_gab = f"0200{stan.zfill(6)}{time.strftime('%m%d%H%M%S')}0000000000100000000001"
                if gab_fault == "CASH_JAM":
                    rev_code, _ = self.process_reversal(de90_gab, reversal_amount=amount)
                    extra_meta["auto_reversal"] = {
                        "triggered": True,
                        "reason": "GAB_CASH_JAM_FULL_REVERSAL",
                        "reversal_de39": rev_code,
                        "dispensed_amount": 0,
                        "restored_amount": amount,
                    }
                    return self._finalize_decision(
                        t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                        "00", auth_code, "GAB-JAM: Approuvé 00 puis Bourrage Billets -> Auto-Reversal 0400 Total",
                        f"Bourrage billets GAB détecté : {amount:,} FCFA recrédités automatiquement via 0400",
                        extra_meta
                    )
                elif gab_fault == "PARTIAL_DISPENSE":
                    # Le GAB ne distribue qu'une partie (ex: 60% ou retrait de 2000/5000 F) et annule le reste
                    undispensed = max(2000, (amount // 2))
                    dispensed = amount - undispensed
                    rev_code, _ = self.process_reversal(de90_gab, reversal_amount=undispensed)
                    extra_meta["auto_reversal"] = {
                        "triggered": True,
                        "reason": "GAB_PARTIAL_DISPENSE_REVERSAL",
                        "reversal_de39": rev_code,
                        "dispensed_amount": dispensed,
                        "restored_amount": undispensed,
                    }
                    return self._finalize_decision(
                        t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                        "00", auth_code, "GAB-PARTIAL: Distribution Partielle -> Auto-Reversal 0400 Partiel",
                        f"Servi: {dispensed:,} FCFA | Non distribué recrédité par 0400: +{undispensed:,} FCFA",
                        extra_meta
                    )

            desc = f"[{channel}] Approuvé, débité de {amount:,} FCFA, Solde restant: {account['balance']:,} FCFA"
            if extra_meta.get("atm_notes"):
                notes_str = ", ".join(f"{v}x{k}" for k, v in extra_meta["atm_notes"].items() if v > 0)
                desc += f" (Coupures GAB : {notes_str})"

            return self._finalize_decision(
                t0, timestamp, pan, amount, currency, stan, terminal_id, channel,
                "00", auth_code, auth_rule_title, desc, extra_meta
            )

    def _finalize_decision(
        self,
        t0: float,
        timestamp: str,
        pan: str,
        amount: int,
        currency: str,
        stan: str,
        terminal_id: str,
        channel: str,
        code: str,
        auth_code: str,
        rule_triggered: str,
        description: str,
        extra_meta: Dict[str, Any],
    ) -> Tuple[str, str, str, Dict[str, Any]]:
        host_exec_ms = (time.perf_counter() - t0) * 1000
        breakdown = self.compute_latency_breakdown(channel, host_exec_ms)
        code_meta = DE_39_DESCRIPTIONS.get(code, {})
        extra_meta["latency_breakdown"] = breakdown
        extra_meta["runbook"] = {
            "code": code,
            "label": code_meta.get("label", "Code inconnu"),
            "category": code_meta.get("category", "AUTRE"),
            "severity": code_meta.get("severity", "INFO"),
            "failing_component": code_meta.get("failing_component", "HOST"),
            "root_cause": code_meta.get("root_cause", description),
            "steps": code_meta.get("runbook", []),
            "pci_dss_compliant": True,
        }

        self._record_audit(
            timestamp=timestamp,
            mti="0200",
            channel=channel,
            pan=pan,
            amount=amount,
            currency=currency,
            stan=stan,
            terminal_id=terminal_id,
            code=code,
            auth_code=auth_code,
            rule=rule_triggered,
            description=description,
            latency_breakdown=breakdown,
        )
        return code, auth_code, rule_triggered, extra_meta

    def process_reversal(
        self, de_90: str, reversal_amount: Optional[int] = None
    ) -> Tuple[str, Optional[dict]]:
        """
        Traite un message d'annulation 0400 (totale ou partielle) via l'analyse du champ DE 90.
        Rétablit le solde et ajuste le cumul consommé sur 24h.
        """
        de_90_clean = str(de_90).strip()
        if len(de_90_clean) < 10:
            return "25", None

        orig_mti = de_90_clean[:4]
        orig_stan = de_90_clean[4:10]

        with self._lock:
            for key, tx in list(self.processed_transactions.items()):
                if key.startswith(orig_stan) and tx.get("status") == "APPROVED":
                    pan = tx["pan"]
                    orig_amt = int(tx["amount"])
                    restored_amt = orig_amt
                    if reversal_amount is not None and 0 < int(reversal_amount) <= orig_amt:
                        restored_amt = int(reversal_amount)

                    account = self.db.get_raw_account(pan)
                    if account:
                        account["balance"] += restored_amt
                        account["daily_spent"] = max(0, account.get("daily_spent", 0) - restored_amt)
                        if self.persist_to_mysql:
                            self.db.persist_account(pan)

                    is_partial = restored_amt < orig_amt
                    tx["status"] = "PARTIALLY_REVERSED" if is_partial else "REVERSED"
                    tx["reversed_amount"] = restored_amt
                    tx["reversed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")

                    label_type = "Annulation Partielle 0400" if is_partial else "Annulation Totale 0400"
                    self._record_audit(
                        timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                        mti="0400",
                        channel=tx.get("channel", "TPE"),
                        pan=pan,
                        amount=restored_amt,
                        currency=tx.get("currency", "952"),
                        stan=orig_stan,
                        terminal_id=tx.get("terminal_id", ""),
                        code="00",
                        auth_code=tx.get("auth_code", ""),
                        rule="REVERSAL_PARTIAL" if is_partial else "REVERSAL",
                        description=f"{label_type} acceptée. Solde restitué : +{restored_amt:,} FCFA",
                    )
                    return "00", tx

            self._record_audit(
                timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                mti="0400",
                channel="TPE",
                pan="UNKNOWN",
                amount=0,
                currency="952",
                stan=orig_stan,
                terminal_id="",
                code="25",
                auth_code="",
                rule="REVERSAL_FAILED",
                description=f"Annulation 0400 rejetée : STAN original {orig_stan} introuvable ou déjà annulé",
            )
            return "25", None

    def _record_audit(
        self,
        timestamp: str,
        pan: str,
        amount: int,
        currency: str,
        stan: str,
        terminal_id: str,
        code: str,
        auth_code: str,
        rule: str,
        description: str,
        mti: str = "0200",
        channel: str = "TPE",
        latency_breakdown: Optional[dict] = None,
    ) -> dict:
        code_meta = DE_39_DESCRIPTIONS.get(code, {})
        masked = mask_pan(pan)
        bd = latency_breakdown or {"total_chain_ms": 1.5, "socket_rtt_ms": 1.5}
        entry = {
            "timestamp": timestamp,
            "mti": mti,
            "channel": channel,
            "masked_pan": masked,
            "amount": amount,
            "currency": currency,
            "stan": stan,
            "terminal_id": terminal_id,
            "code": code,
            "auth_code": auth_code,
            "rule": rule,
            "description": description,
            "status_label": code_meta.get("label", "Code inconnu"),
            "severity": code_meta.get("severity", "INFO"),
            "failing_component": code_meta.get("failing_component", "HOST"),
            "latency_total_ms": bd.get("total_chain_ms", 1.5),
            "latency_breakdown": bd,
            "runbook_steps": code_meta.get("runbook", []),
        }
        self.audit_history.append(entry)
        if len(self.audit_history) > 1000:
            self.audit_history.pop(0)

        if self.persist_to_mysql:
            mysql_manager.insert_audit_log(entry)
        return entry

    def get_audit_history(self, limit: int = 100) -> List[dict]:
        with self._lock:
            return list(reversed(self.audit_history[-limit:]))


# Instance singleton
decision_engine = DecisionEngine()
