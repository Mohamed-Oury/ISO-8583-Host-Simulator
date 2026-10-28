"use client";

import { useState } from "react";
import { dissectPacket, executeReplay, DissectionResult, ReplayExecutionResult } from "@/lib/api";

const REPLAY_PRESETS = [
  {
    id: "tpe_emv_arqc",
    label: "Achat TPE EMV avec ARQC (0200)",
    desc: "Trame standard débit avec puce EMV, ARQC 9F26, ATC 9F36 et TVR 95",
    hex: "020072380000000000001640001234567800010000000050000000019F260811223344556677889F36020005950580000080009C01005F2A020952",
  },
  {
    id: "atm_withdrawal",
    label: "Retrait GAB Agence (0200)",
    desc: "Demande de retrait espèces 50 000 FCFA sur automate GAB_AGENCE_01",
    hex: "020072380000000000001640001234567800010000000500000000029F2608AABBCCDDEEFF00119F360200109C01015F2A020952",
  },
  {
    id: "ecom_auth",
    label: "Autorisation E-Commerce 3DS (0100)",
    desc: "Demande d'autorisation achat Web 3-D Secure vérifié",
    hex: "010072380000000000001640001234567800030000000350000000039C01005F2A020952",
  },
  {
    id: "reversal_0420",
    label: "Annulation Reversal GAB Timeout (0420)",
    desc: "Avis d'annulation suite à bourrage ou non-distribution billets",
    hex: "0420723800000000000016400012345678000100000005000000000490070200000001",
  },
  {
    id: "echo_0800",
    label: "Echo Test Réseau / HSM (0800)",
    desc: "Test de présence de liaison switch / HSM",
    hex: "08000020000000000000000005301",
  },
];

