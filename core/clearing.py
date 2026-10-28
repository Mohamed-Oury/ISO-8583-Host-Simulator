"""
Module de Télécompensation & Rapprochement Interbancaire (Clearing & Settlement)
Générateur de Fichiers de Compensation conformes aux normes GIM-UEMOA, BASE II (Visa)
et Fichier Pivot Core Banking (Amplitude / Orion / Delta Bank).
"""

import os
import json
import datetime
from typing import Dict, Any, List, Optional


CLEARING_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".data", "clearing")
os.makedirs(CLEARING_DIR, exist_ok=True)


class ClearingEngine:
    """Moteur de compensation, de calcul d'interchange et de génération de fichiers comptables."""

    # Paramètres d'interchange standard (GIM-UEMOA / Zone UEMOA)
    DEFAULT_ATM_INTERCHANGE_FEE = 350  # Fixe 350 XOF par retrait GAB déplacé
    DEFAULT_POS_INTERCHANGE_RATE = 0.008  # 0.8% commission commerçant TPE
    DEFAULT_ECOM_INTERCHANGE_RATE = 0.012  # 1.2% commission e-commerce 3DS

    @staticmethod
    def calculate_interchange(channel: str, amount: int) -> int:
        """Calcule la commission d'interchange selon le canal."""
        channel_upper = (channel or "TPE").upper()
        if "GAB" in channel_upper or "ATM" in channel_upper:
            return ClearingEngine.DEFAULT_ATM_INTERCHANGE_FEE
        elif "ECOM" in channel_upper or "WEB" in channel_upper:
            return int(amount * ClearingEngine.DEFAULT_ECOM_INTERCHANGE_RATE)
        else:
            return int(amount * ClearingEngine.DEFAULT_POS_INTERCHANGE_RATE)

    @classmethod
    def generate_clearing_batch(
        cls,
        transactions: List[Dict[str, Any]],
        format_type: str = "GIM_UEMOA",
        bank_code: str = "CI099",
        batch_seq: int = 1,
    ) -> Dict[str, Any]:
        """
        Génère un lot de compensation complet à partir d'une liste de transactions autorisées.
        Formats supportés : 'GIM_UEMOA', 'CORE_BANKING_PIVOT', 'BASE_II_SIM'
        """
        now = datetime.datetime.now()
        date_str = now.strftime("%Y%m%d")
        time_str = now.strftime("%H%M%S")
        batch_id = f"CLR-{date_str}-{batch_seq:04d}"

        # Filtrer uniquement les transactions approuvées (DE39 = '00')
        settled_txs: List[Dict[str, Any]] = []
        total_debit_amount = 0
        total_credit_amount = 0
        total_interchange_fees = 0

        for tx in transactions:
            de39 = str(tx.get("response_code") or tx.get("de39") or "00")
            # Seules les transactions approuvées entrent en compensation financière
            if de39 not in ("00", "0"):
                continue

            amt = int(tx.get("amount") or 0)
            channel = str(tx.get("channel") or "TPE")
            interchange = cls.calculate_interchange(channel, amt)
            total_interchange_fees += interchange

            pan = str(tx.get("pan") or "4000123456780001")
            masked_pan = pan[:6] + "*" * (len(pan) - 10) + pan[-4:]

            mti = str(tx.get("mti") or "0200")
            is_credit = mti in ("0420", "0400", "0220")  # Reversal ou remboursement

            if is_credit:
                total_credit_amount += amt
            else:
                total_debit_amount += amt

            record = {
                "stan": tx.get("stan", "000001"),
                "channel": channel,
                "mti": mti,
                "pan_masked": masked_pan,
                "amount": amt,
                "currency": "952",
                "interchange_fee": interchange,
                "net_settlement_amount": amt - interchange if not is_credit else amt + interchange,
                "terminal_id": tx.get("terminal_id", "TERM0001"),
                "merchant_id": tx.get("merchant_id", "MERCHANT0000001"),
                "auth_code": tx.get("auth_code", "AUT001"),
                "date": tx.get("timestamp", now.isoformat()),
            }
            settled_txs.append(record)

        net_settlement_position = total_debit_amount - total_credit_amount

        # Construction du fichier selon le format
        if format_type == "CORE_BANKING_PIVOT":
            content, filename = cls._format_core_banking_pivot(
                bank_code, batch_id, date_str, settled_txs, total_debit_amount, total_credit_amount
            )
        elif format_type == "BASE_II_SIM":
            content, filename = cls._format_base_ii(
                bank_code, batch_id, date_str, settled_txs, total_debit_amount, total_credit_amount
            )
        else:  # GIM_UEMOA par défaut
            content, filename = cls._format_gim_uemoa(
                bank_code, batch_id, date_str, time_str, settled_txs, total_debit_amount, total_credit_amount, total_interchange_fees
            )

        # Enregistrement du fichier physique
        file_path = os.path.join(CLEARING_DIR, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

        summary = {
            "batch_id": batch_id,
            "filename": filename,
            "file_path": file_path,
            "format": format_type,
            "bank_code": bank_code,
            "created_at": now.isoformat(),
            "transaction_count": len(settled_txs),
            "total_debit_amount": total_debit_amount,
            "total_credit_amount": total_credit_amount,
            "net_position": net_settlement_position,
            "total_interchange_fees": total_interchange_fees,
            "records": settled_txs,
            "file_preview": content[:1200] + ("..." if len(content) > 1200 else ""),
        }

        # Sauvegarder le metadata JSON du batch
        meta_path = os.path.join(CLEARING_DIR, f"{batch_id}.json")
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)

        return summary

    @staticmethod
    def _format_gim_uemoa(
        bank_code: str,
        batch_id: str,
        date_str: str,
        time_str: str,
        records: List[Dict[str, Any]],
        total_debit: int,
        total_credit: int,
        total_interchange: int,
    ) -> (str, str):
        """Format de télécompensation normalisé GIM-UEMOA (Champs à largeur fixe)."""
        lines = []
        # Header En-tête : H + Code Banque + Date + Heure + Batch ID
        header = f"H|GIM-UEMOA|{bank_code}|{date_str}|{time_str}|{batch_id}|DEV=952"
        lines.append(header)

        # Enregistrements détaillés : D + STAN + Canal + MTI + PAN + Montant + Interchange + TID + Date
        for r in records:
            line = (
                f"D|{r['stan']:>06}|{r['channel']:<4}|{r['mti']:<4}|"
                f"{r['pan_masked']:<19}|{r['amount']:>012}|{r['interchange_fee']:>06}|"
                f"{r['auth_code']:<6}|{r['terminal_id']:<8}|{r['merchant_id']:<15}"
            )
            lines.append(line)

        # Trailer Fin de Lot : T + Nombre transactions + Total Débit + Total Crédit + Total Interchange
        trailer = (
            f"T|{batch_id}|COUNT={len(records):>06}|DEBIT={total_debit:>014}|"
            f"CREDIT={total_credit:>014}|INTERCHANGE={total_interchange:>010}"
        )
        lines.append(trailer)

        filename = f"GIM_CLEARING_{bank_code}_{date_str}_{batch_id}.txt"
        return "\n".join(lines), filename

    @staticmethod
    def _format_core_banking_pivot(
        bank_code: str,
        batch_id: str,
        date_str: str,
        records: List[Dict[str, Any]],
        total_debit: int,
        total_credit: int,
    ) -> (str, str):
        """Fichier Pivot Core Banking (CSV normé avec colonnes comptables)."""
        lines = [
            "COMPTE_SOURCE;COMPTE_DESTINATION;DATE_VALEUR;MONTANT_XOF;SENS;CANAL;REFERENCE_STAN;NUM_AUTORISATION;LIBELLE_ECRITURE"
        ]
        for r in records:
            # Écriture comptable client -> compte d'attente compensation
            sens = "D" if r["mti"] != "0420" else "C"
            acc_source = f"{bank_code}37110001"  # Compte d'attente compensation GIM
            acc_dest = f"{bank_code}25110042"    # Compte porteur
            lines.append(
                f"{acc_source};{acc_dest};{date_str};{r['amount']};{sens};{r['channel']};"
                f"{r['stan']};{r['auth_code']};PAIEMENT MONETIQUE {r['channel']} {r['pan_masked']}"
            )

        filename = f"CORE_BANKING_PIVOT_{bank_code}_{date_str}_{batch_id}.csv"
        return "\n".join(lines), filename

    @staticmethod
    def _format_base_ii(
        bank_code: str,
        batch_id: str,
        date_str: str,
        records: List[Dict[str, Any]],
        total_debit: int,
        total_credit: int,
    ) -> (str, str):
        """Simulation de format Visa BASE II (TCR 0 & TCR 1)."""
        lines = []
        lines.append(f"TCR0|VISA-BASE-II|{bank_code}|{date_str}|{batch_id}|REG=CEMEA")
        for idx, r in enumerate(records, 1):
            lines.append(
                f"TCR1|{idx:>04}|{r['pan_masked']}|{r['amount']:>012}|952|{r['auth_code']}|"
                f"{r['terminal_id']}|{r['interchange_fee']:>06}"
            )
        lines.append(f"TCR9|END_OF_BATCH|{len(records):>06}|DEBIT={total_debit}|CREDIT={total_credit}")

        filename = f"VISA_BASE2_SIM_{bank_code}_{date_str}_{batch_id}.txt"
        return "\n".join(lines), filename

    @classmethod
    def list_batches(cls) -> List[Dict[str, Any]]:
        """Liste tous les fichiers de compensation générés."""
        batches = []
        if not os.path.exists(CLEARING_DIR):
            return batches

        for fname in sorted(os.listdir(CLEARING_DIR), reverse=True):
            if fname.endswith(".json"):
                try:
                    fpath = os.path.join(CLEARING_DIR, fname)
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        batches.append(data)
                except Exception:
                    pass
        return batches
