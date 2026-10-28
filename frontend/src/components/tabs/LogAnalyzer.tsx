"use client";

import { useState } from "react";
import { analyzeLogs, LogAnalyzeResponse } from "@/lib/api";

const SAMPLE_LOGS = {
  atm_jam: `2026-10-28 14:02:11.102 [INCOMING TCP:5001] 0200 STAN=000101 PAN=4000123456780001 AMT=25000 TID=GAB_AGENCE_01 DE22=051 DE25=02
2026-10-28 14:02:11.350 [HOST DECISION] R01-LIMITS: Solde suffisant, approbation accordée.
2026-10-28 14:02:11.352 [OUTGOING TCP:5001] 0210 STAN=000101 RESP=00 AUTH=AUT101 (Accord Hôte)
2026-10-28 14:02:14.920 [INCOMING TCP:5001] 0420 STAN=000102 ORIG_STAN=000101 PAN=4000123456780001 AMT=25000 TID=GAB_AGENCE_01 REASON=CASH_DISPENSE_FAILURE
2026-10-28 14:02:14.990 [HOST REVERSAL] Annulation financière confirmée. Solde porteur réintégré de 25 000 FCFA.
2026-10-28 14:02:15.001 [OUTGOING TCP:5001] 0430 STAN=000102 RESP=00 REVERSAL_ACK`,

  timeout_stip: `2026-10-28 14:03:00.010 [INCOMING TCP:5001] 0200 STAN=000103 PAN=4000123456780002 AMT=35000 TID=TPE_SUPERMARCHE DE22=051 DE25=00
2026-10-28 14:03:03.550 [ALERT NOC] SLA Host dépassé (> 3500 ms) pour STAN=000103.
2026-10-28 14:03:03.552 [OUTGOING TCP:5001] 0210 STAN=000103 RESP=68 TIMEOUT (Host non joignable)
2026-10-28 14:03:05.100 [STIP ENGINE] Activation du Stand-In Processing pour montant < 50 000 FCFA.`,

  velocity_fraud: `2026-10-28 14:10:00.100 [INCOMING TCP:5001] 0200 STAN=000110 PAN=4000123456780003 AMT=100000 TID=TPE_BOUTIQUE_01
2026-10-28 14:10:00.220 [OUTGOING TCP:5001] 0210 STAN=000110 RESP=55 PIN_FAIL (Essai 1/3)
2026-10-28 14:10:15.300 [INCOMING TCP:5001] 0200 STAN=000111 PAN=4000123456780003 AMT=100000 TID=TPE_BOUTIQUE_01
2026-10-28 14:10:15.410 [OUTGOING TCP:5001] 0210 STAN=000111 RESP=55 PIN_FAIL (Essai 2/3)
2026-10-28 14:10:30.500 [INCOMING TCP:5001] 0200 STAN=000112 PAN=4000123456780003 AMT=100000 TID=TPE_BOUTIQUE_01
2026-10-28 14:10:30.610 [OUTGOING TCP:5001] 0210 STAN=000112 RESP=75 PIN_BLOCKED (Carte bloquée pour 3 tentatives erronées)`,
};