export default function PacketReplay() {
  const [rawHex, setRawHex] = useState(REPLAY_PRESETS[0].hex);
  const [dissection, setDissection] = useState<DissectionResult | null>(null);
  const [replayResult, setReplayResult] = useState<ReplayExecutionResult | null>(null);
  const [isDissecting, setIsDissecting] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDissect = async () => {
    setErrorMsg(null);
    setIsDissecting(true);
    try {
      const res = await dissectPacket(rawHex);
      setDissection(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur de dissection");
    } finally {
      setIsDissecting(false);
    }
  };

  const handleReplay = async () => {
    setErrorMsg(null);
    setIsReplaying(true);
    try {
      // Exécute d'abord la dissection si non faite
      if (!dissection) {
        const d = await dissectPacket(rawHex);
        setDissection(d);
      }
      const res = await executeReplay(rawHex, 3.0);
      setReplayResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors du rejeu TCP");
    } finally {
      setIsReplaying(false);
    }
  };

  const loadPreset = (presetHex: string) => {
    setRawHex(presetHex);
    setDissection(null);
    setReplayResult(null);
    setErrorMsg(null);
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
            <span style={{ fontSize: "1.5rem" }}>🔬</span>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
              Dissecteur Hexadécimal, Décodeur TLV EMV & Rejeu TCP
            </h2>
          </div>
          <p style={{ margin: "0.25rem 0 0 0", color: "var(--text-muted)", fontSize: "0.875rem" }}>
            Analysez des trames de production brutes, décodez le DE 55 EMV (ARQC/ATC) et rejouez les paquets directement sur le serveur TCP Host (:5001).
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
            TCP Host Socket :5001
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
            Conforme EMVCo & ISO 8583
          </span>
        </div>
      </div>

      {/* Sélecteur de Presets Rapides */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
          Scénarios & Trames Typiques de Production :
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {REPLAY_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => loadPreset(p.hex)}
              className="btn"
              style={{
                fontSize: "0.8125rem",
                padding: "0.4rem 0.85rem",
                background: rawHex === p.hex ? "#7d1538" : "var(--bg-card)",
                color: rawHex === p.hex ? "#ffffff" : "var(--text-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone de Saisie Hexadécimale */}
      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>
            Trame Brute Hexadécimale ou Dump Wireshark (ASCII / Hex) :
          </label>
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Longueur : {rawHex.replace(/[^0-9a-fA-F]/g, "").length} cars ({Math.floor(rawHex.replace(/[^0-9a-fA-F]/g, "").length / 2)} octets)
          </span>
        </div>
        <textarea
          rows={4}
          value={rawHex}
          onChange={(e) => setRawHex(e.target.value)}
          placeholder="Ex: 02007238000000000000164000123456780001..."
          style={{
            width: "100%",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--border-color)",
            background: "var(--bg-primary)",
            color: "var(--text-primary)",
            resize: "vertical",
          }}
        />

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            onClick={handleDissect}
            disabled={isDissecting || !rawHex.trim()}
            className="btn"
            style={{
              background: "var(--bg-hover)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-color)",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
              fontWeight: 600,
              cursor: isDissecting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {isDissecting ? "Dissection en cours..." : "🔬 Dissecter la Trame"}
          </button>

          <button
            onClick={handleReplay}
            disabled={isReplaying || !rawHex.trim()}
            className="btn"
            style={{
              background: "#7d1538",
              color: "#ffffff",
              border: "none",
              padding: "0.5rem 1.5rem",
              borderRadius: "0.5rem",
              fontWeight: 600,
              cursor: isReplaying ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {isReplaying ? "Rejeu TCP en cours..." : "▶️ Rejouer sur Serveur TCP (:5001)"}
          </button>
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

      {/* Résultat du Rejeu TCP (si exécuté) */}
      {replayResult && (
        <div
          className="card"
          style={{
            padding: "1.25rem",
            borderLeft: `4px solid ${replayResult.status === "SUCCESS" ? "#10b981" : "#ef4444"}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>
                {replayResult.status === "SUCCESS" ? "✅" : "❌"}
              </span>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                Résultat du Rejeu Réseau TCP Host
              </h3>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <span
                style={{
                  padding: "0.25rem 0.65rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: replayResult.status === "SUCCESS" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: replayResult.status === "SUCCESS" ? "#10b981" : "#ef4444",
                }}
              >
                Statut : {replayResult.status}
              </span>
              <span
                style={{
                  padding: "0.25rem 0.65rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  background: "rgba(59, 130, 246, 0.15)",
                  color: "#3b82f6",
                }}
              >
                Latence RTT : {replayResult.latency_ms} ms
              </span>
            </div>
          </div>

          {replayResult.response_hex && (
            <div style={{ marginTop: "0.75rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" }}>
                Trame Réponse Reçue du Serveur (Hex) :
              </span>
              <pre
                style={{
                  marginTop: "0.25rem",
                  padding: "0.75rem",
                  background: "var(--bg-primary)",
                  borderRadius: "0.375rem",
                  fontSize: "0.8125rem",
                  overflowX: "auto",
                  wordBreak: "break-all",
                  whiteSpace: "pre-wrap",
                }}
              >
                {replayResult.response_hex}
              </pre>
            </div>
          )}

          {replayResult.error && (
            <div style={{ color: "#ef4444", fontSize: "0.875rem", marginTop: "0.5rem" }}>
              Détail de l'incident : {replayResult.error}
            </div>
          )}
        </div>
      )}

      {/* Dissection Détaillée de la Trame */}
      {dissection && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.5rem" }}>
          {/* Métadonnées & Bitmap */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
              1. En-Tête ISO 8583 & Bitmap Primaire
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
              <div style={{ padding: "0.75rem", background: "var(--bg-primary)", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>MTI (Message Type Identifier)</span>
                <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "#7d1538" }}>{dissection.mti}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{dissection.mti_desc}</div>
              </div>

              <div style={{ padding: "0.75rem", background: "var(--bg-primary)", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Bitmap Primaire (16 hex)</span>
                <div style={{ fontSize: "0.95rem", fontFamily: "monospace", fontWeight: 700 }}>{dissection.primary_bitmap_hex}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{dissection.active_fields.length} champs déclarés actifs</div>
              </div>

              <div style={{ padding: "0.75rem", background: "var(--bg-primary)", borderRadius: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Taille Totale du Paquet</span>
                <div style={{ fontSize: "1.125rem", fontWeight: 700 }}>{dissection.total_bytes} octets</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  {dissection.has_2byte_length_header ? "Cadrage 2-octets inclus" : "Trame directe (sans header)"}
                </div>
              </div>
            </div>

            {/* Grille des bits actifs */}
            <div>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Champs ISO Détectés dans le Bitmap :
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.5rem" }}>
                {dissection.active_fields.map((f) => (
                  <span
                    key={f}
                    style={{
                      padding: "0.2rem 0.5rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: f === 55 ? "rgba(125, 21, 56, 0.15)" : "var(--bg-hover)",
                      color: f === 55 ? "#7d1538" : "var(--text-primary)",
                      border: f === 55 ? "1px solid #7d1538" : "1px solid var(--border-color)",
                    }}
                  >
                    DE {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Décodage EMV TLV (DE 55) */}
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.25rem" }}>💳</span>
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  2. Dissection des Tags EMV de la Puce (DE 55)
                </h3>
              </div>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "0.25rem",
                  background: dissection.emv_tags.length > 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                  color: dissection.emv_tags.length > 0 ? "#10b981" : "#ef4444",
                  fontWeight: 600,
                }}
              >
                {dissection.emv_tags.length} Tag(s) décodé(s)
              </span>
            </div>

            {dissection.emv_tags.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border-color)", textAlign: "left" }}>
                      <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Tag EMV</th>
                      <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Désignation Normalisée</th>
                      <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Taille</th>
                      <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Valeur Hexadécimale</th>
                      <th style={{ padding: "0.6rem 0.75rem", color: "var(--text-muted)" }}>Interprétation Métier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dissection.emv_tags.map((t, idx) => (
                      <tr
                        key={idx}
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                          background: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.02)",
                        }}
                      >
                        <td style={{ padding: "0.6rem 0.75rem", fontFamily: "monospace", fontWeight: 700, color: "#7d1538" }}>
                          {t.tag}
                        </td>
                        <td style={{ padding: "0.6rem 0.75rem" }}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{t.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{t.desc}</div>
                        </td>
                        <td style={{ padding: "0.6rem 0.75rem", color: "var(--text-secondary)" }}>
                          {t.length} octets
                        </td>
                        <td style={{ padding: "0.6rem 0.75rem", fontFamily: "monospace", color: "#3b82f6" }}>
                          {t.value_hex}
                        </td>
                        <td style={{ padding: "0.6rem 0.75rem", fontWeight: 600, color: "#10b981" }}>
                          {t.meaning || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                Aucun tag TLV EMV (DE 55) identifié dans cette trame (ex: transaction piste magnétique ou echo test).
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
