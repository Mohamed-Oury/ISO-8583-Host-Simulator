"""
Module de manipulation, encodage et décodage de trames ISO 8583 (Multi-Canal : GAB, TPE, E-Commerce).
Conforme aux spécifications du serveur d'autorisation, aux exigences d'exploitation bancaire
et à la norme PCI-DSS v4.0 (masquage PAN 6/4, protection PIN Block et CVV2).
"""

import re
import struct
import time
from typing import Dict, Any, Tuple, Optional


def mask_pan(pan: str) -> str:
    """
    Règle PCI-DSS v4.0 : Afficher uniquement les 6 premiers (BIN) et 4 derniers chiffres.
    Exemple : 4000123456780001 -> 400012******0001
    """
    if not pan:
        return "****************"
    pan_str = str(pan).strip()
    if len(pan_str) < 10:
        return "*" * len(pan_str)
    masked_middle = "*" * (len(pan_str) - 10)
    return f"{pan_str[:6]}{masked_middle}{pan_str[-4:]}"


def mask_sensitive_de48(de48_str: str) -> str:
    """
    Masque le CVV2/CVC2 ou OTP dans le champ privé DE 48 pour la conformité PCI-DSS.
    Exemple : CVV2=123;3DS=Y;ECI=05 -> CVV2=***;3DS=Y;ECI=05
    """
    if not de48_str:
        return ""
    masked = re.sub(r"(CVV2|CVC2|CVV)=([^;]+)", r"\1=***", str(de48_str), flags=re.IGNORECASE)
    return masked


# Définition descriptive étendue des Data Elements (DE) ISO 8583:1987
DE_DEFINITIONS = {
    2: {"name": "Primary Account Number (PAN)", "type": "LLVAR", "max_len": 19},
    3: {"name": "Processing Code (Nature Opération)", "type": "FIXED", "len": 6},
    4: {"name": "Amount, Transaction (Montant)", "type": "FIXED", "len": 12},
    7: {"name": "Transmission Date & Time (MMDDhhmmss)", "type": "FIXED", "len": 10},
    11: {"name": "Systems Trace Audit Number (STAN)", "type": "FIXED", "len": 6},
    12: {"name": "Time, Local Transaction (hhmmss)", "type": "FIXED", "len": 6},
    13: {"name": "Date, Local Transaction (YYMM)", "type": "FIXED", "len": 4},
    14: {"name": "Date, Expiration (YYMM)", "type": "FIXED", "len": 4},
    18: {"name": "Merchant Category Code (MCC)", "type": "FIXED", "len": 4},
    22: {"name": "Point of Service Entry Mode (Mode Lecture)", "type": "FIXED", "len": 3},
    25: {"name": "Point of Service Condition Code (Canal)", "type": "FIXED", "len": 2},
    32: {"name": "Acquiring Institution ID Code", "type": "LLVAR", "max_len": 11},
    37: {"name": "Retrieval Reference Number (RRN)", "type": "FIXED", "len": 12},
    38: {"name": "Authorization Identification Response", "type": "FIXED", "len": 6},
    39: {"name": "Action Code / Response Code", "type": "FIXED", "len": 2},
    41: {"name": "Card Acceptor Terminal Identification (TID)", "type": "FIXED", "len": 8},
    42: {"name": "Card Acceptor Identification Code (MID)", "type": "FIXED", "len": 15},
    43: {"name": "Card Acceptor Name / Location", "type": "FIXED", "len": 40},
    48: {"name": "Additional Data - Private (3DS / CVV2 / Canal)", "type": "LLLVAR", "max_len": 999},
    49: {"name": "Currency Code, Transaction", "type": "FIXED", "len": 3},
    52: {"name": "Personal Identification Number (PIN) Block", "type": "FIXED", "len": 16},
    54: {"name": "Additional Amounts (Solde GAB / Disponible)", "type": "LLLVAR", "max_len": 120},
    55: {"name": "ICC System Related Data (EMV TLV / ARQC)", "type": "LLLVAR", "max_len": 255},
    64: {"name": "Message Authentication Code (MAC)", "type": "FIXED", "len": 16},
    70: {"name": "Network Management Information Code", "type": "FIXED", "len": 3},
    90: {"name": "Original Data Elements (Reversal Reference)", "type": "FIXED", "len": 42},
}

