"use client";

import { UserSession } from "@/lib/auth";
import { SystemStatus } from "@/lib/api";
import { TabKey } from "@/components/Sidebar";

interface HeaderProps {
  activeTab: TabKey;
  user: UserSession | null;
  status: SystemStatus | null;
  onRefresh: () => void;
}

const TAB_METADATA: Record<TabKey, { title: string; category: string; badge: string }> = {
  suite: {
    title: "Homologation & UAT Multi-Canal",
    category: "Exploitation",
    badge: "24 Scénarios",
  },
  simulator: {
    title: "Simulateur GAB / TPE / E-Commerce",
    category: "Exploitation",
    badge: "ISO 8583 Live",
  },
  logs: {
    title: "Supervision NOC & Audit TCP",
    category: "Exploitation",
    badge: "PCI-DSS v4.0",
  },
  chaos: {
    title: "Incidents Prod & Chaos Lab",
    category: "Expertise & Outils",
    badge: "STIP • HSM • GAB",
  },
  loadtest: {
    title: "Laboratoire de Charge & SLA",
    category: "Expertise & Outils",
    badge: "100 TPS Async",
  },
  rules: {
    title: "Matrice d'Arbitrage & Runbooks DE 39",
    category: "Référentiels & MySQL",
    badge: "18 Règles • 24 Codes",
  },
  accounts: {
    title: "Référentiel Cartes & Parc GAB",
    category: "Référentiels & MySQL",
    badge: "MySQL :8889",
  },
  users: {
    title: "Gestion des Utilisateurs & RBAC",
    category: "Référentiels & MySQL",
    badge: "MySQL :8889",
  },
  replay: {
    title: "Dissecteur Hexadécimal & Rejeu TCP Host",
    category: "Expertise & Outils",
    badge: "EMV TLV • DE 55",
  },
  decoder: {
    title: "Décodeur Dynamique de Trame ISO 8583",
    category: "Expertise & Outils",
    badge: "Temps Réel • Wireshark Grade",
  },
  crypto: {
    title: "Studio Cryptographique & Émulateur HSM",
    category: "Expertise & Outils",
    badge: "Thales payShield 10K • ANSI X9.8",
  },
  iso20022: {
    title: "Passerelle Bi-directionnelle ISO 20022",
    category: "Expertise & Outils",
    badge: "pacs.008 • pacs.002 • Instant Payment",
  },
  clearing: {
    title: "Télécompensation & Rapprochement Bancaire",
    category: "Expertise & Outils",
    badge: "GIM-UEMOA • Core Banking",
  },
  logs_analyzer: {
    title: "Analyseur Intelligent de Logs & Forensic NOC",
    category: "Exploitation & Recette",
    badge: "Corrélation Sessions • Diagnostics",
  },
  profiles: {
    title: "Profils Réseaux Multi-Dialectes ISO 8583",
    category: "Expertise & Protocoles",
    badge: "GIM-UEMOA • VISA • Mastercard",
  },
  builder: {
    title: "Studio de Recette & PV d'Homologation Certifié",
    category: "Exploitation & Recette",
    badge: "Visa Ingénierie • UAT",
  },
  cbs: {
    title: "Passerelle CBS & Grand Livre Comptable",
    category: "Core Banking & Comptabilité",
    badge: "Partie Double • Holds 0100",
  },
};

export default function Header({ activeTab, status, onRefresh }: HeaderProps) {
  const currentMeta = TAB_METADATA[activeTab] || TAB_METADATA.suite;
  const isRunning = status?.is_running ?? true;
  const mysqlOk = status?.mysql_connected ?? true;
  const chaosActive =
    status?.chaos &&
    (status.chaos.host_down_91 ||
      status.chaos.timeout_68 ||
      status.chaos.hsm_failure_mode !== "NONE" ||
      status.chaos.atm_fault_mode !== "NONE" ||
      status.chaos.duplicate_stan_94 ||
      status.chaos.format_error_30 ||
      status.chaos.routing_error_92);

  return (
    <header className="main-topbar">
      <div className="topbar-left">
        <div className="topbar-breadcrumb">
          <span className="breadcrumb-category">{currentMeta.category}</span>
          <span className="breadcrumb-separator">›</span>
          <h1 className="breadcrumb-current">{currentMeta.title}</h1>
          <span className="breadcrumb-badge">{currentMeta.badge}</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-chips">
          {chaosActive && (
            <div
              className="meta-chip status-offline"
              style={{ borderColor: "#fecdd3", background: "#fff1f2" }}
              title="Un ou plusieurs incidents Chaos Engineering sont actifs"
            >
              <span>🔥</span>
              <span className="chip-val" style={{ color: "#e60028", fontWeight: 800 }}>
                CHAOS ACTIF
              </span>
            </div>
          )}

          <div className="meta-chip" title="Base de données relationnelle MySQL (Port 8889)">
            <span
              className="pulse-dot"
              style={{ background: mysqlOk ? "#10b981" : "#f59e0b", width: "7px", height: "7px" }}
            />
            <span className="chip-label">MySQL</span>
            <span className="chip-val" style={{ color: mysqlOk ? "#047857" : "#b45309" }}>
              {mysqlOk ? ":8889" : "RAM"}
            </span>
          </div>

          <div className="meta-chip" title="Cadrage TCP 2 octets Big-Endian ISO 8583:1987">
            <span className="chip-val">ISO 8583 • 2B BE</span>
          </div>

          <div className={`meta-chip ${isRunning ? "status-online" : "status-offline"}`}>
            <span className="pulse-dot" />
            <span className="chip-val">{isRunning ? "TCP :5001 Actif" : "TCP Stop"}</span>
          </div>
        </div>

        <a
          href="/GUIDE_UTILISATEUR_SIMULATEUR_MONETIQUE_ISO8583.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-outline btn-sm"
          style={{ textDecoration: "none", borderColor: "var(--burgundy)", color: "var(--burgundy)", fontWeight: 700 }}
          title="Ouvrir / Télécharger le Guide Utilisateur Complet en PDF"
        >
          <span>📘</span>
          <span>Guide PDF</span>
        </a>

        <button onClick={onRefresh} className="btn btn-outline btn-sm" title="Actualiser les métriques">
          <span>↺</span>
          <span>Actualiser</span>
        </button>
      </div>
    </header>
  );
}
