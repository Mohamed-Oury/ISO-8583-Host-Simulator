"""
Gestion du Référentiel des 50 Comptes Bancaires, Cartes de Test et Parc de GAB (ATM).
Synchronisé avec la base de données relationnelle MySQL (payway_iso8583_simulator)
tout en maintenant un cache mémoire thread-safe ultra-rapide (< 1 ms) pour les tests à 100 TPS.
"""

import copy
import threading
from typing import Dict, Any, List, Optional, Tuple
from core.iso8583 import mask_pan
from core.mysql_db import mysql_manager


# Les 10 profils canoniques de référence de l'Étape 01 (TC-01 à TC-10)
INITIAL_10_ACCOUNTS = [
    {
        "pan": "4000123456780001",
        "cardholder_name": "AMADOU DIALLO",
        "card_product": "VISA PREMIER XOF",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "123",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 50,
        "notes": "Profil Nominal (Valide, Solde 500k, Plafond 300k/1M, 3DS Actif)"
    },
    {
        "pan": "4000123456780002",
        "cardholder_name": "FATOU NDIAYE",
        "card_product": "VISA CLASSIC XOF",
        "exp": "2401",
        "pin": "1234",
        "cvv2": "234",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "Carte Expirée (Exp 2401 -> Rejet DE 39 = 54)"
    },
    {
        "pan": "4000123456780003",
        "cardholder_name": "MOUSSA KONE",
        "card_product": "MASTERCARD GOLD",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "345",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "STOLEN",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "Carte Volée (Statut STOLEN -> Rejet DE 39 = 43 + Capture GAB)"
    },
    {
        "pan": "4000123456780004",
        "cardholder_name": "AISSATOU BAH",
        "card_product": "VISA CLASSIC XOF",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "456",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 3,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "Compteur PIN Saturé (3 tentatives -> Rejet DE 39 = 75)"
    },
    {
        "pan": "4000123456780005",
        "cardholder_name": "IBRAHIMA SOW",
        "card_product": "GIM-UEMOA RETRAIT",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "567",
        "balance": 2000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "Provision Faible (Solde 2 000 FCFA -> Rejet DE 39 = 51)"
    },
    {
        "pan": "4000123456780006",
        "cardholder_name": "MARIAMA TOURE",
        "card_product": "VISA ELECTRON",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "678",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 50000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "Plafond Unitaire Restreint (Max 50 000 FCFA -> Rejet DE 39 = 61)"
    },
    {
        "pan": "4000123456780007",
        "cardholder_name": "OUSMANE SYLLA",
        "card_product": "VISA CLASSIC XOF",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "789",
        "balance": 500000,
        "daily_spent": 980000,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "Plafond Journalier Presque Épuisé (980k / 1M -> Rejet DE 39 = 65)"
    },
    {
        "pan": "4000123456780008",
        "cardholder_name": "KADIATOU CAMARA",
        "card_product": "VISA CLASSIC XOF",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "890",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "SUSPENDED",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "Carte Suspendue Administrativement (Statut SUSPENDED -> Rejet 57)"
    },
    {
        "pan": "4000123456780009",
        "cardholder_name": "SEKOU TRAORE",
        "card_product": "MASTERCARD PLATINUM",
        "exp": "2812",
        "pin": "9999",
        "cvv2": "901",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "PIN Dédié 9999 (Test code secret personnalisé)"
    },
    {
        "pan": "4000123456780010",
        "cardholder_name": "AMINATA KEITA",
        "card_product": "VISA CLASSIC XOF",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "012",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "LOST",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "Carte Déclarée Perdue (Statut LOST -> Rejet DE 39 = 41)"
    },
]