# Référentiel complet des codes de réponse ISO 8583 (DE 39) & Runbooks Exploitant Monétique
DE_39_DESCRIPTIONS: Dict[str, Dict[str, Any]] = {
    "00": {
        "label": "Approuvé / Approved",
        "status": "APPROVED",
        "category": "NOMINAL",
        "severity": "INFO",
        "failing_component": "AUCUN (Chaîne Nominale)",
        "action": "Succès - Transaction acceptée et comptabilisée",
        "root_cause": "Tous les contrôles de sécurité, limites, solde et cryptographie ont réussi.",
        "runbook": [
            "Aucune action corrective requise.",
            "Vérifier l'émission du code d'autorisation DE 38 et l'écriture dans le journal de compensation."
        ]
    },
    "01": {
        "label": "Contacter l'Émetteur / Refer to Card Issuer",
        "status": "REJECTED",
        "category": "FRAUDE_SECURITE",
        "severity": "WARNING",
        "failing_component": "MOTEUR ANTI-FRAUDE / HOST",
        "action": "Refus avec demande d'appel vocal au centre d'autorisation",
        "root_cause": "Carte placée sous surveillance préventive (statut WATCHLIST) ou profil atypique.",
        "runbook": [
            "Vérifier l'identité du porteur si appel entrant au Call Center Monétique.",
            "Consulter l'historique des transactions récentes du PAN masqué.",
            "Lever le statut WATCHLIST dans l'explorateur de cartes après validation client."
        ]
    },
    "04": {
        "label": "Capturer la Carte / Pick-up Card (No Fraud)",
        "status": "REJECTED",
        "category": "FRAUDE_SECURITE",
        "severity": "HIGH",
        "failing_component": "HOST ÉMETTEUR -> TERMINAL GAB",
        "action": "Capture physique immédiate de la carte dans l'avaloir du GAB",
        "root_cause": "Instruction administrative de rétention physique de la carte (statut CAPTURE).",
        "runbook": [
            "Confirmer la capture carte dans le journal électronique du GAB (EJ Log).",
            "Informer l'agence bancaire de rattachement pour récupération par le porteur."
        ]
    },
    "05": {
        "label": "Ne Pas Honorer / Do Not Honor",
        "status": "REJECTED",
        "category": "POLITIQUE_EMETTEUR",
        "severity": "WARNING",
        "failing_component": "MOTEUR DE RÈGLES ÉMETTEUR / ACS 3DS",
        "action": "Refus générique de la banque émettrice (CVV2 erroné ou 3-D Secure absent)",
        "root_cause": "Échec de vérification CVV2/CVC2 en ligne, absence d'authentification forte 3-D Secure (ECI 07) sur montant élevé, ou refus politique interne.",
        "runbook": [
            "Inspecter le champ DE 48 pour vérifier le statut 3DS (Y/N, ECI) et la présence du CVV2.",
            "Vérifier si le porteur est bien enrôlé 3-D Secure (ACS).",
            "Inviter le porteur à réessayer sur un marchand compatible 3DS v2.2."
        ]
    },
    "12": {
        "label": "Transaction Invalide / Invalid Transaction",
        "status": "REJECTED",
        "category": "PROTOCOLE_TERMINAL",
        "severity": "WARNING",
        "failing_component": "SWITCH / ROUTEUR MONÉTIQUE",
        "action": "Rejet immédiat - Code traitement DE 3 non supporté sur ce canal",
        "root_cause": "Combinaison incohérente entre le Processing Code (DE 3) et le type de terminal (DE 25 / DE 18).",
        "runbook": [
            "Vérifier le paramétrage du terminal (TPE/GAB) : DE 3, DE 18 (MCC) et DE 25.",
            "Exemple : tentative de retrait espèces (DE 3 = 010000) sur un TPE standard sans option Cashback."
        ]
    },
    "13": {
        "label": "Montant Invalide / Invalid Amount",
        "status": "REJECTED",
        "category": "METIER_CANAL",
        "severity": "WARNING",
        "failing_component": "CONTRÔLEUR GAB / MOTEUR MÉTIER",
        "action": "Refus - Montant nul ou non multiple des coupures GAB disponibles",
        "root_cause": "Montant <= 0 FCFA, ou retrait GAB dont le montant ne peut pas être composé par les cassettes actives (10 000, 5 000, 2 000 FCFA).",
        "runbook": [
            "Vérifier l'état des cassettes du GAB (stock de coupures 2 000 / 5 000 / 10 000 FCFA).",
            "Si une cassette est vide, recharger la cassette ou orienter vers un montant multiple des coupures restantes."
        ]
    },
    "14": {
        "label": "Carte Inconnue / No Such Card",
        "status": "REJECTED",
        "category": "REFERENTIEL",
        "severity": "WARNING",
        "failing_component": "RÉFÉRENTIEL CARTES (CMS / DB)",
        "action": "Refus immédiat (PAN inexistant dans le référentiel émetteur)",
        "root_cause": "Le numéro de carte (DE 2) n'est pas présent dans la table des porteurs de l'émetteur.",
        "runbook": [
            "Vérifier la table de routage des BINs sur le Switch.",
            "Contrôler si le lot de production de nouvelles cartes (CMS) a bien été synchronisé dans la base Host."
        ]
    },
    "25": {
        "label": "Transaction Originale Introuvable / Unable to Locate Record",
        "status": "REJECTED",
        "category": "REVERSAL_COMPENSATION",
        "severity": "HIGH",
        "failing_component": "MOTEUR D'ANNULATION (REVERSAL 0400)",
        "action": "Échec d'annulation (STAN ou DE 90 non trouvé ou déjà annulé)",
        "root_cause": "Le message 0400 référence dans DE 90 une transaction 0200 inconnue, rejetée initialement ou déjà extournée.",
        "runbook": [
            "Analyser les 42 caractères du champ DE 90 (MTI + STAN + Date/Heure).",
            "Vérifier dans la table `transaction_audit_log` si le STAN d'origine a bien été approuvé (00).",
            "Si écart de caisse GAB avéré, préparer une régularisation comptable manuelle Back-Office."
        ]
    },
    "30": {
        "label": "Erreur de Format / Format Error (ISO 8583)",
        "status": "REJECTED",
        "category": "TECHNIQUE_PROTOCOLE",
        "severity": "HIGH",
        "failing_component": "PARSEUR ISO 8583 / PASSERELLE TCP",
        "action": "Rejet technique - Trame mal formée ou champ obligatoire corrompu",
        "root_cause": "Erreur de cadrage 2-bytes, bitmap hexadécimal invalide, longueur LLVAR erronée ou DE numérique contenant des caractères alpha.",
        "runbook": [
            "Inspecter la trame brute HEX/ASCII dans l'onglet Simulateur ou Logs TCP.",
            "Comparer la définition des champs DE (FIXED vs LLVAR) avec le cahier d'interfaçage de l'acquéreur."
        ]
    },
    "41": {
        "label": "Carte Perdue / Lost Card (Pick-up)",
        "status": "REJECTED",
        "category": "FRAUDE_SECURITE",
        "severity": "HIGH",
        "failing_component": "LISTE D'OPPOSITION ÉMETTEUR",
        "action": "Refus catégorique - Capture physique de la carte sur GAB",
        "root_cause": "Carte mise en opposition définitive avec le motif LOST (Perdue).",
        "runbook": [
            "Aucune levée d'opposition possible sur une carte LOST.",
            "Vérifier que le GAB a capturé la carte et déclencher la réémission d'une nouvelle carte."
        ]
    },
    "43": {
        "label": "Carte Volée / Stolen Card (Pick-up)",
        "status": "REJECTED",
        "category": "FRAUDE_SECURITE",
        "severity": "CRITICAL",
        "failing_component": "LISTE D'OPPOSITION / SÉCURITÉ",
        "action": "Refus catégorique - Capture immédiate et alerte fraude",
        "root_cause": "Carte mise en opposition définitive avec le motif STOLEN (Volée).",
        "runbook": [
            "Conserver l'horodatage et l'identifiant du terminal (DE 41 / DE 43) pour investigation sécurité.",
            "Vérifier la capture physique de la carte si tentative sur GAB."
        ]
    },
    "51": {
        "label": "Provision Insuffisante / Insufficient Funds",
        "status": "REJECTED",
        "category": "FINANCIER",
        "severity": "INFO",
        "failing_component": "CORE BANKING / SOLDE COMPTE",
        "action": "Refus réessayable - Solde comptable disponible insuffisant",
        "root_cause": "Le montant demandé (DE 4) excède le solde disponible du compte rattaché.",
        "runbook": [
            "Comportement métier normal : inviter le client à approvisionner son compte ou réduire le montant.",
            "Vérifier l'absence de pré-autorisations bloquantes non dénouées."
        ]
    },
    "54": {
        "label": "Carte Expirée / Expired Card",
        "status": "REJECTED",
        "category": "REFERENTIEL",
        "severity": "INFO",
        "failing_component": "CONTRÔLE VALIDITÉ CARTE (DE 14)",
        "action": "Refus définitif - Date d'échéance YYMM dépassée",
        "root_cause": "La date d'expiration de la carte (DE 14) est strictement antérieure à la date locale de transaction (DE 13).",
        "runbook": [
            "Vérifier le statut de renouvellement automatique de la carte dans le CMS.",
            "Inviter le porteur à retirer sa nouvelle carte en agence."
        ]
    },
    "55": {
        "label": "Code PIN Erroné / Incorrect PIN",
        "status": "REJECTED",
        "category": "CRYPTO_PIN",
        "severity": "WARNING",
        "failing_component": "HSM / VÉRIFICATION PIN BLOCK (DE 52)",
        "action": "Refus réessayable - Compteur d'essais PIN incrémenté (+1)",
        "root_cause": "Le PIN saisi ne correspond pas au PIN de référence (ou désynchronisation de clé ZPK entre Switch et HSM).",
        "runbook": [
            "Si isolé sur un seul porteur : erreur de saisie client (3 essais max avant blocage 75).",
            "ALERTE EXPLOITANT : Si pic massif de codes 55 sur tous les porteurs simultanément -> vérifier immédiatement la synchronisation de la clé ZPK sur le HSM !"
        ]
    },
    "57": {
        "label": "Transaction Non Autorisée au Porteur / Not Permitted to Cardholder",
        "status": "REJECTED",
        "category": "DROITS_CANAL",
        "severity": "WARNING",
        "failing_component": "MATRICE DROITS PORTEUR / CANAL",
        "action": "Refus administratif - Carte suspendue ou canal (GAB/TPE/E-Com) désactivé",
        "root_cause": "La carte est en statut SUSPENDED/FROZEN, ou le canal utilisé (Retrait GAB, Achat TPE, Paiement E-Commerce ou International) est verrouillé sur le profil porteur.",
        "runbook": [
            "Ouvrir la fiche du compte dans le Référentiel des Cartes.",
            "Vérifier les permissions canal (GAB, TPE, E-Commerce, International) et le statut administratif."
        ]
    },
    "58": {
        "label": "Transaction Non Autorisée au Terminal / Invalid Currency or MCC",
        "status": "REJECTED",
        "category": "CONFORMITE_TERMINAL",
        "severity": "WARNING",
        "failing_component": "CONTRÔLE DEVISE & TERMINAL (DE 49)",
        "action": "Refus immédiat - Devise non autorisée (exige 952 XOF ou activation Internationale)",
        "root_cause": "Devise de transaction (DE 49) différente de 952 (FCFA/XOF) sur un terminal national ou carte sans option internationale.",
        "runbook": [
            "Vérifier le code devise DE 49 transmis par l'acquéreur (952=XOF, 978=EUR, 840=USD).",
            "Activer l'option 'International Multi-Devises' sur la carte si le porteur voyage."
        ]
    },
    "59": {
        "label": "Suspicion de Fraude / Suspected Fraud",
        "status": "REJECTED",
        "category": "FRAUDE_SECURITE",
        "severity": "HIGH",
        "failing_component": "MOTEUR ANTI-FRAUDE & VÉLOCITÉ",
        "action": "Blocage préventif - Vélocité excessive ou Fallback Piste Magnétique interdit",
        "root_cause": "Dépassement du nombre maximal de transactions par heure (vélocité), ou lecture par piste magnétique (Fallback DE 22 = 801) sur une carte EMV à puce.",
        "runbook": [
            "Contrôler le mode d'entrée POS (DE 22) : si 801 (Fallback), demander d'utiliser la puce EMV (051).",
            "Si alerte vélocité, contacter le porteur pour confirmer l'absence de compromission."
        ]
    },
    "61": {
        "label": "Plafond Unitaire Dépassé / Exceeds Withdrawal Limit",
        "status": "REJECTED",
        "category": "LIMITES_PLAFONDS",
        "severity": "INFO",
        "failing_component": "GESTIONNAIRE DE PLAFONDS",
        "action": "Refus - Montant supérieur à la limite unitaire par opération",
        "root_cause": "Le montant DE 4 dépasse le plafond par transaction (`max_tx_limit`) défini sur le produit carte.",
        "runbook": [
            "Inviter le porteur à fractionner son opération ou augmenter temporairement son plafond unitaire dans l'Explorateur de Comptes."
        ]
    },
    "63": {
        "label": "Violation de Sécurité / Security Violation (HSM / MAC)",
        "status": "REJECTED",
        "category": "CRYPTO_HSM",
        "severity": "CRITICAL",
        "failing_component": "MODULE CRYPTOGRAPHIQUE HSM (PayShield)",
        "action": "Rejet critique sécurité - Échec contrôle MAC (DE 64) ou cryptogramme EMV ARQC",
        "root_cause": "Altération du message sur le réseau, clé MAC (ZAK) désynchronisée, ou certificat EMV invalide.",
        "runbook": [
            "URGENCE EXPLOITATION : Vérifier l'état du HSM dans le panneau Chaos / Supervision.",
            "Effectuer un échange de clés dynamiques (Key Exchange 0800) ou resynchroniser les clés ZAK/ZPK."
        ]
    },
    "65": {
        "label": "Plafond Périodique Atteint / Activity Limit Exceeded",
        "status": "REJECTED",
        "category": "LIMITES_PLAFONDS",
        "severity": "INFO",
        "failing_component": "GESTIONNAIRE DE CUMULS 24H / NFC",
        "action": "Refus - Cumul journalier 24h ou plafond sans-contact NFC dépassé",
        "root_cause": "Le cumul des dépenses sur 24h additionné au montant dépasse `daily_ceiling`, ou le cumul Sans-Contact NFC requiert désormais une insertion puce + PIN.",
        "runbook": [
            "Si Sans-Contact NFC (DE 22 = 071) : insérer la carte en mode Contact EMV (051) avec saisie du code PIN.",
            "Si plafond journalier 24h atteint : augmenter `daily_ceiling` ou réinitialiser le cumul journalier."
        ]
    },
    "68": {
        "label": "Réponse Reçue Trop Tard / Response Received Too Late (Time-out)",
        "status": "REJECTED",
        "category": "DISPONIBILITE_RESEAU",
        "severity": "CRITICAL",
        "failing_component": "SWITCH INTERBANCAIRE / SLA LATENCE HOST",
        "action": "Time-out SLA dépassé - Déclenchement automatique d'un Reversal 0400",
        "root_cause": "Le temps de traitement du Host Émetteur ou de la base de données a dépassé le timer de garde du Switch/Terminal.",
        "runbook": [
            "Vérifier la cascade de latence (Waterfall) pour identifier le maillon lent (Réseau, Switch, HSM ou Base MySQL).",
            "S'assurer qu'un message 0400 d'annulation automatique a bien été généré et acquitté (0410) pour éviter tout débit orphelin."
        ]
    },
    "75": {
        "label": "Tentatives PIN Dépassées / Allowable PIN Tries Exceeded",
        "status": "REJECTED",
        "category": "CRYPTO_PIN",
        "severity": "HIGH",
        "failing_component": "COMPTEUR SÉCURITÉ PIN ÉMETTEUR",
        "action": "Blocage sécuritaire de la carte (3 codes PIN faux consécutifs)",
        "root_cause": "Le compteur `pin_tries` a atteint le seuil maximal de 3 échecs consécutifs.",
        "runbook": [
            "Après authentification du porteur, réinitialiser le compteur `pin_tries` à 0 via le bouton 'Débloquer PIN' dans le Référentiel des Cartes."
        ]
    },
    "91": {
        "label": "Émetteur ou Switch Indisponible / Issuer or Switch Inoperative",
        "status": "REJECTED",
        "category": "DISPONIBILITE_RESEAU",
        "severity": "CRITICAL",
        "failing_component": "SERVEUR HOST ÉMETTEUR (DOWN)",
        "action": "Rejet réseau - Host hors ligne et Stand-In Processing (STIP) non applicable",
        "root_cause": "Le serveur d'autorisation émetteur ne répond plus aux requêtes et le mode dégradé Stand-In (STIP) est désactivé ou le montant dépasse le plafond STIP.",
        "runbook": [
            "Envoyer immédiatement un message de test réseau `0800 Echo Test` (DE 70 = 301).",
            "Activer le mode **Stand-In Processing (STIP)** sur le Switch pour autoriser par délégation pendant la maintenance du Host.",
            "Rétablir le service Host Émetteur."
        ]
    },
    "92": {
        "label": "Erreur de Routage BIN / Unable to Route Transaction",
        "status": "REJECTED",
        "category": "TECHNIQUE_PROTOCOLE",
        "severity": "HIGH",
        "failing_component": "TABLE DE ROUTAGE SWITCH INTERBANCAIRE",
        "action": "Rejet de routage - Institution financière ou BIN non raccordé",
        "root_cause": "Le préfixe BIN (6 premiers chiffres du PAN) ne correspond à aucune route active sur le Switch.",
        "runbook": [
            "Vérifier que le BIN de la carte appartient bien à la plage routée (ex: 400012* pour notre banque) ou mettre à jour la table de routage BIN."
        ]
    },
    "94": {
        "label": "Transmission en Doublon / Duplicate Transmission",
        "status": "REJECTED",
        "category": "REVERSAL_COMPENSATION",
        "severity": "WARNING",
        "failing_component": "CONTRÔLE ANTI-DOUBLON (STAN / RRN)",
        "action": "Rejet anti-doublon - Même transaction (STAN + Terminal + Montant) déjà traitée",
        "root_cause": "Le terminal ou l'acquéreur a retransmis une requête 0200 portant exactement le même numéro d'audit STAN (DE 11) et Terminal ID (DE 41) qu'une transaction déjà approuvée.",
        "runbook": [
            "Ne pas débiter une seconde fois le porteur.",
            "Vérifier si le terminal a subi une micro-coupure réseau lors de la réception du premier 0210."
        ]
    },
    "96": {
        "label": "Dysfonctionnement Système / System Malfunction",
        "status": "REJECTED",
        "category": "DISPONIBILITE_RESEAU",
        "severity": "CRITICAL",
        "failing_component": "INFRASTRUCTURE INTERNE (HSM / DB / CORE)",
        "action": "Erreur technique interne critique du serveur d'autorisation",
        "root_cause": "Exception non gérée, crash du module HSM matériel, ou rupture de connexion avec le Core Banking / MySQL.",
        "runbook": [
            "Consulter immédiatement les logs d'audit système et l'état du HSM / Base MySQL.",
            "Désactiver les pannes simulées dans le Centre d'Incidents (Chaos Engineering) et relancer un Echo 0800."
        ]
    },
}


