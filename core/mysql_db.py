"""
Gestionnaire de Base de Données Relationnelle MySQL (MAMP / Port 8889).
Inspiré de la configuration du projet MONETIQUE (mysql://root:root@127.0.0.1:8889).
Assure la persistance des 50+ comptes bancaires, des cassettes GAB, des règles métier,
de la configuration d'incidents (Chaos Engineering) et des journaux d'audit PCI-DSS.
"""

import json
import logging
import os
import threading
import time
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("ISO8583_MySQL")

try:
    import pymysql
    from pymysql.cursors import DictCursor
    PYMYSQL_AVAILABLE = True
except ImportError:
    PYMYSQL_AVAILABLE = False


class MySQLManager:
    def __init__(self):
        self.host = os.getenv("MYSQL_HOST", "127.0.0.1")
        self.port = int(os.getenv("MYSQL_PORT", "8889"))
        self.user = os.getenv("MYSQL_USER", "root")
        self.password = os.getenv("MYSQL_PASSWORD", "root")
        self.database = os.getenv("MYSQL_DATABASE", "payway_iso8583_simulator")
        self._lock = threading.RLock()
        self._conn = None
        self.connected = False
        self.last_error: Optional[str] = None
        self.init_database()

    def _get_server_connection(self):
        if not PYMYSQL_AVAILABLE:
            raise RuntimeError("pymysql non installé")
        return pymysql.connect(
            host=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            charset="utf8mb4",
            cursorclass=DictCursor,
            autocommit=True,
            connect_timeout=2,
        )

    def get_connection(self):
        if not PYMYSQL_AVAILABLE:
            raise RuntimeError("pymysql non installé")
        with self._lock:
            if self._conn is not None:
                try:
                    self._conn.ping(reconnect=True)
                    return self._conn
                except Exception:
                    self._conn = None
            self._conn = pymysql.connect(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                database=self.database,
                charset="utf8mb4",
                cursorclass=DictCursor,
                autocommit=True,
                connect_timeout=2,
            )
            return self._conn

    def init_database(self) -> bool:
        """Crée la base de données MySQL et le schéma de tables si absents."""
        if not PYMYSQL_AVAILABLE:
            self.connected = False
            self.last_error = "Module pymysql non disponible"
            return False

        with self._lock:
            try:
                srv_conn = self._get_server_connection()
                with srv_conn.cursor() as cur:
                    cur.execute(
                        f"CREATE DATABASE IF NOT EXISTS `{self.database}` "
                        "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
                    )
                srv_conn.close()

                conn = self.get_connection()
                with conn.cursor() as cur:
                    # 1. Table des comptes et cartes bancaires (50+ profils)
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS `bank_accounts` (
                            `pan` VARCHAR(24) NOT NULL PRIMARY KEY,
                            `masked_pan` VARCHAR(24) NOT NULL,
                            `cardholder_name` VARCHAR(100) NOT NULL DEFAULT 'PORTEUR TEST',
                            `card_product` VARCHAR(60) NOT NULL DEFAULT 'VISA CLASSIC XOF',
                            `exp` VARCHAR(6) NOT NULL DEFAULT '2812',
                            `pin` VARCHAR(8) NOT NULL DEFAULT '1234',
                            `cvv2` VARCHAR(6) NOT NULL DEFAULT '123',
                            `balance` BIGINT NOT NULL DEFAULT 500000,
                            `daily_spent` BIGINT NOT NULL DEFAULT 0,
                            `daily_ceiling` BIGINT NOT NULL DEFAULT 1000000,
                            `max_tx_limit` BIGINT NOT NULL DEFAULT 300000,
                            `contactless_limit` BIGINT NOT NULL DEFAULT 15000,
                            `contactless_spent` BIGINT NOT NULL DEFAULT 0,
                            `pin_tries` INT NOT NULL DEFAULT 0,
                            `status` VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
                            `channel_gab_enabled` TINYINT(1) NOT NULL DEFAULT 1,
                            `channel_tpe_enabled` TINYINT(1) NOT NULL DEFAULT 1,
                            `channel_ecom_enabled` TINYINT(1) NOT NULL DEFAULT 1,
                            `international_enabled` TINYINT(1) NOT NULL DEFAULT 0,
                            `threeds_enrolled` TINYINT(1) NOT NULL DEFAULT 1,
                            `velocity_tx_1h` INT NOT NULL DEFAULT 0,
                            `velocity_max_1h` INT NOT NULL DEFAULT 15,
                            `notes` VARCHAR(255) DEFAULT '',
                            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """)

                    # 2. Table des terminaux GAB (ATM) et gestion des cassettes de billets
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS `atm_terminals` (
                            `terminal_id` VARCHAR(16) NOT NULL PRIMARY KEY,
                            `name` VARCHAR(100) NOT NULL,
                            `location` VARCHAR(120) NOT NULL,
                            `status` VARCHAR(24) NOT NULL DEFAULT 'ONLINE',
                            `cassette_10000` INT NOT NULL DEFAULT 200,
                            `cassette_5000` INT NOT NULL DEFAULT 300,
                            `cassette_2000` INT NOT NULL DEFAULT 400,
                            `fault_mode` VARCHAR(32) NOT NULL DEFAULT 'NONE',
                            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """)

                    # 3. Table d'audit des transactions (100% PCI-DSS : uniquement masked_pan, jamais de PAN ni PIN en clair)
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS `transaction_audit_log` (
                            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                            `timestamp` VARCHAR(32) NOT NULL,
                            `mti` VARCHAR(8) NOT NULL DEFAULT '0200',
                            `channel` VARCHAR(16) NOT NULL DEFAULT 'TPE',
                            `masked_pan` VARCHAR(24) NOT NULL,
                            `amount` BIGINT NOT NULL DEFAULT 0,
                            `currency` VARCHAR(8) NOT NULL DEFAULT '952',
                            `stan` VARCHAR(12) NOT NULL,
                            `terminal_id` VARCHAR(16) NOT NULL,
                            `response_code` VARCHAR(8) NOT NULL,
                            `auth_code` VARCHAR(12) DEFAULT '',
                            `rule_triggered` VARCHAR(80) DEFAULT '',
                            `status_label` VARCHAR(120) DEFAULT '',
                            `failing_component` VARCHAR(80) DEFAULT '',
                            `severity` VARCHAR(20) DEFAULT 'INFO',
                            `description` TEXT,
                            `latency_total_ms` DOUBLE DEFAULT 0.0,
                            `latency_breakdown_json` TEXT,
                            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            INDEX `idx_stan` (`stan`),
                            INDEX `idx_channel` (`channel`),
                            INDEX `idx_resp_code` (`response_code`)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """)

                    # 4. Table de configuration des incidents & Chaos Engineering
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS `chaos_incident_config` (
                            `id` INT NOT NULL PRIMARY KEY DEFAULT 1,
                            `config_json` TEXT NOT NULL,
                            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """)

                    # 5. Table d'archivage des rapports de tests de charge & UAT
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS `load_test_reports` (
                            `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
                            `executed_at` VARCHAR(32) NOT NULL,
                            `target_tps` INT NOT NULL,
                            `effective_tps` DOUBLE NOT NULL,
                            `total_sent` INT NOT NULL,
                            `p50_ms` DOUBLE NOT NULL,
                            `p95_ms` DOUBLE NOT NULL,
                            `p99_ms` DOUBLE NOT NULL,
                            `error_rate_pct` DOUBLE NOT NULL,
                            `is_certified` TINYINT(1) NOT NULL,
                            `report_markdown` LONGTEXT
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """)

                    # 6. Table des Utilisateurs & Droits RBAC
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS `app_users` (
                            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
                            `email` VARCHAR(120) NOT NULL UNIQUE,
                            `name` VARCHAR(120) NOT NULL,
                            `password_hash` VARCHAR(128) NOT NULL,
                            `role` VARCHAR(60) NOT NULL DEFAULT 'ROLE_EXPLOITATION',
                            `roles_json` TEXT NOT NULL,
                            `active` TINYINT(1) NOT NULL DEFAULT 1,
                            `department` VARCHAR(100) DEFAULT 'Monétique & Moyens de Paiement',
                            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            INDEX `idx_email` (`email`)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """)

                # Connexion persistante conservée ouverte
                self.connected = True
                self.last_error = None
                logger.info(f"Connexion MySQL active sur {self.host}:{self.port}/{self.database}")
                return True
            except Exception as e:
                self.connected = False
                self.last_error = str(e)
                logger.warning(f"MySQL non joignable ({e}) — mode mémoire actif avec repli transparent.")
                return False

    def sync_accounts_to_mysql(self, accounts_list: List[dict]):
        """Synchronise la liste des 50+ comptes bancaires dans la table MySQL `bank_accounts`."""
        if not self.connected and not self.init_database():
            return
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                sql = """
                    INSERT INTO `bank_accounts` (
                        `pan`, `masked_pan`, `cardholder_name`, `card_product`, `exp`, `pin`, `cvv2`,
                        `balance`, `daily_spent`, `daily_ceiling`, `max_tx_limit`,
                        `contactless_limit`, `contactless_spent`, `pin_tries`, `status`,
                        `channel_gab_enabled`, `channel_tpe_enabled`, `channel_ecom_enabled`,
                        `international_enabled`, `threeds_enrolled`,
                        `velocity_tx_1h`, `velocity_max_1h`, `notes`
                    ) VALUES (
                        %(pan)s, %(masked_pan)s, %(cardholder_name)s, %(card_product)s, %(exp)s, %(pin)s, %(cvv2)s,
                        %(balance)s, %(daily_spent)s, %(daily_ceiling)s, %(max_tx_limit)s,
                        %(contactless_limit)s, %(contactless_spent)s, %(pin_tries)s, %(status)s,
                        %(channel_gab_enabled)s, %(channel_tpe_enabled)s, %(channel_ecom_enabled)s,
                        %(international_enabled)s, %(threeds_enrolled)s,
                        %(velocity_tx_1h)s, %(velocity_max_1h)s, %(notes)s
                    )
                    ON DUPLICATE KEY UPDATE
                        `masked_pan` = VALUES(`masked_pan`),
                        `cardholder_name` = VALUES(`cardholder_name`),
                        `card_product` = VALUES(`card_product`),
                        `exp` = VALUES(`exp`),
                        `pin` = VALUES(`pin`),
                        `cvv2` = VALUES(`cvv2`),
                        `balance` = VALUES(`balance`),
                        `daily_spent` = VALUES(`daily_spent`),
                        `daily_ceiling` = VALUES(`daily_ceiling`),
                        `max_tx_limit` = VALUES(`max_tx_limit`),
                        `contactless_limit` = VALUES(`contactless_limit`),
                        `contactless_spent` = VALUES(`contactless_spent`),
                        `pin_tries` = VALUES(`pin_tries`),
                        `status` = VALUES(`status`),
                        `channel_gab_enabled` = VALUES(`channel_gab_enabled`),
                        `channel_tpe_enabled` = VALUES(`channel_tpe_enabled`),
                        `channel_ecom_enabled` = VALUES(`channel_ecom_enabled`),
                        `international_enabled` = VALUES(`international_enabled`),
                        `threeds_enrolled` = VALUES(`threeds_enrolled`),
                        `velocity_tx_1h` = VALUES(`velocity_tx_1h`),
                        `velocity_max_1h` = VALUES(`velocity_max_1h`),
                        `notes` = VALUES(`notes`);
                """
                cur.executemany(sql, accounts_list)
            # Connexion persistante conservée ouverte
        except Exception as e:
            self.last_error = str(e)
            logger.debug(f"Erreur sync_accounts_to_mysql : {e}")

    def update_single_account_mysql(self, acc: dict):
        """Met à jour un compte unique dans MySQL."""
        self.sync_accounts_to_mysql([acc])

    def load_accounts_from_mysql(self) -> List[dict]:
        """Charge les comptes depuis MySQL s'ils existent."""
        if not self.connected and not self.init_database():
            return []
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM `bank_accounts` ORDER BY `pan` ASC;")
                rows = cur.fetchall()
            # Connexion persistante conservée ouverte
            for r in rows:
                r["channel_gab_enabled"] = bool(r.get("channel_gab_enabled", 1))
                r["channel_tpe_enabled"] = bool(r.get("channel_tpe_enabled", 1))
                r["channel_ecom_enabled"] = bool(r.get("channel_ecom_enabled", 1))
                r["international_enabled"] = bool(r.get("international_enabled", 0))
                r["threeds_enrolled"] = bool(r.get("threeds_enrolled", 1))
                r.pop("updated_at", None)
            return rows
        except Exception as e:
            self.last_error = str(e)
            return []

    def sync_atms_to_mysql(self, atms_list: List[dict]):
        if not self.connected and not self.init_database():
            return
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                sql = """
                    INSERT INTO `atm_terminals` (
                        `terminal_id`, `name`, `location`, `status`,
                        `cassette_10000`, `cassette_5000`, `cassette_2000`, `fault_mode`
                    ) VALUES (
                        %(terminal_id)s, %(name)s, %(location)s, %(status)s,
                        %(cassette_10000)s, %(cassette_5000)s, %(cassette_2000)s, %(fault_mode)s
                    )
                    ON DUPLICATE KEY UPDATE
                        `name` = VALUES(`name`),
                        `location` = VALUES(`location`),
                        `status` = VALUES(`status`),
                        `cassette_10000` = VALUES(`cassette_10000`),
                        `cassette_5000` = VALUES(`cassette_5000`),
                        `cassette_2000` = VALUES(`cassette_2000`),
                        `fault_mode` = VALUES(`fault_mode`);
                """
                cur.executemany(sql, atms_list)
            # Connexion persistante conservée ouverte
        except Exception as e:
            self.last_error = str(e)

    def insert_audit_log(self, entry: dict):
        """Enregistre une entrée d'audit PCI-DSS dans MySQL."""
        if not self.connected:
            return
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO `transaction_audit_log` (
                        `timestamp`, `mti`, `channel`, `masked_pan`, `amount`, `currency`,
                        `stan`, `terminal_id`, `response_code`, `auth_code`, `rule_triggered`,
                        `status_label`, `failing_component`, `severity`, `description`,
                        `latency_total_ms`, `latency_breakdown_json`
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    );
                """, (
                    entry.get("timestamp", time.strftime("%Y-%m-%d %H:%M:%S")),
                    entry.get("mti", "0200"),
                    entry.get("channel", "TPE"),
                    entry.get("masked_pan", "****************"),
                    int(entry.get("amount", 0)),
                    entry.get("currency", "952"),
                    entry.get("stan", "000001"),
                    entry.get("terminal_id", "TERM0001"),
                    entry.get("code", "00"),
                    entry.get("auth_code", ""),
                    entry.get("rule", ""),
                    entry.get("status_label", ""),
                    entry.get("failing_component", ""),
                    entry.get("severity", "INFO"),
                    entry.get("description", ""),
                    float(entry.get("latency_total_ms", 0.0)),
                    json.dumps(entry.get("latency_breakdown", {}))
                ))
            # Connexion persistante conservée ouverte
        except Exception as e:
            self.last_error = str(e)

    def clear_audit_logs_mysql(self):
        if not self.connected:
            return
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("TRUNCATE TABLE `transaction_audit_log`;")
            # Connexion persistante conservée ouverte
        except Exception:
            pass

    def save_chaos_config(self, config: dict):
        if not self.connected:
            return
        try:
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO `chaos_incident_config` (`id`, `config_json`)
                    VALUES (1, %s)
                    ON DUPLICATE KEY UPDATE `config_json` = VALUES(`config_json`);
                """, (json.dumps(config),))
            # Connexion persistante conservée ouverte
        except Exception:
            pass

    def save_load_test_report(self, result: dict):
        if not self.connected:
            return
        try:
            m = result.get("metrics", {})
            sla = result.get("sla", {})
            conn = self.get_connection()
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO `load_test_reports` (
                        `executed_at`, `target_tps`, `effective_tps`, `total_sent`,
                        `p50_ms`, `p95_ms`, `p99_ms`, `error_rate_pct`, `is_certified`, `report_markdown`
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
                """, (
                    time.strftime("%Y-%m-%d %H:%M:%S"),
                    int(m.get("target_tps", 100)),
                    float(m.get("effective_tps", 0.0)),
                    int(m.get("total_sent", 0)),
                    float(m.get("latency_p50_ms", 0.0)),
                    float(m.get("latency_p95_ms", 0.0)),
                    float(m.get("latency_p99_ms", 0.0)),
                    float(m.get("error_rate_pct", 0.0)),
                    1 if sla.get("is_certified") else 0,
                    result.get("report_markdown", "")
                ))
            # Connexion persistante conservée ouverte
        except Exception:
            pass

    def get_db_info(self) -> dict:
        """Retourne l'état et les compteurs de la base MySQL pour le Cockpit Exploitant."""
        counts = {"accounts": 0, "atms": 0, "audit_logs": 0, "load_reports": 0, "users": 0}
        if self.connected:
            try:
                conn = self.get_connection()
                with conn.cursor() as cur:
                    cur.execute("SELECT COUNT(*) AS c FROM `bank_accounts`;")
                    counts["accounts"] = cur.fetchone()["c"]
                    cur.execute("SELECT COUNT(*) AS c FROM `atm_terminals`;")
                    counts["atms"] = cur.fetchone()["c"]
                    cur.execute("SELECT COUNT(*) AS c FROM `transaction_audit_log`;")
                    counts["audit_logs"] = cur.fetchone()["c"]
                    cur.execute("SELECT COUNT(*) AS c FROM `load_test_reports`;")
                    counts["load_reports"] = cur.fetchone()["c"]
                    cur.execute("SELECT COUNT(*) AS c FROM `app_users`;")
                    counts["users"] = cur.fetchone()["c"]
                # Connexion persistante conservée ouverte
            except Exception as e:
                self.last_error = str(e)
        return {
            "engine": "MySQL 8 / MAMP",
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "connected": self.connected,
            "last_error": self.last_error,
            "tables": counts
        }


mysql_manager = MySQLManager()
