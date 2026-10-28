"""
Module de Dissection Hexadécimale, Décodage TLV EMV (DE 55) & Rejeu de Trames ISO 8583
Conforme aux standards bancaires GIM-UEMOA, VISA, Mastercard et PCI-DSS v4.0
"""

import socket
import struct
import time
import re
import asyncio
from typing import Dict, Any, List, Optional, Tuple


# Dictionnaire de description des champs ISO 8583
ISO_FIELD_NAMES: Dict[int, str] = {
    1: "Secondary Bitmap",
    2: "Primary Account Number (PAN)",
    3: "Processing Code",
    4: "Amount, Transaction",
    7: "Transmission Date & Time (MMDDhhmmss)",
    11: "Systems Trace Audit Number (STAN)",
    12: "Time, Local Transaction (hhmmss)",
    13: "Date, Local Transaction (MMDD)",
    14: "Date, Expiration (YYMM)",
    18: "Merchant Type / Category Code (MCC)",
    22: "Point of Service Entry Mode",
    23: "Card Sequence Number",
    25: "Point of Service Condition Code",
    32: "Acquiring Institution Identification Code",
    35: "Track 2 Data",
    37: "Retrieval Reference Number (RRN)",
    38: "Authorization Identification Response",
    39: "Response Code (DE 39)",
    41: "Card Acceptor Terminal Identification (TID)",
    42: "Card Acceptor Identification Code (MID)",
    43: "Card Acceptor Name / Location",
    44: "Additional Response Data",
    48: "Private Additional Data",
    49: "Currency Code, Transaction",
    52: "Personal Identification Number (PIN) Data",
    53: "Security Related Control Information",
    54: "Additional Amounts",
    55: "Integrated Circuit Card (ICC / EMV TLV Data)",
    62: "Private Use Field",
    70: "Network Management Information Code",
    90: "Original Data Elements (Annulation/Reversal)",
    102: "Account Identification 1",
    103: "Account Identification 2",
    128: "Message Authentication Code (MAC)",
}

# Dictionnaire standard des Tags EMV courants (DE 55)
EMV_TAG_DEFINITIONS: Dict[str, Dict[str, str]] = {
    "9F26": {"name": "Application Cryptogram (ARQC/TC/AAC)", "desc": "Cryptogramme calculé par la puce pour authentification"},
    "9F27": {"name": "Cryptogram Information Data (CID)", "desc": "Type de cryptogramme généré (ARQC, TC, AAC)"},
    "9F10": {"name": "Issuer Application Data (IAD)", "desc": "Données propriétaires émetteur & dérivation clé"},
    "9F37": {"name": "Unpredictable Number (UN)", "desc": "Nombre aléatoire généré par le terminal"},
    "9F36": {"name": "Application Transaction Counter (ATC)", "desc": "Compteur séquentiel de transactions de la puce"},
    "95":   {"name": "Terminal Verification Results (TVR)", "desc": "Résultat des vérifications de risque effectuées par le terminal"},
    "9A":   {"name": "Transaction Date", "desc": "Date de la transaction au format AAMMJJ"},
    "9C":   {"name": "Transaction Type", "desc": "Type de transaction ISO (00=Achat, 01=Retrait)"},
    "9F02": {"name": "Amount, Authorized", "desc": "Montant autorisé exprimé sans virgule"},
    "9F03": {"name": "Amount, Other", "desc": "Montant secondaire ou cashback"},
    "5F2A": {"name": "Transaction Currency Code", "desc": "Code devise ISO 4217 (952=XOF, 978=EUR)"},
    "82":   {"name": "Application Interchange Profile (AIP)", "desc": "Capacités et fonctions supportées par la carte EMV"},
    "84":   {"name": "Dedicated File (DF) Name / AID", "desc": "Identifiant de l'application sélectionnée sur la puce"},
    "9F1A": {"name": "Terminal Country Code", "desc": "Code pays ISO du terminal émetteur"},
    "9F33": {"name": "Terminal Capabilities", "desc": "Capacités de saisie et de validation du terminal (TPE/GAB)"},
    "9F34": {"name": "CVM Results", "desc": "Méthode de vérification du porteur (PIN en ligne, PIN hors ligne, Signature)"},
    "9F35": {"name": "Terminal Type", "desc": "Environnement du terminal (En ligne, Hors ligne, Attendu, etc.)"},
    "5F34": {"name": "Card Sequence Number (PAN Seq)", "desc": "Numéro de séquence de la carte"},
    "8A":   {"name": "Authorization Response Code (ARC)", "desc": "Code retour émetteur renvoyé dans la puce (Z3, 00)"},
    "91":   {"name": "Issuer Authentication Data (ARPC)", "desc": "Cryptogramme de réponse d'authentification émetteur"},
    "71":   {"name": "Issuer Script Command 1", "desc": "Script de mise à jour carte post-autorisation"},
    "72":   {"name": "Issuer Script Command 2", "desc": "Script de blocage carte ou mise à jour compteurs"},
}