class ISO8583Message:
    """
    Représente un message ISO 8583 avec MTI, champs DE et utilitaires de cadrage TCP 2-octets Big-Endian.
    """

    def __init__(self, mti: str = "0200"):
        self.mti = mti
        self.fields: Dict[int, str] = {}

    def set_field(self, de: int, value: Any):
        if value is not None and str(value) != "":
            self.fields[int(de)] = str(value)

    def get_field(self, de: int, default: str = "") -> str:
        return self.fields.get(int(de), default)

    def detect_channel(self) -> str:
        """
        Détermine le canal monétique à partir des champs ISO 8583 (DE 25, DE 22, DE 18, DE 3, DE 41).
        Retourne 'GAB', 'ECOM', ou 'TPE'.
        """
        de25 = self.get_field(25, "")
        de22 = self.get_field(22, "")
        de18 = self.get_field(18, "")
        de3 = self.get_field(3, "000000")
        de41 = self.get_field(41, "").upper()
        de48 = self.get_field(48, "").upper()

        if de25 == "02" or de18 == "6011" or de3.startswith(("01", "31", "38")) or de41.startswith(("GAB", "ATM")):
            return "GAB"
        if de25 == "59" or de22 in ("812", "012") or "CHANNEL=ECOM" in de48 or "3DS=" in de48 or de41.startswith(("ECOM", "WEB")):
            return "ECOM"
        return "TPE"

    def to_safe_fields_dict(self) -> Dict[str, str]:
        """Retourne les champs DE avec masquage PCI-DSS (PAN masqué, PIN et CVV2 obfusqués)."""
        safe: Dict[str, str] = {}
        for k, v in sorted(self.fields.items()):
            if k == 2:
                safe[str(k)] = mask_pan(v)
            elif k == 52:
                safe[str(k)] = "**************** (PIN Block Chiffré ZPK)"
            elif k == 48:
                safe[str(k)] = mask_sensitive_de48(v)
            else:
                safe[str(k)] = v
        return safe

    def to_dict(self) -> dict:
        return {
            "mti": self.mti,
            "channel": self.detect_channel(),
            "fields": {str(k): v for k, v in self.fields.items()},
            "safe_fields": self.to_safe_fields_dict(),
            "masked_pan": mask_pan(self.fields.get(2, "")),
            "amount": int(self.fields.get(4, "0")) if self.fields.get(4, "").isdigit() else 0,
            "currency": self.fields.get(49, ""),
            "stan": self.fields.get(11, ""),
            "terminal_id": self.fields.get(41, ""),
            "merchant_id": self.fields.get(42, ""),
            "auth_code": self.fields.get(38, ""),
            "response_code": self.fields.get(39, ""),
            "reversal_data": self.fields.get(90, "")
        }

    def pack(self) -> bytes:
        """
        Génère la trame brute ISO 8583 :
        Trame = MTI (4 ASCII) + Bitmap hexadécimal (16 ou 32 caractères) + corps des données.
        """
        sorted_fields = sorted(self.fields.keys())
        has_secondary = any(de > 64 for de in sorted_fields)
        bitmap_primary = 0
        bitmap_secondary = 0

        if has_secondary:
            bitmap_primary |= (1 << 63)  # Bit 1 = secondary bitmap present

        for de in sorted_fields:
            if 1 <= de <= 64:
                bitmap_primary |= (1 << (64 - de))
            elif 65 <= de <= 128:
                bitmap_secondary |= (1 << (128 - de))

        if has_secondary:
            bitmap_hex = f"{bitmap_primary:016X}{bitmap_secondary:016X}"
        else:
            bitmap_hex = f"{bitmap_primary:016X}"

        body_parts = []
        for de in sorted_fields:
            val = self.fields[de]
            definition = DE_DEFINITIONS.get(de, {"type": "FIXED", "len": len(val)})
            if definition["type"] == "LLVAR":
                max_len = definition.get("max_len", 99)
                val_clipped = val[:max_len]
                body_parts.append(f"{len(val_clipped):02d}{val_clipped}")
            elif definition["type"] == "LLLVAR":
                max_len = definition.get("max_len", 999)
                val_clipped = val[:max_len]
                body_parts.append(f"{len(val_clipped):03d}{val_clipped}")
            else:
                target_len = definition.get("len", len(val))
                if len(val) < target_len:
                    if val.isdigit():
                        val = val.zfill(target_len)
                    else:
                        val = val.ljust(target_len)
                elif len(val) > target_len:
                    val = val[:target_len]
                body_parts.append(val)

        raw_str = f"{self.mti}{bitmap_hex}{''.join(body_parts)}"
        return raw_str.encode("ascii", errors="replace")

    def pack_tcp(self) -> bytes:
        """
        Encapsule la trame avec l'en-tête de cadrage TCP de 2 octets Big-Endian (!H).
        """
        payload = self.pack()
        header = struct.pack("!H", len(payload))
        return header + payload

    @classmethod
    def unpack(cls, raw_data: bytes) -> "ISO8583Message":
        """
        Décode une trame ISO 8583 (sans header TCP).
        Lève ValueError en cas d'erreur de format (qui déclenchera DE 39 = '30').
        """
        raw_str = raw_data.decode("ascii", errors="replace")
        if len(raw_str) < 20:
            raise ValueError(f"Trame ISO 8583 trop courte : {len(raw_str)} caractères")

        mti = raw_str[:4]
        if not mti.isdigit():
            raise ValueError(f"MTI non numérique invalide : {mti}")

        msg = cls(mti=mti)

        bitmap_primary_hex = raw_str[4:20]
        try:
            bitmap_primary_int = int(bitmap_primary_hex, 16)
        except ValueError:
            raise ValueError(f"Bitmap primaire hexadécimal invalide : {bitmap_primary_hex}")

        bit1_secondary_flag = bool((bitmap_primary_int >> 63) & 1)
        active_fields = []

        for bit in range(2, 65):
            if (bitmap_primary_int >> (64 - bit)) & 1:
                active_fields.append(bit)

        cursor = 20

        if bit1_secondary_flag and len(raw_str) >= 36:
            starts_with_pan = (
                (2 in active_fields)
                and raw_str[20:22] in ["15", "16", "17", "18", "19"]
                and raw_str[22:32].isdigit()
            )
            if not starts_with_pan:
                try:
                    bitmap_sec_int = int(raw_str[20:36], 16)
                    for bit in range(1, 65):
                        if (bitmap_sec_int >> (64 - bit)) & 1:
                            active_fields.append(64 + bit)
                    cursor = 36
                except ValueError:
                    pass

        for de in sorted(active_fields):
            if cursor >= len(raw_str):
                break
            definition = DE_DEFINITIONS.get(de)
            if not definition:
                break

            if definition["type"] == "LLVAR":
                len_str = raw_str[cursor:cursor + 2]
                cursor += 2
                if not len_str.isdigit():
                    raise ValueError(f"Longueur LLVAR invalide pour DE {de} : {len_str}")
                field_len = int(len_str)
                val = raw_str[cursor:cursor + field_len]
                cursor += field_len
                msg.set_field(de, val)
            elif definition["type"] == "LLLVAR":
                len_str = raw_str[cursor:cursor + 3]
                cursor += 3
                if not len_str.isdigit():
                    raise ValueError(f"Longueur LLLVAR invalide pour DE {de} : {len_str}")
                field_len = int(len_str)
                val = raw_str[cursor:cursor + field_len]
                cursor += field_len
                msg.set_field(de, val)
            else:
                field_len = definition.get("len", 0)
                val = raw_str[cursor:cursor + field_len]
                cursor += field_len
                msg.set_field(de, val)

        return msg


