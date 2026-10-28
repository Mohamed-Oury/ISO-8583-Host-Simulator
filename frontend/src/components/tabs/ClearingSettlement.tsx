"use client";

import { useEffect, useState } from "react";
import {
  fetchClearingBatches,
  generateClearingBatch,
  getClearingDownloadUrl,
  ClearingBatch,
} from "@/lib/api";

export default function ClearingSettlement() {
  const [batches, setBatches] = useState<ClearingBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<ClearingBatch | null>(null);
  const [formatType, setFormatType] = useState<string>("GIM_UEMOA");
  const [bankCode, setBankCode] = useState<string>("CI099");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadBatches = async () => {
    try {
      const data = await fetchClearingBatches();
      setBatches(data.batches);
      if (data.batches.length > 0 && !selectedBatch) {
        setSelectedBatch(data.batches[0]);
      }
    } catch (err: any) {
      console.error("Erreur de chargement des lots de compensation :", err);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleGenerate = async () => {
    setErrorMsg(null);
    setIsGenerating(true);
    try {
      const newBatch = await generateClearingBatch(formatType, bankCode, batches.length + 1);
      setBatches([newBatch, ...batches]);
      setSelectedBatch(newBatch);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur de génération du lot");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* En-tête / Présentation */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(125, 21, 56, 0.08) 0%, rgba(15, 23, 42, 0.04) 100%)",
          border: "1px solid rgba(125, 21, 56, 0.2)",
          borderRadius: "0.75rem",
          padding: "1.25rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>📑</span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Télécompensation & Rapprochement Bancaire (Clearing & Settlement)
            </h2>
          </div>
          <p style={{ margin: "0.25rem 0 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Générez les fichiers de compensation interbancaires, calculez les commissions d'interchange et exportez les écritures pour le Core Banking (Amplitude / Orion).
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <span
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "0.375rem",
              background: "rgba(16, 185, 129, 0.1)",
              color: "#10b981",
              fontSize: "0.75rem",
              fontWeight: 600,
              border: "1px solid rgba(16, 185, 129, 0.2)",
            }}
          >
            Norme GIM-UEMOA
          </span>
          <span
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "0.375rem",
              background: "rgba(59, 130, 246, 0.1)",
              color: "#3b82f6",
              fontSize: "0.75rem",
              fontWeight: 600,
              border: "1px solid rgba(59, 130, 246, 0.2)",
            }}
          >
            Visa BASE II & Core Banking
          </span>
        </div>
      </div>

      {/* Cartouche de Génération de Batch */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
          Lancer une Compensation de Fin de Journée
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", alignItems: "end" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-muted)" }}>
              Format du Fichier de Compensation :
            </label>
            <select
              value={formatType}
              onChange={(e) => setFormatType(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border-color)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
              }}
            >
              <option value="GIM_UEMOA">GIM-UEMOA (Télécompensation sous-régionale)</option>
              <option value="CORE_BANKING_PIVOT">Fichier Pivot Core Banking (CSV Écritures)</option>
              <option value="BASE_II_SIM">Visa BASE II (Format International TCR)</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: "0.35rem", color: "var(--text-muted)" }}>
              Code Banque Participant :
            </label>
            <input
              type="text"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              placeholder="Ex: CI099"
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid var(--border-color)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: "0.875rem",
              }}
            />
          </div>

          <div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="btn"
              style={{
                width: "100%",
                background: "#7d1538",
                color: "#ffffff",
                border: "none",
                padding: "0.65rem 1.25rem",
                borderRadius: "0.5rem",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: isGenerating ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              {isGenerating ? "Génération en cours..." : "⚡ Exécuter la Compensation"}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              fontSize: "0.875rem",
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}
      </div>

      {/* Lot Sélectionné & Détails Financiers */}
      {selectedBatch ? (
        <>
          {/* Ruban Métriques du Lot */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
            }}
          >
            <div className="card" style={{ padding: "1rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Lot de Compensation</span>
              <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#7d1538" }}>{selectedBatch.batch_id}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Format {selectedBatch.format}</div>
            </div>

            <div className="card" style={{ padding: "1rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Transactions Incluses</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>{selectedBatch.transaction_count} txs</div>
              <div style={{ fontSize: "0.75rem", color: "#10b981" }}>Toutes approuvées (DE39=00)</div>
            </div>

            <div className="card" style={{ padding: "1rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Débit Interbancaire</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {selectedBatch.total_debit_amount.toLocaleString("fr-FR")} XOF
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Flux porteurs</div>
            </div>

            <div className="card" style={{ padding: "1rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Commissions d'Interchange</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f59e0b" }}>
                {selectedBatch.total_interchange_fees.toLocaleString("fr-FR")} XOF
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>GAB (350F) / TPE (0.8%) / E-Com (1.2%)</div>
            </div>

            <div className="card" style={{ padding: "1rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Position Nette de Règlement</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#10b981" }}>
                {selectedBatch.net_position.toLocaleString("fr-FR")} XOF
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Balance de compensation</div>
            </div>
          </div>

          {/* Prévisualisation du Fichier Généré & Téléchargement */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Fichier Généré : {selectedBatch.filename}
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Généré le {new Date(selectedBatch.created_at).toLocaleString("fr-FR")}
                </span>
              </div>
              <a
                href={getClearingDownloadUrl(selectedBatch.filename)}
                download={selectedBatch.filename}
                className="btn"
                style={{
                  background: "#10b981",
                  color: "#ffffff",
                  padding: "0.45rem 1rem",
                  borderRadius: "0.375rem",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                📥 Télécharger le Fichier
              </a>
            </div>

            <pre
              style={{
                padding: "0.75rem",
                background: "var(--bg-primary)",
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                border: "1px solid var(--border-color)",
                maxHeight: "220px",
              }}
            >
              {selectedBatch.file_preview}
            </pre>
          </div>

          {/* Tableau Détaillé des Écritures du Lot */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              Détail des Enregistrements Financiers du Lot ({selectedBatch.records.length} écritures)
            </h3>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border-color)", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>STAN</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Canal</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Carte (PAN Masqué)</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Montant Brut</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Interchange</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Règlement Net</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Code Auth</th>
                    <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Terminal</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBatch.records.map((r, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid var(--border-color)",
                        background: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.02)",
                      }}
                    >
                      <td style={{ padding: "0.6rem 0.75rem", fontFamily: "monospace", fontWeight: 700 }}>
                        {r.stan}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <span
                          style={{
                            padding: "0.15rem 0.45rem",
                            borderRadius: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background:
                              r.channel === "GAB"
                                ? "rgba(59, 130, 246, 0.1)"
                                : r.channel === "TPE"
                                ? "rgba(16, 185, 129, 0.1)"
                                : "rgba(139, 92, 246, 0.1)",
                            color:
                              r.channel === "GAB"
                                ? "#3b82f6"
                                : r.channel === "TPE"
                                ? "#10b981"
                                : "#8b5cf6",
                          }}
                        >
                          {r.channel}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", fontFamily: "monospace" }}>
                        {r.pan_masked}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", fontWeight: 700 }}>
                        {r.amount.toLocaleString("fr-FR")} XOF
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "#f59e0b" }}>
                        {r.interchange_fee.toLocaleString("fr-FR")} XOF
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600, color: "#10b981" }}>
                        {r.net_settlement_amount.toLocaleString("fr-FR")} XOF
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", fontFamily: "monospace" }}>
                        {r.auth_code}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)" }}>
                        {r.terminal_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
          Aucun lot de compensation généré pour le moment. Cliquez sur "Exécuter la Compensation" pour créer le premier fichier.
        </div>
      )}

      {/* Historique des Lots Précédents */}
      {batches.length > 1 && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Historique des Lots Générés ({batches.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {batches.map((b) => (
              <div
                key={b.batch_id}
                onClick={() => setSelectedBatch(b)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  background: selectedBatch?.batch_id === b.batch_id ? "rgba(125, 21, 56, 0.08)" : "var(--bg-primary)",
                  border: selectedBatch?.batch_id === b.batch_id ? "1px solid #7d1538" : "1px solid var(--border-color)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{b.batch_id}</span>
                  <span style={{ marginLeft: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {b.filename} • {new Date(b.created_at).toLocaleString("fr-FR")}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                    {b.total_debit_amount.toLocaleString("fr-FR")} XOF ({b.transaction_count} txs)
                  </span>
                  <a
                    href={getClearingDownloadUrl(b.filename)}
                    download={b.filename}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontSize: "0.75rem",
                      color: "#3b82f6",
                      textDecoration: "underline",
                    }}
                  >
                    Télécharger
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
