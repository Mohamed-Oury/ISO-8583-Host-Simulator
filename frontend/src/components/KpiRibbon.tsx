"use client";

import { SystemStatus } from "@/lib/api";

interface KpiRibbonProps {
  status: SystemStatus | null;
}

export default function KpiRibbon({ status }: KpiRibbonProps) {
  const totalTx = status?.total_requests ?? 0;
  const approved = status?.approved ?? 0;
  const rejected = status?.rejected ?? 0;
  const total = approved + rejected;
  const rate = total > 0 ? ((approved / total) * 100).toFixed(1) : "100.0";
  const pool = status?.total_balance_pool ?? 50827000;
  const lastLat = status?.last_latency_ms ?? 0.2;

  const gabCount = status?.requests_gab ?? 0;
  const tpeCount = status?.requests_tpe ?? 0;
  const ecomCount = status?.requests_ecom ?? 0;
  const reversals = status?.requests_0400 ?? 0;
  const autoRev = status?.auto_reversals ?? 0;

  return (
    <section className="kpi-ribbon">
      {/* 1. Transactions Multi-Canaux */}
      <div className="kpi-card">
        <div className="kpi-card-inner">
          <div className="kpi-header">
            <div className="kpi-icon-box primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span className="kpi-chip">GAB • TPE • E-Com</span>
          </div>

          <div className="kpi-content">
            <div className="kpi-label">Transactions Traitées</div>
            <div className="kpi-value">{totalTx.toLocaleString()}</div>
            <div className="kpi-footer">
              <span className="kpi-trend positive">
                <span className="pulse-dot-sm" />
                {lastLat > 0 ? `${lastLat.toFixed(2)} ms` : "0.20 ms"}
              </span>
              <span className="kpi-sub-text">
                🏧 {gabCount} • 💳 {tpeCount} • 🌐 {ecomCount}
              </span>
            </div>
          </div>
        </div>
        <div className="kpi-accent-bar primary" />
      </div>

      {/* 2. Taux d'Approbation */}
      <div className="kpi-card success">
        <div className="kpi-card-inner">
          <div className="kpi-header">
            <div className="kpi-icon-box success">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <span className="kpi-chip success">Code 00</span>
          </div>

          <div className="kpi-content">
            <div className="kpi-label">Taux d'Approbation</div>
            <div className="kpi-value highlight-emerald">{rate}%</div>
            <div className="kpi-footer">
              <span className="kpi-trend success">✓ {approved.toLocaleString()}</span>
              <span className="kpi-sub-text">autorisations validées</span>
            </div>
          </div>
        </div>
        <div className="kpi-accent-bar success" />
      </div>

      {/* 3. Refus & Annulations 0400 */}
      <div className="kpi-card danger">
        <div className="kpi-card-inner">
          <div className="kpi-header">
            <div className="kpi-icon-box danger">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <span className="kpi-chip danger">R00 → R13</span>
          </div>

          <div className="kpi-content">
            <div className="kpi-label">Refus &amp; Reversals</div>
            <div className="kpi-value">{rejected.toLocaleString()}</div>
            <div className="kpi-footer">
              <span className="kpi-trend neutral">↺ {reversals} (0400)</span>
              <span className="kpi-sub-text">dont {autoRev} auto-rev</span>
            </div>
          </div>
        </div>
        <div className="kpi-accent-bar danger" />
      </div>

      {/* 4. Référentiel MySQL & Parc GAB */}
      <div className="kpi-card pool">
        <div className="kpi-card-inner">
          <div className="kpi-header">
            <div className="kpi-icon-box pool">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <span className="kpi-chip pool">MySQL :8889</span>
          </div>

          <div className="kpi-content">
            <div className="kpi-label">Référentiel &amp; Parc GAB</div>
            <div className="kpi-value">
              {status?.total_accounts ?? 50} <span className="kpi-unit">Cartes • 3 GAB</span>
            </div>
            <div className="kpi-footer">
              <span className="kpi-trend emerald-badge">{(pool / 1_000_000).toFixed(2)}M FCFA</span>
              <span className="kpi-sub-text">liquidité porteurs</span>
            </div>
          </div>
        </div>
        <div className="kpi-accent-bar pool" />
      </div>
    </section>
  );
}
