"use client";

import React, { useState, useEffect } from "react";
import {
  fetchCbsAccounts,
  fetchCbsLedger,
  executeCbsOperation,
  CbsAccount,
  CbsLedgerEntry,
} from "@/lib/api";

export default function CbsGateway() {
  const [accounts, setAccounts] = useState<CbsAccount[]>([]);
  const [ledger, setLedger] = useState<CbsLedgerEntry[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("ACC_001_COURANT");
  const [operationType, setOperationType] = useState<"HOLD" | "DEBIT" | "REVERSAL">("HOLD");
  const [amount, setAmount] = useState<number>(25000);
  const [channel, setChannel] = useState<string>("ATM");
  const [loading, setLoading] = useState<boolean>(false);
  const [fetching, setFetching] = useState<boolean>(true);
  const [lastOpResult, setLastOpResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setFetching(true);
      setErrorMsg(null);
      const [accRes, ledRes] = await Promise.all([
        fetchCbsAccounts(),
        fetchCbsLedger(),
      ]);
      setAccounts(accRes.accounts || []);
      setLedger(ledRes.ledger || []);
      if (accRes.accounts && accRes.accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accRes.accounts[0].account_id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Impossible de charger les données CBS");
    } finally {
      setFetching(false);
    }
  };

  const handleExecute = async () => {
    if (amount <= 0) {
      setErrorMsg("Le montant doit être supérieur à zéro.");
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      setLastOpResult(null);

      const res = await executeCbsOperation({
        operation: operationType,
        account_id: selectedAccountId,
        amount: Number(amount),
        channel: channel,
      });

      setLastOpResult(res);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur d'opération CBS");
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find((a) => a.account_id === selectedAccountId);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="rounded-xl border border-slate-700/60 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-400 border border-indigo-500/30">
                Core Banking System & Comptabilité
              </span>
              <span className="text-xs text-slate-400">Écritures en Partie Double</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>🏛️</span> Passerelle CBS & Grand Livre Comptable
            </h1>
            <p className="mt-1 text-sm text-slate-300 max-w-3xl">
              Simulation temps réel de l'intégration monétique vers le Core Banking System (CBS).
              Gérez les <strong>mises en réserve de provisions (Holds 0100)</strong>, les <strong>débits fermes (0200)</strong> et les
              <strong> extournes (0400)</strong> avec génération automatique des écritures comptables au Grand Livre.
            </p>
          </div>

          <button
            onClick={loadData}
            disabled={fetching}
            className="self-start md:self-center px-4 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition flex items-center gap-2"
          >
            🔄 Actualiser le Solde
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200 flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* CBS ACCOUNTS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((acc) => {
          const isSelected = acc.account_id === selectedAccountId;
          return (
            <div
              key={acc.account_id}
              onClick={() => setSelectedAccountId(acc.account_id)}
              className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 shadow-md ${
                isSelected
                  ? "border-indigo-500 bg-indigo-950/30 ring-2 ring-indigo-500/40"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {acc.account_id}
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {acc.type === "CLIENT" ? "👤 Compte Client" : "🏢 Compte Interne"}
                </span>
              </div>

              <h3 className="mt-2 text-sm font-bold text-white truncate">{acc.name}</h3>

              <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Solde Comptable :</span>
                  <span className="text-slate-200">{acc.accounting_balance.toLocaleString()} XOF</span>
                </div>
                {acc.holds > 0 && (
                  <div className="flex justify-between text-amber-400">
                    <span>Provision Bloquée (Hold) :</span>
                    <span>-{acc.holds.toLocaleString()} XOF</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 border-t border-slate-800 text-sm font-bold">
                  <span className="text-slate-300">Disponible :</span>
                  <span className="text-emerald-400">{acc.available_balance.toLocaleString()} XOF</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* OPERATIONS & GRAND LIVRE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* INTERACTIVE OPERATION FORM */}
        <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              ⚡ Actionner le CBS
            </h2>
            {selectedAccount && (
              <span className="text-xs font-mono text-slate-400">
                Cible : <strong className="text-white">{selectedAccount.account_id}</strong>
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Type d'Opération Monétique :</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOperationType("HOLD")}
                  className={`py-2 rounded font-semibold transition border ${
                    operationType === "HOLD"
                      ? "bg-amber-600/30 text-amber-300 border-amber-500"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                  }`}
                >
                  🔒 Hold (0100)
                </button>
                <button
                  type="button"
                  onClick={() => setOperationType("DEBIT")}
                  className={`py-2 rounded font-semibold transition border ${
                    operationType === "DEBIT"
                      ? "bg-emerald-600/30 text-emerald-300 border-emerald-500"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                  }`}
                >
                  💳 Débit (0200)
                </button>
                <button
                  type="button"
                  onClick={() => setOperationType("REVERSAL")}
                  className={`py-2 rounded font-semibold transition border ${
                    operationType === "REVERSAL"
                      ? "bg-red-600/30 text-red-300 border-red-500"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
                  }`}
                >
                  🔄 Extourne (0400)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Compte Cible Sélectionné :</label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 p-2 font-mono text-white focus:border-indigo-500 focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.account_id} value={acc.account_id}>
                    {acc.account_id} - {acc.name} (Dispo: {acc.available_balance.toLocaleString()} XOF)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Montant Opérationnel (XOF) :</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full font-mono rounded border border-slate-700 bg-slate-950 p-2 text-amber-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Canal Transactionnel :</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ATM">GAB / ATM</option>
                  <option value="POS">TPE / POS</option>
                  <option value="ECOM">E-Commerce</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleExecute}
              disabled={loading}
              className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
            >
              {loading ? "Traitement bancaire..." : "Envoyer l'Instruction au CBS"}
            </button>
          </div>

          {/* LAST OPERATION RESULT BANNER */}
          {lastOpResult && (
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-300">
                  {lastOpResult.success ? "✓ Succès de l'Opération CBS" : "✗ Rejet CBS"}
                </span>
                <span className="font-mono text-slate-400">STAN: {lastOpResult.stan}</span>
              </div>
              <p className="text-slate-300">{lastOpResult.message}</p>
              {lastOpResult.new_available_balance !== undefined && (
                <div className="pt-2 border-t border-slate-800 flex justify-between font-mono text-[11px]">
                  <span className="text-slate-400">Nouveau Solde Dispo :</span>
                  <span className="text-emerald-400 font-bold">
                    {lastOpResult.new_available_balance.toLocaleString()} XOF
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* GRAND LIVRE COMPTABLE RIGHT */}
        <div className="lg:col-span-7 rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                📑 Grand Livre Comptable (General Ledger)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Écritures en partie double passées en temps réel par les transactions ISO 8583.
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/50">
              Équilibré (Débit = Crédit)
            </span>
          </div>

          <div className="max-h-[460px] overflow-y-auto">
            {ledger.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Aucune écriture comptable enregistrée dans cette session.
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                    <th className="py-2">Heure / STAN</th>
                    <th className="py-2">Libellé</th>
                    <th className="py-2">Compte Débit</th>
                    <th className="py-2">Compte Crédit</th>
                    <th className="py-2 text-right">Montant (XOF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {ledger.map((entry) => (
                    <tr key={entry.entry_id} className="hover:bg-slate-800/30 transition">
                      <td className="py-2 text-slate-400">
                        <div>{entry.timestamp.slice(11, 19)}</div>
                        <div className="text-[10px] text-slate-500">{entry.stan}</div>
                      </td>
                      <td className="py-2 font-sans font-medium text-white">{entry.label}</td>
                      <td className="py-2 text-red-400">{entry.debit_account}</td>
                      <td className="py-2 text-emerald-400">{entry.credit_account}</td>
                      <td className="py-2 text-right font-bold text-amber-400">
                        {entry.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
