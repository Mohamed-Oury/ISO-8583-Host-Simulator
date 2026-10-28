"use client";

import { useState, useEffect, useRef } from "react";
import { fetchAuditLogs, sendTransaction, resetChaos } from "@/lib/api";

interface LogEntry {
  id: string;
  timestamp: string;
  type: string;
  message: string;
}

interface AuditRecord {
  timestamp: string;
  mti: string;
  channel: string;
  masked_pan: string;
  amount: number;
  currency: string;
  stan: string;
  terminal_id: string;
  code: string;
  auth_code: string;
  rule: string;
  description: string;
  status_label: string;
  severity: string;
  failing_component: string;
  latency_total_ms: number;
  latency_breakdown?: Record<string, number>;
  runbook_steps?: string[];
}

export default function LogsTerminal() {
  const [viewMode, setViewMode] = useState<"audit" | "stream">("audit");
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [selectedTx, setSelectedTx] = useState<AuditRecord | null>(null);
  const [channelFilter, setChannelFilter] = useState<"ALL" | "GAB" | "TPE" | "ECOM">("ALL");
  const [verdictFilter, setVerdictFilter] = useState<"ALL" | "APPROVED" | "REJECTED" | "CRITICAL">("ALL");
  const [quickActionFeedback, setQuickActionFeedback] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "init",
      timestamp: new Date().toLocaleTimeString(),
      type: "SYSTEM",
      message: "Console d'audit TCP ISO 8583 connectée. Cadrage 2-octets Big-Endian actif. Conformité PCI-DSS v4.0 active.",
    },
  ]);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  const loadAuditHistory = async () => {
    setLoadingAudit(true);
    try {
      const res = await fetchAuditLogs(100);
      const list = (res.logs || []) as AuditRecord[];
      setAuditLogs(list);
      if (!selectedTx && list.length > 0) {
        setSelectedTx(list[0]);
      }
    } catch (e) {
      console.error("Erreur chargement journal d'audit MySQL :", e);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadAuditHistory();
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "127.0.0.1";
    const wsUrl = `${protocol}//${host}:8000/ws`;

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const type = data.type || "INFO";
          const message = data.message || JSON.stringify(data);
          setLogs((prev) => [
            ...prev.slice(-300),
            {
              id: Math.random().toString(36).substring(7),
              timestamp: new Date().toLocaleTimeString(),
              type,
              message,
            },
          ]);
          if (type.startsWith("TRANSACTION_")) {
            loadAuditHistory();
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (ws) ws.close();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClear = () => {
    setLogs([]);
  };

  // Calcul des indicateurs NOC (Approval Rate & Incidents Critiques)
  const totalAudited = auditLogs.length;
  const approvedAudited = auditLogs.filter((a) => a.code === "00").length;
  const criticalIncidents = auditLogs.filter((a) => ["91", "68", "96", "63", "30"].includes(a.code)).length;
  const approvalRate = totalAudited > 0 ? (approvedAudited / totalAudited) * 100 : 100;
  const nocAlertActive = (totalAudited > 0 && approvalRate < 80) || criticalIncidents > 0;

  const filteredAudit = auditLogs.filter((item) => {
    if (channelFilter !== "ALL" && item.channel !== channelFilter) return false;
    if (verdictFilter === "APPROVED" && item.code !== "00") return false;
    if (verdictFilter === "REJECTED" && item.code === "00") return false;
    if (verdictFilter === "CRITICAL" && !["91", "68", "96", "63", "30", "43", "41", "04"].includes(item.code)) return false;
    return true;
  });

  // Actions Rapides Exploitant depuis la Fiche Diagnostic
  const handleQuickEcho0800 = async () => {
    setQuickActionFeedback("Envoi Echo Test 0800 sur socket TCP 5001...");
    try {
      const res = await sendTransaction({
        mti: "0800",
        pan: "4000123456780001",
        amount: 0,
        currency: "952",
        pin: "1234",
        exp: "2812",
        stan: String(Math.floor(Math.random() * 900000) + 100000),
        terminal_id: "NOC00001",
      });
      setQuickActionFeedback(
        `Echo 0800 -> 0810 validé (DE 39 = ${res.response.de39}) en ${res.latency_ms.toFixed(2)} ms`
      );
      await loadAuditHistory();
    } catch (e: any) {
      setQuickActionFeedback(`Échec Echo 0800 : ${e.message}`);
    }
  };

  const handleQuickReversal0400 = async (tx: AuditRecord) => {
    setQuickActionFeedback(`Émission Reversal 0400 pour STAN ${tx.stan}...`);
    try {
      const de90 = `0200${tx.stan.padStart(6, "0")}10271200000000000000100000000001`;
      const res = await sendTransaction({
        mti: "0400",
        pan: "4000123456780001",
        amount: tx.amount,
        currency: tx.currency || "952",
        pin: "1234",
        exp: "2812",
        stan: String(Math.floor(Math.random() * 900000) + 100000),
        terminal_id: tx.terminal_id || "TERM0001",
        de_90: de90,
      });
      setQuickActionFeedback(
        `Reversal 0400 traité : DE 39 = ${res.response.de39} (${res.response.label})`
      );
      await loadAuditHistory();
    } catch (e: any) {
      setQuickActionFeedback(`Erreur Reversal 0400 : ${e.message}`);
    }
  };

  const handleQuickResetChaos = async () => {
    setQuickActionFeedback("Purge des pannes Chaos & resynchronisation HSM/Host...");
    try {
      await resetChaos();
      setQuickActionFeedback("Nominal rétabli : Host Émetteur en ligne, HSM synchronisé, latence nominale.");
      await loadAuditHistory();
    } catch (e: any) {
      setQuickActionFeedback(`Erreur : ${e.message}`);
    }
  };

  return (
    <div className="homologation-container">
      {/* En-tête du Poste NOC & Journal d'Audit */}
      <div className="pane-header-enhanced">
        <div className="pane-title-group">
          <div className="pane-badge-wrapper">
            <span className="badge-chip emerald">
              <span className="status-indicator-dot" />
              COCKPIT EXPLOITANT NOC &amp; AUDIT MYSQL
            </span>
            <span className="badge-chip subtle">SOCKET TCP : 5001 • PCI-DSS v4.0</span>
          </div>
          <h2 className="pane-title">Supervision NOC, Journal d&apos;Audit MySQL &amp; Flux TCP</h2>
          <p className="pane-subtitle">
            Inspecteur de diagnostic sur clic, surveillance du taux d&apos;approbation, cascade de latence bout-en-bout et actions rapides d&apos;exploitation.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setViewMode("audit")}
            className={`btn btn-sm ${viewMode === "audit" ? "btn-primary" : "btn-outline"}`}
          >
            📊 Inspecteur d&apos;Audit MySQL ({auditLogs.length})
          </button>
          <button
            onClick={() => setViewMode("stream")}
            className={`btn btn-sm ${viewMode === "stream" ? "btn-primary" : "btn-outline"}`}
          >
            📡 Console Flux TCP Brut ({logs.length})
          </button>
          <button onClick={loadAuditHistory} disabled={loadingAudit} className="btn btn-sm btn-outline">
            ↻ Actualiser
          </button>
        </div>
      </div>

      {/* Bannière d'Alerting Supervision NOC (Approval Rate & Codes Critiques) */}
      <div
        className="card"
        style={{
          marginBottom: "1.25rem",
          borderLeft: `4px solid ${nocAlertActive ? "#e60028" : "#10b981"}`,
          background: nocAlertActive ? "#fff1f2" : "#ecfdf5",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.25rem" }}>
              <span
                style={{
                  padding: "0.2rem 0.6rem",
                  borderRadius: "999px",
                  fontSize: "0.7rem",
                  fontWeight: 800,
                  background: nocAlertActive ? "#fecdd3" : "#a7f3d0",
                  color: nocAlertActive ? "#9f1239" : "#065f46",
                }}
              >
                {nocAlertActive ? "⚠️ ALERTE SUPERVISION NOC" : "✓ SUPERVISION NOMINALE"}
              </span>
              <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>
                Taux d&apos;Approbation Échantillon : {approvalRate.toFixed(1)}% ({approvedAudited}/{totalAudited})
              </strong>
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              {nocAlertActive
                ? `Seuil d'alerte déclenché : ${criticalIncidents} incident(s) technique(s) critique(s) (91/68/96/63/30) ou taux d'approbation < 80%. Cliquez sur une transaction pour ouvrir le Runbook.`
                : "Aucun incident technique critique non résolu. Taux d'approbation conforme aux seuils de production (> 80%)."}
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button onClick={handleQuickEcho0800} className="btn btn-sm btn-outline">
              ⚡ Tester Liaison (0800)
            </button>
            <button onClick={handleQuickResetChaos} className="btn btn-sm btn-outline">
              🛠️ Rétablir Nominal (Reset Chaos)
            </button>
          </div>
        </div>

        {quickActionFeedback && (
          <div
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              background: "#ffffff",
              border: "1px solid var(--border-burgundy)",
              fontSize: "0.78rem",
              fontFamily: "var(--font-mono)",
              color: "var(--burgundy)",
              fontWeight: 600,
            }}
          >
            ▶ {quickActionFeedback}
          </div>
        )}
      </div>

      {viewMode === "audit" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "1.25rem", alignItems: "start" }}>
          {/* Tableau du Journal d'Audit MySQL */}
          <div className="card">
            <div className="card-header" style={{ flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <h3>Journal d&apos;Audit Transactionnel MySQL</h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Cliquez sur une ligne pour inspecter le diagnostic exploitant et la cascade de latence
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {(["ALL", "GAB", "TPE", "ECOM"] as const).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => setChannelFilter(ch)}
                    className={`btn btn-sm ${channelFilter === ch ? "btn-primary" : "btn-outline"}`}
                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
                  >
                    {ch === "ALL" ? "Tous Canaux" : ch}
                  </button>
                ))}
                {(["ALL", "APPROVED", "REJECTED", "CRITICAL"] as const).map((vf) => (
                  <button
                    key={vf}
                    onClick={() => setVerdictFilter(vf)}
                    className={`btn btn-sm ${verdictFilter === vf ? "btn-primary" : "btn-outline"}`}
                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
                  >
                    {vf === "ALL" ? "Tous Verdicts" : vf === "APPROVED" ? "00 Approuvés" : vf === "REJECTED" ? "Rejets" : "Critiques"}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-container" style={{ maxHeight: "540px", overflowY: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Horodatage</th>
                    <th>Canal</th>
                    <th>STAN</th>
                    <th>PAN Masqué</th>
                    <th>Montant</th>
                    <th>DE 39</th>
                    <th>Règle / Maillon</th>
                    <th>Latence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                        Aucune transaction dans cette sélection. Exécutez la Suite d&apos;Homologation ou le Simulateur.
                      </td>
                    </tr>
                  ) : (
                    filteredAudit.map((item, idx) => {
                      const isSelected =
                        selectedTx?.stan === item.stan &&
                        selectedTx?.timestamp === item.timestamp &&
                        selectedTx?.code === item.code;
                      const isOk = item.code === "00";
                      return (
                        <tr
                          key={`${item.stan}-${item.timestamp}-${idx}`}
                          onClick={() => setSelectedTx(item)}
                          style={{
                            cursor: "pointer",
                            background: isSelected ? "var(--sg-red-50)" : undefined,
                            borderLeft: isSelected ? "3px solid var(--burgundy)" : undefined,
                          }}
                        >
                          <td className="font-mono" style={{ fontSize: "0.73rem" }}>
                            {item.timestamp.split(" ")[1] || item.timestamp}
                          </td>
                          <td>
                            <span className="tag" style={{ fontSize: "0.7rem" }}>
                              {item.channel}
                            </span>
                          </td>
                          <td className="font-mono">{item.stan}</td>
                          <td className="font-mono" style={{ fontSize: "0.75rem" }}>
                            {item.masked_pan}
                          </td>
                          <td className="font-mono">
                            {item.amount > 0 ? `${item.amount.toLocaleString()} F` : "—"}
                          </td>
                          <td>
                            <span className={`verdict-pill ${isOk ? "pass" : "fail"}`}>{item.code}</span>
                          </td>
                          <td style={{ fontSize: "0.75rem", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.rule}
                          </td>
                          <td className="font-mono" style={{ fontSize: "0.74rem" }}>
                            {Number(item.latency_total_ms || 0).toFixed(1)} ms
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fiche d'Analyse Exploitant sur Clic */}
          <div className="card">
            <div className="card-header">
              <h3>🔍 Fiche d&apos;Analyse Exploitant (Diagnostic sur Clic)</h3>
              {selectedTx && (
                <span className={`verdict-pill ${selectedTx.code === "00" ? "pass" : "fail"}`}>
                  DE 39 = {selectedTx.code}
                </span>
              )}
            </div>

            {!selectedTx ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                Sélectionnez une transaction dans le tableau à gauche pour afficher son diagnostic complet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Résumé Transaction */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.65rem",
                    padding: "0.85rem",
                    borderRadius: "10px",
                    background: "#f8fafc",
                    border: "1px solid var(--border-light)",
                    fontSize: "0.78rem",
                  }}
                >
                  <div>
                    <span className="text-muted">Canal &amp; MTI :</span>{" "}
                    <strong>
                      {selectedTx.channel} ({selectedTx.mti})
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted">Terminal / STAN :</span>{" "}
                    <strong className="font-mono">
                      {selectedTx.terminal_id} / #{selectedTx.stan}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted">PAN (PCI-DSS) :</span>{" "}
                    <strong className="font-mono">{selectedTx.masked_pan}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Montant :</span>{" "}
                    <strong className="font-mono">
                      {selectedTx.amount.toLocaleString()} FCFA ({selectedTx.currency})
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted">Maillon Imputé :</span>{" "}
                    <strong style={{ color: "var(--burgundy)" }}>{selectedTx.failing_component}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Sévérité :</span>{" "}
                    <strong>{selectedTx.severity}</strong>
                  </div>
                </div>

                {/* Cause Racine & Règle Déclenchée */}
                <div
                  style={{
                    padding: "0.85rem",
                    borderRadius: "10px",
                    background: selectedTx.code === "00" ? "#ecfdf5" : "#fef2f2",
                    border: `1px solid ${selectedTx.code === "00" ? "#a7f3d0" : "#fecdd3"}`,
                  }}
                >
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", marginBottom: "0.3rem", color: selectedTx.code === "00" ? "#047857" : "#b91c1c" }}>
                    {selectedTx.rule} — {selectedTx.status_label}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-primary)" }}>{selectedTx.description}</div>
                </div>

                {/* Cascade de Latence Bout-en-Bout */}
                {selectedTx.latency_breakdown && (
                  <div
                    style={{
                      padding: "0.85rem",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      border: "1px solid var(--border-light)",
                    }}
                  >
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text-primary)" }}>
                      ⏱️ Cascade de Latence Bout-en-Bout (Total : {Number(selectedTx.latency_total_ms || 0).toFixed(2)} ms)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem", fontSize: "0.74rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
                      <div>1. Réseau Accès : {selectedTx.latency_breakdown.access_network_ms ?? 0} ms</div>
                      <div>2. Acquéreur : {selectedTx.latency_breakdown.acquirer_ms ?? 0} ms</div>
                      <div>3. Switch GIM : {selectedTx.latency_breakdown.switch_ms ?? 0} ms</div>
                      <div>4. HSM Crypto : {selectedTx.latency_breakdown.hsm_crypto_ms ?? 0} ms</div>
                      <div>5. Host CBS : {selectedTx.latency_breakdown.issuer_host_cbs_ms ?? 0} ms</div>
                      <div>6. Socket TCP : {selectedTx.latency_breakdown.socket_rtt_ms ?? 0} ms</div>
                    </div>
                  </div>
                )}

                {/* Runbook Opérateur */}
                {selectedTx.runbook_steps && selectedTx.runbook_steps.length > 0 && (
                  <div
                    style={{
                      padding: "0.85rem",
                      borderRadius: "10px",
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                    }}
                  >
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, marginBottom: "0.45rem", color: "#047857" }}>
                      🛠️ Procédure d&apos;Intervention Exploitant (Runbook)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", lineHeight: 1.55, color: "#065f46" }}>
                      {selectedTx.runbook_steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Boutons d'Action Rapide Exploitant */}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", paddingTop: "0.25rem" }}>
                  <button
                    onClick={() => handleQuickReversal0400(selectedTx)}
                    className="btn btn-sm btn-primary"
                    title="Émettre un message 0400 Reversal pour annuler et recréditer cette transaction"
                  >
                    ↩ Émettre Reversal 0400 (STAN #{selectedTx.stan})
                  </button>
                  <button onClick={handleQuickEcho0800} className="btn btn-sm btn-outline">
                    📡 Ping 0800
                  </button>
                  <button onClick={handleQuickResetChaos} className="btn btn-sm btn-outline">
                    🔄 Reset Chaos
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Console Flux TCP Brut Temps Réel */
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", alignItems: "center", marginBottom: "0.75rem" }}>
            <button onClick={handleClear} className="btn btn-sm btn-outline">
              Effacer Console
            </button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--text-muted)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                style={{ accentColor: "#7d1538" }}
              />
              Défilement auto
            </label>
          </div>

          <div style={{ background: "rgba(15, 23, 42, 0.98)", border: "1px solid var(--border-subtle)", borderRadius: "16px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
            <div style={{ background: "rgba(30, 41, 59, 0.95)", padding: "0.65rem 1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} />
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} />
              <span style={{ marginLeft: "0.65rem", fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                tcp://127.0.0.1:5001 • ISO 8583 Host Stream • Masquage PAN Actif (PCI-DSS v4.0)
              </span>
            </div>

            <div
              ref={terminalRef}
              className="font-mono"
              style={{ padding: "1.25rem", height: "500px", overflowY: "auto", fontSize: "0.8rem", lineHeight: "1.7" }}
            >
              {logs.map((log) => {
                let typeColor = "#94a3b8";
                let typeBg = "rgba(255, 255, 255, 0.06)";
                if (log.type === "TRANSACTION_0800") {
                  typeColor = "#34d399";
                  typeBg = "rgba(16, 185, 129, 0.15)";
                } else if (log.type === "TRANSACTION_0200") {
                  typeColor = "#fda4af";
                  typeBg = "rgba(125, 21, 56, 0.35)";
                } else if (log.type === "TRANSACTION_0400") {
                  typeColor = "#fbbf24";
                  typeBg = "rgba(245, 158, 11, 0.15)";
                }

                return (
                  <div key={log.id} style={{ display: "flex", gap: "0.75rem", marginBottom: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>[{log.timestamp}]</span>
                    <span style={{ color: typeColor, background: typeBg, fontWeight: "700", padding: "0 6px", borderRadius: "4px" }}>
                      {log.type}
                    </span>
                    <span style={{ color: "#e2e8f0", wordBreak: "break-all" }}>{log.message}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
