"use client";

import { useState, useEffect } from "react";
import { fetchRules, RuleItem, De39CatalogEntry } from "@/lib/api";

const DEFAULT_RULES: RuleItem[] = [
  { id: "R00-A", prio: 0, rule: "Conformité Format Trame", fail: "Champs obligatoires absents ou malformés", code: "30", label: "Format Error", behavior: "Rejet technique immédiat." },
  { id: "R00-B", prio: 0, rule: "Anti-Rejeu STAN (Idempotence)", fail: "Même couple (PAN, STAN, Montant) déjà traité", code: "94", label: "Duplicate Transmission", behavior: "Rejet du doublon réseau." },
  { id: "R00-C", prio: 0, rule: "Disponibilité HSM Cryptographique", fail: "HSM hors ligne ou erreur vérification MAC (DE 64)", code: "96 / 63", label: "System Malfunction / Security Violation", behavior: "Alerte P1 Sécurité HSM." },
  { id: "R00-D", prio: 0, rule: "Disponibilité Host CBS & STIP", fail: "CBS indisponible (> seuil STIP) ou Timeout", code: "91 / 68", label: "Issuer Inoperative / Response Too Late", behavior: "Bascule STIP ou Auto-Reversal 0400." },
  { id: "R01", prio: 1, rule: "Existence du PAN", fail: "Le PAN n'existe pas dans le référentiel des comptes.", code: "14", label: "No Such Card", behavior: "Refus immédiat." },
  { id: "R02", prio: 2, rule: "Opposition : Volée / Perdue / Capture / Surveillance", fail: "status in ('STOLEN','LOST','CAPTURE','WATCHLIST')", code: "43 / 41 / 04 / 01", label: "Stolen / Lost / Pick-up / Refer to Issuer", behavior: "Refus catégorique. Capture physique sur GAB." },
  { id: "R03", prio: 3, rule: "Validité Temporelle", fail: "Date transaction locale > Date expiration (DE 14)", code: "54", label: "Expired Card", behavior: "Refus définitif." },
  { id: "R04", prio: 4, rule: "Tentatives PIN Dépassées", fail: "Compteur faux PIN consécutifs >= 3", code: "75", label: "PIN Tries Exceeded", behavior: "Blocage sécuritaire du PIN." },
  { id: "R05", prio: 5, rule: "Conformité du PIN", fail: "Le PIN DE 52 ne concorde pas avec le code secret stocké", code: "55", label: "Incorrect PIN", behavior: "Refus réessayable. Incrémentation compteur." },
  { id: "R06", prio: 6, rule: "Conformité Devise & International", fail: "Devise DE 49 != 952 et carte non internationale", code: "58", label: "Transaction Not Permitted", behavior: "Refus immédiat." },
  { id: "R07", prio: 7, rule: "Plafond Unitaire", fail: "Montant brut DE 4 > max_tx_limit", code: "61", label: "Exceeds Withdrawal Limit", behavior: "Refus. Inviter à réduire le montant." },
  { id: "R08", prio: 8, rule: "Plafond Journalier (24h)", fail: "daily_spent + montant > daily_ceiling", code: "65", label: "Activity Limit Exceeded", behavior: "Refus réessayable le lendemain." },
  { id: "R08b", prio: 8, rule: "Vélocité Anti-Fraude Horaire", fail: "tx_count_hour >= max_tx_per_hour (ex: 5 tx/h)", code: "65", label: "Velocity Frequency Exceeded", behavior: "Blocage anti-fraude temporaire." },
  { id: "R09", prio: 9, rule: "Solde Disponible", fail: "Montant demandé > Solde disponible comptable", code: "51", label: "Insufficient Funds", behavior: "Refus réessayable." },
  { id: "R10", prio: 10, rule: "Statut Carte & Droits Canal (GAB/TPE/ECOM)", fail: "status == 'SUSPENDED' ou canal désactivé sur la carte", code: "57", label: "Not Permitted to Cardholder", behavior: "Refus administratif sans capture." },
  { id: "R11", prio: 11, rule: "Règles Spécifiques GAB (Coupures & Cassettes)", fail: "Montant non composable par les cassettes GAB (10k/5k/2k)", code: "13", label: "Invalid Amount / ATM Cassettes", behavior: "Refus GAB. Proposer un montant multiple." },
  { id: "R12", prio: 12, rule: "Règles Spécifiques TPE (Sans Contact NFC & Fallback)", fail: "NFC > 15 000 FCFA sans PIN (65) ou Fallback Piste sur EMV (57)", code: "65 / 57", label: "Contactless Limit / Fallback Denied", behavior: "Demander insertion puce + PIN." },
  { id: "R13", prio: 13, rule: "Règles Spécifiques E-Commerce (CVV2 & 3-D Secure)", fail: "CVV2 erroné (82) ou montant > 25 000 FCFA sans 3DS ECI 05 (63)", code: "82 / 63", label: "Invalid CVV2 / 3DS Required", behavior: "Rejet passerelle E-Commerce." },
];