# Profils UAT avancés (Cartes 0011 à 0016) pour cas réels d'exploitation bancaire
UAT_SPECIAL_ACCOUNTS = [
    {
        "pan": "4000123456780011",
        "cardholder_name": "CHEIKH FALL",
        "card_product": "CARTE E-COM BLOQUÉE",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "111",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": False,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "UAT: Paiement en ligne E-Commerce désactivé par le porteur (Rejet 57 sur ECOM)"
    },
    {
        "pan": "4000123456780012",
        "cardholder_name": "BINTA DIOP",
        "card_product": "CARTE RETRAIT GAB SEUL",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "222",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 0,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": False,
        "channel_ecom_enabled": False,
        "international_enabled": False,
        "threeds_enrolled": False,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "UAT: Carte Retrait GAB uniquement (Rejet 57 sur TPE et E-Commerce)"
    },
    {
        "pan": "4000123456780013",
        "cardholder_name": "MAMADOU BARRY",
        "card_product": "VISA CLASSIC XOF",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "333",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "CAPTURE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "UAT: Ordre de Capture GAB sans fraude (Statut CAPTURE -> DE 39 = 04)"
    },
    {
        "pan": "4000123456780014",
        "cardholder_name": "SALIMATA CISSE",
        "card_product": "VISA GOLD",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "444",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "WATCHLIST",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 0,
        "velocity_max_1h": 15,
        "notes": "UAT: Surveillance Émetteur / Refer to Card Issuer (Statut WATCHLIST -> DE 39 = 01)"
    },
    {
        "pan": "4000123456780015",
        "cardholder_name": "ABDOULAYE SANGARE",
        "card_product": "VISA CLASSIC XOF",
        "exp": "2812",
        "pin": "1234",
        "cvv2": "555",
        "balance": 500000,
        "daily_spent": 0,
        "daily_ceiling": 1000000,
        "max_tx_limit": 300000,
        "contactless_limit": 15000,
        "contactless_spent": 0,
        "pin_tries": 0,
        "status": "ACTIVE",
        "channel_gab_enabled": True,
        "channel_tpe_enabled": True,
        "channel_ecom_enabled": True,
        "international_enabled": False,
        "threeds_enrolled": True,
        "velocity_tx_1h": 15,
        "velocity_max_1h": 15,
        "notes": "UAT: Alerte Vélocité Anti-Fraude (15/15 tx en 1h -> Rejet DE 39 = 59)"
    },
]

INITIAL_ATM_TERMINALS = [
    {
        "terminal_id": "GAB00001",
        "name": "GAB Agence Principale Plateau",
        "location": "Dakar / Abidjan - Siège Central",
        "status": "ONLINE",
        "cassette_10000": 200,
        "cassette_5000": 300,
        "cassette_2000": 400,
        "fault_mode": "NONE"
    },
    {
        "terminal_id": "GAB00002",
        "name": "GAB Zone Commerciale Aéroport",
        "location": "Hall Arrivées Internationales",
        "status": "ONLINE",
        "cassette_10000": 150,
        "cassette_5000": 200,
        "cassette_2000": 0,
        "fault_mode": "NONE"
    },
    {
        "terminal_id": "GAB00003",
        "name": "GAB Hors-Site Université",
        "location": "Campus Universitaire",
        "status": "ONLINE",
        "cassette_10000": 0,
        "cassette_5000": 120,
        "cassette_2000": 250,
        "fault_mode": "NONE"
    },
]


def generate_50_reference_accounts() -> Dict[str, dict]:
    """
    Génère les 50 comptes de test :
    - Cartes 0001 à 0010 : Profils normatifs TC-01 à TC-10.
    - Cartes 0011 à 0015 : Profils UAT multi-canaux et anti-fraude.
    - Cartes 0016 à 0050 : Profils nominaux haute capacité pour campagnes de charge.
    """
    accounts: Dict[str, dict] = {}
    for acc in INITIAL_10_ACCOUNTS:
        item = copy.deepcopy(acc)
        item["masked_pan"] = mask_pan(item["pan"])
        accounts[item["pan"]] = item

    for acc in UAT_SPECIAL_ACCOUNTS:
        item = copy.deepcopy(acc)
        item["masked_pan"] = mask_pan(item["pan"])
        accounts[item["pan"]] = item

    for i in range(16, 51):
        pan = f"400012345678{i:04d}"
        accounts[pan] = {
            "pan": pan,
            "masked_pan": mask_pan(pan),
            "cardholder_name": f"PORTEUR NOMINAL #{i}",
            "card_product": "VISA CLASSIC XOF",
            "exp": "2812",
            "pin": "1234",
            "cvv2": f"{(100 + i) % 900 + 100:03d}",
            "balance": 500000,
            "daily_spent": 0,
            "daily_ceiling": 1000000,
            "max_tx_limit": 300000,
            "contactless_limit": 15000,
            "contactless_spent": 0,
            "pin_tries": 0,
            "status": "ACTIVE",
            "channel_gab_enabled": True,
            "channel_tpe_enabled": True,
            "channel_ecom_enabled": True,
            "international_enabled": (i % 5 == 0),
            "threeds_enrolled": True,
            "velocity_tx_1h": 0,
            "velocity_max_1h": 50,
            "notes": f"Carte Nominale #{i} (Multi-canal & Test de charge)"
        }

    return accounts


