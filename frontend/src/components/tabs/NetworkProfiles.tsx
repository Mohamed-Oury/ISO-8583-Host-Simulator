"use client";

import React, { useState, useEffect } from "react";
import {
  fetchNetworkProfiles,
  validateNetworkProfile,
  NetworkProfile,
  ProfileValidationResponse,
} from "@/lib/api";

const PRESET_FRAMES: Record<string, string> = {
  "GIM_UEMOA": "0200723C448100E0900016506000000000000100000000000002500010281200000001231200002610281260110510006000001GIMATM01MERCHANT0000001GIM-ATM 01        ABIDJAN      CI       9521234            ",
  "VISA_BASE_I": "0200F23A448108E0800000000000040000001640000000000000020000000001000001281200000001231200000128012801286011400000000000000012345678001VISA-POS01    PARIS        FRUSD8400120104VISA",
  "MASTERCARD_CIS": "0200F23A448108E0800000000000040000001651000000000000010000000002500001281200000001231200000128012801286011400000000000000012345678001MC-WEB-01     NEW YORK     USEUR978",
  "DOMESTIC_SWITCH": "0200F23A448108E0800000000000040000001650600000000000010000000001500001281200000001231200000128012801286011400000000000000012345678001DOM-ATM-01    DAKAR        SNXOF952",
};

