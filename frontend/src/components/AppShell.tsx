"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UserSession, getStoredUser, isAuthenticated } from "@/lib/auth";
import { SystemStatus, fetchStatus } from "@/lib/api";
import Sidebar, { TabKey } from "@/components/Sidebar";
import Header from "@/components/Header";
import KpiRibbon from "@/components/KpiRibbon";

interface AppShellProps {
  activeTab: TabKey;
  children: (ctx: { status: SystemStatus | null; reloadStatus: () => Promise<void> }) => ReactNode;
}

export default function AppShell({ activeTab, children }: AppShellProps) {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);

  const loadStatus = async () => {
    try {
      const s = await fetchStatus();
      setStatus(s);
    } catch (err) {
      console.error("Erreur de chargement du statut système :", err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
    } else {
      setUser(getStoredUser());
      setCheckedAuth(true);
      loadStatus();
    }
  }, [router]);

  if (!checkedAuth) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "var(--text-muted)" }}>
          <span className="pulse-dot" />
          <span>Vérification de la session opérateur...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeTab={activeTab}
        status={status}
        user={user}
        onRefresh={loadStatus}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className={`app-main-viewport ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <Header
          activeTab={activeTab}
          user={user}
          status={status}
          onRefresh={loadStatus}
        />

        <div className="app-scrollable-content">
          <KpiRibbon status={status} />

          <div className="tab-pane-container">
            {children({ status, reloadStatus: loadStatus })}
          </div>
        </div>

        <footer className="app-footer">
          <div className="footer-content">
            <span className="footer-copyright">
              &copy; {new Date().getFullYear()} <strong>M.Oury</strong> — Ingénieur IT BANKING &amp; Expert Monétique - CBS
            </span>
            <span className="footer-badge">ISO 8583 • PCI-DSS v4.0 • Architecture Sécurisée</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
