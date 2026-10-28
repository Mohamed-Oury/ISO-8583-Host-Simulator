"""
Passerelle Core Banking System (CBS) Mock & Grand Livre Comptable Monétique.
Gère les blocages de provision (Hold), les débits fermes, les levées d'opposition (Release),
et les écritures en partie double (Comptabilité Bancaire Temps Réel).
Conçu & Réalisé par M. Oury — Ingénieur IT Banking & Architecte Monétique - CBS.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from core.iso8583 import mask_pan


class CBSAccountingEngine:
    """
    Simulateur de Core Banking System (Sopra Amplitude / Temenos T24 / Oracle Flexcube mock).
    """

    def __init__(self):
        # Soldes initiaux des comptes du plan comptable de la banque (en FCFA)
        self.accounts: Dict[str, Dict[str, Any]] = {
            "1001-CLIENT-0001": {"name": "Compte Courant M. Oury", "type": "PASSIF", "balance": 1500000, "holds": 0},
            "1001-CLIENT-0002": {"name": "Compte Courant Entreprise", "type": "PASSIF", "balance": 8500000, "holds": 0},
            "1001-CLIENT-0003": {"name": "Compte Particulier", "type": "PASSIF", "balance": 450000, "holds": 0},
            "2001-CAISSE-GAB": {"name": "Encaisse Billets GAB Agence", "type": "ACTIF", "balance": 50000000, "holds": 0},
            "3001-ATTENTE-CLEARING": {"name": "Compte d'Attente Compensation GIM-UEMOA", "type": "TRANSIT", "balance": 0, "holds": 0},
            "4001-COMMISSION-INTERCHANGE": {"name": "Produit Commissions Monétiques", "type": "PRODUIT", "balance": 0, "holds": 0},
            "5001-MARCHAND-ACCEPTEUR": {"name": "Compte Commerçant Carrefour", "type": "PASSIF", "balance": 12000000, "holds": 0},
        }

        # Grand Livre des écritures comptables
        self.ledger_entries: List[Dict[str, Any]] = [
            {
                "entry_id": "ECR-000001",
                "timestamp": "2026-10-28 08:00:00",
                "label": "Alimentation Caisse GAB par Transporteur de Fonds",
                "debit_account": "2001-CAISSE-GAB",
                "credit_account": "3001-ATTENTE-CLEARING",
                "amount": 25000000,
                "stan": "000000",
                "status": "COMPTABILISE"
            }
        ]

    def get_accounts(self) -> List[Dict[str, Any]]:
        res = []
        for acc_id, d in self.accounts.items():
            avail = d["balance"] - d["holds"]
            res.append({
                "account_id": acc_id,
                "name": d["name"],
                "type": d["type"],
                "accounting_balance": d["balance"],
                "holds": d["holds"],
                "available_balance": avail
            })
        return res

    def get_ledger(self) -> List[Dict[str, Any]]:
        return self.ledger_entries

    def process_hold(self, account_id: str, amount: int, stan: str) -> Dict[str, Any]:
        """Place un blocage de provision sur le compte (Pré-autorisation 0100)."""
        acc = self.accounts.get(account_id, self.accounts["1001-CLIENT-0001"])
        if (acc["balance"] - acc["holds"]) < amount:
            return {"success": False, "error": "Solde disponible insuffisant pour blocage (DE 39 = 51)"}

        acc["holds"] += amount
        return {
            "success": True,
            "operation": "HOLD_RESERVATION",
            "account_id": account_id,
            "amount": amount,
            "stan": stan,
            "new_holds": acc["holds"],
            "new_available": acc["balance"] - acc["holds"]
        }

    def process_debit(self, account_id: str, amount: int, channel: str, stan: str) -> Dict[str, Any]:
        """Débit ferme du compte client avec écriture en partie double (Achat ou Retrait 0200)."""
        acc = self.accounts.get(account_id, self.accounts["1001-CLIENT-0001"])
        avail = acc["balance"] - acc["holds"]
        if avail < amount:
            return {"success": False, "error": "Solde disponible insuffisant (DE 39 = 51)"}

        # Débit compte client
        acc["balance"] -= amount

        # Contrepartie selon le canal
        credit_acc = "2001-CAISSE-GAB" if channel == "GAB" else "3001-ATTENTE-CLEARING"
        if credit_acc == "2001-CAISSE-GAB":
            self.accounts["2001-CAISSE-GAB"]["balance"] -= amount  # Sortie physique billets
        else:
            self.accounts["3001-ATTENTE-CLEARING"]["balance"] += amount

        entry_id = f"ECR-{len(self.ledger_entries) + 1:06d}"
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        entry = {
            "entry_id": entry_id,
            "timestamp": now_str,
            "label": f"Débit Monétique Carte ({channel} - MTI 0200)",
            "debit_account": account_id,
            "credit_account": credit_acc,
            "amount": amount,
            "stan": stan,
            "status": "COMPTABILISE"
        }
        self.ledger_entries.insert(0, entry)

        return {
            "success": True,
            "entry": entry,
            "new_client_balance": acc["balance"],
            "new_client_available": acc["balance"] - acc["holds"]
        }

    def process_reversal(self, account_id: str, amount: int, stan: str) -> Dict[str, Any]:
        """Annulation comptable / Réintégration de fonds suite à un Reversal (0400 / 0420)."""
        acc = self.accounts.get(account_id, self.accounts["1001-CLIENT-0001"])
        acc["balance"] += amount

        entry_id = f"ECR-{len(self.ledger_entries) + 1:06d}"
        now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        entry = {
            "entry_id": entry_id,
            "timestamp": now_str,
            "label": f"Contrepassation Annulation Monétique (Reversal MTI 0420)",
            "debit_account": "3001-ATTENTE-CLEARING",
            "credit_account": account_id,
            "amount": amount,
            "stan": stan,
            "status": "CONTREPASSE"
        }
        self.ledger_entries.insert(0, entry)

        return {
            "success": True,
            "entry": entry,
            "new_client_balance": acc["balance"]
        }


cbs_engine = CBSAccountingEngine()