export default function NetworkProfiles() {
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("GIM_UEMOA");
  const [inputFrame, setInputFrame] = useState<string>(PRESET_FRAMES["GIM_UEMOA"]);
  const [validationResult, setValidationResult] = useState<ProfileValidationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetching, setFetching] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      setFetching(true);
      setErrorMsg(null);
      const res = await fetchNetworkProfiles();
      setProfiles(res.profiles || []);
      if (res.profiles && res.profiles.length > 0) {
        setSelectedProfileId(res.profiles[0].id);
        setInputFrame(PRESET_FRAMES[res.profiles[0].id] || "");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Impossible de charger les profils réseaux");
    } finally {
      setFetching(false);
    }
  };

  const handleProfileChange = (pId: string) => {
    setSelectedProfileId(pId);
    if (PRESET_FRAMES[pId]) {
      setInputFrame(PRESET_FRAMES[pId]);
    }
    setValidationResult(null);
  };

  const handleValidate = async () => {
    if (!inputFrame.trim()) {
      setErrorMsg("Veuillez saisir ou coller une trame ISO 8583.");
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await validateNetworkProfile({
        raw_frame: inputFrame.trim(),
        profile_id: selectedProfileId,
      });
      setValidationResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de la validation du profil");
    } finally {
      setLoading(false);
    }
  };

  const activeProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* HEADER PRINCIPAL */}
      <div className="pane-header">
        <div className="pane-header-main">
          <div className="pane-title-row">
            <span className="badge-chip highlight">NORMES &amp; SCHÉMAS MONÉTIQUES</span>
            <span className="badge-chip subtle">DIALECTES ISO 8583:1987 / 1993</span>
            <span className="badge-chip success">GIM-UEMOA • VISA • MASTERCARD</span>
          </div>
          <h2 className="pane-title">Profils Réseaux Multi-Dialectes ISO 8583</h2>
          <p className="pane-subtitle">
            Spécifications strictes d'interconnexion régionale et internationale. Validez vos trames ISO 8583
            face aux exigences normatives du réseau interbancaire régional <strong>GIM-UEMOA</strong>,
            des réseaux internationaux <strong>VISA Base I</strong> et <strong>Mastercard CIS</strong>, ou du <strong>Switch Domestique</strong>.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={loadProfiles}
            disabled={fetching}
            className="btn btn-outline"
            style={{ fontSize: "0.82rem" }}
          >
            {fetching ? "Chargement..." : "🔄 Actualiser les Profils"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* GRILLE DES 4 PROFILS RÉSEAUX */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        {profiles.map((p) => {
          const isSelected = p.id === selectedProfileId;
          return (
            <div
              key={p.id}
              onClick={() => handleProfileChange(p.id)}
              className="card"
              style={{
                cursor: "pointer",
                padding: "1rem",
                transition: "all 0.2s ease",
                border: isSelected ? "2px solid var(--burgundy)" : "1px solid var(--border-subtle)",
                background: isSelected ? "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)" : "#ffffff",
                boxShadow: isSelected ? "0 4px 12px rgba(125, 21, 56, 0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span className="tag" style={{ fontSize: "0.68rem" }}>{p.region}</span>
                <span style={{ fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, color: "var(--burgundy)" }}>
                  {p.currency_name} ({p.currency_default})
                </span>
              </div>

              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "0.2rem" }}>
                {p.id === "GIM_UEMOA" && "🏛️ "}
                {p.id === "VISA_BASE_I" && "💳 "}
                {p.id === "MASTERCARD_CIS" && "🔴 "}
                {p.id === "DOMESTIC_SWITCH" && "🔄 "}
                {p.name}
              </h3>

              <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", lineHeight: 1.4, height: "38px", overflow: "hidden" }}>
                {p.rules_description}
              </p>

              <div style={{ marginTop: "0.75rem", paddingTop: "0.6rem", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                <span>Champs 0200 Requis :</span>
                <strong style={{ fontFamily: "monospace", color: "var(--text-main)" }}>
                  {p.mandatory_fields_0200.length} DE obligatoires
                </strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* DÉTAIL DU PROFIL SÉLECTIONNÉ & VALIDATEUR EN 2 COLONNES */}
      {activeProfile && (
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr", gap: "1.25rem", alignItems: "start" }}>
          {/* COLONNE GAUCHE : SPÉCIFICATIONS DU DIALECTE */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>📋</span>
                <span>Spécifications : {activeProfile.name}</span>
              </h3>
              <span className="tag">{activeProfile.id}</span>
            </div>

            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: "0.8rem" }}>
              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                  Territoire d'Application :
                </span>
                <strong style={{ color: "var(--text-main)" }}>{activeProfile.region}</strong>
              </div>

              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block" }}>
                  Devise de Compensation (DE 49) :
                </span>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--burgundy)" }}>
                  {activeProfile.currency_name} — Code ISO 4217 : {activeProfile.currency_default}
                </span>
              </div>

              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.2rem" }}>
                  Format des Données Privées (DE 48) :
                </span>
                <div style={{ padding: "0.5rem 0.75rem", background: "#f8fafc", border: "1px solid var(--border-subtle)", borderRadius: "6px", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-soft)" }}>
                  {activeProfile.de48_format}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.3rem" }}>
                  MTI Standards Autorisés :
                </span>
                <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                  {activeProfile.standard_mti.map((m) => (
                    <span key={m} className="tag" style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--burgundy)" }}>
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.3rem" }}>
                  Champs Obligatoires (0200 Demande d'Autorisation) :
                </span>
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", maxHeight: "110px", overflowY: "auto", padding: "0.4rem", background: "#f8fafc", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                  {activeProfile.mandatory_fields_0200.map((f) => (
                    <span key={f} style={{ fontFamily: "monospace", fontSize: "0.7rem", padding: "0.15rem 0.4rem", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", color: "var(--text-soft)" }}>
                      DE {f}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "0.2rem" }}>
                  Règles &amp; Exigences Spécifiques :
                </span>
                <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0, padding: "0.6rem 0.75rem", background: "#f8fafc", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
                  {activeProfile.rules_description}
                </p>
              </div>
            </div>
          </div>

          {/* COLONNE DROITE : VALIDATEUR DE CONFORMITÉ */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span>⚡</span>
                  <span>Validateur Normatif de Trame</span>
                </h3>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  Analyse syntaxique, bitmaps, DE obligatoires et contraintes régionales
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInputFrame(PRESET_FRAMES[selectedProfileId] || "")}
                className="preset-btn"
                style={{ fontSize: "0.75rem" }}
              >
                Trame d'Exemple
              </button>
            </div>

            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>
                    Trame ISO 8583 (ASCII ou Hexadécimal) :
                  </label>
                  <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                    Longueur : <strong>{inputFrame.length}</strong> caractères
                  </span>
                </div>
                <textarea
                  value={inputFrame}
                  onChange={(e) => setInputFrame(e.target.value)}
                  rows={4}
                  placeholder="Coller ici la trame brute..."
                  className="form-control"
                  style={{ fontFamily: "monospace", fontSize: "0.78rem", backgroundColor: "#0f172a", color: "#38bdf8", border: "1px solid #334155" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={loading}
                  className="btn btn-primary btn-glow"
                  style={{ padding: "0.65rem 1.25rem", fontSize: "0.82rem" }}
                >
                  {loading ? "Vérification en cours..." : "✓ Lancer la Validation Normative"}
                </button>
              </div>

              {/* RÉSULTAT DE LA VALIDATION */}
              {validationResult && (
                <div style={{ marginTop: "0.5rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span className={`verdict-pill ${validationResult.is_compliant ? "pass" : "fail"}`}>
                        {validationResult.verdict}
                      </span>
                      <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                        Profil : <strong style={{ color: "var(--text-main)" }}>{validationResult.profile_name}</strong>
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem" }}>
                      <span style={{ color: "#15803d", fontWeight: 700 }}>
                        ✓ {validationResult.checks_passed.length} vérifications
                      </span>
                      {validationResult.anomalies_count > 0 && (
                        <span style={{ color: "#b91c1c", fontWeight: 700 }}>
                          ✗ {validationResult.anomalies_count} anomalies
                        </span>
                      )}
                      {validationResult.warnings_count > 0 && (
                        <span style={{ color: "#b45309", fontWeight: 700 }}>
                          ⚠️ {validationResult.warnings_count} alertes
                        </span>
                      )}
                    </div>
                  </div>

                  {/* ANOMALIES BLOQUANTES */}
                  {validationResult.anomalies && validationResult.anomalies.length > 0 && (
                    <div style={{ padding: "0.75rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#991b1b", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                        Anomalies Bloquantes (Rejet par le Switch Réseau) :
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.75rem", color: "#b91c1c", lineHeight: 1.5 }}>
                        {validationResult.anomalies.map((ano, idx) => (
                          <li key={idx} style={{ fontFamily: "monospace" }}>{ano}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AVERTISSEMENTS */}
                  {validationResult.warnings && validationResult.warnings.length > 0 && (
                    <div style={{ padding: "0.75rem", background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: "8px" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#92400e", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                        Avertissements &amp; Recommandations :
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.75rem", color: "#b45309", lineHeight: 1.5 }}>
                        {validationResult.warnings.map((warn, idx) => (
                          <li key={idx} style={{ fontFamily: "monospace" }}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* CONTRÔLES VALIDÉS */}
                  {validationResult.checks_passed && validationResult.checks_passed.length > 0 && (
                    <div style={{ padding: "0.75rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px" }}>
                      <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#166534", textTransform: "uppercase", marginBottom: "0.3rem" }}>
                        Contrôles Validés avec Succès :
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.75rem", color: "#15803d", lineHeight: 1.5 }}>
                        {validationResult.checks_passed.map((chk, idx) => (
                          <li key={idx} style={{ fontFamily: "monospace" }}>{chk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
