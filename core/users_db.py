"""
Gestionnaire des Utilisateurs et Droits RBAC (MySQL & Fallback Local).
Inspiré de l'architecture du projet MONETIQUE.
Supporte les profils : SUPER_ADMIN, ADMIN, ROLE_EXPLOITATION, ROLE_HOMOLOGATION, ROLE_CHAOS, ROLE_PCI_DSS.
"""

import hashlib
import json
import logging
import os
import threading
import time
from typing import Dict, Any, List, Optional

logger = logging.getLogger("ISO8583_Users")

SUPER_ADMIN_EMAILS = [
    "mohaourydiallo@gmail.com",
    "ourykohkoun@gmail.com",
    "admin@bank.ci"
]

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def get_default_users() -> List[Dict[str, Any]]:
    now = time.strftime("%Y-%m-%d %H:%M:%S")
    return [
        {
            "id": "usr-mohaourydiallo",
            "email": "mohaourydiallo@gmail.com",
            "name": "M. Oury Diallo (Super Administrateur)",
            "password_hash": hash_password("admin123"),
            "role": "SUPER_ADMIN",
            "roles": ["SUPER_ADMIN", "ROLE_EXPLOITATION", "ROLE_HOMOLOGATION", "ROLE_CHAOS", "ROLE_PCI_DSS"],
            "active": True,
            "department": "Direction Monétique & Systèmes de Paiement",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "usr-ourykohkoun",
            "email": "ourykohkoun@gmail.com",
            "name": "Oury Kohkoun (Super Administrateur)",
            "password_hash": hash_password("123456"),
            "role": "SUPER_ADMIN",
            "roles": ["SUPER_ADMIN", "ROLE_EXPLOITATION", "ROLE_HOMOLOGATION", "ROLE_CHAOS", "ROLE_PCI_DSS"],
            "active": True,
            "department": "Direction Monétique & Systèmes de Paiement",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "usr-admin",
            "email": "admin@bank.ci",
            "name": "Administrateur Monétique Principal",
            "password_hash": hash_password("admin123"),
            "role": "ADMIN",
            "roles": ["ADMIN", "ROLE_EXPLOITATION", "ROLE_HOMOLOGATION"],
            "active": True,
            "department": "Centre d'Autorisation & Switch",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "usr-noc",
            "email": "noc@bank.ci",
            "name": "Exploitant Monétique NOC",
            "password_hash": hash_password("noc123"),
            "role": "ROLE_EXPLOITATION",
            "roles": ["ROLE_EXPLOITATION"],
            "active": True,
            "department": "Supervision NOC & Réseaux",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "usr-qa",
            "email": "qa@bank.ci",
            "name": "Ingénieur Homologation & UAT",
            "password_hash": hash_password("qa123"),
            "role": "ROLE_HOMOLOGATION",
            "roles": ["ROLE_HOMOLOGATION"],
            "active": True,
            "department": "Qualité & Recette Bancaire",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": "usr-audit",
            "email": "audit@bank.ci",
            "name": "Auditeur Sécurité PCI-DSS",
            "password_hash": hash_password("audit123"),
            "role": "ROLE_PCI_DSS",
            "roles": ["ROLE_PCI_DSS"],
            "active": True,
            "department": "Audit, Conformité & Risques",
            "created_at": now,
            "updated_at": now
        }
    ]


