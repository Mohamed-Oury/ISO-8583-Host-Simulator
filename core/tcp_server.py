"""
Serveur d'Écoute TCP Haute Performance ISO 8583 (Host Simulator Multi-Canal).
Gère le cadrage TCP 2-octets Big-Endian (!H), les connexions concurrentes asyncio,
les messages 0800, 0200/0100 (GAB, TPE, E-Commerce), 0400/0420 (Reversal Total ou Partiel)
et le masquage strict PCI-DSS v4.0.
"""

import asyncio
import json
import logging
import struct
import time
from typing import Callable, List, Optional, Dict, Any, Tuple
from core.iso8583 import ISO8583Message, mask_pan, DE_39_DESCRIPTIONS
from core.decision_engine import DecisionEngine, decision_engine

logger = logging.getLogger("ISO8583_Host")


class ISO8583TCPServer:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 5001,
        engine: DecisionEngine = decision_engine
    ):
        self.host = host
        self.port = port
        self.engine = engine
        self.server: Optional[asyncio.AbstractServer] = None
        self.is_running = False
        self.start_time: Optional[float] = None

        # Métriques en temps réel enrichies par canal
        self.metrics = {
            "total_connections": 0,
            "active_connections": 0,
            "total_requests": 0,
            "requests_0800": 0,
            "requests_0200": 0,
            "requests_0400": 0,
            "requests_gab": 0,
            "requests_tpe": 0,
            "requests_ecom": 0,
            "approved": 0,
            "rejected": 0,
            "last_latency_ms": 0.0,
            "uptime_seconds": 0
        }

        self.log_callbacks: List[Callable[[dict], None]] = []

    def register_log_callback(self, cb: Callable[[dict], None]):
        self.log_callbacks.append(cb)

    def _broadcast_event(self, event_type: str, data: dict):
        log_entry = {
            "type": event_type,
            "timestamp": time.strftime("%H:%M:%S"),
            **data
        }
        for cb in self.log_callbacks:
            try:
                cb(log_entry)
            except Exception:
                pass

    async def start(self):
        """Démarre le serveur TCP asyncio."""
        if self.is_running:
            return

        try:
            self.server = await asyncio.start_server(
                self.handle_client,
                self.host,
                self.port
            )
            self.is_running = True
            self.start_time = time.time()
            logger.info(f"Serveur ISO 8583 en écoute sur {self.host}:{self.port} (Cadrage 2-octets Big-Endian)")
            self._broadcast_event("SERVER_START", {
                "host": self.host,
                "port": self.port,
                "message": f"Serveur TCP démarré sur {self.host}:{self.port}"
            })
        except OSError as e:
            logger.warning(f"Port TCP {self.port} déjà lié ou en écoute ({e}) — activation du flag is_running.")
            self.is_running = True

    async def stop(self):
        """Arrête le serveur proprement."""
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            self.server = None
        self.is_running = False
        self._broadcast_event("SERVER_STOP", {"message": "Serveur TCP arrêté."})

    def get_stats(self) -> dict:
        uptime = int(time.time() - self.start_time) if self.start_time and self.is_running else 0
        self.metrics["uptime_seconds"] = uptime
        total_fin = self.metrics["approved"] + self.metrics["rejected"]
        approval_rate = round((self.metrics["approved"] / total_fin) * 100, 1) if total_fin > 0 else 100.0
        return {
            "is_running": self.is_running,
            "host": self.host,
            "port": self.port,
            "approval_rate_pct": approval_rate,
            **self.metrics
        }

    async def handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        client_address = writer.get_extra_info("peername")
        self.metrics["total_connections"] += 1
        self.metrics["active_connections"] += 1

        self._broadcast_event("CONNECTION_OPEN", {
            "client": f"{client_address[0]}:{client_address[1]}" if client_address else "Client",
            "message": f"Nouvelle connexion TCP acceptée depuis {client_address}"
        })

        try:
            while True:
                header_data = await reader.readexactly(2)
                if not header_data:
                    break

                message_length = struct.unpack("!H", header_data)[0]
                payload = await reader.readexactly(message_length)
                start_time = time.perf_counter()

                raw_message = payload.decode("ascii", errors="replace")
                mti = raw_message[:4]
                self.metrics["total_requests"] += 1

                response_msg: Optional[ISO8583Message] = None
                rule_info = ""
                extra_meta: Dict[str, Any] = {}

                if mti == "0800":
                    self.metrics["requests_0800"] += 1
                    response_msg, net_desc = self.process_0800(payload)
                    elapsed_ms = (time.perf_counter() - start_time) * 1000
                    self.metrics["last_latency_ms"] = round(elapsed_ms, 2)
                    self._broadcast_event("TRANSACTION_0800", {
                        "mti": "0800",
                        "response_mti": "0810",
                        "latency_ms": round(elapsed_ms, 2),
                        "code": response_msg.get_field(39, "00"),
                        "status": "APPROVED" if response_msg.get_field(39, "00") == "00" else "REJECTED",
                        "message": f"0800 {net_desc} traité en {elapsed_ms:.2f} ms -> DE 39: {response_msg.get_field(39, '00')}"
                    })

                elif mti in ("0200", "0100", "0220", "0120"):
                    self.metrics["requests_0200"] += 1
                    response_msg, rule_info, extra_meta = self.process_0200(payload)
                    elapsed_ms = (time.perf_counter() - start_time) * 1000
                    self.metrics["last_latency_ms"] = round(elapsed_ms, 2)
                    de39 = response_msg.get_field(39, "96")
                    ch = extra_meta.get("channel", "TPE")
                    if ch == "GAB":
                        self.metrics["requests_gab"] += 1
                    elif ch == "ECOM":
                        self.metrics["requests_ecom"] += 1
                    else:
                        self.metrics["requests_tpe"] += 1

                    if de39 == "00":
                        self.metrics["approved"] += 1
                    else:
                        self.metrics["rejected"] += 1

                    self._broadcast_event("TRANSACTION_0200", {
                        "mti": mti,
                        "response_mti": response_msg.mti,
                        "channel": ch,
                        "masked_pan": mask_pan(response_msg.get_field(2)),
                        "amount": int(response_msg.get_field(4, "0")) if response_msg.get_field(4, "0").isdigit() else 0,
                        "code": de39,
                        "auth_code": response_msg.get_field(38, ""),
                        "rule": rule_info,
                        "latency_ms": round(elapsed_ms, 2),
                        "latency_breakdown": extra_meta.get("latency_breakdown", {}),
                        "message": f"[{ch}] {mti} Traité en {elapsed_ms:.2f} ms -> DE 39: {de39} ({rule_info})"
                    })

                elif mti in ("0400", "0420"):
                    self.metrics["requests_0400"] += 1
                    response_msg = self.process_0400(payload)
                    elapsed_ms = (time.perf_counter() - start_time) * 1000
                    self.metrics["last_latency_ms"] = round(elapsed_ms, 2)
                    de39 = response_msg.get_field(39, "96")
                    self._broadcast_event("TRANSACTION_0400", {
                        "mti": mti,
                        "response_mti": response_msg.mti,
                        "code": de39,
                        "latency_ms": round(elapsed_ms, 2),
                        "message": f"{mti} Reversal traité en {elapsed_ms:.2f} ms -> DE 39: {de39}"
                    })

                else:
                    logger.warning(f"MTI non supporté : {mti}")
                    resp = ISO8583Message("0210")
                    resp.set_field(39, "12")
                    response_msg = resp

                resp_payload = response_msg.pack()
                resp_header = struct.pack("!H", len(resp_payload))
                writer.write(resp_header + resp_payload)
                await writer.drain()

        except asyncio.IncompleteReadError:
            pass
        except Exception as e:
            logger.error(f"Erreur traitement client {client_address} : {str(e)}")
        finally:
            self.metrics["active_connections"] = max(0, self.metrics["active_connections"] - 1)
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass
            self._broadcast_event("CONNECTION_CLOSE", {
                "message": f"Déconnexion du client {client_address}"
            })

    def process_0800(self, payload: bytes) -> Tuple[ISO8583Message, str]:
        """Génère la réponse 0810 (Liaison réseau, Logon, Key Exchange, Cutover)."""
        try:
            req_msg = ISO8583Message.unpack(payload)
            net_code = req_msg.get_field(70, "301")
            stan = req_msg.get_field(11, "000001")
        except Exception:
            net_code = "301"
            stan = "000001"

        resp = ISO8583Message("0810")
        resp.set_field(7, time.strftime("%m%d%H%M%S"))
        resp.set_field(11, stan)
        resp.set_field(70, net_code)

        net_descriptions = {
            "301": "Echo Test Réseau / Keep-Alive",
            "001": "Logon / Sign-On Switch Monétique",
            "002": "Logoff / Sign-Off Switch Monétique",
            "101": "Échange Dynamique Clé HSM ZPK",
            "201": "Cutover / Bascule Comptable Journalière",
        }
        net_desc = net_descriptions.get(net_code, f"Gestion Réseau ({net_code})")

        if self.engine.chaos_config.get("host_down_91"):
            resp.set_field(39, "91")
        else:
            resp.set_field(39, "00")
            if net_code == "101":
                resp.set_field(48, "ZPK=B47E29A81C0D3F5E729B1A0C8D6E4F2A KCV=5A2B9C")
            elif net_code == "201":
                resp.set_field(48, f"BATCH_ID=CUT-{time.strftime('%Y%m%d%H%M')}")

        return resp, net_desc

    def process_0200(self, payload: bytes) -> Tuple[ISO8583Message, str, Dict[str, Any]]:
        """
        Décode la demande 0200/0100/0220/0120, soumet au moteur de décision multi-canal,
        et construit la réponse 0210/0110/0230/0130 avec DE 38, DE 39 et DE 54/48 éventuels.
        """
        try:
            req_msg = ISO8583Message.unpack(payload)
        except Exception as e:
            logger.warning(f"Échec parsing 0200 : {e}")
            resp = ISO8583Message("0210")
            resp.set_field(39, "30")  # Format error
            return resp, "R00-FMT: Erreur de Format Trame (DE 39 = 30)", {"channel": "TPE"}

        resp_mti_map = {
            "0100": "0110",
            "0120": "0130",
            "0200": "0210",
            "0220": "0230",
        }
        resp_mti = resp_mti_map.get(req_msg.mti, "0210")
        pan = req_msg.get_field(2)
        amount_raw = req_msg.get_field(4, "0")
        if not amount_raw.isdigit():
            resp = ISO8583Message(resp_mti)
            resp.set_field(2, pan)
            resp.set_field(39, "30")
            return resp, "R00-FMT: Montant DE 4 non numérique (DE 39 = 30)", {"channel": req_msg.detect_channel()}

        amount = int(amount_raw)
        currency = req_msg.get_field(49, "952")
        pin = req_msg.get_field(52, "").strip()
        exp = req_msg.get_field(14, "")
        tx_date = req_msg.get_field(13, time.strftime("%y%m"))
        stan = req_msg.get_field(11, "000001")
        terminal_id = req_msg.get_field(41, "TERM0001")
        merchant_id = req_msg.get_field(42, "MERCHANT0000001")
        proc_code = req_msg.get_field(3, "000000")
        mcc = req_msg.get_field(18, "")
        pos_entry_mode = req_msg.get_field(22, "051")
        pos_condition_code = req_msg.get_field(25, "00")
        de48 = req_msg.get_field(48, "")
        mac = req_msg.get_field(64, "")
        channel = req_msg.detect_channel()

        # Journalisation sécurisée PCI-DSS (masquage PAN 6/4)
        logger.info(f"[{channel}] Demande {req_msg.mti} reçue : {mask_pan(pan)} - Mt : {amount} FCFA")

        tx_data = {
            "mti": req_msg.mti,
            "pan": pan,
            "amount": amount,
            "currency": currency,
            "pin": pin,
            "exp": exp,
            "tx_date": tx_date,
            "stan": stan,
            "terminal_id": terminal_id,
            "merchant_id": merchant_id,
            "proc_code": proc_code,
            "mcc": mcc,
            "pos_entry_mode": pos_entry_mode,
            "pos_condition_code": pos_condition_code,
            "de48": de48,
            "mac": mac,
            "channel": channel,
        }

        de39, de38, rule_triggered, extra_meta = self.engine.authorize_transaction(tx_data)

        resp = ISO8583Message(resp_mti)
        resp.set_field(2, pan)
        resp.set_field(3, proc_code)
        resp.set_field(4, str(amount).zfill(12))
        resp.set_field(7, time.strftime("%m%d%H%M%S"))
        resp.set_field(11, stan)
        if mcc:
            resp.set_field(18, mcc)
        if pos_entry_mode:
            resp.set_field(22, pos_entry_mode)
        if pos_condition_code:
            resp.set_field(25, pos_condition_code)
        resp.set_field(41, terminal_id)
        resp.set_field(42, merchant_id)
        resp.set_field(49, currency)

        resp.set_field(39, de39)
        if de39 == "00" and de38:
            resp.set_field(38, de38)

        if extra_meta.get("de54_balance"):
            resp.set_field(54, extra_meta["de54_balance"])

        return resp, rule_triggered, extra_meta

    def process_0400(self, payload: bytes) -> ISO8583Message:
        """
        Décode la demande d'annulation 0400/0420, traite le champ DE 90 (totale ou partielle via DE 4)
        et génère la réponse 0410.
        """
        try:
            req_msg = ISO8583Message.unpack(payload)
        except Exception:
            resp = ISO8583Message("0410")
            resp.set_field(39, "30")
            return resp

        de_90 = req_msg.get_field(90, "")
        pan = req_msg.get_field(2, "")
        stan = req_msg.get_field(11, "000001")
        amt_str = req_msg.get_field(4, "000000000000")
        rev_amount = int(amt_str) if amt_str.isdigit() and int(amt_str) > 0 else None

        logger.info(f"Demande 0400 Reversal reçue pour DE 90 : {de_90} (Montant: {rev_amount})")
        de39, orig_tx = self.engine.process_reversal(de_90, reversal_amount=rev_amount)

        resp_mti = "0430" if req_msg.mti == "0420" else "0410"
        resp = ISO8583Message(resp_mti)
        resp.set_field(2, pan)
        resp.set_field(3, req_msg.get_field(3, "000000"))
        resp.set_field(4, amt_str)
        resp.set_field(7, time.strftime("%m%d%H%M%S"))
        resp.set_field(11, stan)
        resp.set_field(39, de39)
        if de_90:
            resp.set_field(90, de_90)

        return resp


# Instance singleton
tcp_server = ISO8583TCPServer(host="127.0.0.1", port=5001)