def create_0800_echo(stan: str = "000001", net_code: str = "301") -> ISO8583Message:
    """Crée un message de gestion réseau 0800 (301=Echo Test, 001=Sign-On, 161=Key Change)."""
    msg = ISO8583Message("0800")
    tx_datetime = time.strftime("%m%d%H%M%S")
    msg.set_field(7, tx_datetime)
    msg.set_field(11, stan.zfill(6))
    msg.set_field(70, net_code.zfill(3))
    return msg


def create_0200_auth(
    pan: str,
    amount: int,
    currency: str = "952",
    pin: str = "1234",
    exp: str = "2812",
    stan: str = "000001",
    terminal_id: str = "TERM0001",
    merchant_id: str = "MERCHANT0000001",
    tx_date: Optional[str] = None,
    proc_code: str = "000000",
    mcc: Optional[str] = None,
    pos_entry_mode: Optional[str] = None,
    pos_condition_code: Optional[str] = None,
    de48_private: Optional[str] = None,
    mac: Optional[str] = None,
    channel: Optional[str] = None,
    cvv2: Optional[str] = None,
    threeds_status: Optional[str] = None,
) -> ISO8583Message:
    """Crée un message financier 0200 multi-canal (GAB, TPE ou E-Commerce)."""
    msg = ISO8583Message("0200")
    now = time.localtime()
    tx_datetime = time.strftime("%m%d%H%M%S", now)
    local_time = time.strftime("%H%M%S", now)
    local_date = tx_date if tx_date else time.strftime("%y%m", now)

    # Préréglages automatiques selon le canal choisi si les DE ne sont pas forcés
    ch = (channel or "").upper()
    if ch == "GAB":
        proc_code = proc_code if proc_code != "000000" else "010000"
        mcc = mcc or "6011"
        pos_entry_mode = pos_entry_mode or "051"
        pos_condition_code = pos_condition_code or "02"
        if terminal_id == "TERM0001":
            terminal_id = "GAB00001"
    elif ch == "ECOM":
        proc_code = proc_code or "000000"
        mcc = mcc or "5999"
        pos_entry_mode = pos_entry_mode or "812"
        pos_condition_code = pos_condition_code or "59"
        if terminal_id == "TERM0001":
            terminal_id = "ECOM0001"
        if not de48_private:
            cvv_part = f"CVV2={cvv2};" if cvv2 else ""
            tds = threeds_status or "Y"
            eci = "05" if tds == "Y" else "07"
            de48_private = f"{cvv_part}3DS={tds};ECI={eci};CHANNEL=ECOM"
    elif ch == "TPE":
        mcc = mcc or "5411"
        pos_entry_mode = pos_entry_mode or "051"
        pos_condition_code = pos_condition_code or "00"

    msg.set_field(2, pan)
    msg.set_field(3, proc_code.zfill(6))
    msg.set_field(4, str(max(0, int(amount))).zfill(12))
    msg.set_field(7, tx_datetime)
    msg.set_field(11, stan.zfill(6))
    msg.set_field(12, local_time)
    msg.set_field(13, local_date)
    msg.set_field(14, exp)
    if mcc:
        msg.set_field(18, mcc.zfill(4)[:4])
    if pos_entry_mode:
        msg.set_field(22, pos_entry_mode.zfill(3)[:3])
    if pos_condition_code:
        msg.set_field(25, pos_condition_code.zfill(2)[:2])
    msg.set_field(41, terminal_id.ljust(8)[:8])
    msg.set_field(42, merchant_id.ljust(15)[:15])
    if de48_private:
        msg.set_field(48, de48_private)
    msg.set_field(49, currency.zfill(3))
    if pin is not None and str(pin) != "":
        msg.set_field(52, str(pin).ljust(16)[:16])
    if mac:
        msg.set_field(64, str(mac).ljust(16)[:16])
    return msg


