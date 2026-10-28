"""
Serveur API FastAPI & Passerelle WebSocket pour la Plateforme d'Exploitation & Simulation ISO 8583.
Expose :
- Les contrôles du serveur TCP (Port 5001) et l'état de la base MySQL (Port 8889)
- Le simulateur multi-canal (GAB, TPE EMV/NFC, E-Commerce 3-D Secure) avec cascade de latence et Runbook Exploitant
- Le parc de GAB et la gestion des cassettes de billets (10 000, 5 000, 2 000 FCFA)
- Le Centre d'Injection d'Incidents de Production (Chaos Engineering Monétique)
- La suite d'homologation & UAT (24 scénarios) et le laboratoire de charge 100 TPS.
"""

import asyncio
import json
import logging
import os
import time
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core.iso8583 import (
    ISO8583Message,
    create_0800_echo,
    create_0200_auth,
    create_0400_reversal,
    mask_pan,
    mask_sensitive_de48,
    DE_39_DESCRIPTIONS,
    DE_DEFINITIONS
)
from core.accounts_db import accounts_db
from core.users_db import users_db
from core.decision_engine import decision_engine
from core.tcp_server import tcp_server
from core.mysql_db import mysql_manager
from tests_suite.test_cases import TestSuiteRunner, TEST_CASES_DEFINITIONS, send_tcp_message
from tests_suite.load_tester import LoadTester
from core.packet_replay import PacketDissector, PacketReplayer
from core.clearing import ClearingEngine, CLEARING_DIR
from core.hsm_crypto import hsm_engine, HSMCryptoEngine
from core.iso20022 import iso20022_bridge, ISO20022Bridge

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ISO8583_API")

