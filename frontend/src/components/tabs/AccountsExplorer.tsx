"use client";

import { useState } from "react";
import { BankAccount } from "@/lib/api";

interface AccountsExplorerProps {
  accounts: BankAccount[];
  onRefresh: () => void;
  onEditAccount: (account: BankAccount) => void;
}

export default function AccountsExplorer({ accounts, onRefresh, onEditAccount }: AccountsExplorerProps) {
  const [search, setSearch] = useState("");

  const filtered = accounts.filter((a) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      a.pan.includes(q) ||
      a.masked_pan.toLowerCase().includes(q) ||
      a.status.toLowerCase().includes(q) ||
      (a.cardholder_name && a.cardholder_name.toLowerCase().includes(q)) ||
      (a.notes && a.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="homologation-container">
      <div className="pane-header-enhanced">
        <div className="pane-title-group">
          <div className="pane-badge-wrapper">
            <span className="badge-chip emerald">
              <span className="status-indicator-dot" />
              BASE MYSQL : PAYWAY_ISO8583_SIMULATOR
            </span>
            <span className="badge-chip subtle">50 CARTES • DROITS MULTI-CANAUX &amp; VÉLOCITÉ</span>
          </div>
          <h2 className="pane-title">Référentiel MySQL des Porteurs &amp; Paramètres de Sécurité</h2>
          <p className="pane-subtitle">
            Administration en temps réel des 50 cartes en base MySQL : soldes comptables, plafonds, statuts d'opposition, droits par canal (GAB, TPE, E-Commerce, 3DS) et vélocité horaire.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par PAN, Porteur, Statut..."
              className="form-control"
              style={{ width: "260px", paddingLeft: "2.2rem" }}
            />
            <span style={{ position: "absolute", left: "0.8rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", fontSize: "0.9rem" }}>
              🔍
            </span>
          </div>
          <button
            onClick={() =>
              onEditAccount({
                pan: "",
                masked_pan: "",
                exp: "2812",
                pin: "1234",
                balance: 500000,
                daily_spent: 0,
                daily_ceiling: 1000000,
                max_tx_limit: 300000,
                pin_tries: 0,
                status: "ACTIVE",
              })
            }
            className="btn btn-primary btn-glow"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
          >
            <span>➕</span>
            <span>Créer un Porteur / BIN de Prod</span>
          </button>
          <button onClick={onRefresh} className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <span>↺</span>
            <span>Actualiser MySQL</span>
          </button>
        </div>
      </div>

      <div className="table-container-enhanced">
        <table className="data-table-enhanced">
          <thead>
            <tr>
              <th style={{ width: "45px" }}>#</th>
              <th style={{ minWidth: "165px" }}>PAN MASQUÉ (PCI-DSS)</th>
              <th style={{ minWidth: "155px" }}>PORTEUR &amp; GAMME</th>
              <th style={{ width: "130px" }}>STATUT</th>
              <th style={{ width: "130px" }}>SOLDE DISPO</th>
              <th style={{ minWidth: "145px" }}>CUMUL 24H / PLAFOND</th>
              <th style={{ width: "165px" }}>CANAUX AUTORISÉS</th>
              <th style={{ width: "95px" }}>PIN / VÉLOCITÉ</th>
              <th style={{ minWidth: "160px" }}>NOTES MÉTIER</th>
              <th style={{ width: "85px", textAlign: "right" }}>ÉDITER</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((acc, idx) => {
              let statusPill = <span className="tag">{acc.status}</span>;
              if (acc.status === "ACTIVE") {
                statusPill = (
                  <span className="verdict-chip success">
                    <span className="chip-dot" /> ACTIVE
                  </span>
                );
              } else if (acc.status === "STOLEN") {
                statusPill = (
                  <span className="verdict-chip failed">
                    <span className="chip-dot" /> VOLÉE (43)
                  </span>
                );
              } else if (acc.status === "LOST") {
                statusPill = (
                  <span className="verdict-chip failed">
                    <span className="chip-dot" /> PERDUE (41)
                  </span>
                );
              } else if (acc.status === "CAPTURE") {
                statusPill = (
                  <span className="verdict-chip failed">
                    <span className="chip-dot" /> CAPTURE (04)
                  </span>
                );
              } else if (acc.status === "WATCHLIST") {
                statusPill = (
                  <span className="verdict-chip idle">
                    <span className="chip-dot" /> SURVEILLÉE (01)
                  </span>
                );
              } else if (acc.status === "SUSPENDED") {
                statusPill = (
                  <span className="verdict-chip idle">
                    <span className="chip-dot" /> BLOQUÉE (57)
                  </span>
                );
              }

              const allowAtm = acc.channel_gab_enabled ?? acc.allow_atm ?? true;
              const allowPos = acc.channel_tpe_enabled ?? acc.allow_pos ?? true;
              const allowEcom = acc.channel_ecom_enabled ?? acc.allow_ecom ?? true;
              const threeds = acc.threeds_enrolled ?? true;
              const txHour = acc.velocity_tx_1h ?? acc.tx_count_hour ?? 0;
              const maxHour = acc.velocity_max_1h ?? acc.max_tx_per_hour ?? 5;

              return (
                <tr key={acc.pan}>
                  <td style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{idx + 1}</td>
                  <td>
                    <span className="card-pan-cell font-mono" style={{ fontSize: "0.78rem" }}>
                      <strong>{acc.masked_pan}</strong>
                    </span>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      Exp: {acc.exp} • PIN: {acc.pin || "1234"} • CVV2: ***
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text-primary)" }}>
                      {acc.cardholder_name || `PORTEUR #${idx + 1}`}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                      {acc.card_product || "VISA CLASSIC"}
                    </div>
                  </td>
                  <td>{statusPill}</td>
                  <td className="amount-cell">{acc.balance.toLocaleString()} F</td>
                  <td className="font-mono" style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    <span style={{ color: acc.daily_spent > 0 ? "#b45309" : "inherit", fontWeight: acc.daily_spent > 0 ? 700 : 400 }}>
                      {acc.daily_spent.toLocaleString()}
                    </span>{" "}
                    / {(acc.daily_ceiling / 1000).toFixed(0)}k F
                    <div style={{ fontSize: "0.68rem", color: "var(--text-dim)" }}>
                      Max/Tx: {acc.max_tx_limit.toLocaleString()} F
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                      <span
                        className="tag font-mono"
                        style={{
                          fontSize: "0.65rem",
                          padding: "1px 5px",
                          background: allowAtm ? "#ecfdf5" : "#fef2f2",
                          borderColor: allowAtm ? "#a7f3d0" : "#fecdd3",
                          color: allowAtm ? "#047857" : "#b91c1c",
                        }}
                      >
                        GAB
                      </span>
                      <span
                        className="tag font-mono"
                        style={{
                          fontSize: "0.65rem",
                          padding: "1px 5px",
                          background: allowPos ? "#ecfdf5" : "#fef2f2",
                          borderColor: allowPos ? "#a7f3d0" : "#fecdd3",
                          color: allowPos ? "#047857" : "#b91c1c",
                        }}
                      >
                        TPE
                      </span>
                      <span
                        className="tag font-mono"
                        style={{
                          fontSize: "0.65rem",
                          padding: "1px 5px",
                          background: allowEcom ? "#ecfdf5" : "#fef2f2",
                          borderColor: allowEcom ? "#a7f3d0" : "#fecdd3",
                          color: allowEcom ? "#047857" : "#b91c1c",
                        }}
                      >
                        WEB
                      </span>
                      <span
                        className="tag font-mono"
                        style={{
                          fontSize: "0.65rem",
                          padding: "1px 5px",
                          background: threeds ? "#eff6ff" : "#f1f5f9",
                          borderColor: threeds ? "#bfdbfe" : "#cbd5e1",
                          color: threeds ? "#1d4ed8" : "#64748b",
                        }}
                      >
                        3DS
                      </span>
                    </div>
                  </td>
                  <td className="font-mono" style={{ fontSize: "0.75rem" }}>
                    <div style={{ color: acc.pin_tries >= 3 ? "#b91c1c" : "var(--text-secondary)", fontWeight: acc.pin_tries >= 3 ? 700 : 400 }}>
                      PIN: {acc.pin_tries}/3
                    </div>
                    <div style={{ color: txHour >= maxHour ? "#b45309" : "var(--text-dim)", fontSize: "0.7rem" }}>
                      Vel: {txHour}/{maxHour}h
                    </div>
                  </td>
                  <td>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{acc.notes || "—"}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      onClick={() => onEditAccount(acc)}
                      className="btn-action-test"
                      title="Modifier ce porteur dans MySQL"
                    >
                      <span>✏️</span> Éditer
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
