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
    label: "Retrait GAB Valide (DE 39: 00)",
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
    label: "Solde Insuffisant (DE 39: 51)",
    config: {
      name: "Dépassement Solde Disponible",
      channel: "ATM",
      mti: "0200",
      pan: "4000123456780005", // Solde faible (2000 XOF)
      amount: 500000,
      expected_de39: "51",
      pin: "1234",
    },
  },
  {
    label: "Code PIN Incorrect (DE 39: 55)",
    config: {
      name: "Erreur Saisie PIN Client",
      channel: "POS",
      mti: "0200",
      pan: "4000123456780001",
      amount: 15000,
      expected_de39: "55",
      pin: "9999", // Mauvais PIN
    },
  },
  {
    label: "Demande d'Autorisation (MTI 0100)",
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
    label: "Annulation / Reversal (MTI 0400)",
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
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-xl border border-slate-700/60 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-400 border border-indigo-500/30">
                UAT & Certification
              </span>
              <span className="text-xs text-slate-400">Générateur Certifié de PV</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>📋</span> Studio de Recette & PV d'Homologation
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl">
              Configurez des plans de tests personnalisés, injectez des champs ISO 8583 spécifiques, comparez les codes retours
              (DE 39) et générez un <strong>Procès-Verbal officiel d'homologation</strong> revêtu du visa d'ingénierie monétique.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setResults([])}
              disabled={results.length === 0}
              className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded border border-slate-700 transition disabled:opacity-40"
            >
              Effacer les Tests
            </button>
            <button
              onClick={handleGeneratePv}
              disabled={pvLoading || results.length === 0}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg shadow-emerald-600/30 transition disabled:opacity-40 flex items-center gap-2"
            >
              {pvLoading ? "Génération..." : "📄 Générer PV Officiel"}
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200 flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* QUICK PRESETS */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-slate-400 font-semibold">Modèles de Tests Rapides :</span>
        {PRESET_SCENARIOS.map((p, idx) => (
          <button
            key={idx}
            onClick={() => applyPreset(p.config)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* WORKSPACE: CONFIG FORM & RESULTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORM LEFT */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 border-b border-slate-800 pb-2">
            ⚙️ Paramètres du Scénario
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Nom / Référence du Test :</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Canal Monétique :</label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ATM">GAB / ATM</option>
                  <option value="POS">TPE / POS</option>
                  <option value="ECOM">E-Commerce / WEB</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">MTI Requis :</label>
                <select
                  value={form.mti}
                  onChange={(e) => setForm({ ...form, mti: e.target.value })}
                  className="w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-emerald-400 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="0200">0200 - Demande d'Autorisation</option>
                  <option value="0100">0100 - Demande de Pré-Autorisation</option>
                  <option value="0400">0400 - Demande d'Extourne (Reversal)</option>
                  <option value="0800">0800 - Echo Test Réseau</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Numéro de Carte (PAN) :</label>
                <input
                  type="text"
                  value={form.pan}
                  onChange={(e) => setForm({ ...form, pan: e.target.value })}
                  className="w-full font-mono rounded border border-slate-700 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Montant Transactionnel :</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  className="w-full font-mono rounded border border-slate-700 bg-slate-950 p-2 text-amber-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-slate-400 mb-1">Devise (DE 49) :</label>
                <input
                  type="text"
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className="w-full font-mono rounded border border-slate-700 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Code PIN :</label>
                <input
                  type="password"
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                  className="w-full font-mono rounded border border-slate-700 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">DE 39 Attendu :</label>
                <input
                  type="text"
                  maxLength={2}
                  value={form.expected_de39}
                  onChange={(e) => setForm({ ...form, expected_de39: e.target.value })}
                  className="w-full font-mono font-bold text-center rounded border border-slate-700 bg-slate-950 p-2 text-indigo-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">
                Surcharges de Données (JSON DE 43, 48, 55...) :
              </label>
              <textarea
                rows={3}
                value={form.field_overrides_raw}
                onChange={(e) => setForm({ ...form, field_overrides_raw: e.target.value })}
                className="w-full font-mono text-xs rounded border border-slate-700 bg-slate-950 p-2 text-emerald-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Intitulé de la Campagne d'Homologation :</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-slate-300 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleRunScenario}
              disabled={loading}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {loading ? "Exécution du Scénario..." : "🚀 Exécuter le Cas de Test"}
            </button>
          </div>
        </div>

        {/* RESULTS RIGHT */}
        <div className="lg:col-span-7 space-y-4">
          {/* STATS STRIP */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
              <span className="text-[11px] uppercase tracking-wider text-slate-400">Total Exécutés</span>
              <p className="font-mono text-xl font-bold text-white mt-0.5">{results.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 text-center">
              <span className="text-[11px] uppercase tracking-wider text-emerald-400">Succès (PASS)</span>
              <p className="font-mono text-xl font-bold text-emerald-400 mt-0.5">{passedCount}</p>
            </div>
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-center">
              <span className="text-[11px] uppercase tracking-wider text-red-400">Échecs (FAIL)</span>
              <p className="font-mono text-xl font-bold text-red-400 mt-0.5">{failedCount}</p>
            </div>
          </div>

          {/* RESULTS TABLE */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white border-b border-slate-800 pb-2">
              📊 Journal des Tests de la Session ({results.length})
            </h2>

            {results.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Aucun test exécuté pour le moment. Renseignez le formulaire ou cliquez sur un modèle pour démarrer.
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {results.map((r, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 text-xs transition ${
                      r.passed
                        ? "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50"
                        : "border-red-500/30 bg-red-950/10 hover:border-red-500/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                            r.passed
                              ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50"
                              : "bg-red-900/50 text-red-300 border border-red-700/50"
                          }`}
                        >
                          {r.test_verdict}
                        </span>
                        <span className="font-semibold text-white">{r.scenario_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">[{r.channel} • MTI {r.mti}]</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">{r.timestamp}</span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-800/60 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Carte :</span>
                        <span className="text-slate-300">{r.pan_masked}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Montant :</span>
                        <span className="text-amber-400">{r.amount.toLocaleString()} XOF</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Attendu / Obtenu :</span>
                        <span className="text-slate-300">DE {r.expected_de39} ➔ </span>
                        <strong className={r.passed ? "text-emerald-400" : "text-red-400"}>
                          DE {r.obtained_de39}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Règle Active :</span>
                        <span className="text-indigo-300 truncate block" title={r.rule_triggered}>
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

      {/* PV MODAL / PREVIEW */}
      {pvReport && (
        <div className="rounded-xl border border-emerald-500/40 bg-slate-900/90 p-5 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-400 border border-emerald-500/30">
                Document Officiel de Certification
              </span>
              <h3 className="mt-1 text-base font-bold text-white">
                📄 Procès-Verbal de Recette Monétique — {pvReport.campaign_name}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadPv}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow transition flex items-center gap-2"
              >
                💾 Télécharger le PV (.md)
              </button>
              <button
                onClick={() => setPvReport(null)}
                className="px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded transition"
              >
                Fermer
              </button>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 max-h-96 overflow-y-auto">
            <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
              {pvReport.markdown}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