def create_0400_reversal(
    pan: str,
    amount: int,
    orig_stan: str,
    orig_mti: str = "0200",
    orig_datetime: Optional[str] = None,
    currency: str = "952",
    stan: str = "000002",
    terminal_id: str = "TERM0001",
    de48_reason: Optional[str] = None
) -> ISO8583Message:
    """Crée un message d'annulation 0400 (totale ou partielle) avec DE 90."""
    msg = ISO8583Message("0400")
    now = time.localtime()
    dt = orig_datetime if orig_datetime else time.strftime("%m%d%H%M%S", now)

    # DE 90 : 42 caractères = [MTI Origine: 4][STAN Origine: 6][Date/Heure: 10][Acquirer: 11][Forwarding: 11]
    de_90 = f"{orig_mti[:4]}{orig_stan.zfill(6)}{dt[:10]}{'00000000001':11}{'00000000001':11}"

    msg.set_field(2, pan)
    msg.set_field(3, "000000")
    msg.set_field(4, str(max(0, int(amount))).zfill(12))
    msg.set_field(11, stan.zfill(6))
    msg.set_field(41, terminal_id.ljust(8)[:8])
    if de48_reason:
        msg.set_field(48, de48_reason)
    msg.set_field(49, currency.zfill(3))
    msg.set_field(90, de_90)
    return msg
