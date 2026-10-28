"use client";

import React, { useState } from "react";
import {
  runCustomScenario,
  generatePvReport,
  CustomScenarioResult,
  PvReportResponse,
} from "@/lib/api";

interface ScenarioFormState {
  name: string;
  channel: string;
  mti: string;
  pan: string;
  amount: number;
  currency: string;
  stan: string;
  pos_entry_mode: string;
  pin: string;
  expected_de39: string;
  field_overrides_raw: string;
}

const DEFAULT_FORM: ScenarioFormState = {
  name: "Retrait GAB Standard UAT-01",
  channel: "ATM",
  mti: "0200",
  pan: "4000123456780001",
  amount: 25000,
  currency: "952",
  stan: "000123",
  pos_entry_mode: "021",
  pin: "1234",
  expected_de39: "00",
  field_overrides_raw: '{\n  "43": "GIM-ATM TEST 01   ABIDJAN      CI"\n}',
};

const PRESET_SCENARIOS: Array<{ label: string; config: Partial<ScenarioFormState> }> = [
  {
    label: "🏧 Retrait GAB Valide (DE 39: 00)",
    config: {
      name: "Retrait GAB Compte Provisionné",
      channel: "ATM",
      mti: "0200",
      pan: "4000123456780001",
      amount: 20000,
      expected_de39: "00",
      pin: "1234",
    },
  },
  {
    label: "❌ Solde Insuffisant (DE 39: 51)",
    config: {
      name: "Dépassement Solde Disponible",
      channel: "ATM",
      mti: "0200",
      pan: "4000123456780005",
      amount: 500000,
      expected_de39: "51",
      pin: "1234",
    },
  },
  {
    label: "🔒 Code PIN Incorrect (DE 39: 55)",
    config: {
      name: "Erreur Saisie PIN Client",
      channel: "POS",
      mti: "0200",
      pan: "4000123456780001",
      amount: 15000,
      expected_de39: "55",
      pin: "9999",
    },
  },
  {
    label: "⛽ Pré-autorisation TPE (MTI 0100)",
    config: {
      name: "Pré-autorisation TPE Carburant",
      channel: "POS",
      mti: "0100",
      pan: "4000123456780002",
      amount: 45000,
      expected_de39: "00",
      pin: "1234",
    },
  },
  {
    label: "🔄 Extourne / Reversal (MTI 0400)",
    config: {
      name: "Extourne Timeout Distribution GAB",
      channel: "ATM",
      mti: "0400",
      pan: "4000123456780001",
      amount: 25000,
      expected_de39: "00",
    },
  },
];

