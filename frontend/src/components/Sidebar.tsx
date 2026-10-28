"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { UserSession, clearUserSession } from "@/lib/auth";
import { SystemStatus, startServer, stopServer, resetAccounts } from "@/lib/api";

export type TabKey =
  | "suite"
  | "simulator"
  | "chaos"
  | "accounts"
  | "loadtest"
  | "logs"
  | "rules"
  | "users"
  | "replay"
  | "clearing"
  | "decoder"
  | "crypto"
  | "iso20022"
  | "logs_analyzer"
  | "profiles"
  | "builder"
  | "cbs";

export const TAB_ROUTES: Record<TabKey, string> = {
  suite: "/homologation",
  simulator: "/simulateur",
  logs: "/supervision",
  chaos: "/chaos",
  loadtest: "/charge",
  rules: "/regles",
  accounts: "/cartes",
  users: "/utilisateurs",
  replay: "/rejeu",
  clearing: "/clearing",
  decoder: "/decodeur",
  crypto: "/crypto",
  iso20022: "/iso20022",
  logs_analyzer: "/analyseur-logs",
  profiles: "/profils-reseaux",
  builder: "/recette-builder",
  cbs: "/cbs-gateway",
};

interface SidebarProps {
  activeTab: TabKey;
  onSelectTab?: (tab: TabKey) => void;
  status: SystemStatus | null;
  user: UserSession | null;
  onRefresh: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavItem {
  id: TabKey;
  label: string;
  icon: string;
  href: string;
}

interface NavSection {
  key: string;
  title: string;
  icon: string;
  items: NavItem[];
}

const MONETIQUE_NAV_SECTIONS: NavSection[] = [
  {
    key: "exploitation",
    title: "EXPLOITATION & RECETTE",
    icon: "⚡",
    items: [
      { id: "suite", label: "Homologation & UAT (24 Cas)", icon: "⊞", href: "/homologation" },
      { id: "builder", label: "Studio Recette & PV Certifié", icon: "📋", href: "/recette-builder" },
      { id: "simulator", label: "Simulateur GAB / TPE / Web", icon: "💳", href: "/simulateur" },
      { id: "logs", label: "Supervision NOC & Logs TCP", icon: "🖥️", href: "/supervision" },
      { id: "logs_analyzer", label: "Analyseur Logs Prod Forensique", icon: "🕵️", href: "/analyseur-logs" },
    ],
  },
  {
    key: "expertise",
    title: "EXPERTISE MONÉTIQUE & PROTOCOLES",
    icon: "🛠️",
    items: [
      { id: "decoder", label: "Décodeur Dynamique ISO", icon: "🔍", href: "/decodeur" },
      { id: "profiles", label: "Profils Réseaux GIM / VISA", icon: "🌐", href: "/profils-reseaux" },
      { id: "crypto", label: "Studio Crypto & HSM Thales", icon: "🔐", href: "/crypto" },
      { id: "iso20022", label: "Passerelle ISO 20022", icon: "🔄", href: "/iso20022" },
      { id: "chaos", label: "Incidents Prod & Chaos Lab", icon: "🚨", href: "/chaos" },
      { id: "loadtest", label: "Laboratoire Charge 100 TPS", icon: "⚡", href: "/charge" },
      { id: "replay", label: "Dissecteur & Rejeu Hex/EMV", icon: "🔬", href: "/rejeu" },
      { id: "clearing", label: "Compensation & Clearing", icon: "📑", href: "/clearing" },
    ],
  },
  {
    key: "cbs_and_accounting",
    title: "CORE BANKING & RÉFÉRENTIELS",
    icon: "🏛️",
    items: [
      { id: "cbs", label: "Passerelle CBS & Grand Livre", icon: "🏛️", href: "/cbs-gateway" },
      { id: "rules", label: "Référentiel Règles & DE39", icon: "🏷️", href: "/regles" },
      { id: "accounts", label: "Référentiel 50 Cartes (MySQL)", icon: "🗂️", href: "/cartes" },
      { id: "users", label: "Gestion Utilisateurs & RBAC", icon: "👥", href: "/utilisateurs" },
    ],
  },
];

export default function Sidebar({
  activeTab,
  onSelectTab,
  status,
  onRefresh,
  collapsed: externalCollapsed,
  onToggleCollapse: externalToggleCollapse,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    exploitation: true,
    expertise: true,
    referentials: true,
  });

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;
  const toggleCollapse =
    externalToggleCollapse !== undefined
      ? externalToggleCollapse
      : () => setInternalCollapsed(!internalCollapsed);