class PacketDissector:
    """Dissecteur et analyseur de paquets ISO 8583 bruts & EMV."""

    @staticmethod
    def clean_hex_input(raw_input: str) -> str:
        """Nettoie une saisie brute pour extraire une chaîne hexadécimale valide."""
        if not raw_input:
            return ""
        # Retirer les préfixes 0x, les espaces, tabulations, sauts de ligne, barres verticales, deux-points
        cleaned = re.sub(r"[^0-9a-fA-F]", "", raw_input)
        return cleaned.upper()

    @staticmethod
    def parse_emv_tlv(hex_data: str) -> List[Dict[str, Any]]:
        """Parse une chaîne hexadécimale contenant des données TLV EMV (DE 55)."""
        tags: List[Dict[str, Any]] = []
        i = 0
        n = len(hex_data)

        while i < n:
            # Vérifier s'il reste assez pour un tag (au moins 2 car hex)
            if i + 2 > n:
                break

            first_byte = int(hex_data[i:i+2], 16)
            tag_hex = hex_data[i:i+2]
            i += 2

            # Règle Tag EMV multi-octets (si les 5 bits de poids faible sont à 1, i.e. 0x1F)
            if (first_byte & 0x1F) == 0x1F:
                if i + 2 <= n:
                    tag_hex += hex_data[i:i+2]
                    i += 2

            if i + 2 > n:
                break

            # Décodage Longueur (L)
            len_byte = int(hex_data[i:i+2], 16)
            i += 2
            length_bytes = len_byte

            if len_byte & 0x80:
                # Longueur multi-octets
                num_len_bytes = len_byte & 0x7F
                if i + (num_len_bytes * 2) <= n:
                    length_hex = hex_data[i:i + (num_len_bytes * 2)]
                    length_bytes = int(length_hex, 16)
                    i += (num_len_bytes * 2)

            val_len_hex = length_bytes * 2
            val_hex = hex_data[i:i+val_len_hex]
            i += val_len_hex

            # Interprétation du tag
            tag_upper = tag_hex.upper()
            tag_info = EMV_TAG_DEFINITIONS.get(tag_upper, {
                "name": f"Tag Propriétaire {tag_upper}",
                "desc": "Tag de données EMV spécifique émetteur ou terminal"
            })

            # Interprétations métier spécifiques
            meaning = ""
            if tag_upper == "9F27":
                cid_val = int(val_hex, 16) if val_hex else 0
                if (cid_val & 0xC0) == 0x80:
                    meaning = "ARQC (Demande d'autorisation en ligne)"
                elif (cid_val & 0xC0) == 0x40:
                    meaning = "TC (Transaction acceptée hors ligne)"
                elif (cid_val & 0xC0) == 0x00:
                    meaning = "AAC (Transaction refusée par la puce)"
            elif tag_upper == "9C":
                meaning = "Achat standard (00)" if val_hex == "00" else ("Retrait GAB (01)" if val_hex == "01" else f"Type {val_hex}")
            elif tag_upper == "5F2A":
                meaning = "Franc CFA (XOF 952)" if val_hex in ("0952", "952") else ("Euro (EUR 978)" if val_hex in ("0978", "978") else val_hex)
            elif tag_upper == "84":
                try:
                    meaning = bytes.fromhex(val_hex).decode("utf-8", errors="ignore")
                except Exception:
                    meaning = ""

            tags.append({
                "tag": tag_upper,
                "name": tag_info["name"],
                "desc": tag_info["desc"],
                "length": length_bytes,
                "value_hex": val_hex,
                "meaning": meaning,
            })

        return tags

    @staticmethod
    def dissect_packet(raw_hex: str) -> Dict[str, Any]:
        """
        Dissecte complètement un paquet ISO 8583 brut.
        Gère les variantes : cadrage 2-octets Big-Endian ou trame directe.
        """
        cleaned = PacketDissector.clean_hex_input(raw_hex)
        if len(cleaned) < 8:
            return {
                "error": "Trame hexadécimale trop courte (minimum 8 caractères requis pour MTI).",
                "is_valid": False,
            }

        result: Dict[str, Any] = {
            "is_valid": True,
            "raw_hex": cleaned,
            "total_bytes": len(cleaned) // 2,
            "has_2byte_length_header": False,
            "header_length_declared": None,
            "mti": "",
            "mti_desc": "",
            "primary_bitmap_hex": "",
            "secondary_bitmap_hex": "",
            "active_fields": [],
            "fields": {},
            "emv_tags": [],
            "anomalies": [],
        }

        cursor = 0

        # 1. Vérifier si les 2 premiers octets (4 cars hex) correspondent à une longueur de trame
        try:
            potential_len = int(cleaned[0:4], 16)
            remaining_bytes = (len(cleaned) - 4) // 2
            # Si la longueur correspond exactement ou presque aux octets restants
            if potential_len == remaining_bytes:
                result["has_2byte_length_header"] = True
                result["header_length_declared"] = potential_len
                cursor = 4
        except Exception:
            pass

        # 2. Tenter de lire le MTI (soit en ASCII direct comme '30323030' = '0200', soit en caractères '0200')
        payload_hex = cleaned[cursor:]
        mti_str = ""
        is_ascii_encoded = False

        if payload_hex.startswith("30313030") or payload_hex.startswith("30323030") or payload_hex.startswith("30343230") or payload_hex.startswith("30383030"):
            # ASCII encodé ('0200' -> '30323030')
            is_ascii_encoded = True
            mti_str = bytes.fromhex(payload_hex[0:8]).decode("ascii", errors="ignore")
            cursor += 8
        elif payload_hex.startswith("0100") or payload_hex.startswith("0200") or payload_hex.startswith("0420") or payload_hex.startswith("0800") or payload_hex.startswith("0210"):
            mti_str = payload_hex[0:4]
            cursor += 4
        else:
            # Fallback : essayer de décoder les 4 premiers caractères
            mti_candidate = payload_hex[0:4]
            if mti_candidate.isdigit() and len(mti_candidate) == 4:
                mti_str = mti_candidate
                cursor += 4
            else:
                result["anomalies"].append("MTI non standard ou cadrage ISO non identifié au début de la trame.")
                mti_str = mti_candidate

        result["mti"] = mti_str
        mti_meanings = {
            "0100": "0100 - Demande d'autorisation (Authorization Request)",
            "0110": "0110 - Réponse d'autorisation (Authorization Response)",
            "0200": "0200 - Demande financière / Débit (Financial Transaction Request)",
            "0210": "0210 - Réponse financière / Débit (Financial Transaction Response)",
            "0420": "0420 - Avis d'annulation / Reversal (Acquirer Reversal Advice)",
            "0430": "0430 - Acquittement d'annulation (Acquirer Reversal Response)",
            "0800": "0800 - Gestion Réseau / Échange Clés (Network Management Request)",
            "0810": "0810 - Réponse Gestion Réseau (Network Management Response)",
        }
        result["mti_desc"] = mti_meanings.get(mti_str, f"MTI Spécifique ({mti_str})")

        # 3. Traiter le Bitmap Primaire (16 caractères hex = 8 octets)
        remaining_hex = cleaned[cursor:]
        if len(remaining_hex) >= 16:
            # Vérifier si le Bitmap est ASCII (32 hex) ou Raw (16 hex)
            if is_ascii_encoded and len(remaining_hex) >= 32:
                try:
                    bitmap_ascii = bytes.fromhex(remaining_hex[:32]).decode("ascii", errors="ignore")
                    result["primary_bitmap_hex"] = bitmap_ascii
                    cursor += 32
                except Exception:
                    result["primary_bitmap_hex"] = remaining_hex[:16]
                    cursor += 16
            else:
                result["primary_bitmap_hex"] = remaining_hex[:16]
                cursor += 16

            # Décodage des bits du Bitmap Primaire
            try:
                bm_int = int(result["primary_bitmap_hex"], 16)
                for b in range(1, 65):
                    # Bit 1 est le bit de poids fort (63ème décalage)
                    if (bm_int >> (64 - b)) & 1:
                        result["active_fields"].append(b)
            except Exception as e:
                result["anomalies"].append(f"Erreur de décodage du Bitmap Primaire : {e}")

            # Vérifier si bit 1 est actif (présence Bitmap Secondaire)
            if 1 in result["active_fields"] and len(cleaned[cursor:]) >= 16:
                result["secondary_bitmap_hex"] = cleaned[cursor:cursor+16]
                cursor += 16
                try:
                    bm2_int = int(result["secondary_bitmap_hex"], 16)
                    for b in range(65, 129):
                        if (bm2_int >> (128 - b)) & 1:
                            result["active_fields"].append(b)
                except Exception as e:
                    result["anomalies"].append(f"Erreur de décodage du Bitmap Secondaire : {e}")

        # 4. Décodage heuristique des champs ISO courants
        unpacked_data = cleaned[cursor:]
        for f_num in result["active_fields"]:
            if f_num == 1:
                continue
            field_name = ISO_FIELD_NAMES.get(f_num, f"Field DE {f_num}")
            result["fields"][str(f_num)] = {
                "field_num": f_num,
                "name": field_name,
                "status": "Présent dans le Bitmap",
            }

        # 5. Recherche heuristique de DE 55 (Tag EMV) dans le payload restant
        # Le DE 55 contient typiquement des tags EMV '9F26', '9F10', '9F37', etc.
        emv_markers = ["9F26", "9F36", "9F10", "9505", "9A03", "9C01"]
        for marker in emv_markers:
            marker_idx = cleaned.find(marker)
            if marker_idx != -1:
                try:
                    emv_slice = cleaned[marker_idx:]
                    parsed_tags = PacketDissector.parse_emv_tlv(emv_slice)
                    if parsed_tags:
                        result["emv_tags"] = parsed_tags
                        result["fields"]["55"] = {
                            "field_num": 55,
                            "name": ISO_FIELD_NAMES[55],
                            "status": f"{len(parsed_tags)} Tags EMV décodés avec succès",
                            "tags_count": len(parsed_tags),
                        }
                        break
                except Exception:
                    pass

        # 6. Extraction heuristique du PAN (DE 2) si présent
        pan_match = re.search(r"(4\d{15}|5\d{15}|6\d{15})", cleaned)
        if pan_match:
            raw_pan = pan_match.group(1)
            masked_pan = raw_pan[:6] + "*" * (len(raw_pan) - 10) + raw_pan[-4:]
            result["fields"]["2"] = {
                "field_num": 2,
                "name": ISO_FIELD_NAMES[2],
                "value_masked": masked_pan,
                "status": "Identifié & masqué PCI-DSS",
            }

        return result


