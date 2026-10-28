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
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* HEADER PRINCIPAL */}
      <div className="pane-header">
        <div className="pane-header-main">
          <div className="pane-title-row">
            <span className="badge-chip highlight">CORE BANKING SYSTEM (CBS)</span>
            <span className="badge-chip subtle">COMPTABILITÉ EN PARTIE DOUBLE</span>
            <span className="badge-chip success">HOLDS 0100 • DÉBITS 0200 • EXTURNES 0400</span>
          </div>
          <h2 className="pane-title">Passerelle Core Banking (CBS) &amp; Grand Livre Comptable</h2>
          <p className="pane-subtitle">
            Simulation temps réel de l'intégration monétique vers le Core Banking System (CBS).
            Gérez les <strong>mises en réserve de provisions (Holds 0100)</strong>, les <strong>débits fermes (0200)</strong> et les
            <strong> extournes (0400)</strong> avec génération automatique des écritures comptables équilibrées au Grand Livre.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={loadData}
            disabled={fetching}
            className="btn btn-outline"
            style={{ fontSize: "0.82rem" }}
          >
            {fetching ? "Chargement..." : "🔄 Actualiser le Solde"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: "0.75rem 1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* GRILLE DES COMPTES CBS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
        {accounts.map((acc) => {
          const isSelected = acc.account_id === selectedAccountId;
          return (
            <div
              key={acc.account_id}
              onClick={() => setSelectedAccountId(acc.account_id)}
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
                <span className="tag" style={{ fontFamily: "monospace", fontSize: "0.68rem" }}>
                  {acc.account_id}
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 600 }}>
                  {acc.type === "CLIENT" ? "👤 Compte Client" : "🏢 Compte Interne"}
                </span>
              </div>

              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "0.5rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {acc.name}
              </h3>

              <div style={{ paddingTop: "0.5rem", borderTop: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.75rem", fontFamily: "monospace" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Solde Comptable :</span>
                  <span style={{ fontWeight: 600, color: "var(--text-soft)" }}>{acc.accounting_balance.toLocaleString()} XOF</span>
                </div>
                {acc.holds > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#b45309" }}>
                    <span>Hold / Réservé :</span>
                    <span>-{acc.holds.toLocaleString()} XOF</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "0.3rem", borderTop: "1px solid #f1f5f9", fontSize: "0.82rem" }}>
                  <span style={{ fontWeight: 700, color: "var(--text-main)" }}>Disponible :</span>
                  <strong style={{ color: "var(--burgundy)" }}>{acc.available_balance.toLocaleString()} XOF</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* FORMULAIRE D'ACTION & GRAND LIVRE EN 2 COLONNES */}
      <div style={{ display: "grid", gridTemplateColumns: "1.05fr 1.35fr", gap: "1.25rem", alignItems: "start" }}>
        {/* COLONNE GAUCHE : ACTIONNER LE CBS */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>⚡</span>
                <span>Actionner le Core Banking (CBS)</span>
              </h3>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Émission d'instructions monétiques directes
              </span>
            </div>
            {selectedAccount && (
              <span className="tag" style={{ fontFamily: "monospace" }}>{selectedAccount.account_id}</span>
            )}
          </div>

          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.4rem" }}>
                Type d'Opération Monétique :
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setOperationType("HOLD")}
                  className={`btn ${operationType === "HOLD" ? "btn-primary btn-glow" : "btn-outline"}`}
                  style={{ fontSize: "0.75rem", padding: "0.5rem" }}
                >
                  🔒 Hold (0100)
                </button>
                <button
                  type="button"
                  onClick={() => setOperationType("DEBIT")}
                  className={`btn ${operationType === "DEBIT" ? "btn-primary btn-glow" : "btn-outline"}`}
                  style={{ fontSize: "0.75rem", padding: "0.5rem" }}
                >
                  💳 Débit (0200)
                </button>
                <button
                  type="button"
                  onClick={() => setOperationType("REVERSAL")}
                  className={`btn ${operationType === "REVERSAL" ? "btn-danger" : "btn-outline"}`}
                  style={{ fontSize: "0.75rem", padding: "0.5rem" }}
                >
                  🔄 Extourne (0400)
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                Compte Bancaire Cible :
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="form-control"
                style={{ fontFamily: "monospace", fontSize: "0.82rem" }}
              >
                {accounts.map((acc) => (
                  <option key={acc.account_id} value={acc.account_id}>
                    {acc.account_id} — {acc.name} (Dispo: {acc.available_balance.toLocaleString()} XOF)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                  Montant Opérationnel (XOF) :
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="form-control"
                  style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--burgundy)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)", display: "block", marginBottom: "0.3rem" }}>
                  Canal Monétique :
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="form-control"
                >
                  <option value="ATM">🏧 GAB / ATM</option>
                  <option value="POS">💳 TPE / POS</option>
                  <option value="ECOM">🌐 E-Commerce</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecute}
              disabled={loading}
              className="btn btn-primary btn-glow btn-block"
              style={{ marginTop: "0.5rem", padding: "0.75rem" }}
            >
              {loading ? "Comptabilisation en cours..." : "Transmettre l'Instruction au CBS"}
            </button>

            {/* BANNIÈRE RÉSULTAT DERNIÈRE OPÉRATION */}
            {lastOpResult && (
              <div style={{ padding: "0.85rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.78rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ color: "#15803d" }}>✓ Instruction Comptabilisée avec Succès</strong>
                  <span style={{ fontFamily: "monospace", color: "var(--text-muted)", fontSize: "0.72rem" }}>
                    STAN: {lastOpResult.stan}
                  </span>
                </div>
                <div style={{ color: "var(--text-soft)" }}>
                  Opération <strong>{lastOpResult.operation}</strong> de {lastOpResult.amount?.toLocaleString()} XOF validée.
                </div>
                {lastOpResult.new_available !== undefined && (
                  <div style={{ paddingTop: "0.3rem", borderTop: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", fontFamily: "monospace" }}>
                    <span>Nouveau Solde Disponible :</span>
                    <strong style={{ color: "var(--burgundy)" }}>{lastOpResult.new_available.toLocaleString()} XOF</strong>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* COLONNE DROITE : GRAND LIVRE COMPTABLE */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span>📑</span>
                <span>Grand Livre Comptable (General Ledger)</span>
              </h3>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Écritures en partie double passées en temps réel par les transactions monétiques
              </span>
            </div>
            <span className="badge-chip success" style={{ fontSize: "0.68rem" }}>
              Équilibré (Débit = Crédit)
            </span>
          </div>

          <div style={{ padding: "1rem" }}>
            {ledger.length === 0 ? (
              <div style={{ padding: "3rem 1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📑</div>
                <div>Aucune écriture comptable enregistrée dans cette session.</div>
                <div style={{ fontSize: "0.75rem", marginTop: "0.3rem" }}>
                  Déclenchez une opération à gauche ou simulez un retrait GAB pour passer des écritures.
                </div>
              </div>
            ) : (
              <div className="table-container-enhanced" style={{ maxHeight: "480px", overflowY: "auto" }}>
                <table className="data-table-enhanced" style={{ fontSize: "0.75rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "95px" }}>Heure / STAN</th>
                      <th>Libellé de l'Écriture</th>
                      <th>Compte Débité</th>
                      <th>Compte Crédité</th>
                      <th style={{ textAlign: "right" }}>Montant (XOF)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((entry) => (
                      <tr key={entry.entry_id}>
                        <td style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>
                          <div>{entry.timestamp.slice(11, 19)}</div>
                          <div style={{ fontSize: "0.68rem", color: "var(--burgundy)" }}>STAN: {entry.stan}</div>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--text-main)" }}>
                          {entry.label}
                        </td>
                        <td style={{ fontFamily: "monospace", color: "#b91c1c", fontWeight: 600 }}>
                          {entry.debit_account}
                        </td>
                        <td style={{ fontFamily: "monospace", color: "#15803d", fontWeight: 600 }}>
                          {entry.credit_account}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "var(--burgundy)" }}>
                          {entry.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