export default function RulesMatrix() {
  const [rules, setRules] = useState<RuleItem[]>(DEFAULT_RULES);
  const [de39Catalog, setDe39Catalog] = useState<Record<string, De39CatalogEntry>>({});
  const [viewMode, setViewMode] = useState<"rules" | "runbooks">("rules");
  const [searchCode, setSearchCode] = useState("");

  useEffect(() => {
    fetchRules()
      .then((data) => {
        if (data?.rules) setRules(data.rules);
        if (data?.de39_catalog || data?.codes) {
          setDe39Catalog(data.de39_catalog || data.codes);
        }
      })
      .catch(console.error);
  }, []);

  const catalogEntries = Object.entries(de39Catalog).filter(([code, info]) => {
    const q = searchCode.toLowerCase().trim();
    if (!q) return true;
    const meaningStr = info.meaning || info.root_cause || "";
    const runbookStr =
      info.operator_runbook ||
      (Array.isArray(info.runbook) ? info.runbook.join(" ") : "");
    return (
      code.toLowerCase().includes(q) ||
      info.label.toLowerCase().includes(q) ||
      info.category.toLowerCase().includes(q) ||
      meaningStr.toLowerCase().includes(q) ||
      runbookStr.toLowerCase().includes(q)
    );
  });

  return (
    <div className="homologation-container">
      <div className="pane-header-enhanced">
        <div className="pane-title-group">
          <div className="pane-badge-wrapper">
            <span className="badge-chip emerald">
              <span className="status-indicator-dot" />
              MOTEUR D'ARBITRAGE &amp; EXPLOITATION
            </span>
            <span className="badge-chip subtle">18 RÈGLES (R00 → R13) • 24 RUNBOOKS DE 39</span>
          </div>
          <h2 className="pane-title">Matrice des Règles Bancaires &amp; Catalogue Runbooks DE 39</h2>
          <p className="pane-subtitle">
            Ordonnancement déterministe par court-circuit (R00 Technique/Chaos → R01..R10 Socle Émetteur → R11 GAB → R12 TPE → R13 E-Commerce) et procédures d'exploitation.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            onClick={() => setViewMode("rules")}
            className={`btn ${viewMode === "rules" ? "btn-primary btn-glow" : "btn-outline"}`}
          >
            <span>📐</span>
            <span>18 Règles d'Arbitrage (R00-R13)</span>
          </button>
          <button
            onClick={() => setViewMode("runbooks")}
            className={`btn ${viewMode === "runbooks" ? "btn-primary btn-glow" : "btn-outline"}`}
          >
            <span>🛠️</span>
            <span>Catalogue des 24 Codes DE 39 &amp; Runbooks</span>
          </button>
        </div>
      </div>

      {viewMode === "rules" ? (
        <>
          {/* Tableau des 18 règles */}
          <div className="table-container-enhanced">
            <table className="data-table-enhanced">
              <thead>
                <tr>
                  <th style={{ width: "85px" }}>ID RÈGLE</th>
                  <th style={{ width: "75px" }}>ORDRE</th>
                  <th style={{ minWidth: "200px" }}>INTITULÉ DE LA RÈGLE</th>
                  <th style={{ minWidth: "260px" }}>CONDITION DE DÉCLENCHEMENT</th>
                  <th style={{ width: "120px" }}>CODE DE 39</th>
                  <th style={{ minWidth: "160px" }}>LIBELLÉ ISO 8583</th>
                  <th style={{ minWidth: "200px" }}>COMPORTEMENT SYSTÈME</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="test-id-badge">{r.id}</span>
                    </td>
                    <td>
                      <span className="tag font-mono">P{r.prio}</span>
                    </td>
                    <td>
                      <strong style={{ color: "var(--text-primary)" }}>{r.rule}</strong>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>{r.fail}</td>
                    <td>
                      <span className="de39-code mismatch">{r.code}</span>
                    </td>
                    <td style={{ fontStyle: "italic", color: "var(--text-muted)" }}>{r.label}</td>
                    <td style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>{r.behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Barre de recherche Runbooks */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Référentiel complet des <strong>{catalogEntries.length}</strong> codes réponses ISO 8583 (DE 39) avec procédures d'intervention pour l'exploitant monétique :
            </div>
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Filtrer par code (ex: 91, 68, 55, HSM, GAB)..."
              className="form-control"
              style={{ width: "320px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))", gap: "1rem" }}>
            {catalogEntries.map(([code, info]) => {
              const isOk = code === "00";
              const isCrit = info.severity === "CRITICAL";
              return (
                <div
                  key={code}
                  className="card"
                  style={{
                    borderLeft: `4px solid ${isOk ? "#10b981" : isCrit ? "#ef4444" : "#f59e0b"}`,
                    padding: "1.1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: 900,
                          padding: "2px 10px",
                          borderRadius: "6px",
                          background: isOk ? "#ecfdf5" : "#fef2f2",
                          border: `1px solid ${isOk ? "#a7f3d0" : "#fecdd3"}`,
                          color: isOk ? "#047857" : "#b91c1c",
                        }}
                      >
                        DE 39 = {code}
                      </span>
                      <div>
                        <div style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "0.92rem" }}>{info.label}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          Composant : <strong>{info.component || "Host Émetteur"}</strong>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <span className="tag" style={{ fontSize: "0.68rem" }}>{info.category}</span>
                      <span
                        className="tag font-mono"
                        style={{
                          fontSize: "0.68rem",
                          color: isCrit ? "#b91c1c" : isOk ? "#047857" : "#b45309",
                        }}
                      >
                        {info.severity || "WARN"}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    <strong>Cause :</strong> {info.meaning}
                  </div>

                  <div
                    style={{
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      borderRadius: "8px",
                      padding: "0.6rem 0.75rem",
                      fontSize: "0.78rem",
                    }}
                  >
                    <div style={{ color: "#047857", fontWeight: 700, fontSize: "0.7rem", marginBottom: "2px" }}>
                      🛠️ RUNBOOK EXPLOITANT MONÉTIQUE :
                    </div>
                    <div style={{ color: "#065f46", fontWeight: 500 }}>{info.operator_runbook || info.action}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