class AccountsDatabase:
    """
    Gestionnaire thread-safe du référentiel des 50 cartes et du parc de GAB (ATM),
    synchronisé en temps réel avec MySQL.
    """

    def __init__(self):
        self._lock = threading.RLock()
        self._accounts: Dict[str, dict] = {}
        self._atms: Dict[str, dict] = {}
        self.reset_to_default()

    def reset_to_default(self):
        """Réinitialise les 50 comptes et les GAB aux valeurs de référence et synchronise MySQL."""
        with self._lock:
            self._accounts = generate_50_reference_accounts()
            self._atms = {a["terminal_id"]: copy.deepcopy(a) for a in INITIAL_ATM_TERMINALS}
            mysql_manager.sync_accounts_to_mysql(list(self._accounts.values()))
            mysql_manager.sync_atms_to_mysql(list(self._atms.values()))

    def get_account(self, pan: str) -> Optional[dict]:
        with self._lock:
            acc = self._accounts.get(pan)
            if not acc:
                return None
            res = copy.deepcopy(acc)
            res["masked_pan"] = mask_pan(pan)
            return res

    def get_raw_account(self, pan: str) -> Optional[dict]:
        """Retourne la référence directe interne (pour le moteur de décision sous verrou)."""
        return self._accounts.get(pan)

    def persist_account(self, pan: str):
        """Persiste l'état courant du compte dans MySQL."""
        with self._lock:
            acc = self._accounts.get(pan)
            if acc:
                acc["masked_pan"] = mask_pan(pan)
                mysql_manager.update_single_account_mysql(acc)

    def exists(self, pan: str) -> bool:
        with self._lock:
            return pan in self._accounts

    def list_accounts(self) -> List[dict]:
        """Retourne la liste des 50 comptes avec masquage PCI-DSS."""
        with self._lock:
            result = []
            for pan in sorted(self._accounts.keys()):
                acc = copy.deepcopy(self._accounts[pan])
                acc["masked_pan"] = mask_pan(pan)
                result.append(acc)
            return result

    def create_account(self, data: dict) -> dict:
        """Crée ou remplace une carte/compte sur-mesure (cas réel de production) et la persiste dans MySQL."""
        with self._lock:
            pan = str(data.get("pan", "")).strip().replace(" ", "")
            if not pan.isdigit() or len(pan) < 12 or len(pan) > 19:
                raise ValueError("Le PAN doit contenir entre 12 et 19 chiffres numériques.")

            new_acc = {
                "pan": pan,
                "masked_pan": mask_pan(pan),
                "cardholder_name": str(data.get("cardholder_name") or "PORTEUR PROD SUR-MESURE").strip().upper(),
                "card_product": str(data.get("card_product") or "VISA PREMIER XOF").strip(),
                "exp": str(data.get("exp") or "2812").strip()[:4],
                "pin": str(data.get("pin") or "1234").strip()[:8],
                "cvv2": str(data.get("cvv2") or "123").strip()[:4],
                "balance": int(data.get("balance", 500000)),
                "daily_spent": int(data.get("daily_spent", 0)),
                "daily_ceiling": int(data.get("daily_ceiling", 1000000)),
                "max_tx_limit": int(data.get("max_tx_limit", 300000)),
                "contactless_limit": int(data.get("contactless_limit", 15000)),
                "contactless_spent": int(data.get("contactless_spent", 0)),
                "pin_tries": int(data.get("pin_tries", 0)),
                "status": str(data.get("status") or "ACTIVE").strip().upper(),
                "channel_gab_enabled": bool(data.get("channel_gab_enabled", data.get("allow_atm", True))),
                "channel_tpe_enabled": bool(data.get("channel_tpe_enabled", data.get("allow_pos", True))),
                "channel_ecom_enabled": bool(data.get("channel_ecom_enabled", data.get("allow_ecom", True))),
                "international_enabled": bool(data.get("international_enabled", data.get("allow_international", False))),
                "threeds_enrolled": bool(data.get("threeds_enrolled", True)),
                "velocity_tx_1h": int(data.get("velocity_tx_1h", data.get("tx_count_hour", 0))),
                "velocity_max_1h": int(data.get("velocity_max_1h", 15)),
                "notes": str(data.get("notes") or "Profil créé sur-mesure pour reproduction d'incident Prod / UAT"),
            }
            self._accounts[pan] = new_acc
            mysql_manager.sync_accounts_to_mysql([new_acc])
            return copy.deepcopy(new_acc)

    def update_account(self, pan: str, updates: dict) -> bool:
        with self._lock:
            if pan not in self._accounts:
                return False
            alias_map = {
                "allow_atm": "channel_gab_enabled",
                "allow_pos": "channel_tpe_enabled",
                "allow_ecom": "channel_ecom_enabled",
                "allow_international": "international_enabled",
                "tx_count_hour": "velocity_tx_1h",
            }
            for k, v in updates.items():
                if k != "pan" and v is not None:
                    canonical_key = alias_map.get(k, k)
                    self._accounts[pan][canonical_key] = v
            self._accounts[pan]["masked_pan"] = mask_pan(pan)
            mysql_manager.update_single_account_mysql(self._accounts[pan])
            return True

    def credit_balance(self, pan: str, amount: int) -> bool:
        with self._lock:
            if pan not in self._accounts:
                return False
            self._accounts[pan]["balance"] += amount
            mysql_manager.update_single_account_mysql(self._accounts[pan])
            return True

    def total_balance(self) -> int:
        with self._lock:
            return sum(acc["balance"] for acc in self._accounts.values())

    # --- GESTION DU PARC DE GAB (ATM) & CASSETTES DE BILLETS ---

    def list_atms(self) -> List[dict]:
        with self._lock:
            result = []
            for tid in sorted(self._atms.keys()):
                atm = copy.deepcopy(self._atms[tid])
                atm["total_cash"] = (
                    atm["cassette_10000"] * 10000
                    + atm["cassette_5000"] * 5000
                    + atm["cassette_2000"] * 2000
                )
                result.append(atm)
            return result

    def get_atm(self, terminal_id: str) -> dict:
        with self._lock:
            tid = terminal_id if terminal_id in self._atms else "GAB00001"
            return self._atms[tid]

    def update_atm(self, terminal_id: str, updates: dict) -> Optional[dict]:
        with self._lock:
            if terminal_id not in self._atms:
                return None
            for k, v in updates.items():
                if k != "terminal_id" and v is not None:
                    self._atms[terminal_id][k] = v
            mysql_manager.sync_atms_to_mysql([self._atms[terminal_id]])
            return copy.deepcopy(self._atms[terminal_id])

    def compute_atm_notes_dispense(
        self, terminal_id: str, amount: int, commit: bool = True
    ) -> Tuple[bool, Dict[str, int], str]:
        """
        Calcule la répartition optimale des billets sur les cassettes du GAB (10 000, 5 000, 2 000 FCFA).
        Retourne (succès, {"10000": n1, "5000": n2, "2000": n3}, message).
        """
        with self._lock:
            atm = self.get_atm(terminal_id)
            if amount <= 0 or amount % 1000 != 0:
                return False, {}, f"Montant {amount} FCFA non multiple des coupures GAB (2 000 / 5 000 / 10 000 FCFA)"

            avail_10k = atm["cassette_10000"]
            avail_5k = atm["cassette_5000"]
            avail_2k = atm["cassette_2000"]

            if avail_10k == 0 and avail_5k == 0 and avail_2k == 0:
                return False, {}, "Toutes les cassettes du GAB sont vides (Kassettes épuisées)"

            # Recherche gloutonne avec backtracking léger pour résoudre les combinaisons (ex: 6 000 = 3 x 2 000)
            max_n10 = min(amount // 10000, avail_10k)
            for n10 in range(max_n10, -1, -1):
                rem1 = amount - n10 * 10000
                max_n5 = min(rem1 // 5000, avail_5k)
                for n5 in range(max_n5, -1, -1):
                    rem2 = rem1 - n5 * 5000
                    if rem2 % 2000 == 0:
                        n2 = rem2 // 2000
                        if n2 <= avail_2k:
                            if commit:
                                atm["cassette_10000"] -= n10
                                atm["cassette_5000"] -= n5
                                atm["cassette_2000"] -= n2
                                mysql_manager.sync_atms_to_mysql([atm])
                            notes = {"10000": n10, "5000": n5, "2000": n2}
                            parts = []
                            if n10:
                                parts.append(f"{n10}x10000")
                            if n5:
                                parts.append(f"{n5}x5000")
                            if n2:
                                parts.append(f"{n2}x2000")
                            return True, notes, " + ".join(parts) + " FCFA"

            return False, {}, f"Impossible de composer {amount} FCFA avec les coupures restantes du GAB ({terminal_id})"


# Instance singleton partagée
accounts_db = AccountsDatabase()