class PacketReplayer:
    """Moteur de rejeu de paquets ISO 8583 sur le serveur d'autorisation TCP."""

    def __init__(self, host: str = "127.0.0.1", port: int = 5001):
        self.host = host
        self.port = port

    async def replay_packet_async(self, raw_hex: str, timeout_seconds: float = 3.0) -> Dict[str, Any]:
        """
        Envoie la trame sur le port TCP 5001 de manière asynchrone non-bloquante pour l'event-loop.
        """
        cleaned = PacketDissector.clean_hex_input(raw_hex)
        if not cleaned:
            return {
                "status": "ERROR",
                "error": "Aucune trame hexadécimale valide fournie.",
                "latency_ms": 0,
            }

        # Détection intelligente du format d'envoi (ASCII string direct vs Hex binaire)
        if cleaned.startswith("3031") or cleaned.startswith("3032") or cleaned.startswith("3034") or cleaned.startswith("3038"):
            wire_payload = bytes.fromhex(cleaned)
        elif cleaned.startswith("0100") or cleaned.startswith("0200") or cleaned.startswith("0420") or cleaned.startswith("0800"):
            wire_payload = cleaned.encode("ascii", errors="replace")
        else:
            try:
                candidate = bytes.fromhex(cleaned)
                if candidate[:2] in (b"01", b"02", b"04", b"08"):
                    wire_payload = candidate
                else:
                    wire_payload = cleaned.encode("ascii", errors="replace")
            except Exception:
                wire_payload = cleaned.encode("ascii", errors="replace")

        # Cadrage standard 2-octets Big-Endian (!H)
        wire_bytes = struct.pack("!H", len(wire_payload)) + wire_payload

        start_time = time.perf_counter()
        reader, writer = None, None
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self.host, self.port),
                timeout=timeout_seconds
            )
            writer.write(wire_bytes)
            await writer.drain()

            resp_header = await asyncio.wait_for(reader.readexactly(2), timeout=timeout_seconds)
            resp_len = struct.unpack("!H", resp_header)[0]
            resp_body = await asyncio.wait_for(reader.readexactly(resp_len), timeout=timeout_seconds)

            latency = round((time.perf_counter() - start_time) * 1000, 2)
            resp_str = resp_body.decode("ascii", errors="replace")
            response_hex = (resp_header + resp_body).hex().upper()

            # Dissection de la réponse obtenue
            dissection = PacketDissector.dissect_packet(resp_str if resp_str.startswith("0") else response_hex)

            return {
                "status": "SUCCESS",
                "latency_ms": latency,
                "sent_bytes": len(wire_bytes),
                "received_bytes": len(resp_header) + len(resp_body),
                "response_ascii": resp_str,
                "response_hex": response_hex,
                "response_dissection": dissection,
            }
        except asyncio.TimeoutError:
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "status": "TIMEOUT",
                "error": f"Timeout réseau : aucune réponse reçue après {timeout_seconds}s.",
                "latency_ms": latency,
            }
        except ConnectionRefusedError:
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "status": "REFUSED",
                "error": f"Connexion refusée sur {self.host}:{self.port}. Le serveur TCP est-il démarré ?",
                "latency_ms": latency,
            }
        except Exception as e:
            latency = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "status": "ERROR",
                "error": f"Erreur de communication TCP : {e}",
                "latency_ms": latency,
            }
        finally:
            if writer:
                try:
                    writer.close()
                    await writer.wait_closed()
                except Exception:
                    pass

    def replay_packet(self, raw_hex: str, timeout_seconds: float = 3.0) -> Dict[str, Any]:
        """Wrapper synchrone vers replay_packet_async."""
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                return asyncio.run_coroutine_threadsafe(
                    self.replay_packet_async(raw_hex, timeout_seconds), loop
                ).result(timeout=timeout_seconds + 1.0)
            return loop.run_until_complete(self.replay_packet_async(raw_hex, timeout_seconds))
        except Exception as e:
            return {
                "status": "ERROR",
                "error": f"Erreur d'exécution : {e}",
                "latency_ms": 0,
            }
