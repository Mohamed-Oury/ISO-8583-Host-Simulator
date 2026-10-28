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
      setErrorMsg(err.message || "Impossible de charger les profils");
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
      setErrorMsg(err.message || "Erreur de validation");
    } finally {
      setLoading(false);
    }
  };

  const activeProfile = profiles.find((p) => p.id === selectedProfileId);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-xl border border-slate-700/60 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-400 border border-indigo-500/30">
                Dialectes & Schémas Monétiques
              </span>
              <span className="text-xs text-slate-400">Standard ISO 8583:1987 / 1993</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🌐</span> Profils Réseaux Multi-Dialectes
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl">
              Spécifications strictes d'interconnexion régionale et internationale. Validez vos trames ISO 8583
              face aux exigences normatives du réseau interbancaire régional <strong>GIM-UEMOA</strong>,
              des réseaux internationaux <strong>VISA Base I</strong> et <strong>Mastercard CIS</strong>, ou du <strong>Switch Domestique</strong>.
            </p>
          </div>
          <button
            onClick={loadProfiles}
            disabled={fetching}
            className="self-start md:self-center px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition flex items-center gap-2"
          >
            🔄 Actualiser les Profils
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200 flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* PROFILES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {profiles.map((p) => {
          const isSelected = p.id === selectedProfileId;
          return (
            <div
              key={p.id}
              onClick={() => handleProfileChange(p.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 shadow-md ${
                isSelected
                  ? "border-indigo-500 bg-indigo-950/30 ring-2 ring-indigo-500/40"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {p.region}
                </span>
                <span className="font-mono text-xs font-bold text-amber-400">
                  {p.currency_name} ({p.currency_default})
                </span>
              </div>
              <h3 className="mt-2 text-base font-bold text-white flex items-center gap-1.5">
                {p.id === "GIM_UEMOA" && "🏛️"}
                {p.id === "VISA_BASE_I" && "💳"}
                {p.id === "MASTERCARD_CIS" && "🔴"}
                {p.id === "DOMESTIC_SWITCH" && "🔄"}
                {p.name}
              </h3>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2">{p.rules_description}</p>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span>Champs 0200 :</span>
                <span className="font-mono text-slate-300 font-semibold">{p.mandatory_fields_0200.length} requis</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ACTIVE PROFILE DETAILS & VALIDATOR */}
      {activeProfile && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PROFILE CARD DETAIL */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                📋 Spécifications : {activeProfile.name}
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-900/50 text-indigo-300 border border-indigo-700/50">
                {activeProfile.id}
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <span className="text-slate-400 block mb-0.5">Région / Territoire :</span>
                <span className="font-semibold text-white">{activeProfile.region}</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Devise Régionale par Défaut :</span>
                <span className="font-mono font-bold text-amber-400">
                  {activeProfile.currency_name} (Code ISO 4217 : {activeProfile.currency_default})
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Format Données Privées (DE 48) :</span>
                <span className="font-mono text-xs text-indigo-300 bg-indigo-950/40 px-2 py-1 rounded border border-indigo-900/50 block">
                  {activeProfile.de48_format}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">MTI Supportés :</span>
                <div className="flex flex-wrap gap-1">
                  {activeProfile.standard_mti.map((m) => (
                    <span key={m} className="font-mono bg-slate-800 px-2 py-0.5 rounded text-emerald-400 border border-slate-700">
                      {m}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">
                  Champs Obligatoires (0200 Demande d'Autorisation) :
                </span>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-slate-950/50 rounded border border-slate-800/80">
                  {activeProfile.mandatory_fields_0200.map((f) => (
                    <span key={f} className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                      DE {f}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Règles Spécifiques :</span>
                <p className="text-slate-300 leading-relaxed bg-slate-950/40 p-2 rounded border border-slate-800">
                  {activeProfile.rules_description}
                </p>
              </div>
            </div>
          </div>

          {/* VALIDATOR INTERACTION */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  ⚡ Validateur de Conformité Réseau
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vérification du format MTI, bitmaps, DE obligatoires et contraintes régionales.
                </p>
              </div>
              <button
                onClick={() => setInputFrame(PRESET_FRAMES[selectedProfileId] || "")}
                className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition"
              >
                Trame Exemple
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Trame ISO 8583 (ASCII / Hexadécimal) :
              </label>
              <textarea
                value={inputFrame}
                onChange={(e) => setInputFrame(e.target.value)}
                rows={4}
                placeholder="Ex: 0200F23A448108E080000000000004000000165060..."
                className="w-full font-mono text-xs rounded-lg border border-slate-700 bg-slate-950 p-3 text-emerald-400 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Longueur : <span className="font-mono text-white font-semibold">{inputFrame.length}</span> caractères
              </span>
              <button
                onClick={handleValidate}
                disabled={loading}
                className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? "Vérification en cours..." : "✓ Lancer la Validation Normative"}
              </button>
            </div>

            {/* RESULTS VIEW */}
            {validationResult && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        validationResult.is_compliant
                          ? "bg-emerald-900/60 text-emerald-300 border border-emerald-600/60"
                          : "bg-red-900/60 text-red-300 border border-red-600/60"
                      }`}
                    >
                      {validationResult.verdict}
                    </span>
                    <span className="text-xs text-slate-400">
                      Profil : <strong className="text-white">{validationResult.profile_name}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-emerald-400">
                      ✓ {validationResult.checks_passed.length} vérifications
                    </span>
                    {validationResult.anomalies_count > 0 && (
                      <span className="text-red-400 font-semibold">
                        ✗ {validationResult.anomalies_count} anomalies
                      </span>
                    )}
                    {validationResult.warnings_count > 0 && (
                      <span className="text-amber-400 font-semibold">
                        ⚠️ {validationResult.warnings_count} alertes
                      </span>
                    )}
                  </div>
                </div>

                {/* ANOMALIES LIST */}
                {validationResult.anomalies && validationResult.anomalies.length > 0 && (
                  <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3 space-y-1">
                    <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">
                      Anomalies Bloquantes (Rejet Réseau) :
                    </h4>
                    <ul className="list-disc list-inside text-xs text-red-300 space-y-0.5">
                      {validationResult.anomalies.map((ano, idx) => (
                        <li key={idx} className="font-mono">{ano}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* WARNINGS */}
                {validationResult.warnings && validationResult.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 space-y-1">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Avertissements & Recommandations :
                    </h4>
                    <ul className="list-disc list-inside text-xs text-amber-300 space-y-0.5">
                      {validationResult.warnings.map((warn, idx) => (
                        <li key={idx} className="font-mono">{warn}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* CHECKS PASSED */}
                {validationResult.checks_passed && validationResult.checks_passed.length > 0 && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-1">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Contrôles Validés avec Succès :
                    </h4>
                    <ul className="list-disc list-inside text-xs text-emerald-300 space-y-0.5">
                      {validationResult.checks_passed.map((chk, idx) => (
                        <li key={idx} className="font-mono">{chk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