app = FastAPI(title="ISO 8583 Multi-Channel Host & Exploitation Simulator", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class WebSocketManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead_conns = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_conns.append(connection)
        for dead in dead_conns:
            self.disconnect(dead)


ws_manager = WebSocketManager()


def on_tcp_server_event(event: dict):
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(ws_manager.broadcast(event), loop)
    except Exception:
        pass


tcp_server.register_log_callback(on_tcp_server_event)

load_tester_instance = LoadTester(host=tcp_server.host, port=tcp_server.port)
packet_replayer = PacketReplayer(host=tcp_server.host, port=tcp_server.port)
active_load_test_task: Optional[asyncio.Task] = None
latest_load_test_result: Optional[dict] = None


# --- MODÈLES PYDANTIC ---

class TransactionRequest(BaseModel):
    mti: str = "0200"
    channel: Optional[str] = "TPE"       # GAB | TPE | ECOM
    pan: str = "4000123456780001"
    amount: int = 5000
    currency: str = "952"
    pin: str = "1234"
    exp: str = "2812"
    stan: str = "000001"
    terminal_id: str = "TERM0001"
    merchant_id: str = "MERCHANT0000001"
    proc_code: str = "000000"
    mcc: Optional[str] = None
    pos_entry_mode: Optional[str] = None
    pos_condition_code: Optional[str] = None
    de48: Optional[str] = None
    cvv2: Optional[str] = "123"
    threeds_status: Optional[str] = "Y"
    mac: Optional[str] = None
    tx_date: Optional[str] = None
    de_90: Optional[str] = None
    net_code: Optional[str] = "301"
    cashback_amount: Optional[int] = 0
    new_pin: Optional[str] = None


class LoadTestRequest(BaseModel):
    tps: int = 100
    duration: int = 10


class AccountUpdateRequest(BaseModel):
    pan: str
    cardholder_name: Optional[str] = None
    card_product: Optional[str] = None
    exp: Optional[str] = None
    pin: Optional[str] = None
    cvv2: Optional[str] = None
    balance: Optional[int] = None
    status: Optional[str] = None
    pin_tries: Optional[int] = None
    max_tx_limit: Optional[int] = None
    daily_ceiling: Optional[int] = None
    daily_spent: Optional[int] = None
    contactless_limit: Optional[int] = None
    channel_gab_enabled: Optional[bool] = None
    channel_tpe_enabled: Optional[bool] = None
    channel_ecom_enabled: Optional[bool] = None
    international_enabled: Optional[bool] = None
    threeds_enrolled: Optional[bool] = None
    velocity_tx_1h: Optional[int] = None
    velocity_max_1h: Optional[int] = None
    notes: Optional[str] = None
    # Aliases frontend
    allow_atm: Optional[bool] = None
    allow_pos: Optional[bool] = None
    allow_ecom: Optional[bool] = None
    allow_international: Optional[bool] = None
    tx_count_hour: Optional[int] = None


class AccountCreateRequest(BaseModel):
    pan: str
    cardholder_name: str = "PORTEUR PROD SUR-MESURE"
    card_product: str = "VISA PREMIER XOF"
    exp: str = "2812"
    pin: str = "1234"
    cvv2: str = "123"
    balance: int = 500000
    daily_spent: int = 0
    daily_ceiling: int = 1000000
    max_tx_limit: int = 300000
    contactless_limit: int = 15000
    pin_tries: int = 0
    status: str = "ACTIVE"
    channel_gab_enabled: bool = True
    channel_tpe_enabled: bool = True
    channel_ecom_enabled: bool = True
    international_enabled: bool = False
    threeds_enrolled: bool = True
    velocity_tx_1h: int = 0
    velocity_max_1h: int = 15
    notes: str = "Profil créé sur-mesure pour reproduction d'incident Prod / UAT"
    allow_atm: Optional[bool] = None
    allow_pos: Optional[bool] = None
    allow_ecom: Optional[bool] = None
    allow_international: Optional[bool] = None
    tx_count_hour: Optional[int] = None


class RawFrameRequest(BaseModel):
    raw_frame: str
    format: Optional[str] = "AUTO"  # AUTO | ASCII | HEX


class AtmUpdateRequest(BaseModel):
    terminal_id: str
    status: Optional[str] = None
    cassette_10000: Optional[int] = None
    cassette_5000: Optional[int] = None
    cassette_2000: Optional[int] = None
    fault_mode: Optional[str] = None


class ChaosUpdateRequest(BaseModel):
    host_down_91: Optional[bool] = None
    stip_standin_enabled: Optional[bool] = None
    stip_max_amount: Optional[int] = None
    timeout_enabled: Optional[bool] = None
    timeout_delay_ms: Optional[int] = None
    sla_timeout_threshold_ms: Optional[int] = None
    auto_reversal_on_timeout: Optional[bool] = None
    hsm_failure_mode: Optional[str] = None
    gab_fault_mode: Optional[str] = None
    duplicate_stan_check: Optional[bool] = None
    format_error_30_sim: Optional[bool] = None
    routing_error_92_sim: Optional[bool] = None
    artificial_latency_ms: Optional[int] = None
    artificial_jitter_ms: Optional[int] = None


class UserLoginRequest(BaseModel):
    identifier: str
    password: str


class UserCreateRequest(BaseModel):
    name: str
    email: str
    password: str = "123456"
    role: Optional[str] = None
    roles: Optional[List[str]] = None
    department: Optional[str] = "Monétique & Moyens de Paiement"
    active: bool = True


class UserUpdateRequest(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    roles: Optional[List[str]] = None
    active: Optional[bool] = None
    password: Optional[str] = None


class UserToggleStatusRequest(BaseModel):
    id: str


class UserResetPasswordRequest(BaseModel):
    id: str
    password: str


class UserDeleteRequest(BaseModel):
    id: str


class ReplayDissectRequest(BaseModel):
    raw_hex: str


class ReplayExecuteRequest(BaseModel):
    raw_hex: str
    timeout_seconds: Optional[float] = 3.0


class ClearingGenerateRequest(BaseModel):
    format: Optional[str] = "GIM_UEMOA"
    bank_code: Optional[str] = "CI099"
    batch_seq: Optional[int] = 1


@app.on_event("startup")
async def on_app_startup():
    try:
        users_db.sync_from_mysql(mysql_manager)
    except Exception as e:
        logger.warning(f"Sync users au démarrage: {e}")


# --- ROUTES UTILISATEURS & RBAC ---

@app.get("/api/users")
async def get_all_users():
    """Retourne la liste des utilisateurs de l'application."""
    return {"users": users_db.list_users()}


@app.post("/api/users/login")
async def login_user_endpoint(req: UserLoginRequest):
    """Authentifie un utilisateur avec son email ou identifiant et mot de passe."""
    try:
        user = users_db.authenticate(req.identifier, req.password)
        if not user:
            raise HTTPException(status_code=401, detail="Identifiant ou mot de passe incorrect.")
        return {"status": "authenticated", "user": user}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/api/users/create")
async def create_user_endpoint(req: UserCreateRequest):
    """Crée un nouvel utilisateur."""
    try:
        new_u = users_db.create_user(req.dict(), mysql_manager=mysql_manager)
        await ws_manager.broadcast({
            "type": "USER_CREATED",
            "message": f"Nouvel utilisateur créé : {new_u['name']} ({new_u['email']})"
        })
        return {"status": "created", "user": new_u}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/users/update")
async def update_user_endpoint(req: UserUpdateRequest):
    """Met à jour un utilisateur existant."""
    try:
        updates = {k: v for k, v in req.dict().items() if k != "id" and v is not None}
        updated = users_db.update_user(req.id, updates, mysql_manager=mysql_manager)
        await ws_manager.broadcast({
            "type": "USER_UPDATED",
            "message": f"Utilisateur mis à jour : {updated['name']}"
        })
        return {"status": "updated", "user": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/users/toggle-status")
async def toggle_user_status_endpoint(req: UserToggleStatusRequest):
    """Active ou suspend un utilisateur."""
    try:
        updated = users_db.toggle_status(req.id, mysql_manager=mysql_manager)
        action_label = "activé" if updated["active"] else "suspendu"
        await ws_manager.broadcast({
            "type": "USER_STATUS_TOGGLED",
            "message": f"Compte {action_label} : {updated['name']}"
        })
        return {"status": "updated", "user": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/users/reset-password")
async def reset_user_password_endpoint(req: UserResetPasswordRequest):
    """Réinitialise le mot de passe d'un utilisateur."""
    try:
        updated = users_db.reset_password(req.id, req.password, mysql_manager=mysql_manager)
        return {"status": "password_reset", "user": updated}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/users/delete")
async def delete_user_endpoint(req: UserDeleteRequest):
    """Supprime un utilisateur."""
    try:
        users_db.delete_user(req.id, mysql_manager=mysql_manager)
        await ws_manager.broadcast({
            "type": "USER_DELETED",
            "message": f"Utilisateur {req.id} supprimé"
        })
        return {"status": "deleted", "id": req.id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# --- ROUTES REST ---

@app.get("/api/status")
async def get_system_status():
    """Retourne l'état du serveur TCP, de la base MySQL, des canaux et du mode Chaos."""
    stats = tcp_server.get_stats()
    stats["total_accounts"] = len(accounts_db.list_accounts())
    stats["total_balance_pool"] = accounts_db.total_balance()
    stats["load_test_running"] = load_tester_instance.is_running
    db_info = mysql_manager.get_db_info()
    stats["mysql"] = db_info
    stats["mysql_connected"] = db_info.get("connected", False)
    stats["chaos"] = decision_engine.get_chaos_config()
    return stats


@app.post("/api/server/start")
async def start_tcp_server():
    if not tcp_server.is_running:
        await tcp_server.start()
    return {"status": "started", "host": tcp_server.host, "port": tcp_server.port}


@app.post("/api/server/stop")
async def stop_tcp_server():
    if tcp_server.is_running:
        await tcp_server.stop()
    return {"status": "stopped"}


@app.get("/api/accounts")
async def get_all_accounts():
    """Retourne la liste des 50+ comptes de test avec masquage PCI-DSS."""
    accs = accounts_db.list_accounts()
    return {
        "accounts": accs,
        "total": len(accs),
        "total_balance": accounts_db.total_balance(),
        "mysql_connected": mysql_manager.connected
    }


@app.post("/api/accounts/reset")
async def reset_accounts():
    """Restaure les 50 comptes, les GAB et le Chaos dans leur état de référence initial et synchronise MySQL."""
    accounts_db.reset_to_default()
    decision_engine.reset_chaos_config()
    decision_engine.clear_history()
    await ws_manager.broadcast({
        "type": "ACCOUNTS_RESET",
        "message": "Référentiel MySQL (50 comptes + 3 GAB + Chaos) réinitialisé aux valeurs d'usine."
    })
    return {"status": "reset_complete", "accounts_count": len(accounts_db.list_accounts())}


@app.post("/api/accounts/create")
async def create_custom_account(req: AccountCreateRequest):
    """Crée ou clone une carte/compte sur-mesure (PAN/BIN personnalisé, PIN, CVV2, plafonds) dans MySQL."""
    try:
        acc = accounts_db.create_account(req.dict())
        await ws_manager.broadcast({
            "type": "ACCOUNT_CREATED",
            "message": f"Nouveau porteur sur-mesure créé dans MySQL : {acc['masked_pan']} ({acc['cardholder_name']})"
        })
        return {"status": "created", "account": acc}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/accounts/update")
async def update_account(req: AccountUpdateRequest):
    """Met à jour les propriétés d'un compte (solde, statut, PIN, CVV2, expiration, droits canaux, 3DS, vélocité) dans MySQL."""
    updates = {
        k: v for k, v in req.dict().items()
        if k != "pan" and v is not None
    }
    success = accounts_db.update_account(req.pan, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Compte non trouvé")
    return {"status": "updated", "account": accounts_db.get_account(req.pan)}


# --- ROUTES PARC GAB & CASSETTES ---

@app.get("/api/atms")
async def get_all_atms():
    """Retourne la liste des GAB (ATM) et l'état de leurs cassettes de billets."""
    return {"atms": accounts_db.list_atms()}


@app.post("/api/atms/update")
async def update_atm_terminal(req: AtmUpdateRequest):
    updates = {k: v for k, v in req.dict().items() if k != "terminal_id" and v is not None}
    updated = accounts_db.update_atm(req.terminal_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Terminal GAB non trouvé")
    return {"status": "updated", "atm": updated}


@app.post("/api/atms/refill")
async def refill_all_atms():
    """Recharge intégralement les cassettes des 3 GAB dans MySQL."""
    for tid in ["GAB00001", "GAB00002", "GAB00003"]:
        accounts_db.update_atm(tid, {
            "status": "ONLINE",
            "cassette_10000": 200,
            "cassette_5000": 300,
            "cassette_2000": 400,
            "fault_mode": "NONE"
        })
    return {"status": "refilled", "atms": accounts_db.list_atms()}


# --- ROUTES CHAOS ENGINEERING & INCIDENTS DE PRODUCTION ---

@app.get("/api/chaos")
async def get_chaos_state():
    return {"chaos": decision_engine.get_chaos_config()}


@app.post("/api/chaos/update")
async def update_chaos_state(req: ChaosUpdateRequest):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    cfg = decision_engine.update_chaos_config(updates)
    await ws_manager.broadcast({
        "type": "CHAOS_UPDATED",
        "message": f"Configuration d'incidents d'exploitation mise à jour : {json.dumps(updates)}",
        "data": cfg
    })
    return {"status": "updated", "chaos": cfg}


@app.post("/api/chaos/reset")
async def reset_chaos_state():
    cfg = decision_engine.reset_chaos_config()
    await ws_manager.broadcast({
        "type": "CHAOS_RESET",
        "message": "Tous les incidents simulés ont été levés (Retour à l'état nominal).",
        "data": cfg
    })
    return {"status": "reset", "chaos": cfg}


# --- SIMULATEUR MULTI-CANAL INTERACTIF ---

@app.post("/api/test/send")
async def send_interactive_transaction(req: TransactionRequest):
    """
    Simulateur de terminal multi-canal (GAB, TPE, E-Commerce) :
    Encode la trame ISO 8583 (0800, 0200/0100 ou 0400), l'envoie via la socket TCP réelle (port 5001),
    et retourne l'analyse complète : trames ASCII/HEX, champs DE masqués PCI-DSS,
    cascade de latence (Waterfall), découpage billets GAB et fiche Runbook Exploitant.
    """
    if not tcp_server.is_running:
        await tcp_server.start()

    mti = req.mti.strip()
    channel = (req.channel or "TPE").upper()

    if mti == "0800":
        msg = create_0800_echo(stan=req.stan, net_code=req.net_code or "301")
    elif mti in ("0400", "0420"):
        de_90_val = req.de_90
        if not de_90_val:
            de_90_val = f"0200{req.stan.zfill(6)}10261441000000000000100000000001"
        msg = create_0400_reversal(
            pan=req.pan,
            amount=req.amount,
            orig_stan=req.stan,
            currency=req.currency,
            stan=str(int(req.stan) + 1).zfill(6) if req.stan.isdigit() else "000002",
            terminal_id=req.terminal_id
        )
        msg.mti = mti
        msg.set_field(90, de_90_val)
    else:
        extra_de48 = req.de48 or ""
        if req.proc_code == "900000" and req.new_pin:
            extra_de48 = (extra_de48 + f" NEW_PIN={req.new_pin}").strip()
        if req.proc_code == "090000" and req.cashback_amount:
            extra_de48 = (extra_de48 + f" CASHBACK={req.cashback_amount}").strip()

        msg = create_0200_auth(
            pan=req.pan,
            amount=req.amount,
            currency=req.currency,
            pin=req.pin,
            exp=req.exp,
            stan=req.stan,
            terminal_id=req.terminal_id,
            merchant_id=req.merchant_id,
            tx_date=req.tx_date,
            proc_code=req.proc_code,
            mcc=req.mcc,
            pos_entry_mode=req.pos_entry_mode,
            pos_condition_code=req.pos_condition_code,
            de48_private=extra_de48 if extra_de48 else None,
            mac=req.mac,
            channel=channel,
            cvv2=req.cvv2,
            threeds_status=req.threeds_status,
        )
        msg.mti = mti

    raw_req_bytes = msg.pack()
    raw_req_hex = msg.pack_tcp().hex()

    try:
        resp_msg, latency_ms = await send_tcp_message(tcp_server.host, tcp_server.port, msg)
        raw_resp_bytes = resp_msg.pack()
        raw_resp_hex = resp_msg.pack_tcp().hex()
        de39 = resp_msg.get_field(39, "96")
        de38 = resp_msg.get_field(38, "")
        de54 = resp_msg.get_field(54, "")

        code_meta = DE_39_DESCRIPTIONS.get(de39, {
            "label": "Code inconnu",
            "status": "UNKNOWN",
            "category": "AUTRE",
            "severity": "WARNING",
            "failing_component": "HOST",
            "action": "Consulter les spécifications",
            "root_cause": "Code réponse non répertorié",
            "runbook": ["Vérifier la table des codes DE 39."]
        })

        # Récupérer la dernière entrée d'audit pour extraire la cascade de latence exacte
        recent_logs = decision_engine.get_audit_history(limit=1)
        last_audit = recent_logs[0] if recent_logs else {}
        latency_breakdown = last_audit.get(
            "latency_breakdown",
            decision_engine.compute_latency_breakdown(channel, latency_ms)
        )

        # Masquage PCI-DSS de la trame ASCII affichée
        req_ascii_safe = raw_req_bytes.decode("ascii", errors="replace")
        if req.pan and len(req.pan) >= 12:
            req_ascii_safe = req_ascii_safe.replace(req.pan, mask_pan(req.pan))
        resp_ascii_safe = raw_resp_bytes.decode("ascii", errors="replace")
        if req.pan and len(req.pan) >= 12:
            resp_ascii_safe = resp_ascii_safe.replace(req.pan, mask_pan(req.pan))

        runbook_list = code_meta.get("runbook", [])
        runbook_str = " • ".join(runbook_list) if isinstance(runbook_list, list) else str(runbook_list)

        return {
            "success": True,
            "channel": msg.detect_channel() if mti != "0800" else "NETWORK",
            "latency_ms": round(latency_ms, 2),
            "latency_breakdown": latency_breakdown,
            "rule_triggered": last_audit.get("rule", ""),
            "atm_notes_dispensed": last_audit.get("atm_notes_dispensed", {}),
            "auto_reversal_triggered": bool(last_audit.get("auto_reversal", False)),
            "auto_reversal_reason": last_audit.get("description", "") if last_audit.get("auto_reversal") else "",
            "stip_approved": last_audit.get("rule") == "R00-STIP",
            "request": {
                "mti": msg.mti,
                "raw_ascii": req_ascii_safe,
                "raw_hex": raw_req_hex,
                "fields": msg.to_safe_fields_dict(),
                "masked_pan": mask_pan(req.pan)
            },
            "response": {
                "mti": resp_msg.mti,
                "raw_ascii": resp_ascii_safe,
                "raw_hex": raw_resp_hex,
                "fields": resp_msg.to_safe_fields_dict(),
                "de39": de39,
                "de38": de38,
                "de54": de54,
                "status": code_meta["status"],
                "label": code_meta["label"],
                "category": code_meta.get("category", "METIER"),
                "severity": code_meta.get("severity", "INFO"),
                "failing_component": code_meta.get("failing_component", "HOST"),
                "component": code_meta.get("failing_component", "HOST"),
                "action": code_meta["action"],
                "root_cause": code_meta.get("root_cause", ""),
                "meaning": code_meta.get("root_cause", ""),
                "runbook": runbook_list,
                "operator_runbook": runbook_str,
                "rule_triggered": last_audit.get("rule", ""),
                "audit_description": last_audit.get("description", "")
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "latency_ms": 0.0
        }


def _extract_iso_payload_bytes(raw_input: str, fmt: str = "AUTO") -> bytes:
    """
    Extrait les octets de la trame ISO 8583 (sans l'en-tête TCP 2-octets) à partir d'une chaîne
    brute copiée depuis un log de production (Hexadécimal avec ou sans header 2-bytes, ou ASCII).
    """
    import re
    import struct

    text = (raw_input or "").strip()
    text = re.sub(r"^\[(ASCII|HEX)\]\s*", "", text, flags=re.IGNORECASE).strip()
    compact = re.sub(r"\s+", "", text)
    if not compact:
        raise ValueError("La trame fournie est vide.")

    mode = (fmt or "AUTO").upper()

    # 1. Trame Hexadécimale représentant de l'ASCII encodé (ex: 30323030 = "0200")
    if compact.upper().startswith(("30313030", "30323030", "30343030", "30343230", "30383030")):
        try:
            return bytes.fromhex(compact)
        except Exception:
            pass

    # 2. Header TCP 2-octets (4 hex) suivi d'ASCII encodé (ex: 004c30323030...)
    if len(compact) > 8 and compact[4:12].upper() in ("30313030", "30323030", "30343030", "30343230", "30383030"):
        try:
            raw_bytes = bytes.fromhex(compact)
            return raw_bytes[2:]
        except Exception:
            pass

    # 3. Trame ASCII pure commençant par un MTI standard
    valid_mtis = ("0100", "0110", "0120", "0130", "0200", "0210", "0220", "0230", "0400", "0410", "0420", "0430", "0800", "0810")
    if any(compact.startswith(m) for m in valid_mtis):
        return compact.encode("ascii", errors="replace")

    # 4. Trame avec cadrage TCP 2-octets suivi d'un MTI ASCII (ex: 004c0200...)
    if len(compact) > 4 and any(compact[4:].startswith(m) for m in valid_mtis):
        return compact[4:].encode("ascii", errors="replace")

    # 5. Format explicitement HEX ou payload hexadécimal
    is_hex_chars = bool(re.fullmatch(r"[0-9a-fA-F]+", compact)) and (len(compact) % 2 == 0)
    if (mode == "HEX" or mode == "AUTO") and is_hex_chars:
        try:
            raw_bytes = bytes.fromhex(compact)
            if len(raw_bytes) >= 4:
                declared_len = struct.unpack("!H", raw_bytes[:2])[0]
                if declared_len == len(raw_bytes) - 2:
                    return raw_bytes[2:]
            return raw_bytes
        except Exception:
            pass

    return text.encode("ascii", errors="replace")


@app.post("/api/test/decode-raw")
async def decode_raw_iso_frame(req: RawFrameRequest):
    """
    Décode une trame brute ISO 8583 (Hex ou ASCII issue d'un log de production),
    retourne tous les Data Elements (DE) décodés et prépare le pré-remplissage du simulateur.
    Supporte à la fois ISO8583Message.unpack() et le fallback sur PacketDissector.
    """
    try:
        payload_bytes = _extract_iso_payload_bytes(req.raw_frame, req.format or "AUTO")
        raw_ascii_str = payload_bytes.decode("ascii", errors="replace")
        hex_dump_lines = []
        for i in range(0, len(payload_bytes), 16):
            chunk = payload_bytes[i:i+16]
            hex_part = " ".join(f"{b:02X}" for b in chunk)
            ascii_part = "".join(chr(b) if 32 <= b <= 126 else "." for b in chunk)
            hex_dump_lines.append({
                "offset": f"{i:04X}",
                "hex": hex_part,
                "ascii": ascii_part
            })

        mti_dict = {
            "0100": "0100 — Demande d'Autorisation (Pré-Autorisation / Caution)",
            "0110": "0110 — Réponse d'Autorisation",
            "0120": "0120 — Avis d'Autorisation (Advice)",
            "0130": "0130 — Acquittement d'Avis d'Autorisation",
            "0200": "0200 — Demande Financière / Débit Direct (Achat ou Retrait)",
            "0210": "0210 — Réponse Financière / Débit Direct",
            "0220": "0220 — Avis Financier (Completion / Confirmation)",
            "0230": "0230 — Acquittement d'Avis Financier",
            "0400": "0400 — Demande d'Annulation / Reversal Immédiat",
            "0410": "0410 — Réponse d'Annulation / Reversal",
            "0420": "0420 — Avis d'Annulation Répété / Reversal Advice",
            "0430": "0430 — Acquittement d'Annulation / Reversal Advice Response",
            "0800": "0800 — Demande de Gestion Réseau / Échange de Clés",
            "0810": "0810 — Réponse de Gestion Réseau / Échange de Clés",
        }

        # Tentative 1 : Unpack standard avec ISO8583Message
        try:
            msg = ISO8583Message.unpack(payload_bytes)
            channel = msg.detect_channel() if msg.mti != "0800" else "NETWORK"
            safe_fields = msg.to_safe_fields_dict()

            de_details = []
            for de_num in sorted(msg.fields.keys()):
                meta = DE_DEFINITIONS.get(de_num, {"name": f"Data Element {de_num}", "type": "FIXED"})
                safe_val = safe_fields.get(str(de_num), msg.fields[de_num])
                de_details.append({
                    "de": de_num,
                    "name": meta["name"],
                    "type": meta["type"],
                    "value": msg.fields[de_num],
                    "safe_value": safe_val,
                    "masked_value": safe_val,
                })

            de48_str = msg.get_field(48, "")
            cvv2_val = "123"
            threeds_val = "Y"
            for token in de48_str.split(";"):
                if "=" in token:
                    k, v = token.split("=", 1)
                    if k.strip().upper() == "CVV2":
                        cvv2_val = v.strip()
                    elif k.strip().upper() == "3DS":
                        threeds_val = v.strip()

            raw_amount = msg.get_field(4, "0")
            amount_int = int(raw_amount) if raw_amount.isdigit() else 0
            pin_raw = msg.get_field(52, "1234").strip()
            bitmap_hex = raw_ascii_str[4:20] if len(raw_ascii_str) >= 20 else ""
            mti_desc = mti_dict.get(msg.mti, f"MTI {msg.mti} — Message Spécifique")

            mti_breakdown = {
                "version": f"ISO 8583-{msg.mti[0]} (1987)" if msg.mti.startswith("0") else f"ISO 8583-{msg.mti[0]}",
                "message_class": {"1": "Autorisation", "2": "Financière", "4": "Annulation / Reversal", "8": "Gestion Réseau"}.get(msg.mti[1], "Spécifique"),
                "function": {"0": "Demande (Request)", "1": "Réponse (Response)", "2": "Avis (Advice)", "3": "Acquittement Avis"}.get(msg.mti[2], "Spécifique"),
                "origin": {"0": "Acquéreur (Acquirer)", "1": "Répétition Acquéreur", "2": "Émetteur (Issuer)"}.get(msg.mti[3], "Spécifique")
            }

            active_fields = sorted(msg.fields.keys())

            emv_tags = []
            if 55 in msg.fields:
                emv_tags = PacketDissector.parse_emv_tlv(msg.fields[55])
            if not emv_tags:
                dissected = PacketDissector.dissect_packet(payload_bytes.hex())
                emv_tags = dissected.get("emv_tags", [])

            return {
                "success": True,
                "mti": msg.mti,
                "mti_desc": mti_desc,
                "mti_breakdown": mti_breakdown,
                "bitmap_hex": bitmap_hex,
                "active_fields": active_fields,
                "payload_length_bytes": len(payload_bytes),
                "channel": channel if channel in ("GAB", "TPE", "ECOM") else "TPE",
                "raw_ascii": raw_ascii_str,
                "raw_hex": msg.pack_tcp().hex(),
                "hex_dump_lines": hex_dump_lines,
                "emv_tags": emv_tags,
                "fields": {str(k): v for k, v in msg.fields.items()},
                "safe_fields": safe_fields,
                "de_details": de_details,
                "preset": {
                    "mti": msg.mti,
                    "channel": channel if channel in ("GAB", "TPE", "ECOM") else "TPE",
                    "pan": msg.get_field(2, "4000123456780001"),
                    "proc_code": msg.get_field(3, "000000"),
                    "processing_code": msg.get_field(3, "000000"),
                    "amount": amount_int,
                    "stan": msg.get_field(11, "000001"),
                    "exp": msg.get_field(14, "2812"),
                    "mcc": msg.get_field(18, "5411"),
                    "pos_entry_mode": msg.get_field(22, "051"),
                    "pos_condition_code": msg.get_field(25, "00"),
                    "terminal_id": msg.get_field(41, "TERM0001").strip(),
                    "merchant_id": msg.get_field(42, "MERCHANT0000001").strip(),
                    "de48": de48_str,
                    "currency": msg.get_field(49, "952"),
                    "pin": pin_raw or "1234",
                    "cvv2": cvv2_val,
                    "threeds_status": threeds_val,
                    "de_90": msg.get_field(90, ""),
                }
            }
        except Exception as unpack_exc:
            # Tentative 2 : Fallback sur le dissecteur PacketDissector (pour trames hex ou binaires complexes)
            logger.info(f"ISO8583Message.unpack a levé une exception ({unpack_exc}), recours à PacketDissector.")
            dissected = PacketDissector.dissect_packet(payload_bytes.hex())
            if not dissected.get("is_valid", False):
                dissected = PacketDissector.dissect_packet(req.raw_frame)

            dissect_mti = dissected.get("mti", "0200")
            if not dissect_mti or len(dissect_mti) < 4:
                dissect_mti = "0200"

            mti_desc = mti_dict.get(dissect_mti, dissected.get("mti_desc", f"MTI {dissect_mti}"))
            mti_breakdown = {
                "version": f"ISO 8583-{dissect_mti[0]} (1987)" if dissect_mti.startswith("0") else f"ISO 8583-{dissect_mti[0]}",
                "message_class": {"1": "Autorisation", "2": "Financière", "4": "Annulation / Reversal", "8": "Gestion Réseau"}.get(dissect_mti[1], "Spécifique"),
                "function": {"0": "Demande (Request)", "1": "Réponse (Response)", "2": "Avis (Advice)", "3": "Acquittement Avis"}.get(dissect_mti[2], "Spécifique"),
                "origin": {"0": "Acquéreur (Acquirer)", "1": "Répétition Acquéreur", "2": "Émetteur (Issuer)"}.get(dissect_mti[3], "Spécifique")
            }

            active_fields = dissected.get("active_fields", [])
            dissect_fields = dissected.get("fields", {})

            de_details = []
            safe_fields = {}
            for f_num in sorted(active_fields):
                field_info = dissect_fields.get(str(f_num), {})
                name = field_info.get("name", DE_DEFINITIONS.get(f_num, {}).get("name", f"Data Element {f_num}"))
                val = field_info.get("value_masked", field_info.get("status", "Présent"))
                safe_fields[str(f_num)] = val
                de_details.append({
                    "de": f_num,
                    "name": name,
                    "type": "VARIABLE" if f_num in (2, 35, 48, 55, 90) else "FIXED",
                    "value": val,
                    "safe_value": val,
                    "masked_value": val
                })

            return {
                "success": True,
                "mti": dissect_mti,
                "mti_desc": mti_desc,
                "mti_breakdown": mti_breakdown,
                "bitmap_hex": dissected.get("primary_bitmap_hex", ""),
                "active_fields": active_fields,
                "payload_length_bytes": len(payload_bytes),
                "channel": "TPE",
                "raw_ascii": raw_ascii_str,
                "raw_hex": payload_bytes.hex(),
                "hex_dump_lines": hex_dump_lines,
                "emv_tags": dissected.get("emv_tags", []),
                "fields": safe_fields,
                "safe_fields": safe_fields,
                "de_details": de_details,
                "preset": {
                    "mti": dissect_mti,
                    "channel": "TPE",
                    "pan": "4000123456780001",
                    "proc_code": "000000",
                    "processing_code": "000000",
                    "amount": 25000,
                    "stan": "000001",
                    "exp": "2812",
                    "mcc": "5411",
                    "pos_entry_mode": "051",
                    "pos_condition_code": "00",
                    "terminal_id": "TERM0001",
                    "merchant_id": "MERCHANT0000001",
                    "de48": "",
                    "currency": "952",
                    "pin": "1234",
                    "cvv2": "123",
                    "threeds_status": "Y",
                    "de_90": "",
                }
            }
    except Exception as e:
        return {
            "success": False,
            "error": f"Impossible de décoder la trame ISO 8583 : {str(e)}"
        }


@app.post("/api/test/replay-raw")
async def replay_raw_iso_frame(req: RawFrameRequest):
    """
    Rejoue directement une trame brute ISO 8583 (Hex ou ASCII issue de la production, même malformée)
    sur la socket TCP réelle (127.0.0.1:5001) avec cadrage binaire 2-octets Big-Endian.
    """
    import struct

    if not tcp_server.is_running:
        await tcp_server.start()

    try:
        payload_bytes = _extract_iso_payload_bytes(req.raw_frame, req.format or "AUTO")
        tcp_packet = struct.pack("!H", len(payload_bytes)) + payload_bytes

        # Tentative de décodage local pour l'affichage de la requête (tolérant aux trames volontairement malformées)
        req_pan = ""
        req_mti = payload_bytes[:4].decode("ascii", errors="replace") if len(payload_bytes) >= 4 else "0200"
        req_safe_fields: Dict[str, str] = {}
        detected_channel = "TPE"
        try:
            parsed_req = ISO8583Message.unpack(payload_bytes)
            req_pan = parsed_req.get_field(2, "")
            req_mti = parsed_req.mti
            req_safe_fields = parsed_req.to_safe_fields_dict()
            detected_channel = parsed_req.detect_channel() if req_mti != "0800" else "NETWORK"
        except Exception:
            pass

        t0 = time.perf_counter()
        reader, writer = await asyncio.open_connection(tcp_server.host, tcp_server.port)
        writer.write(tcp_packet)
        await writer.drain()

        resp_header = await asyncio.wait_for(reader.readexactly(2), timeout=5.0)
        resp_len = struct.unpack("!H", resp_header)[0]
        resp_payload = await asyncio.wait_for(reader.readexactly(resp_len), timeout=5.0)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        latency_ms = (time.perf_counter() - t0) * 1000.0

        resp_msg = ISO8583Message.unpack(resp_payload)
        de39 = resp_msg.get_field(39, "96")
        de38 = resp_msg.get_field(38, "")
        de54 = resp_msg.get_field(54, "")

        code_meta = DE_39_DESCRIPTIONS.get(de39, {
            "label": "Code inconnu",
            "status": "UNKNOWN",
            "category": "AUTRE",
            "severity": "WARNING",
            "failing_component": "HOST",
            "action": "Consulter les spécifications",
            "root_cause": "Code réponse non répertorié",
            "runbook": ["Vérifier la table des codes DE 39."]
        })

        if de39 == "30":
            last_audit = {
                "rule": "R30-FORMAT-ERROR (ISO 8583 Unpack)",
                "description": "Rejet protocolaire TCP : trame ISO 8583 malformée ou bitmap corrompu (DE 39 = 30).",
                "latency_breakdown": decision_engine.compute_latency_breakdown(detected_channel, latency_ms),
            }
        else:
            recent_logs = decision_engine.get_audit_history(limit=1)
            last_audit = recent_logs[0] if recent_logs else {}
        latency_breakdown = last_audit.get(
            "latency_breakdown",
            decision_engine.compute_latency_breakdown(detected_channel, latency_ms)
        )

        req_ascii_safe = payload_bytes.decode("ascii", errors="replace")
        if req_pan and len(req_pan) >= 12:
            req_ascii_safe = req_ascii_safe.replace(req_pan, mask_pan(req_pan))
        resp_ascii_safe = resp_payload.decode("ascii", errors="replace")
        if req_pan and len(req_pan) >= 12:
            resp_ascii_safe = resp_ascii_safe.replace(req_pan, mask_pan(req_pan))

        runbook_list = code_meta.get("runbook", [])
        runbook_str = " • ".join(runbook_list) if isinstance(runbook_list, list) else str(runbook_list)

        return {
            "success": True,
            "channel": detected_channel,
            "latency_ms": round(latency_ms, 2),
            "latency_breakdown": latency_breakdown,
            "rule_triggered": last_audit.get("rule", ""),
            "atm_notes_dispensed": last_audit.get("atm_notes_dispensed", {}),
            "auto_reversal_triggered": bool(last_audit.get("auto_reversal", False)),
            "auto_reversal_reason": last_audit.get("description", "") if last_audit.get("auto_reversal") else "",
            "stip_approved": last_audit.get("rule") == "R00-STIP",
            "request": {
                "mti": req_mti,
                "raw_ascii": req_ascii_safe,
                "raw_hex": tcp_packet.hex(),
                "fields": req_safe_fields,
                "masked_pan": mask_pan(req_pan) if req_pan else "N/A"
            },
            "response": {
                "mti": resp_msg.mti,
                "raw_ascii": resp_ascii_safe,
                "raw_hex": (resp_header + resp_payload).hex(),
                "fields": resp_msg.to_safe_fields_dict(),
                "de39": de39,
                "de38": de38,
                "de54": de54,
                "status": code_meta["status"],
                "label": code_meta["label"],
                "category": code_meta.get("category", "METIER"),
                "severity": code_meta.get("severity", "INFO"),
                "failing_component": code_meta.get("failing_component", "HOST"),
                "component": code_meta.get("failing_component", "HOST"),
                "action": code_meta["action"],
                "root_cause": code_meta.get("root_cause", ""),
                "meaning": code_meta.get("root_cause", ""),
                "runbook": runbook_list,
                "operator_runbook": runbook_str,
                "rule_triggered": last_audit.get("rule", ""),
                "audit_description": last_audit.get("description", "")
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "latency_ms": 0.0
        }


@app.post("/api/test/suite")
async def run_full_test_suite(include_uat: bool = True):
    """Exécute les 24 épreuves (12 Homologation Normative + 12 UAT Multi-Canal)."""
    if not tcp_server.is_running:
        await tcp_server.start()

    runner = TestSuiteRunner(host=tcp_server.host, port=tcp_server.port)
    report = await runner.run_all_tests(include_uat=include_uat)
    await ws_manager.broadcast({
        "type": "TEST_SUITE_COMPLETE",
        "data": report["summary"]
    })
    return report


@app.get("/api/test/definitions")
async def get_test_definitions():
    return {"test_cases": TEST_CASES_DEFINITIONS}


@app.post("/api/loadtest/start")
async def start_load_test(req: LoadTestRequest):
    global active_load_test_task, latest_load_test_result

    if load_tester_instance.is_running:
        raise HTTPException(status_code=400, detail="Un test de charge est déjà en cours.")

    if not tcp_server.is_running:
        await tcp_server.start()

    def on_progress(data: dict):
        asyncio.create_task(ws_manager.broadcast({
            "type": "LOAD_TEST_PROGRESS",
            "data": data,
            **data
        }))

    async def _runner():
        global latest_load_test_result
        try:
            res = await load_tester_instance.run_load_test(
                target_tps=req.tps,
                duration_seconds=req.duration,
                progress_cb=on_progress
            )
            latest_load_test_result = res
            await ws_manager.broadcast({
                "type": "LOAD_TEST_COMPLETE",
                "data": res,
                "report": res
            })
        except Exception as e:
            logger.error(f"Erreur test de charge : {e}")
            await ws_manager.broadcast({
                "type": "LOAD_TEST_ERROR",
                "error": str(e)
            })

    active_load_test_task = asyncio.create_task(_runner())
    return {
        "status": "started",
        "target_tps": req.tps,
        "duration_seconds": req.duration,
        "total_planned_tx": req.tps * req.duration
    }


@app.post("/api/loadtest/cancel")
async def cancel_load_test():
    if load_tester_instance.is_running:
        load_tester_instance.cancel()
        return {"status": "cancelling"}
    return {"status": "not_running"}


@app.get("/api/loadtest/latest")
async def get_latest_load_test():
    return latest_load_test_result or {"status": "no_test_executed_yet"}


@app.get("/api/audit/logs")
async def get_audit_logs(limit: int = 100):
    return {"logs": decision_engine.get_audit_history(limit=limit)}


@app.get("/api/rules")
async def get_decision_rules():
    """Retourne la matrice complète des 18 règles métier/techniques et le catalogue des 24 codes DE 39."""
    rules = [
        {"id": "R00-TECH", "prio": 0, "channel": "TOUS", "rule": "Intégrité Trame, Routage & Disponibilité Host/HSM", "fail": "Trame corrompue (30), BIN inconnu (92), Host Down (91), HSM/MAC (63/96), Time-out (68), Doublon STAN (94).", "code": "30/63/68/91/92/94/96", "label": "Technical & Security Guardrails", "behavior": "Rejet technique immédiat, Auto-Reversal 0400 sur 68, ou bascule Stand-In (STIP) sur 91."},
        {"id": "R01", "prio": 1, "channel": "TOUS", "rule": "Existence du PAN", "fail": "Le PAN (DE 2) n'existe pas dans la table MySQL `bank_accounts`.", "code": "14", "label": "No Such Card", "behavior": "Refus immédiat."},
        {"id": "R02", "prio": 2, "channel": "TOUS / GAB", "rule": "Opposition Volée / Perdue / Capture", "fail": "status IN ('STOLEN', 'LOST', 'CAPTURE')", "code": "43 / 41 / 04", "label": "Stolen / Lost / Pick-up Card", "behavior": "Refus catégorique. Capture physique de la carte par l'avaloir du GAB."},
        {"id": "R03", "prio": 3, "channel": "TOUS", "rule": "Validité Temporelle (Expiration)", "fail": "Date transaction locale (DE 13) > Date expiration (DE 14 YYMM)", "code": "54", "label": "Expired Card", "behavior": "Refus définitif. Ne pas reproposer."},
        {"id": "R04", "prio": 4, "channel": "GAB / TPE", "rule": "Tentatives PIN Dépassées", "fail": "Compteur faux PIN consécutifs >= 3", "code": "75", "label": "Allowable PIN Tries Exceeded", "behavior": "Blocage sécuritaire de la carte (Déblocage exploitant requis)."},
        {"id": "R05", "prio": 5, "channel": "GAB / TPE", "rule": "Conformité du PIN Block (DE 52)", "fail": "PIN erroné ou clé ZPK HSM désynchronisée", "code": "55", "label": "Incorrect PIN", "behavior": "Refus réessayable. Incrémentation atomique de `pin_tries`."},
        {"id": "R06", "prio": 6, "channel": "TOUS", "rule": "Conformité Devise & International", "fail": "Devise DE 49 != 952 (XOF) et `international_enabled == False`", "code": "58", "label": "Transaction Not Permitted to Terminal", "behavior": "Refus immédiat. Activer l'option Internationale si voyage."},
        {"id": "R07", "prio": 7, "channel": "TOUS", "rule": "Plafond Unitaire par Opération", "fail": "Montant brut DE 4 > `max_tx_limit`", "code": "61", "label": "Exceeds Withdrawal Amount Limit", "behavior": "Refus. Inviter à fractionner l'opération."},
        {"id": "R08", "prio": 8, "channel": "TOUS / NFC", "rule": "Plafond Journalier 24h & Seuil Sans-Contact NFC", "fail": "`daily_spent + amount > daily_ceiling` ou NFC (DE 22=071) > 15 000 FCFA sans PIN", "code": "65", "label": "Activity Limit Exceeded", "behavior": "Refus. Sur TPE NFC, demander l'insertion puce EMV (051) + PIN."},
        {"id": "R09", "prio": 9, "channel": "TOUS", "rule": "Solde Comptable Disponible", "fail": "Montant demandé > `balance` (hors consultation 310000)", "code": "51", "label": "Insufficient Funds", "behavior": "Refus réessayable. Approvisionner le compte."},
        {"id": "R10", "prio": 10, "channel": "GAB / TPE / ECOM", "rule": "Statut Carte & Permissions par Canal", "fail": "status IN ('SUSPENDED','FROZEN') ou canal (`channel_gab`, `channel_tpe`, `channel_ecom`) verrouillé", "code": "57 / 01", "label": "Not Permitted to Cardholder / Refer to Issuer", "behavior": "Refus administratif selon les droits du porteur."},
        {"id": "R11", "prio": 11, "channel": "TPE / TOUS", "rule": "Anti-Fraude : Fallback Piste & Vélocité 1h", "fail": "Fallback piste magnétique (DE 22=801) sur carte EMV ou `velocity_tx_1h >= velocity_max_1h`", "code": "59", "label": "Suspected Fraud", "behavior": "Blocage préventif anti-fraude. Exiger lecture puce EMV."},
        {"id": "R12", "prio": 12, "channel": "ECOM", "rule": "Sécurité E-Commerce : CVV2 & 3-D Secure (ECI)", "fail": "CVV2 erroné dans DE 48 ou absence de 3-D Secure (3DS=N / ECI=07) sur montant > 25 000 FCFA", "code": "05", "label": "Do Not Honor (CVV2 / 3DS Failure)", "behavior": "Refus immédiat par l'ACS / Host Émetteur."},
        {"id": "R13", "prio": 13, "channel": "GAB", "rule": "Coupures GAB & Disponibilité Cassettes", "fail": "Montant non composable avec les cassettes actives (10 000, 5 000, 2 000 FCFA) ou cassettes vides", "code": "13", "label": "Invalid Amount / ATM Denomination Error", "behavior": "Refus avant débit ou Auto-Reversal 0400 si bourrage/distribution partielle."}
    ]
    enriched_codes = {}
    for code, meta in DE_39_DESCRIPTIONS.items():
        r_list = meta.get("runbook", [])
        enriched_codes[code] = {
            **meta,
            "component": meta.get("failing_component", "HOST"),
            "meaning": meta.get("root_cause", ""),
            "operator_runbook": " • ".join(r_list) if isinstance(r_list, list) else str(r_list),
        }
    return {
        "rules": rules,
        "codes": enriched_codes,
        "de39_catalog": enriched_codes,
        "fields": DE_DEFINITIONS
    }


# --- ROUTES REJEU DE TRAMES BRUTES & EMV TLV ---

@app.post("/api/replay/dissect")
async def dissect_replay_packet(req: ReplayDissectRequest):
    """Dissection hexadécimale, parsing Bitmap et décodage TLV EMV (DE 55)."""
    return PacketDissector.dissect_packet(req.raw_hex)


@app.post("/api/replay/execute")
async def execute_replay_packet(req: ReplayExecuteRequest):
    """Rejeu d'une trame brute sur le port TCP d'autorisation 5001 avec mesure de latence."""
    return await packet_replayer.replay_packet_async(req.raw_hex, timeout_seconds=req.timeout_seconds or 3.0)


# --- ROUTES TÉLÉCOMPENSATION & CLEARING (GIM / BASE II / CORE BANKING) ---

@app.get("/api/clearing/batches")
async def get_clearing_batches():
    """Liste tous les lots de compensation générés."""
    return {"batches": ClearingEngine.list_batches()}


@app.post("/api/clearing/generate")
async def generate_clearing_batch_endpoint(req: ClearingGenerateRequest):
    """Génération d'un lot de télécompensation et des fichiers d'écritures comptables."""
    recent_audits = decision_engine.get_audit_history(limit=100)
    txs = []
    for a in recent_audits:
        if a.get("code") == "00":
            txs.append({
                "stan": a.get("stan", "000001"),
                "channel": a.get("channel", "TPE"),
                "mti": a.get("mti", "0200"),
                "pan": a.get("masked_pan", "400012******0001"),
                "amount": a.get("amount", 0),
                "response_code": "00",
                "auth_code": a.get("auth_code", "AUT001"),
                "terminal_id": a.get("terminal_id", "TERM0001"),
                "merchant_id": "MERCHANT0000001",
            })
    if not txs:
        # Transactions par défaut pour simulation
        txs = [
            {"stan": "000101", "channel": "GAB", "mti": "0200", "pan": "4000123456780001", "amount": 50000, "response_code": "00", "auth_code": "AUT101", "terminal_id": "GAB_AGENCE_01", "merchant_id": "GIM_CI_001"},
            {"stan": "000102", "channel": "TPE", "mti": "0200", "pan": "4000123456780002", "amount": 28500, "response_code": "00", "auth_code": "AUT102", "terminal_id": "TPE_COMMERCE_01", "merchant_id": "CARREFOUR_CI"},
            {"stan": "000103", "channel": "ECOM", "mti": "0200", "pan": "4000123456780003", "amount": 42000, "response_code": "00", "auth_code": "AUT103", "terminal_id": "WEB_JUMIA_01", "merchant_id": "JUMIA_CI_ECOM"},
            {"stan": "000104", "channel": "TPE", "mti": "0200", "pan": "4000123456780004", "amount": 12000, "response_code": "00", "auth_code": "AUT104", "terminal_id": "TPE_STATION_01", "merchant_id": "TOTAL_ENERGIES_CI"},
            {"stan": "000105", "channel": "GAB", "mti": "0200", "pan": "4000123456780005", "amount": 100000, "response_code": "00", "auth_code": "AUT105", "terminal_id": "GAB_AGENCE_02", "merchant_id": "GIM_CI_002"},
        ]
    return ClearingEngine.generate_clearing_batch(
        transactions=txs,
        format_type=req.format or "GIM_UEMOA",
        bank_code=req.bank_code or "CI099",
        batch_seq=req.batch_seq or 1
    )


@app.get("/api/clearing/download/{filename}")
async def download_clearing_file(filename: str):
    """Téléchargement direct du fichier de compensation généré."""
    file_path = os.path.join(CLEARING_DIR, filename)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Fichier de compensation non trouvé")
    media_type = "text/csv" if filename.endswith(".csv") else "text/plain"
    return FileResponse(file_path, media_type=media_type, filename=filename)


# --- ROUTES CRYPTOGRAPHIE BANCAIRE & ÉMULATEUR HSM THALES ---

class PinBlockRequest(BaseModel):
    pin: str = "1234"
    pan: str = "4000123456780001"
    format: str = "ISO-0"  # ISO-0, ISO-1, ISO-3
    zpk: Optional[str] = None
    dest_zpk: Optional[str] = None
    encrypted_block: Optional[str] = None


class CvvRequest(BaseModel):
    pan: str = "4000123456780001"
    exp: str = "2812"
    service_code: str = "101"
    cvk: Optional[str] = None


class ArqcRequest(BaseModel):
    pan: str = "4000123456780001"
    pan_seq: str = "01"
    atc: str = "0042"
    unpredictable_number: str = "87A14F23"
    amount_hex: str = "000000025000"
    tvr: str = "0000000000"
    arqc_provided: str = "A1B2C3D4E5F67890"
    arc: str = "00"
    mk_ac: Optional[str] = None


class ThalesCommandRequest(BaseModel):
    command: str = "NO"


@app.post("/api/crypto/pin-block")
async def calculate_pin_block_endpoint(req: PinBlockRequest):
    """Calcul, chiffrement et déchiffrement de blocs PIN (ISO-0 ANSI X9.8, ISO-1, ISO-3)."""
    fmt = (req.format or "ISO-0").upper()
    zpk = req.zpk or HSMCryptoEngine.DEFAULT_ZPK

    # Mode 1 : Traduction de bloc PIN sous nouvelle ZPK
    if req.encrypted_block and req.dest_zpk:
        return hsm_engine.translate_pin_block(
            enc_pin_block_hex=req.encrypted_block,
            pan=req.pan,
            source_zpk_hex=zpk,
            dest_zpk_hex=req.dest_zpk
        )

    # Mode 2 : Génération et chiffrement standard
    if fmt == "ISO-1":
        clear_block = hsm_engine.format_pin_block_iso1(req.pin)
    elif fmt == "ISO-3":
        clear_block = hsm_engine.format_pin_block_iso3(req.pin, req.pan)
    else:
        clear_block = hsm_engine.format_pin_block_iso0(req.pin, req.pan)

    encrypted_block = hsm_engine.encrypt_pin_block(clear_block, zpk)

    return {
        "success": True,
        "format": fmt,
        "pin_length": len(req.pin),
        "pan_masked": mask_pan(req.pan),
        "clear_pin_block": clear_block,
        "zpk_used": f"{zpk[:4]}...{zpk[-4:]}",
        "encrypted_pin_block": encrypted_block,
        "de52_iso_field": encrypted_block
    }


@app.post("/api/crypto/cvv")
async def calculate_cvv_endpoint(req: CvvRequest):
    """Calcul et vérification des valeurs CVV (Piste), CVV2 (E-Com) et iCVV (Puce)."""
    cvk = req.cvk or HSMCryptoEngine.DEFAULT_CVK
    res = hsm_engine.calculate_cvv(req.pan, req.exp, req.service_code, cvk)
    res["pan_masked"] = mask_pan(req.pan)
    res["cvk_masked"] = f"{cvk[:4]}...{cvk[-4:]}"
    return res


@app.post("/api/crypto/arqc-arpc")
async def verify_arqc_endpoint(req: ArqcRequest):
    """Vérification de l'ARQC (Puce EMV DE 55) et calcul de l'ARPC émetteur."""
    mk_ac = req.mk_ac or HSMCryptoEngine.DEFAULT_MK_AC
    res = hsm_engine.verify_arqc_and_generate_arpc(
        pan=req.pan,
        pan_seq=req.pan_seq,
        atc=req.atc,
        unpredictable_number=req.unpredictable_number,
        amount_hex=req.amount_hex,
        tvr=req.tvr,
        arqc_provided=req.arqc_provided,
        arc=req.arc,
        mk_ac_hex=mk_ac
    )
    res["pan_masked"] = mask_pan(req.pan)
    return res


@app.post("/api/crypto/hsm-command")
async def execute_thales_hsm_command_endpoint(req: ThalesCommandRequest):
    """Exécution directe d'une commande Thales payShield 10K (CW, CA, CC, CY, FA, NO)."""
    return hsm_engine.execute_thales_command(req.command)


# --- ROUTES PASSERELLE ISO 8583 <---> ISO 20022 ---

class IsoToXmlRequest(BaseModel):
    raw_frame: Optional[str] = None
    mti: Optional[str] = "0200"
    pan: Optional[str] = "4000123456780001"
    amount: Optional[int] = 25000
    currency: Optional[str] = "952"
    stan: Optional[str] = "000001"
    de39: Optional[str] = "00"
    target_msg: str = "pacs.008"


class XmlToIsoRequest(BaseModel):
    xml_content: str


@app.get("/api/iso20022/mapping")
async def get_iso20022_mapping():
    """Retourne la matrice de correspondance complète ISO 8583 <-> ISO 20022."""
    return {"mappings": iso20022_bridge.get_mapping_matrix()}


@app.post("/api/iso20022/to-xml")
async def convert_iso8583_to_xml(req: IsoToXmlRequest):
    """Convertit un message ISO 8583 en document XML ISO 20022 (pacs.008 ou pacs.002)."""
    # Si une trame brute est passée, on l'unpack
    if req.raw_frame:
        try:
            payload_bytes = _extract_iso_payload_bytes(req.raw_frame, "AUTO")
            msg = ISO8583Message.unpack(payload_bytes)
        except Exception:
            msg = create_0200_auth(
                pan=req.pan or "4000123456780001",
                amount=req.amount or 25000,
                currency=req.currency or "952",
                stan=req.stan or "000001"
            )
            msg.mti = req.mti or "0200"
            if req.de39:
                msg.set_field(39, req.de39)
    else:
        msg = create_0200_auth(
            pan=req.pan or "4000123456780001",
            amount=req.amount or 25000,
            currency=req.currency or "952",
            stan=req.stan or "000001"
        )
        msg.mti = req.mti or "0200"
        if req.de39:
            msg.set_field(39, req.de39)

    target = (req.target_msg or "pacs.008").lower()
    if target == "pacs.002" or msg.mti in ("0210", "0110", "0410", "0430"):
        xml_res = iso20022_bridge.iso8583_to_pacs002(msg)
        schema_type = "pacs.002.001.10 (Payment Status Report)"
    else:
        xml_res = iso20022_bridge.iso8583_to_pacs008(msg)
        schema_type = "pacs.008.001.08 (FI to FI Customer Credit Transfer)"

    return {
        "success": True,
        "schema_type": schema_type,
        "xml": xml_res,
        "source_iso8583": {
            "mti": msg.mti,
            "pan_masked": mask_pan(msg.get_field(2, req.pan or "")),
            "amount": msg.get_field(4, "0"),
            "stan": msg.get_field(11, "000001"),
            "currency": msg.get_field(49, "952"),
            "de39": msg.get_field(39, req.de39 or "00")
        }
    }


@app.post("/api/iso20022/from-xml")
async def convert_xml_to_iso8583(req: XmlToIsoRequest):
    """Convertit un document XML ISO 20022 (pacs.008) en champs ISO 8583."""
    res = iso20022_bridge.pacs008_to_iso8583(req.xml_content)
    return res


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    await websocket.send_json({
        "type": "INITIAL_STATE",
        "data": tcp_server.get_stats()
    })
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
async def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {"service": "ISO 8583 Host Simulator API", "status": "online"}
