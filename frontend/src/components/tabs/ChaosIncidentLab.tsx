"use client";

import { useState, useEffect } from "react";
import {
  AtmTerminal,
  ChaosConfig,
  fetchAtms,
  fetchChaos,
  refillAtms,
  resetChaos,
  updateAtm,
  updateChaos,
} from "@/lib/api";

interface ChaosIncidentLabProps {
  onRefresh?: () => void;
  onJumpToSimulator?: (preset: string) => void;
}

const DEFAULT_CHAOS: ChaosConfig = {
  host_down_91: false,
  stip_standin_enabled: false,
  stip_max_amount: 50000,
  timeout_enabled: false,
  timeout_delay_ms: 350,
  sla_timeout_threshold_ms: 250,
  auto_reversal_on_timeout: true,
  hsm_failure_mode: "NONE",
  gab_fault_mode: "NONE",
  duplicate_stan_check: false,
  format_error_30_sim: false,
  routing_error_92_sim: false,
  artificial_latency_ms: 0,
  artificial_jitter_ms: 0,
};

export default function ChaosIncidentLab({ onRefresh, onJumpToSimulator }: ChaosIncidentLabProps) {
  const [chaos, setChaos] = useState<ChaosConfig>(DEFAULT_CHAOS);
  const [atms, setAtms] = useState<AtmTerminal[]>([]);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    try {
      const c = await fetchChaos();
      if (c?.chaos) setChaos(c.chaos);
      const a = await fetchAtms();
      if (a?.atms) setAtms(a.atms);
    } catch (err) {
      console.error("Erreur chargement Chaos/GAB :", err);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleUpdateChaos = async (patch: Partial<ChaosConfig>) => {
    setSaving(true);
    try {
      const nextState = { ...chaos, ...patch };
      setChaos(nextState);
      const res = await updateChaos(patch);
      if (res?.chaos) setChaos(res.chaos);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    setSaving(true);
    try {
      const res = await resetChaos();
      if (res?.chaos) setChaos(res.chaos);
      await refillAtms();
      await loadAll();
      if (onRefresh) onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleRefillAtms = async () => {
    setSaving(true);
    try {
      const res = await refillAtms();
      if (res?.atms) setAtms(res.atms);
      if (onRefresh) onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleEmptyCassette = async (tid: string, denom: "10000" | "5000" | "2000") => {
    const payload: any = { terminal_id: tid };
    if (denom === "10000") payload.cassette_10000 = 0;
    if (denom === "5000") payload.cassette_5000 = 0;
    if (denom === "2000") payload.cassette_2000 = 0;
    await updateAtm(payload);
    await loadAll();
  };

  const activeIncidentsCount = [
    chaos.host_down_91,
    chaos.timeout_enabled,
    chaos.hsm_failure_mode !== "NONE",
    chaos.gab_fault_mode !== "NONE",
    chaos.duplicate_stan_check,
    chaos.format_error_30_sim,
    chaos.routing_error_92_sim,
    chaos.artificial_latency_ms > 0,
  ].filter(Boolean).length;

  return (
    <div className="homologation-container">
      {/* Header */}
      <div className="pane-header-enhanced">
        <div className="pane-title-group">
          <div className="pane-badge-wrapper">
            <span className="badge-chip emerald">CHAOS ENGINEERING MONÉTIQUE</span>
            <span className="badge-chip subtle">EXPLOITATION &amp; PRODUCTION</span>
          </div>
          <h2 className="pane-title">Centre de Simulation d&apos;Incidents &amp; Parc GAB (Cassettes)</h2>
          <p className="pane-subtitle">
            Injectez des pannes réelles d&apos;exploitation (Time-out 68 + Auto-Reversal 0400, Host Down 91 + Stand-In STIP, Panne HSM 63/96, Bourrage GAB) et supervisez les cassettes de billets dans MySQL.
          </p>
        </div>

        <div className="pane-actions-group" style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={handleRefillAtms} disabled={saving} className="btn btn-outline">
            <span>🏧</span>
            <span>Recharger Cassettes GAB</span>
          </button>
          <button onClick={handleResetAll} disabled={saving} className="btn btn-primary btn-glow">
            <span>🛡️</span>
            <span>Rétablir État Nominal (0 Incident)</span>
          </button>
        </div>
      </div>

      {/* Statut Global d'Exploitation */}
      <div
        className="card"
        style={{
          marginBottom: "1.5rem",
          borderLeft: `5px solid ${activeIncidentsCount === 0 ? "var(--accent-success)" : "var(--accent-danger)"}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              display: "grid",
              placeItems: "center",
              fontSize: "1.5rem",
              background: activeIncidentsCount === 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.2)",
              border: `1px solid ${activeIncidentsCount === 0 ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.5)"}`,
            }}
          >
            {activeIncidentsCount === 0 ? "✅" : "🚨"}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>
              {activeIncidentsCount === 0
                ? "CHAÎNE MONÉTIQUE NOMINALE — AUCUN INCIDENT SIMULÉ"
                : `${activeIncidentsCount} INCIDENT(S) DE PRODUCTION ACTIF(S) SUR LA CHAÎNE`}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Toute transaction envoyée depuis le Simulateur TPE/GAB/E-Com subira immédiatement les règles d&apos;incidents activées ci-dessous.
            </div>
          </div>
        </div>

        {onJumpToSimulator && (
          <button onClick={() => onJumpToSimulator("tc01")} className="btn btn-outline btn-sm">
            ⚡ Tester l&apos;Impact dans le Simulateur
          </button>
        )}
      </div>

      {/* Grille des 4 Pôles d'Incidents d'Exploitation */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.25rem", marginBottom: "1.75rem" }}>
        {/* 1. Indisponibilité Host 91 & Stand-In STIP */}
        <div className="card">
          <div className="card-header">
            <h3>1. Disponibilité Host Émetteur &amp; Stand-In (STIP)</h3>
            <span className={`verdict-pill ${chaos.host_down_91 ? "fail" : "pass"}`}>
              {chaos.host_down_91 ? (chaos.stip_standin_enabled ? "STIP ACTIF" : "HOST DOWN (91)") : "ONLINE"}
            </span>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
            Simule la chute du serveur d&apos;autorisation émetteur (code <strong>DE 39 = 91</strong>) et l&apos;activation de la délégation <strong>Stand-In Processing (STIP)</strong> par le Switch Interbancaire.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "0.6rem 0.8rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
              <span>
                <strong>Couper le Host Émetteur (DE 39 = 91)</strong>
                <br />
                <small style={{ color: "var(--text-dim)" }}>Issuer or Switch Inoperative</small>
              </span>
              <input
                type="checkbox"
                checked={chaos.host_down_91}
                onChange={(e) => handleUpdateChaos({ host_down_91: e.target.checked })}
                style={{ width: "18px", height: "18px" }}
              />
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "0.6rem 0.8rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
              <span>
                <strong>Activer le Stand-In Processing (STIP Switch)</strong>
                <br />
                <small style={{ color: "var(--text-dim)" }}>Le Switch approuve (00 + DE 38 ST*) sous le plafond de secours</small>
              </span>
              <input
                type="checkbox"
                checked={chaos.stip_standin_enabled}
                onChange={(e) => handleUpdateChaos({ stip_standin_enabled: e.target.checked })}
                style={{ width: "18px", height: "18px" }}
              />
            </label>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Plafond d&apos;Autorisation Secours STIP (FCFA) :</label>
              <input
                type="number"
                className="form-control"
                value={chaos.stip_max_amount}
                step={5000}
                onChange={(e) => handleUpdateChaos({ stip_max_amount: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* 2. Time-out 68 & Auto-Reversal 0400 */}
        <div className="card">
          <div className="card-header">
            <h3>2. Time-out Réseau (DE 39 = 68) &amp; Auto-Reversal</h3>
            <span className={`verdict-pill ${chaos.timeout_enabled ? "fail" : "pass"}`}>
              {chaos.timeout_enabled ? "TIME-OUT 68 ACTIF" : "LATENCE NOMINALE"}
            </span>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
            Simule un ralentissement du Core Banking dépassant le timer de garde du Switch (<strong>DE 39 = 68</strong>) suivi d&apos;une annulation automatique <strong>0400 Reversal</strong> pour protéger le solde client.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "0.6rem 0.8rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
              <span>
                <strong>Déclencher un Time-out Émetteur (DE 39 = 68)</strong>
                <br />
                <small style={{ color: "var(--text-dim)" }}>Response Received Too Late (Latence &gt; Seuil SLA)</small>
              </span>
              <input
                type="checkbox"
                checked={chaos.timeout_enabled}
                onChange={(e) => handleUpdateChaos({ timeout_enabled: e.target.checked })}
                style={{ width: "18px", height: "18px" }}
              />
            </label>

            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "0.6rem 0.8rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
              <span>
                <strong>Émettre Auto-Reversal 0400 sur Time-out</strong>
                <br />
                <small style={{ color: "var(--text-dim)" }}>Recrédite automatiquement le compte si débité tardivement</small>
              </span>
              <input
                type="checkbox"
                checked={chaos.auto_reversal_on_timeout}
                onChange={(e) => handleUpdateChaos({ auto_reversal_on_timeout: e.target.checked })}
                style={{ width: "18px", height: "18px" }}
              />
            </label>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>
                Latence Réseau Artificielle Ajoutée : <strong>+{chaos.artificial_latency_ms} ms</strong> (Gigue : ±{chaos.artificial_jitter_ms} ms)
              </label>
              <input
                type="range"
                min={0}
                max={300}
                step={10}
                value={chaos.artificial_latency_ms}
                onChange={(e) => handleUpdateChaos({ artificial_latency_ms: Number(e.target.value) })}
                style={{ width: "100%", accentColor: "var(--primary)" }}
              />
            </div>
          </div>
        </div>

        {/* 3. Pannes HSM Cryptographique & Sécurité */}
        <div className="card">
          <div className="card-header">
            <h3>3. Module Cryptographique HSM (PayShield)</h3>
            <span className={`verdict-pill ${chaos.hsm_failure_mode === "NONE" ? "pass" : "fail"}`}>
              {chaos.hsm_failure_mode}
            </span>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
            Simule les incidents cryptographiques majeurs rencontrés en production : perte du HSM, erreur de calcul MAC (DE 64) ou désynchronisation de clé PIN (ZPK).
          </p>

          <div className="form-group">
            <label>État du Module HSM :</label>
            <select
              className="form-control"
              value={chaos.hsm_failure_mode}
              onChange={(e) => handleUpdateChaos({ hsm_failure_mode: e.target.value })}
            >
              <option value="NONE">NONE — HSM Opérationnel (Clés ZPK / ZAK Synchronisées)</option>
              <option value="MAC_ERROR_63">MAC_ERROR_63 — Échec Contrôle MAC DE 64 (Rejet DE 39 = 63)</option>
              <option value="ZPK_DESYNC_55">ZPK_DESYNC_55 — Clé PIN ZPK Désynchronisée (Tous PINs faux = 55)</option>
              <option value="HSM_DOWN_96">HSM_DOWN_96 — Crash / Timeout Matériel HSM (Rejet DE 39 = 96)</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.75rem" }}>
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "0.5rem 0.75rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
              <span>
                <strong>Contrôle Anti-Doublon STAN Strict (DE 39 = 94)</strong>
                <br />
                <small style={{ color: "var(--text-dim)" }}>Rejette en 94 tout rejeu du même couple STAN + Terminal</small>
              </span>
              <input
                type="checkbox"
                checked={chaos.duplicate_stan_check}
                onChange={(e) => handleUpdateChaos({ duplicate_stan_check: e.target.checked })}
                style={{ width: "18px", height: "18px" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "0.5rem 0.75rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "0.8rem" }}>
                <span>Erreur Format (30)</span>
                <input
                  type="checkbox"
                  checked={chaos.format_error_30_sim}
                  onChange={(e) => handleUpdateChaos({ format_error_30_sim: e.target.checked })}
                />
              </label>
              <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "0.5rem 0.75rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-light)", fontSize: "0.8rem" }}>
                <span>Erreur Routage BIN (92)</span>
                <input
                  type="checkbox"
                  checked={chaos.routing_error_92_sim}
                  onChange={(e) => handleUpdateChaos({ routing_error_92_sim: e.target.checked })}
                />
              </label>
            </div>
          </div>
        </div>

        {/* 4. Incidents Matériels GAB (Bourrage / Distribution Partielle) */}
        <div className="card">
          <div className="card-header">
            <h3>4. Simulateur de Pannes Mécaniques GAB (ATM)</h3>
            <span className={`verdict-pill ${chaos.gab_fault_mode === "NONE" ? "pass" : "fail"}`}>
              {chaos.gab_fault_mode}
            </span>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
            Simule les incidents électromécaniques du distributeur de billets après accord du Host (0210 = 00) déclenchant des extournes automatiques 0400 totales ou partielles.
          </p>

          <div className="form-group">
            <label>Comportement Matériel du Distributeur GAB :</label>
            <select
              className="form-control"
              value={chaos.gab_fault_mode}
              onChange={(e) => handleUpdateChaos({ gab_fault_mode: e.target.value })}
            >
              <option value="NONE">NONE — Distribution Billets Normale (Cassettes OK)</option>
              <option value="CASH_JAM">CASH_JAM — Bourrage Billets (Approuvé 00 puis Auto-Reversal 0400 Total)</option>
              <option value="PARTIAL_DISPENSE">PARTIAL_DISPENSE — Distribution Partielle (50% servi + Reversal 0400 Partiel)</option>
              <option value="CASSETTE_EMPTY">CASSETTE_EMPTY — Cassettes Épuisées (Rejet DE 39 = 13)</option>
            </select>
          </div>

          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
            <strong>💡 Scénario Exploitant :</strong> En mode <code>PARTIAL_DISPENSE</code>, si un client demande 20 000 FCFA sur un GAB, le Host débite 20 000 FCFA (00), le GAB ne délivre que 10 000 FCFA et émet instantanément un <code>0400 Reversal</code> partiel de +10 000 FCFA dans MySQL.
          </div>
        </div>
      </div>

      {/* Supervision du Parc de GAB & Cassettes de Billets (MySQL) */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>État du Parc de GAB (ATM) &amp; Stock des Cassettes dans MySQL</h3>
            <small style={{ color: "var(--text-muted)" }}>
              Décrémentation automatique des coupures (10 000, 5 000, 2 000 FCFA) lors des retraits GAB (DE 3 = 010000).
            </small>
          </div>
          <button onClick={handleRefillAtms} className="btn btn-sm btn-outline">
            ↺ Plein de Caisse (3 GAB)
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.25rem" }}>
          {atms.map((atm) => (
            <div
              key={atm.terminal_id}
              style={{
                background: "#f8fafc",
                border: "1px solid var(--border-light)",
                borderRadius: "12px",
                padding: "1.15rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="font-mono" style={{ fontWeight: 800, color: "var(--primary)", fontSize: "0.95rem" }}>
                    {atm.terminal_id}
                  </span>
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)" }}>{atm.name}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{atm.location}</div>
                </div>
                <span className="verdict-pill pass">{atm.status}</span>
              </div>

              <div style={{ fontSize: "0.82rem", fontFamily: "var(--font-mono)", background: "#ffffff", border: "1px solid var(--border-light)", padding: "0.65rem", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Cassette 1 (10 000 F) :</span>
                  <span style={{ color: atm.cassette_10000 === 0 ? "var(--accent-danger)" : "var(--text-primary)", fontWeight: 700 }}>
                    {atm.cassette_10000} billets
                  </span>
                  <button
                    onClick={() => handleEmptyCassette(atm.terminal_id, "10000")}
                    className="btn btn-xs btn-outline"
                    title="Vider la cassette 10 000 FCFA"
                  >
                    Vider
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Cassette 2 (5 000 F) :</span>
                  <span style={{ color: atm.cassette_5000 === 0 ? "var(--accent-danger)" : "var(--text-primary)", fontWeight: 700 }}>
                    {atm.cassette_5000} billets
                  </span>
                  <button
                    onClick={() => handleEmptyCassette(atm.terminal_id, "5000")}
                    className="btn btn-xs btn-outline"
                    title="Vider la cassette 5 000 FCFA"
                  >
                    Vider
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Cassette 3 (2 000 F) :</span>
                  <span style={{ color: atm.cassette_2000 === 0 ? "var(--accent-danger)" : "var(--text-primary)", fontWeight: 700 }}>
                    {atm.cassette_2000} billets
                  </span>
                  <button
                    onClick={() => handleEmptyCassette(atm.terminal_id, "2000")}
                    className="btn btn-xs btn-outline"
                    title="Vider la cassette 2 000 FCFA"
                  >
                    Vider
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 700, paddingTop: "0.25rem", borderTop: "1px solid var(--border-light)" }}>
                <span style={{ color: "var(--text-muted)" }}>Encaisse Totale GAB :</span>
                <span className="font-mono" style={{ color: "#047857" }}>
                  {atm.total_cash.toLocaleString()} FCFA
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