export default function LogAnalyzer() {
  const [logText, setLogText] = useState(SAMPLE_LOGS.atm_jam);
  const [results, setResults] = useState<LogAnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async (textToAnalyze?: string) => {
    const content = textToAnalyze !== undefined ? textToAnalyze : logText;
    setLoading(true);
    try {
      const res = await analyzeLogs(content);
      setResults(res);
    } catch (err: any) {
      alert("Erreur d'analyse des logs : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setLogText(content);
      handleAnalyze(content);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div className="pane-header">
        <div className="pane-header-main">
          <div className="pane-title-row">
            <span className="badge-chip highlight">EXPLOITATION &amp; FORENSIC ROOT-CAUSE</span>
            <span className="badge-chip subtle">LOGS SWITCH • BASE24 • SMARTVISTA • GIM-UEMOA</span>
            <span className="badge-chip success">CORRÉLATION DE SESSIONS</span>
          </div>
          <h2 className="pane-title">Analyseur Intelligent de Logs &amp; Détection d'Incidents</h2>
          <p className="pane-subtitle">
            Analyseur syntaxique de journaux de production. Détecte automatiquement les sessions monétiques (0200 ➔ 0210 ➔ 0420), isole les causes racines (bourrages GAB, timeouts 68, erreurs cryptographiques 55/63, vélocité de fraude) et affiche les runbooks de remédiation.
          </p>
        </div>
      </div>

      {/* Presets de logs réels */}
      <div className="card" style={{ padding: "0.85rem 1.25rem", background: "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)", border: "1px solid rgba(125, 21, 56, 0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--burgundy)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span>📂</span>
            <span>Charger un Échantillon d'Incident de Production :</span>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            Cliquez pour injecter un extrait de log réel et lancer le diagnostic forensique
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setLogText(SAMPLE_LOGS.atm_jam);
              handleAnalyze(SAMPLE_LOGS.atm_jam);
            }}
            className="preset-btn"
          >
            🏧 Bourrage Billets GAB + Reversal 0420
          </button>
          <button
            type="button"
            onClick={() => {
              setLogText(SAMPLE_LOGS.timeout_stip);
              handleAnalyze(SAMPLE_LOGS.timeout_stip);
            }}
            className="preset-btn"
          >
            ⏱️ Timeout Hôte (68) + Déclenchement STIP
          </button>
          <button
            type="button"
            onClick={() => {
              setLogText(SAMPLE_LOGS.velocity_fraud);
              handleAnalyze(SAMPLE_LOGS.velocity_fraud);
            }}
            className="preset-btn"
          >
            🚨 Attaque par Essais PIN Consécutifs (55 ➔ 75)
          </button>
        </div>
      </div>

      {/* Zone d'import & Textarea */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Contenu du Fichier Log à Analyser</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              {logText.split("\n").length} lignes
            </span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <label className="btn btn-outline" style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem", cursor: "pointer" }}>
              <span>📁</span>
              <span>Importer un Fichier (.log, .txt)</span>
              <input type="file" accept=".log,.txt,.dump" onChange={handleFileUpload} style={{ display: "none" }} />
            </label>
            <button
              type="button"
              onClick={() => handleAnalyze()}
              disabled={loading}
              className="btn btn-primary btn-glow"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.65rem" }}
            >
              <span>{loading ? "⏳" : "🔍"}</span>
              <span>Lancer le Diagnostic Forensique</span>
            </button>
          </div>
        </div>
        <div style={{ padding: "0.85rem 1.25rem 1.25rem" }}>
          <textarea
            value={logText}
            onChange={(e) => setLogText(e.target.value)}
            rows={6}
            className="form-control font-mono"
            style={{
              width: "100%",
              minHeight: "140px",
              boxSizing: "border-box",
              fontSize: "0.85rem",
              lineHeight: 1.5,
              background: "#0b132b",
              color: "#38bdf8",
              borderRadius: "8px",
              padding: "0.85rem",
              resize: "vertical",
            }}
          />
        </div>
      </div>

      {/* KPI Cards des Résultats */}
      {results && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #3b82f6" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 700 }}>LIGNES DU LOG</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {results.total_lines_analyzed}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Lignes textuelles scannées</div>
            </div>

            <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #10b981" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 700 }}>TRAMES ISO EXTRAITES</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#10b981", fontFamily: "var(--font-mono)" }}>
                {results.messages_extracted}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Messages 01xx / 02xx / 04xx</div>
            </div>

            <div className="card" style={{ padding: "1rem", borderLeft: "4px solid #8b5cf6" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 700 }}>SESSIONS CORRÉLÉES</div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#8b5cf6", fontFamily: "var(--font-mono)" }}>
                {results.sessions_count}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Couples Requête / Réponse / Reversal</div>
            </div>

            <div className="card" style={{ padding: "1rem", borderLeft: `4px solid ${results.anomalies_count > 0 ? "#ef4444" : "#10b981"}` }}>
              <div style={{ fontSize: "0.75rem", color: results.anomalies_count > 0 ? "#b91c1c" : "#047857", fontWeight: 700 }}>
                ANOMALIES CRITIQUES
              </div>
              <div style={{ fontSize: "1.8rem", fontWeight: 900, color: results.anomalies_count > 0 ? "#dc2626" : "#10b981", fontFamily: "var(--font-mono)" }}>
                {results.anomalies_count}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Incidents nécessitant action</div>
            </div>
          </div>

          {/* Liste des Anomalies & Causes Racines */}
          {results.anomalies.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#dc2626" }}>🚨 Incidents &amp; Causes Racines Détectés</h3>
                <span className="tag" style={{ background: "#fef2f2", color: "#991b1b" }}>ACTION REQUISE</span>
              </div>
              <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {results.anomalies.map((a, idx) => (
                  <div key={idx} style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", borderRadius: "8px", padding: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <span style={{ fontWeight: 800, color: "#9f1239", fontSize: "0.9rem" }}>
                        ⚠️ {a.title}
                      </span>
                      <span className="tag" style={{ background: "#fecdd3", color: "#881337", fontSize: "0.7rem" }}>
                        {a.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#881337", marginBottom: "0.5rem" }}>
                      <strong>Cause Racine Identifiée :</strong> {a.root_cause}
                    </div>
                    <div style={{ fontSize: "0.78rem", background: "#ffffff", padding: "0.6rem 0.8rem", borderRadius: "6px", border: "1px solid #fca5a5", color: "#991b1b" }}>
                      📋 <strong>Procédure Opérateur (Runbook) :</strong> {a.action_required}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sessions Monétiques Corrélées */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Sessions Monétiques Bout-en-Bout</h3>
              <span className="tag" style={{ background: "#ecfdf5", color: "#065f46" }}>CORRÉLATION ACTIVE</span>
            </div>
            <div style={{ padding: "0", overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "left" }}>Session ID</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "left" }}>Carte (PAN)</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "left" }}>Terminal</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "left" }}>Montant</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "left" }}>Statut</th>
                    <th style={{ padding: "0.6rem 1rem", textAlign: "left" }}>Diagnostic Métier</th>
                  </tr>
                </thead>
                <tbody>
                  {results.sessions.map((s, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.55rem 1rem", fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--burgundy)" }}>
                        {s.session_id}
                      </td>
                      <td style={{ padding: "0.55rem 1rem", fontFamily: "var(--font-mono)" }}>{s.pan_masked}</td>
                      <td style={{ padding: "0.55rem 1rem" }}>{s.terminal_id}</td>
                      <td style={{ padding: "0.55rem 1rem", fontWeight: 700 }}>
                        {s.amount ? `${s.amount.toLocaleString()} FCFA` : "-"}
                      </td>
                      <td style={{ padding: "0.55rem 1rem" }}>
                        <span
                          className="tag"
                          style={{
                            background: s.status === "APPROVED" ? "#ecfdf5" : s.status === "REVERSED" ? "#fef3c7" : "#fef2f2",
                            color: s.status === "APPROVED" ? "#065f46" : s.status === "REVERSED" ? "#92400e" : "#991b1b",
                            fontWeight: 700,
                          }}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.55rem 1rem", color: "var(--text-secondary)" }}>{s.diagnostic}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