  const toggleGroup = (groupKey: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const handleToggleServer = async () => {
    if (!status) return;
    if (status.is_running) {
      await stopServer();
    } else {
      await startServer();
    }
    onRefresh();
  };

  const handleResetDb = async () => {
    if (confirm("Réinitialiser les 50 comptes bancaires et les 3 GAB MySQL à leur état d'origine ?")) {
      await resetAccounts();
      onRefresh();
    }
  };

  const handleLogout = () => {
    clearUserSession();
    router.push("/login");
  };

  const isRunning = status?.is_running ?? true;
  const mysqlConnected = status?.mysql_connected ?? true;
  const port = status?.port ?? 5001;

  return (
    <aside className={`app-sidebar ${isCollapsed ? "collapsed" : ""}`}>
      {/* Header & Logo Sidebar identique au projet MONETIQUE */}
      <div className="brand">
        <img
          src="/logo.png"
          alt="BANKING CBS & MONÉTIQUE HUB Logo"
          className="brand-logo-img"
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            objectFit: "cover",
            border: "1px solid #10b981",
            boxShadow: "0 0 12px rgba(16, 185, 129, 0.35)",
            background: "#0f172a",
            flexShrink: 0,
          }}
        />
        <div className="brand-text">
          SIMULATEUR
          <b>HOMOLOGATION</b>
        </div>
        <button
          type="button"
          className="btn-toggle-sidebar"
          onClick={toggleCollapse}
          title={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
        >
          {isCollapsed ? "»" : "«"}
        </button>
      </div>

      {/* Badge Univers Actif dans la Sidebar identique au projet MONETIQUE */}
      {!isCollapsed && (
        <div style={{ padding: "0.25rem 0.25rem 0.75rem", marginBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "rgba(225, 29, 72, 0.12)",
              border: "1px solid rgba(225, 29, 72, 0.3)",
              borderRadius: "8px",
              padding: "6px 10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "0.9rem" }}>💳</span>
              <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#fda4af" }}>
                Simulateur ISO 8583
              </span>
            </div>
            <span
              style={{
                fontSize: "0.62rem",
                fontWeight: 800,
                textTransform: "uppercase",
                padding: "1px 5px",
                borderRadius: "4px",
                background: isRunning ? "#7d1538" : "#ef4444",
                color: "#ffffff",
              }}
            >
              {isRunning ? "Actif" : "Stop"}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.45rem",
              padding: "0 0.2rem",
              fontSize: "0.7rem",
              color: "#94a3b8",
              fontFamily: "var(--font-mono)",
            }}
          >
            <span>TCP :{port}</span>
            <span style={{ color: mysqlConnected ? "#34d399" : "#fbbf24" }}>
              ● {mysqlConnected ? "MySQL :8889" : "RAM"}
            </span>
          </div>
        </div>
      )}

      {/* Menu de navigation hiérarchique avec accordéons identique au projet MONETIQUE */}
      <nav className="nav-menu" aria-label="Navigation principale">
        {MONETIQUE_NAV_SECTIONS.map((section) => {
          const hasActiveChild = section.items.some((item) => activeTab === item.id);
          const isOpen = openGroups[section.key] ?? true;

          return (
            <div key={section.key} className="nav-group">
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleGroup(section.key)}
                  className={`nav-group-header ${hasActiveChild ? "active-group" : ""}`}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.9rem" }}>{section.icon}</span>
                    <span style={{ fontSize: "0.72rem", letterSpacing: "0.08em", fontWeight: 700, color: "#94a3b8" }}>
                      {section.title}
                    </span>
                  </span>
                  <span className={`nav-chevron ${isOpen ? "expanded" : ""}`}>▶</span>
                </button>
              ) : null}

              {(isOpen || isCollapsed) && (
                <div className={!isCollapsed ? "nav-submenu" : ""}>
                  {section.items.map((item) => {
                    const isActive =
                      activeTab === item.id ||
                      pathname === item.href ||
                      (pathname === "/" && item.id === "suite");
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={(e) => {
                          if (onSelectTab) {
                            onSelectTab(item.id);
                          }
                        }}
                        className={`nav-item ${isActive ? "active" : ""}`}
                        style={{ textDecoration: "none" }}
                        title={isCollapsed ? `${section.title} - ${item.label}` : undefined}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Actions rapides Host TCP / MySQL + Footer identique au projet MONETIQUE */}
      <div className="sidebar-footer" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.75rem" }}>
        <div className={`sidebar-actions ${isCollapsed ? "stacked" : ""}`} style={{ width: "100%" }}>
          <button
            type="button"
            onClick={handleToggleServer}
            className="btn-sidebar-action"
            title={isRunning ? "Arrêter le serveur TCP" : "Démarrer le serveur TCP"}
          >
            <span>⚡</span>
            {!isCollapsed && <span>{isRunning ? "Stop TCP" : "Start TCP"}</span>}
          </button>

          <button
            type="button"
            onClick={handleResetDb}
            className="btn-sidebar-action"
            title="Réinitialiser les 50 comptes bancaires et les GAB MySQL"
          >
            <span>↺</span>
            {!isCollapsed && <span>Reset DB</span>}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="btn-sidebar-action danger"
            title="Se déconnecter"
          >
            <span>🚪</span>
            {!isCollapsed && <span>Sortir</span>}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.1rem" }}>🛡️</span>
          <div>
            Environnement sécurisé
            <br />
            <b>Données sensibles masquées</b>
          </div>
        </div>
      </div>
    </aside>
  );
}
