"""
Module de Gestion des Profils Réseaux Multi-Dialectes (GIM-UEMOA, VISA Base I, Mastercard CIS/MIP).
Permet d'adapter dynamiquement la syntaxe, les sous-champs obligatoires et les règles de conformité.
Conçu & Réalisé par M. Oury — Ingénieur IT Banking & Architecte Monétique - CBS.
"""

from typing import Dict, Any, List, Optional
from core.iso8583 import ISO8583Message


NETWORK_PROFILES: Dict[str, Dict[str, Any]] = {
    "GIM_UEMOA": {
        "id": "GIM_UEMOA",
        "name": "GIM-UEMOA (Groupement Interbancaire Monétique de l'UEMOA)",
        "region": "Afrique de l'Ouest (8 pays)",
        "currency_default": "952",
        "currency_name": "Franc CFA (XOF)",
        "standard_mti": ["0100", "0110", "0200", "0210", "0420", "0430", "0800", "0810"],
        "mandatory_fields_0200": [2, 3, 4, 7, 11, 12, 13, 14, 18, 22, 25, 32, 41, 42, 49],
        "de48_format": "SOUS_CHAMPS_UEMOA (Format TAG-LONGUEUR ou CLE=VALEUR)",
        "acquirer_institution_de32_length": 6,
        "rules_description": "Conforme aux spécifications du Switch GIM-UEMOA v3.2. Devise 952 obligatoire. DE 32 doit identifier l'établissement financier membre."
    },
    "VISA_BASE_I": {
        "id": "VISA_BASE_I",
        "name": "VISA International (Base I / SMS - Single Message System)",
        "region": "Mondial / Cross-Border",
        "currency_default": "840",
        "currency_name": "USD / Multi-Devises",
        "standard_mti": ["0100", "0110", "0200", "0210", "0420", "0800"],
        "mandatory_fields_0200": [2, 3, 4, 7, 11, 14, 18, 22, 25, 41, 42, 49, 62, 63],
        "de48_format": "VISA_SMS_ADDITIONAL_DATA (ECI, CAVV, CVV2)",
        "acquirer_institution_de32_length": 6,
        "rules_description": "Conforme aux spécifications VISA Base I. DE 62 (Custom Payment Service) et DE 63 (Network Reference Number) obligatoires."
    },
    "MASTERCARD_CIS": {
        "id": "MASTERCARD_CIS",
        "name": "Mastercard Worldwide (CIS / MIP - Customer Interface System)",
        "region": "Mondial / Cross-Border",
        "currency_default": "978",
        "currency_name": "EUR / USD / Multi-Devises",
        "standard_mti": ["0100", "0110", "0200", "0210", "0420", "0800"],
        "mandatory_fields_0200": [2, 3, 4, 7, 11, 12, 14, 18, 22, 41, 42, 48, 49],
        "de48_format": "MASTERCARD_PDS (Private Data Sub-elements 4 cars tag)",
        "acquirer_institution_de32_length": 6,
        "rules_description": "Conforme aux spécifications Mastercard CIS. DE 48 doit contenir des conteneurs PDS (ex: PDS 0002, PDS 0023)."
    },
    "DOMESTIC_PRIVATIF": {
        "id": "DOMESTIC_PRIVATIF",
        "name": "Switch Domestique / Réseau Bancaire Privatif",
        "region": "National / Closed-Loop",
        "currency_default": "952",
        "currency_name": "XOF / Local",
        "standard_mti": ["0200", "0210", "0400", "0800"],
        "mandatory_fields_0200": [2, 3, 4, 11, 41, 49],
        "de48_format": "LIBRE",
        "acquirer_institution_de32_length": 4,
        "rules_description": "Profil allégé pour terminaux propriétaires en boucle fermée sans switch international."
    }
}


class NetworkProfileValidator:
    """
    Validateur de conformité syntaxique selon le profil de réseau sélectionné.
    """

    @staticmethod
    def list_profiles() -> List[Dict[str, Any]]:
        return list(NETWORK_PROFILES.values())

    @staticmethod
    def get_profile(profile_id: str) -> Dict[str, Any]:
        return NETWORK_PROFILES.get(profile_id.upper(), NETWORK_PROFILES["GIM_UEMOA"])

    @staticmethod
    def validate_message_against_profile(msg: ISO8583Message, profile_id: str = "GIM_UEMOA") -> Dict[str, Any]:
        """
        Valide un message ISO 8583 par rapport aux exigences du profil réseau sélectionné.
        """
        prof = NetworkProfileValidator.get_profile(profile_id)
        anomalies: List[str] = []
        warnings: List[str] = []
        checks_passed: List[str] = []

        mti = msg.mti
        active_fields = list(msg.fields.keys())

        # 1. Vérification MTI supporté
        if mti in prof["standard_mti"]:
            checks_passed.append(f"MTI {mti} supporté par le réseau {prof['name']}.")
        else:
            anomalies.append(f"MTI {mti} non standard ou non autorisé dans le profil {prof['id']}.")

        # 2. Vérification des champs obligatoires pour 0200
        if mti == "0200":
            for req_field in prof["mandatory_fields_0200"]:
                if req_field in active_fields:
                    checks_passed.append(f"Champ obligatoire DE {req_field} présent.")
                else:
                    anomalies.append(f"Champ obligatoire DE {req_field} manquant pour le réseau {prof['id']}.")

        # 3. Vérification de la devise (DE 49)
        currency_val = msg.get_field(49, "")
        if profile_id == "GIM_UEMOA":
            if currency_val != "952":
                warnings.append(f"Devise DE 49 = '{currency_val}' différente de la devise standard UEMOA (952 XOF).")
            else:
                checks_passed.append("Devise DE 49 = 952 (XOF) conforme GIM-UEMOA.")

        # 4. Vérification spécifique DE 48
        if 48 in active_fields:
            de48_val = msg.fields[48]
            if profile_id == "MASTERCARD_CIS" and not any(tag in de48_val for tag in ["PDS", "0002", "0023"]):
                warnings.append("Le champ DE 48 ne semble pas contenir de conteneurs PDS standard Mastercard.")
            else:
                checks_passed.append(f"Champ DE 48 présent et inspecté sous le format {prof['de48_format']}.")

        is_compliant = len(anomalies) == 0

        return {
            "profile_id": prof["id"],
            "profile_name": prof["name"],
            "is_compliant": is_compliant,
            "verdict": "CONFORME AUX SPÉCIFICATIONS" if is_compliant else "NON CONFORME (ÉLÉMENTS MANQUANTS)",
            "anomalies_count": len(anomalies),
            "warnings_count": len(warnings),
            "anomalies": anomalies,
            "warnings": warnings,
            "checks_passed": checks_passed
        }


network_validator = NetworkProfileValidator()