export default function TestScenarioBuilder() {
  const [form, setForm] = useState<ScenarioFormState>(DEFAULT_FORM);
  const [campaignName, setCampaignName] = useState<string>("Campagne Homologation UAT - Réseau Domestique");
  const [results, setResults] = useState<CustomScenarioResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [pvLoading, setPvLoading] = useState<boolean>(false);
  const [pvReport, setPvReport] = useState<PvReportResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const applyPreset = (preset: Partial<ScenarioFormState>) => {
    setForm((prev) => ({
      ...prev,
      ...preset,
    }));
  };

  const handleRunScenario = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      let field_overrides: Record<string, string> | undefined = undefined;
      if (form.field_overrides_raw.trim()) {
        try {
          field_overrides = JSON.parse(form.field_overrides_raw);
        } catch {
          throw new Error("Le format JSON des surcharges de champs (field_overrides) est invalide.");
        }
      }

      const res = await runCustomScenario({
        name: form.name,
        channel: form.channel,
        mti: form.mti,
        pan: form.pan,
        amount: Number(form.amount),
        currency: form.currency,
        stan: form.stan,
        pos_entry_mode: form.pos_entry_mode,
        pin: form.pin,
        expected_de39: form.expected_de39,
        field_overrides,
      });

      setResults((prev) => [res, ...prev]);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de l'exécution du test");
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePv = async () => {
    if (results.length === 0) {
      setErrorMsg("Veuillez exécuter au moins un test avant de générer le Procès-Verbal.");
      return;
    }
    try {
      setPvLoading(true);
      setErrorMsg(null);
      const res = await generatePvReport({
        campaign_name: campaignName,
        results: results,
      });
      setPvReport(res);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur de génération du PV");
    } finally {
      setPvLoading(false);
    }
  };

  const downloadPv = () => {
    if (!pvReport) return;
    const blob = new Blob([pvReport.markdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `PV_HOMOLOGATION_${new Date().toISOString().slice(0, 10)}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* HEADER PRINCIPAL */}
      <div className="pane-header">
        <div className="pane-header-main">
          <div className="pane-title-row">
            <span className="badge-chip highlight">UAT &amp; CERTIFICATION BANCAIRE</span>
            <span className="badge-chip subtle">PLAN DE TESTS SUR-MESURE</span>
            <span className="badge-chip success">VISA INGÉNIERIE MONÉTIQUE - CBS</span>
          </div>
          <h2 className="pane-title">Studio de Recette &amp; PV d'Homologation Certifié</h2>
          <p className="pane-subtitle">
            Configurez et injectez des trames ISO 8583 personnalisées, comparez les codes retours (DE 39),
            auditez les règles d'arbitrage et générez un <strong>Procès-Verbal officiel d'homologation</strong> revêtu de votre visa d'ingénieur.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setResults([])}
            disabled={results.length === 0}
            className="btn btn-outline"
            style={{ fontSize: "0.82rem" }}
          >
            Effacer les Tests
          </button>
          <button
            type="button"
            onClick={handleGeneratePv}
            disabled={pvLoading || results.length === 0}
            className="btn btn-primary btn-glow"
            style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span>📄</span>
            <span>{pvLoading ? "Génération..." : "Générer PV Officiel"}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MODÈLES DE TESTS RAPIDES */}
      <div className="card" style={{ padding: "0.85rem 1.25rem", background: "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)", border: "1px solid rgba(125, 21, 56, 0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--burgundy)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span>⚡</span>
            <span>Modèles de Scénarios Préconfigurés :</span>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            Cliquez pour charger automatiquement les paramètres et le code DE 39 attendu
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {PRESET_SCENARIOS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(p.config)}
              className="preset-btn"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* WORKSPACE DEUX COLONNES */}
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr", gap: "1.25rem", alignItems: "start" }}>
        {/* COLONNE GAUCHE : FORMULAIRE DU CAS DE TEST */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span>⚙️</span>
              <span>Paramètres du Scénario d'Épreuve</span>
            </h3>
            <span className="tag">MTI {form.mti} • {form.channel}</span>
          </div>

          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Nom / Intitulé du Scénario :
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="form-control"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                  Canal Monétique :
                </label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className="form-control"
                >
                  <option value="ATM">🏧 GAB / Distributeur ATM</option>
                  <option value="POS">💳 TPE / Terminal POS</option>
                  <option value="ECOM">🌐 E-Commerce / Vente à Distance</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                  MTI ISO 8583 Requis :
                </label>
                <select
                  value={form.mti}
                  onChange={(e) => setForm({ ...form, mti: e.target.value })}
                  className="form-control"
                  style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--burgundy)" }}
                >
                  <option value="0200">0200 — Demande d'Autorisation</option>
                  <option value="0100">0100 — Pré-autorisation (Hold)</option>
                  <option value="0400">0400 — Annulation / Extourne</option>
                  <option value="0800">0800 — Échange Réseau / Echo</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                  Numéro de Carte (PAN) :
                </label>
                <input
                  type="text"
                  value={form.pan}
                  onChange={(e) => setForm({ ...form, pan: e.target.value })}
                  className="form-control"
                  style={{ fontFamily: "monospace", fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                  Montant Transaction (XOF) :
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="form-control"
                  style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--burgundy)" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.6rem" }}>
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                  Devise (DE 49) :
                </label>
                <input
                  type="text"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="form-control"
                  style={{ fontFamily: "monospace" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                  Code PIN :
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  className="form-control"
                  style={{ fontFamily: "monospace", textAlign: "center" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                  DE 39 Attendu :
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={form.expected_de39}
                  onChange={(e) => setForm({ ...form, expected_de39: e.target.value })}
                  className="form-control"
                  style={{ fontFamily: "monospace", fontWeight: 800, textAlign: "center", color: "var(--burgundy)", backgroundColor: "#fdf2f5" }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Surcharges de Champs ISO (Format JSON DE 43, 48, 55...) :
              </label>
              <textarea
                rows={3}
                value={form.field_overrides_raw}
                onChange={(e) => setForm({ ...form, field_overrides_raw: e.target.value })}
                className="form-control"
                style={{ fontFamily: "monospace", fontSize: "0.78rem", backgroundColor: "#0f172a", color: "#38bdf8", border: "1px solid #334155" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Intitulé de la Campagne d'Homologation :
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="form-control"
                style={{ fontSize: "0.82rem" }}
              />
            </div>

            <button
              type="button"
              onClick={handleRunScenario}
              disabled={loading}
              className="btn btn-primary btn-glow btn-block"
              style={{ marginTop: "0.5rem", padding: "0.75rem" }}
            >
              {loading ? "Exécution du Scénario en cours..." : "🚀 Exécuter le Cas de Test Unitaire"}
            </button>
          </div>
        </div>

        {/* COLONNE DROITE : SYNTHÈSE DES STATS ET RÉSULTATS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* STATS RIBBON */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <div className="card" style={{ padding: "0.85rem 1rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Exécutés
              </span>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--text-main)", marginTop: "0.2rem" }}>
                {results.length}
              </div>
            </div>

            <div className="card" style={{ padding: "0.85rem 1rem", textAlign: "center", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Conformes (PASS)
              </span>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#15803d", marginTop: "0.2rem" }}>
                {passedCount}
              </div>
            </div>

            <div className="card" style={{ padding: "0.85rem 1rem", textAlign: "center", background: "#fef2f2", border: "1px solid #fecaca" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Non Conformes (FAIL)
              </span>
              <div style={{ fontSize: "1.7rem", fontWeight: 800, color: "#b91c1c", marginTop: "0.2rem" }}>
                {failedCount}
              </div>
            </div>
          </div>

          {/* TABLEAU / JOURNAL DES TESTS */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>📊</span>
                <span>Journal des Épreuves de la Session ({results.length})</span>
              </h3>
              <span className="tag">{results.length > 0 ? "Campagne Active" : "En attente"}</span>
            </div>

            <div style={{ padding: "1rem" }}>
              {results.length === 0 ? (
                <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📋</div>
                  <div>Aucun cas de test n'a encore été exécuté dans cette session.</div>
                  <div style={{ fontSize: "0.75rem", marginTop: "0.3rem" }}>
                    Sélectionnez un modèle rapide ci-dessus ou configurez votre scénario à gauche, puis cliquez sur <strong>Exécuter</strong>.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "520px", overflowY: "auto" }}>
                  {results.map((r, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: "0.85rem",
                        borderRadius: "8px",
                        border: r.passed ? "1px solid #bbf7d0" : "1px solid #fecaca",
                        background: r.passed ? "#f8fafc" : "#fff5f5",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span className={`verdict-pill ${r.passed ? "pass" : "fail"}`}>
                            {r.test_verdict}
                          </span>
                          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-main)" }}>
                            {r.scenario_name}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                            [{r.channel} • MTI {r.mti}]
                          </span>
                        </div>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                          {r.timestamp}
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.3fr", gap: "0.5rem", fontSize: "0.75rem", borderTop: "1px solid #f1f5f9", paddingTop: "0.4rem" }}>
                        <div>
                          <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.68rem" }}>Carte :</span>
                          <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{r.pan_masked}</span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.68rem" }}>Montant :</span>
                          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--burgundy)" }}>
                            {r.amount.toLocaleString()} XOF
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.68rem" }}>Attendu / Obtenu :</span>
                          <span style={{ fontFamily: "monospace" }}>
                            DE {r.expected_de39} ➔ <strong style={{ color: r.passed ? "#15803d" : "#b91c1c" }}>DE {r.obtained_de39}</strong>
                          </span>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.68rem" }}>Règle Arbitrage :</span>
                          <span style={{ color: "var(--burgundy)", fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.rule_triggered}>
                            {r.rule_triggered}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODALE PREVIEW DU PV OFFICIEL D'HOMOLOGATION */}
      {pvReport && (
        <div className="card" style={{ border: "2px solid var(--burgundy)", boxShadow: "0 10px 25px rgba(0,0,0,0.15)" }}>
          <div className="card-header" style={{ background: "linear-gradient(135deg, #7d1538 0%, #a01e4a 100%)", color: "#ffffff" }}>
            <div>
              <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.9 }}>
                Certification Officielle de Qualification
              </div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#ffffff", marginTop: "0.1rem" }}>
                📄 Procès-Verbal de Recette Monétique — {pvReport.campaign_name}
              </h3>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={downloadPv}
                className="btn btn-primary btn-glow"
                style={{ backgroundColor: "#ffffff", color: "var(--burgundy)", borderColor: "#ffffff", fontSize: "0.8rem" }}
              >
                💾 Télécharger le PV (.md)
              </button>
              <button
                type="button"
                onClick={() => setPvReport(null)}
                className="btn btn-outline"
                style={{ color: "#ffffff", borderColor: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}
              >
                Fermer
              </button>
            </div>
          </div>

          <div style={{ padding: "1.25rem", background: "#0f172a", maxHeight: "400px", overflowY: "auto" }}>
            <pre style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#e2e8f0", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {pvReport.markdown}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
