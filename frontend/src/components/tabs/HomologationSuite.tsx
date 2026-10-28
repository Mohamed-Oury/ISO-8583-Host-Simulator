"use client";

import { useState } from "react";
import { TestResult, TestSuiteResponse, runTestSuite } from "@/lib/api";

interface HomologationSuiteProps {
  onSelectTestCase?: (tcId: string) => void;
  onRefresh?: () => void;
}

const DEFAULT_TEST_CASES: TestResult[] = [
  // Suite Homologation Normative (12 cas)
  { id: "TC-0800", title: "Echo Réseau (0800 -> 0810)", description: "Validation liaison réseau host en < 100 ms", rule_tested: "Liaison Réseau", channel: "NETWORK", pan_masked: "N/A", amount: 0, currency: "952", expected_de39: "00", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-01", title: "Succès nominal TPE", description: "Porteur valide, solde et plafonds suffisants, PIN correct.", rule_tested: "R01-R10 (Nominal)", channel: "TPE", pan_masked: "400012******0001", amount: 5000, currency: "952", expected_de39: "00", actual_de39: "--", auth_code: "", expected_balance_impact: -5000, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-02", title: "Carte inconnue", description: "Le PAN n'existe pas dans le référentiel émetteur.", rule_tested: "R01: Existence PAN", channel: "TPE", pan_masked: "400012******9999", amount: 5000, currency: "952", expected_de39: "14", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-03", title: "Carte volée", description: "Carte déclarée comme volée (status STOLEN).", rule_tested: "R02: Fraude / Vol", channel: "TPE", pan_masked: "400012******0003", amount: 5000, currency: "952", expected_de39: "43", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-04", title: "Carte expirée", description: "Date d'expiration (2401) antérieure à la date locale.", rule_tested: "R03: Validité Date", channel: "TPE", pan_masked: "400012******0002", amount: 5000, currency: "952", expected_de39: "54", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-05", title: "PIN erroné (1er échec)", description: "Code PIN incorrect (0000 au lieu de 1234). Incrémente pin_tries.", rule_tested: "R05: Conformité PIN", channel: "TPE", pan_masked: "400012******0001", amount: 5000, currency: "952", expected_de39: "55", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-06", title: "3e faux PIN consécutif", description: "Compteur de tentatives PIN saturé à 3 (carte bloquée).", rule_tested: "R04: Blocage PIN", channel: "TPE", pan_masked: "400012******0004", amount: 5000, currency: "952", expected_de39: "75", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-07", title: "Solde insuffisant", description: "Solde disponible (2 000 FCFA) insuffisant pour le montant (50 000 FCFA).", rule_tested: "R09: Solde Disponible", channel: "TPE", pan_masked: "400012******0005", amount: 50000, currency: "952", expected_de39: "51", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-08", title: "Plafond unitaire dépassé", description: "Montant (60 000 FCFA) dépasse le plafond unitaire configuré (50 000 FCFA).", rule_tested: "R07: Plafond Unitaire", channel: "TPE", pan_masked: "400012******0006", amount: 60000, currency: "952", expected_de39: "61", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-09", title: "Plafond journalier dépassé", description: "Cumul déjà consommé (980 000) + montant (30 000) dépasse 1 000 000 FCFA.", rule_tested: "R08: Plafond Journalier", channel: "TPE", pan_masked: "400012******0007", amount: 30000, currency: "952", expected_de39: "65", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-10", title: "Devise non autorisée", description: "Devise 840 (USD) transmise sur carte domestique XOF (952).", rule_tested: "R06: Conformité Devise", channel: "TPE", pan_masked: "400012******0001", amount: 5000, currency: "840", expected_de39: "58", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-0400", title: "Annulation 0400 (Reversal)", description: "Annulation financière via DE 90 et réintégration intégrale des fonds.", rule_tested: "Annulation DE 90", channel: "TPE", pan_masked: "400012******0001", amount: 15000, currency: "952", expected_de39: "00", actual_de39: "--", auth_code: "", expected_balance_impact: 15000, actual_balance_impact: 0, latency_ms: 0, passed: false },

  // Suite UAT Multi-Canal : GAB, TPE & E-Commerce (12 cas)
  { id: "TC-11", title: "Retrait Espèces GAB Nominal", description: "Retrait GAB 25 000 FCFA (2x10k + 1x5k) sur GAB00001.", rule_tested: "R13: Retrait GAB & Cassettes", channel: "GAB", pan_masked: "400012******0001", amount: 25000, currency: "952", expected_de39: "00", actual_de39: "--", auth_code: "", expected_balance_impact: -25000, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-12", title: "Consultation Solde GAB (DE 54)", description: "Requête DE 3 = 310000 retourne le solde disponible dans DE 54.", rule_tested: "GAB Balance Inquiry", channel: "GAB", pan_masked: "400012******0001", amount: 0, currency: "952", expected_de39: "00", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-13", title: "Coupure GAB Impossible (DE 39=13)", description: "Montant 5 500 FCFA non payable par les coupures GAB (10k, 5k, 2k).", rule_tested: "R13: Coupures GAB (DE 39=13)", channel: "GAB", pan_masked: "400012******0001", amount: 5500, currency: "952", expected_de39: "13", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-14", title: "Achat TPE Sans-Contact NFC", description: "Paiement NFC (DE 22=071) de 10 000 FCFA accepté sans PIN.", rule_tested: "R08: TPE Sans Contact NFC", channel: "TPE", pan_masked: "400012******0001", amount: 10000, currency: "952", expected_de39: "00", actual_de39: "--", auth_code: "", expected_balance_impact: -10000, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-15", title: "Dépassement Seuil Sans-Contact NFC", description: "Paiement NFC (DE 22=071) de 20 000 FCFA sans PIN refusé (Code 65).", rule_tested: "R08: Seuil CVM Sans Contact", channel: "TPE", pan_masked: "400012******0001", amount: 20000, currency: "952", expected_de39: "65", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-16", title: "Fallback Piste Magnétique Interdit", description: "Lecture piste DE 22=801 sur carte EMV rejetée (Anti-Skimming 59).", rule_tested: "R11: Sécurité Fallback EMV", channel: "TPE", pan_masked: "400012******0001", amount: 10000, currency: "952", expected_de39: "59", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-17", title: "Paiement En Ligne 3-D Secure Valide", description: "Achat en ligne (DE 22=812) avec CVV2 valide et 3DS=Y.", rule_tested: "R12: E-Commerce 3DS & CVV2", channel: "ECOM", pan_masked: "400012******0001", amount: 40000, currency: "952", expected_de39: "00", actual_de39: "--", auth_code: "", expected_balance_impact: -40000, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-18", title: "E-Commerce CVV2 Erroné (DE 39=05)", description: "Achat en ligne avec cryptogramme CVV2 invalide (999).", rule_tested: "R12: Contrôle CVV2 (DE 39=05)", channel: "ECOM", pan_masked: "400012******0001", amount: 15000, currency: "952", expected_de39: "05", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-19", title: "E-Commerce Sans 3-D Secure (DE 39=05)", description: "Achat 40 000 FCFA avec 3DS=N (> 25 000 F) rejeté (DE 39=05).", rule_tested: "R12: Obligation 3-D Secure", channel: "ECOM", pan_masked: "400012******0001", amount: 40000, currency: "952", expected_de39: "05", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-20", title: "Canal E-Commerce Désactivé (DE 39=57)", description: "Carte 0011 ayant le canal E-Commerce désactivé par le porteur.", rule_tested: "R10: Restriction Canal", channel: "ECOM", pan_masked: "400012******0011", amount: 10000, currency: "952", expected_de39: "57", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-21", title: "Capture Carte sur GAB (DE 39=04)", description: "Carte 0012 sous ordre de capture immédiate en GAB (Pick-up Card).", rule_tested: "R02: Capture Carte (DE 39=04)", channel: "GAB", pan_masked: "400012******0012", amount: 10000, currency: "952", expected_de39: "04", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
  { id: "TC-22", title: "Alerte Vélocité Anti-Fraude (DE 39=59)", description: "Carte 0013 ayant atteint 5 tx/heure bloquée par vélocité (Code 59).", rule_tested: "R11: Vélocité Horaire (59)", channel: "TPE", pan_masked: "400012******0013", amount: 5000, currency: "952", expected_de39: "59", actual_de39: "--", auth_code: "", expected_balance_impact: 0, actual_balance_impact: 0, latency_ms: 0, passed: false },
];

const HOMOLOGATION_IDS = new Set([
  "TC-0800", "TC-01", "TC-02", "TC-03", "TC-04", "TC-05",
  "TC-06", "TC-07", "TC-08", "TC-09", "TC-10", "TC-0400",
]);

export default function HomologationSuite({ onSelectTestCase, onRefresh }: HomologationSuiteProps) {
  const [loading, setLoading] = useState(false);
  const [suiteResponse, setSuiteResponse] = useState<TestSuiteResponse | null>(null);
  const [results, setResults] = useState<TestResult[]>(DEFAULT_TEST_CASES);
  const [filterType, setFilterType] = useState<"all" | "homologation" | "uat" | "passed" | "failed">("all");

  const handleRunAll = async () => {
    setLoading(true);
    try {
      const res = await runTestSuite();
      setSuiteResponse(res);
      setResults(res.results);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert("Erreur lors de l'exécution : " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const isExecuted = suiteResponse !== null;
  const isCertified = suiteResponse?.summary.certified ?? false;
  const passedCount = suiteResponse?.summary.passed ?? 0;
  const totalCount = suiteResponse?.summary.total ?? 24;
  const rateNum = isExecuted && totalCount > 0 ? (passedCount / totalCount) * 100 : 0;
  const rate = suiteResponse?.summary.compliance_rate ?? (isExecuted ? rateNum.toFixed(1) : "--");

  const filteredResults = results.filter((r) => {
    if (filterType === "homologation") return HOMOLOGATION_IDS.has(r.id);
    if (filterType === "uat") return !HOMOLOGATION_IDS.has(r.id);
    if (filterType === "passed") return r.actual_de39 !== "--" && r.passed;
    if (filterType === "failed") return r.actual_de39 !== "--" && !r.passed;
    return true;
  });

  return (
    <div className="homologation-container">
      {/* Pane Header with Title & Primary Action */}
      <div className="pane-header-enhanced">
        <div className="pane-title-group">
          <div className="pane-badge-wrapper">
            <span className="badge-chip emerald">
              <span className="status-indicator-dot" />
              QUALIFICATION OFFICIELLE &amp; UAT
            </span>
            <span className="badge-chip subtle">24 ÉPREUVES (GAB • TPE • E-COMMERCE)</span>
          </div>
          <h2 className="pane-title">Banc d'Essai d'Homologation &amp; Recette UAT Multi-Canal</h2>
          <p className="pane-subtitle">
            Exécution automatisée sur socket TCP des 12 tests normatifs (R01-R10, 0800, 0400) et des 12 scénarios UAT bancaires (Cassettes GAB, Sans Contact NFC, Fallback EMV, E-Commerce CVV2/3DS, Capture, Vélocité).
          </p>
        </div>

        <div className="pane-actions-group">
          <button
            onClick={handleRunAll}
            disabled={loading}
            className="btn btn-primary btn-glow btn-lg"
          >
            {loading ? (
              <>
                <span className="spinner-emerald" />
                <span>Exécution des 24 Scénarios TCP...</span>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Exécuter les 24 Épreuves (Homologation + UAT)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Certification Passport Banner */}
      <div className={`certification-banner-enhanced ${isExecuted ? (isCertified ? "certified" : "failed") : "idle"}`}>
        <div className="cert-left-section">
          <div className="cert-gauge-box">
            <div className="cert-rate-display">
              <span className="cert-rate-number">{rate}</span>
              <span className="cert-rate-percent">%</span>
            </div>
            <span className="cert-gauge-label">Taux de Conformité</span>
          </div>

          <div className="cert-badge-column">
            <div className={`cert-badge-pill ${isExecuted ? (isCertified ? "certified" : "failed") : "idle"}`}>
              <span className="status-indicator-dot" />
              <span>
                {!isExecuted
                  ? "PRÊT POUR QUALIFICATION (24 SCÉNARIOS)"
                  : isCertified
                  ? "HOMOLOGATION & UAT CERTIFIÉES (24/24 CONFORMES)"
                  : "HOMOLOGATION REJETÉE — ÉCARTS DÉTECTÉS"}
              </span>
            </div>
            <span className="cert-standard-stamp">
              AUTORISATION MULTI-CANAL (GAB / TPE / E-COM) • MYSQL :8889 • PCI-DSS v4.0
            </span>
          </div>
        </div>

        <div className="cert-right-section">
          <div className="cert-metric-card">
            <span className="metric-title">Épreuves Totales</span>
            <div className="metric-val-row">
              <span className="metric-number">{totalCount}</span>
              <span className="metric-tag">12 Norm + 12 UAT</span>
            </div>
          </div>

          <div className="cert-metric-card success">
            <span className="metric-title">Succès Validés</span>
            <div className="metric-val-row">
              <span className="metric-number text-emerald">{passedCount}</span>
              <span className="metric-tag text-emerald">{isExecuted ? "Conformes" : "En attente"}</span>
            </div>
          </div>

          <div className="cert-metric-card danger">
            <span className="metric-title">Échecs / Écarts</span>
            <div className="metric-val-row">
              <span className="metric-number text-rose">{isExecuted ? totalCount - passedCount : 0}</span>
              <span className="metric-tag text-rose">{isExecuted ? "Écarts" : "En attente"}</span>
            </div>
          </div>

          <div className="cert-metric-card protocol">
            <span className="metric-title">Persistance</span>
            <div className="metric-val-row">
              <span className="metric-mono">MySQL / TCP</span>
              <span className="metric-tag">:8889 / :5001</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Filter Toolbar */}
      <div className="table-toolbar">
        <div className="filter-buttons">
          <button
            onClick={() => setFilterType("all")}
            className={`filter-btn ${filterType === "all" ? "active" : ""}`}
          >
            <span>Toutes</span>
            <span className="filter-count">{results.length}</span>
          </button>
          <button
            onClick={() => setFilterType("homologation")}
            className={`filter-btn ${filterType === "homologation" ? "active" : ""}`}
          >
            <span>Socle Normatif (TC-01..10)</span>
            <span className="filter-count">12</span>
          </button>
          <button
            onClick={() => setFilterType("uat")}
            className={`filter-btn ${filterType === "uat" ? "active" : ""}`}
          >
            <span>UAT Multi-Canal (TC-11..22)</span>
            <span className="filter-count">12</span>
          </button>
          <button
            onClick={() => setFilterType("passed")}
            className={`filter-btn ${filterType === "passed" ? "active" : ""}`}
          >
            <span>Validés</span>
            <span className="filter-count success">{results.filter((r) => r.passed && r.actual_de39 !== "--").length}</span>
          </button>
          <button
            onClick={() => setFilterType("failed")}
            className={`filter-btn ${filterType === "failed" ? "active" : ""}`}
          >
            <span>Échecs</span>
            <span className="filter-count danger">{results.filter((r) => !r.passed && r.actual_de39 !== "--").length}</span>
          </button>
        </div>

        <div className="toolbar-legend">
          <span className="legend-item"><span className="legend-dot green" /> Approbation (00)</span>
          <span className="legend-item"><span className="legend-dot red" /> Refus Arbitré (R01-R13)</span>
        </div>
      </div>

      {/* Results Data Table */}
      <div className="table-container-enhanced">
        <table className="data-table-enhanced">
          <thead>
            <tr>
              <th style={{ width: "85px" }}>ID</th>
              <th style={{ width: "80px" }}>CANAL</th>
              <th style={{ minWidth: "210px" }}>INTITULÉ &amp; SCÉNARIO UAT</th>
              <th style={{ width: "150px" }}>PORTEUR (PCI-DSS)</th>
              <th style={{ width: "110px" }}>MONTANT</th>
              <th style={{ width: "145px" }}>RÈGLE TESTÉE</th>
              <th style={{ width: "80px" }}>ATTENDU</th>
              <th style={{ width: "80px" }}>OBTENU</th>
              <th style={{ width: "115px" }}>IMPACT SOLDE</th>
              <th style={{ width: "90px" }}>LATENCE</th>
              <th style={{ width: "120px" }}>VERDICT</th>
              <th style={{ width: "85px", textAlign: "right" }}>SIMULER</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map((r) => {
              const amtStr = r.amount > 0 ? `${r.amount.toLocaleString()} F` : "—";
              const balStr =
                r.actual_balance_impact !== 0
                  ? `${r.actual_balance_impact > 0 ? "+" : ""}${r.actual_balance_impact.toLocaleString()} F`
                  : "0 F";

              let verdictPill = (
                <span className="verdict-chip idle">
                  <span className="chip-dot" /> Attente
                </span>
              );

              if (r.actual_de39 !== "--") {
                verdictPill = r.passed ? (
                  <span className="verdict-chip success">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>CONFORME</span>
                  </span>
                ) : (
                  <span className="verdict-chip failed">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span>ÉCHEC</span>
                  </span>
                );
              }

              const chan = r.channel || "TPE";
              const chanBadge =
                chan === "GAB"
                  ? "🏧 GAB"
                  : chan === "ECOM"
                  ? "🌐 E-Com"
                  : chan === "NETWORK"
                  ? "🖧 Echo"
                  : "💳 TPE";

              return (
                <tr key={r.id} className={r.passed && r.actual_de39 !== "--" ? "row-passed" : ""}>
                  <td>
                    <span className="test-id-badge">{r.id}</span>
                  </td>
                  <td>
                    <span className="tag font-mono" style={{ fontSize: "0.72rem" }}>{chanBadge}</span>
                  </td>
                  <td>
                    <div className="test-title-text">{r.title}</div>
                    <div className="test-desc-text">{r.description}</div>
                  </td>
                  <td>
                    <span className="card-pan-cell font-mono" style={{ fontSize: "0.76rem" }}>
                      {r.pan_masked}
                    </span>
                  </td>
                  <td className="amount-cell">{amtStr}</td>
                  <td>
                    <span className="rule-badge">{r.rule_tested}</span>
                  </td>
                  <td>
                    <span className="de39-code expected">{r.expected_de39}</span>
                  </td>
                  <td>
                    <span className={`de39-code ${r.actual_de39 === "--" ? "empty" : r.actual_de39 === r.expected_de39 ? "match" : "mismatch"}`}>
                      {r.actual_de39}
                    </span>
                  </td>
                  <td className="balance-cell font-mono">{balStr}</td>
                  <td>
                    <span className="latency-cell font-mono">
                      {r.latency_ms > 0 ? `${r.latency_ms.toFixed(1)} ms` : "—"}
                    </span>
                  </td>
                  <td>{verdictPill}</td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      onClick={() => onSelectTestCase && onSelectTestCase(r.id)}
                      className="btn-action-test"
                      title="Charger ce scénario dans le Simulateur Multi-Canal"
                    >
                      <span>⚡</span> Tester
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