class UsersDB:
    def __init__(self, data_file: str = ".data/users.json"):
        self.data_file = data_file
        self._lock = threading.RLock()
        self._users: Dict[str, Dict[str, Any]] = {}
        self._load_local_users()

    def _load_local_users(self):
        with self._lock:
            os.makedirs(os.path.dirname(self.data_file) or ".", exist_ok=True)
            if not os.path.exists(self.data_file):
                defaults = get_default_users()
                for u in defaults:
                    self._users[u["id"]] = u
                self._save_local_users()
                return

            try:
                with open(self.data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        self._users[item["id"]] = item
            except Exception as e:
                logger.warning(f"Erreur lecture fichier users local ({e}), réinitialisation par défaut.")
                defaults = get_default_users()
                for u in defaults:
                    self._users[u["id"]] = u
                self._save_local_users()

    def _save_local_users(self):
        with self._lock:
            try:
                os.makedirs(os.path.dirname(self.data_file) or ".", exist_ok=True)
                with open(self.data_file, "w", encoding="utf-8") as f:
                    json.dump(list(self._users.values()), f, indent=2, ensure_ascii=False)
            except Exception as e:
                logger.error(f"Erreur écriture fichier users local: {e}")

    def sync_from_mysql(self, mysql_manager):
        if not mysql_manager or not mysql_manager.connected:
            return
        with self._lock:
            try:
                conn = mysql_manager.get_connection()
                with conn.cursor() as cur:
                    cur.execute("SELECT * FROM `app_users` ORDER BY `created_at` ASC;")
                    rows = cur.fetchall()
                    if rows:
                        self._users.clear()
                        for r in rows:
                            try:
                                roles_list = json.loads(r.get("roles_json", "[]"))
                            except Exception:
                                roles_list = [r.get("role", "ROLE_EXPLOITATION")]
                            u = {
                                "id": r["id"],
                                "email": r["email"],
                                "name": r["name"],
                                "password_hash": r["password_hash"],
                                "role": r["role"],
                                "roles": roles_list,
                                "active": bool(r["active"]),
                                "department": r.get("department", "Monétique"),
                                "created_at": str(r.get("created_at", "")),
                                "updated_at": str(r.get("updated_at", ""))
                            }
                            self._users[u["id"]] = u
                        self._save_local_users()
                    else:
                        # Si table vide dans MySQL, on synchronise les seed users
                        self.sync_to_mysql(mysql_manager)
            except Exception as e:
                logger.warning(f"Erreur sync_from_mysql: {e}")

    def sync_to_mysql(self, mysql_manager):
        if not mysql_manager or not mysql_manager.connected:
            return
        with self._lock:
            try:
                conn = mysql_manager.get_connection()
                with conn.cursor() as cur:
                    for u in self._users.values():
                        cur.execute("""
                            INSERT INTO `app_users` (
                                `id`, `email`, `name`, `password_hash`, `role`, `roles_json`, `active`, `department`
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                `name` = VALUES(`name`),
                                `password_hash` = VALUES(`password_hash`),
                                `role` = VALUES(`role`),
                                `roles_json` = VALUES(`roles_json`),
                                `active` = VALUES(`active`),
                                `department` = VALUES(`department`);
                        """, (
                            u["id"],
                            u["email"],
                            u["name"],
                            u["password_hash"],
                            u["role"],
                            json.dumps(u.get("roles", [u["role"]])),
                            1 if u.get("active", True) else 0,
                            u.get("department", "Monétique")
                        ))
            except Exception as e:
                logger.warning(f"Erreur sync_to_mysql: {e}")

    def list_users(self) -> List[Dict[str, Any]]:
        with self._lock:
            safe_list = []
            for u in sorted(self._users.values(), key=lambda x: x.get("created_at", "")):
                copy_u = dict(u)
                copy_u.pop("password_hash", None)
                safe_list.append(copy_u)
            return safe_list

    def get_user_by_email_or_username(self, identifier: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            clean = (identifier or "").strip().lower()
            for u in self._users.values():
                if u["email"].lower() == clean:
                    return u
                # Identifiant court sans le domaine (ex: admin pour admin@bank.ci)
                prefix = u["email"].split("@")[0].lower()
                if prefix == clean or u["id"] == clean:
                    return u
            return None

    def authenticate(self, identifier: str, password: str) -> Optional[Dict[str, Any]]:
        user = self.get_user_by_email_or_username(identifier)
        if not user:
            return None
        if not user.get("active", True):
            raise ValueError("Ce compte utilisateur est actuellement désactivé. Veuillez contacter un Super Administrateur.")
        
        pwd_hash = hash_password(password)
        if user.get("password_hash") != pwd_hash:
            return None
        
        res = dict(user)
        res.pop("password_hash", None)
        return res

    def create_user(self, data: Dict[str, Any], mysql_manager=None) -> Dict[str, Any]:
        with self._lock:
            email = data.get("email", "").strip().lower()
            if not email or "@" not in email:
                raise ValueError("Adresse email invalide.")
            
            for u in self._users.values():
                if u["email"].lower() == email:
                    raise ValueError(f"Un utilisateur avec l'email {email} existe déjà.")

            name = data.get("name", "").strip() or email.split("@")[0].capitalize()
            password = data.get("password", "").strip() or "123456"
            roles = data.get("roles", [])
            primary_role = data.get("role") or (roles[0] if roles else "ROLE_EXPLOITATION")
            if primary_role not in roles:
                roles.append(primary_role)

            now = time.strftime("%Y-%m-%d %H:%M:%S")
            user_id = f"usr-{int(time.time() * 1000)}"

            new_user = {
                "id": user_id,
                "email": email,
                "name": name,
                "password_hash": hash_password(password),
                "role": primary_role,
                "roles": roles,
                "active": bool(data.get("active", True)),
                "department": data.get("department", "Monétique & Moyens de Paiement"),
                "created_at": now,
                "updated_at": now
            }
            self._users[user_id] = new_user
            self._save_local_users()

            if mysql_manager:
                self.sync_to_mysql(mysql_manager)

            safe = dict(new_user)
            safe.pop("password_hash", None)
            return safe

    def update_user(self, user_id: str, updates: Dict[str, Any], mysql_manager=None) -> Dict[str, Any]:
        with self._lock:
            if user_id not in self._users:
                raise ValueError(f"Utilisateur {user_id} introuvable.")
            
            user = self._users[user_id]
            is_super = user["email"].lower() in [e.lower() for e in SUPER_ADMIN_EMAILS]

            if "name" in updates and updates["name"]:
                user["name"] = updates["name"].strip()
            if "department" in updates and updates["department"] is not None:
                user["department"] = updates["department"].strip()
            if "roles" in updates and isinstance(updates["roles"], list) and updates["roles"]:
                # Empêcher la suppression du rôle SUPER_ADMIN sur les comptes fondateurs
                if is_super and "SUPER_ADMIN" not in updates["roles"]:
                    updates["roles"].append("SUPER_ADMIN")
                user["roles"] = updates["roles"]
                user["role"] = updates["roles"][0]
            if "active" in updates:
                if is_super and not updates["active"]:
                    raise ValueError("Impossible de désactiver le compte du Super Administrateur fondateur.")
                user["active"] = bool(updates["active"])
            if "password" in updates and updates["password"]:
                user["password_hash"] = hash_password(updates["password"].strip())

            user["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            self._save_local_users()

            if mysql_manager:
                self.sync_to_mysql(mysql_manager)

            safe = dict(user)
            safe.pop("password_hash", None)
            return safe

    def toggle_status(self, user_id: str, mysql_manager=None) -> Dict[str, Any]:
        with self._lock:
            if user_id not in self._users:
                raise ValueError(f"Utilisateur {user_id} introuvable.")
            user = self._users[user_id]
            if user["email"].lower() in [e.lower() for e in SUPER_ADMIN_EMAILS] and user.get("active", True):
                raise ValueError("Impossible de désactiver le compte du Super Administrateur.")
            user["active"] = not user.get("active", True)
            user["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            self._save_local_users()
            if mysql_manager:
                self.sync_to_mysql(mysql_manager)
            safe = dict(user)
            safe.pop("password_hash", None)
            return safe

    def reset_password(self, user_id: str, new_password: str, mysql_manager=None) -> Dict[str, Any]:
        with self._lock:
            if user_id not in self._users:
                raise ValueError(f"Utilisateur {user_id} introuvable.")
            if not new_password or len(new_password) < 4:
                raise ValueError("Le mot de passe doit comporter au moins 4 caractères.")
            user = self._users[user_id]
            user["password_hash"] = hash_password(new_password.strip())
            user["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            self._save_local_users()
            if mysql_manager:
                self.sync_to_mysql(mysql_manager)
            safe = dict(user)
            safe.pop("password_hash", None)
            return safe

    def delete_user(self, user_id: str, mysql_manager=None) -> bool:
        with self._lock:
            if user_id not in self._users:
                raise ValueError(f"Utilisateur {user_id} introuvable.")
            user = self._users[user_id]
            if user["email"].lower() in [e.lower() for e in SUPER_ADMIN_EMAILS]:
                raise ValueError("Sécurité : Le Super Administrateur ne peut pas être supprimé.")
            
            del self._users[user_id]
            self._save_local_users()

            if mysql_manager and mysql_manager.connected:
                try:
                    conn = mysql_manager.get_connection()
                    with conn.cursor() as cur:
                        cur.execute("DELETE FROM `app_users` WHERE `id` = %s;", (user_id,))
                except Exception as e:
                    logger.warning(f"Erreur delete_user MySQL: {e}")
            return True


users_db = UsersDB()
