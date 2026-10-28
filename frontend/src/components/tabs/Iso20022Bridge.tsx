"use client";

import { useState, useEffect } from "react";
import {
  convertIsoToXml,
  convertXmlToIso,
  fetchIso20022Mappings,
  Iso20022ConversionResult,
  Iso20022MappingItem,
} from "@/lib/api";

export default function Iso20022Bridge() {
  const [targetMsg, setTargetMsg] = useState<"pacs.008" | "pacs.002">("pacs.008");
  const [mti, setMti] = useState("0200");
  const [pan, setPan] = useState("4000123456780001");
  const [amount, setAmount] = useState(25000);
  const [stan, setStan] = useState("000001");
  const [currency, setCurrency] = useState("952");
  const [de39, setDe39] = useState("00");

  const [conversionResult, setConversionResult] = useState<Iso20022ConversionResult | null>(null);
  const [mappings, setMappings] = useState<Iso20022MappingItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reverse conversion
  const [xmlInput, setXmlInput] = useState("");
  const [reverseResult, setReverseResult] = useState<any>(null);

  useEffect(() => {
    fetchIso20022Mappings()
      .then((data) => setMappings(data.mappings || []))
      .catch(() => {});
    handleConvert();
  }, []);

  const handleConvert = async (overrideTarget?: "pacs.008" | "pacs.002", overrideDe39?: string) => {
    setIsLoading(true);
    const tgt = overrideTarget || targetMsg;
    const code = overrideDe39 !== undefined ? overrideDe39 : de39;
    try {
      const res = await convertIsoToXml({
        mti: tgt === "pacs.002" ? "0210" : "0200",
        pan,
        amount,
        currency,
        stan,
        de39: code,
        target_msg: tgt,
      });
      setConversionResult(res);
      setXmlInput(res.xml);
    } catch (err: any) {
      alert("Erreur de conversion ISO 20022 : " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadPreset = (preset: "purchase_008" | "atm_008" | "accp_002" | "rjct_51" | "rjct_68") => {
    if (preset === "purchase_008") {
      setTargetMsg("pacs.008");
      setAmount(25000);
      setDe39("00");
      handleConvert("pacs.008", "00");
    } else if (preset === "atm_008") {
      setTargetMsg("pacs.008");
      setAmount(50000);
      setDe39("00");
      handleConvert("pacs.008", "00");
    } else if (preset === "accp_002") {
      setTargetMsg("pacs.002");
      setDe39("00");
      handleConvert("pacs.002", "00");
    } else if (preset === "rjct_51") {
      setTargetMsg("pacs.002");
      setDe39("51");
      handleConvert("pacs.002", "51");
    } else if (preset === "rjct_68") {
      setTargetMsg("pacs.002");
      setDe39("68");
      handleConvert("pacs.002", "68");
    }
  };

  const handleCopyXml = () => {
    if (conversionResult?.xml) {
      navigator.clipboard.writeText(conversionResult.xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadXml = () => {
    if (!conversionResult?.xml) return;
    const blob = new Blob([conversionResult.xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${targetMsg}_${stan}_${Date.now()}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReverseConvert = async () => {
    if (!xmlInput.trim()) return;
    try {
      const res = await convertXmlToIso(xmlInput);
      setReverseResult(res);
    } catch (err: any) {
      alert("Erreur de parsing XML : " + err.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div className="pane-header">
        <div className="pane-header-main">
          <div className="pane-title-row">
            <span className="badge-chip highlight">MODERNISATION &amp; PAIEMENT INSTANTANÉ</span>
            <span className="badge-chip subtle">ISO 8583 ⇄ ISO 20022 XML</span>
            <span className="badge-chip success">GIM-UEMOA / SWIFT MX READY</span>
          </div>
          <h2 className="pane-title">Passerelle Bi-directionnelle ISO 8583 ⇄ ISO 20022</h2>
          <p className="pane-subtitle">
            Conversion en temps réel des transactions monétiques ISO 8583 (0200 / 0210) en messages XML ISO 20022 pour le Paiement Instantané interbancaire (pacs.008 Virement Client et pacs.002 Rapport de Statut), avec matrice de correspondance visuelle.
          </p>
        </div>
      </div>

      {/* Presets rapides */}
      <div className="card" style={{ padding: "0.85rem 1.25rem", background: "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)", border: "1px solid rgba(125, 21, 56, 0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--burgundy)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span>⚡</span>
            <span>Scénarios d'Homologation &amp; de Switch Interbancaire :</span>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            Cliquez pour charger la trame ISO 8583 et générer instantanément son équivalent XML ISO 20022
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <button type="button" onClick={() => handleLoadPreset("purchase_008")} className="preset-btn">
            🛍️ Achat TPE 25k ➔ pacs.008 (Virement Instantané)
          </button>
          <button type="button" onClick={() => handleLoadPreset("atm_008")} className="preset-btn">
            🏧 Retrait GAB 50k ➔ pacs.008 (Débit Porteur)
          </button>
          <button type="button" onClick={() => handleLoadPreset("accp_002")} className="preset-btn">
            ✅ Accord Hôte (00) ➔ pacs.002 ACCP (Règlement Validé)
          </button>
          <button type="button" onClick={() => handleLoadPreset("rjct_51")} className="preset-btn">
            ❌ Rejet Solde Insuffisant (51) ➔ pacs.002 RJCT (AM04)
          </button>
          <button type="button" onClick={() => handleLoadPreset("rjct_68")} className="preset-btn">
            ⏱️ Rejet Timeout (68) ➔ pacs.002 RJCT (TO01)
          </button>
        </div>
      </div>

      {/* Vue en Miroir Split-Screen */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: "1.25rem", alignItems: "start" }}>
        {/* Volet Gauche : Paramètres ISO 8583 */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Message Source ISO 8583</h3>
            <span className="tag">{targetMsg === "pacs.002" ? "0210 / 0110" : "0200 / 0100"}</span>
          </div>
          <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div>
              <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Type de message ISO 20022 cible :</label>
              <select
                value={targetMsg}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setTargetMsg(val);
                  handleConvert(val);
                }}
                className="form-control"
                style={{ marginTop: "0.3rem" }}
              >
                <option value="pacs.008">pacs.008.001.08 — Virement Client Interbancaire (Achat / Retrait)</option>
                <option value="pacs.002">pacs.002.001.10 — Rapport de Statut (Accord ACCP ou Rejet RJCT)</option>
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>PAN Carte (DE 2) :</label>
                <input
                  type="text"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  className="form-control font-mono"
                  style={{ marginTop: "0.3rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Montant FCFA (DE 4) :</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="form-control font-mono"
                  style={{ marginTop: "0.3rem" }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>STAN (DE 11) :</label>
                <input
                  type="text"
                  value={stan}
                  onChange={(e) => setStan(e.target.value)}
                  className="form-control font-mono"
                  style={{ marginTop: "0.3rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Devise (DE 49) :</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="form-control font-mono"
                  style={{ marginTop: "0.3rem" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Code Rép. (DE 39) :</label>
                <select
                  value={de39}
                  onChange={(e) => {
                    setDe39(e.target.value);
                    handleConvert(undefined, e.target.value);
                  }}
                  className="form-control font-mono"
                  style={{ marginTop: "0.3rem", fontWeight: 700 }}
                >
                  <option value="00">00 (Approuvé)</option>
                  <option value="05">05 (Ne pas honorer)</option>
                  <option value="51">51 (Solde insuffisant)</option>
                  <option value="54">54 (Carte expirée)</option>
                  <option value="55">55 (PIN erroné)</option>
                  <option value="68">68 (Timeout Hôte)</option>
                  <option value="91">91 (Switch inaccessible)</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleConvert()}
              disabled={isLoading}
              className="btn btn-primary btn-glow"
              style={{ justifyContent: "center", marginTop: "0.5rem" }}
            >
              <span>{isLoading ? "⏳" : "🔄"}</span>
              <span>Convertir en XML ISO 20022</span>
            </button>
          </div>
        </div>

        {/* Volet Droit : XML ISO 20022 Généré */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Document XML ISO 20022 Généré</h3>
              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                {conversionResult?.schema_type || "XML Schema pacs.008"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button type="button" onClick={handleCopyXml} className="btn btn-outline" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
                <span>{copied ? "✅" : "📋"}</span>
                <span>{copied ? "Copié !" : "Copier"}</span>
              </button>
              <button type="button" onClick={handleDownloadXml} className="btn btn-outline" style={{ fontSize: "0.75rem", padding: "0.3rem 0.6rem" }}>
                <span>💾</span>
                <span>Télécharger</span>
              </button>
            </div>
          </div>
          <div style={{ padding: "0.85rem" }}>
            <pre
              className="font-mono"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#0b132b",
                color: "#38bdf8",
                padding: "1rem",
                borderRadius: "8px",
                fontSize: "0.78rem",
                lineHeight: 1.5,
                maxHeight: "380px",
                overflowY: "auto",
                margin: 0,
                border: "1px solid #1e293b",
              }}
            >
              {conversionResult?.xml || "Génération en cours..."}
            </pre>
          </div>
        </div>
      </div>

      {/* Matrice de Correspondance des Champs ISO 8583 <-> ISO 20022 */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Matrice de Mappage Officielle ISO 8583 ⇄ ISO 20022</h3>
          <span className="tag" style={{ background: "#ecfdf5", color: "#065f46" }}>12 CHAMPS STANDARDS AUDITÉS</span>
        </div>
        <div style={{ padding: "0", overflowX: "auto" }}>
          <table className="table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                <th style={{ padding: "0.6rem 1rem", textAlign: "left", width: "12%" }}>Champ ISO 8583</th>
                <th style={{ padding: "0.6rem 1rem", textAlign: "left", width: "25%" }}>Libellé Monétique</th>
                <th style={{ padding: "0.6rem 1rem", textAlign: "left", width: "30%" }}>Équivalent XPath ISO 20022</th>
                <th style={{ padding: "0.6rem 1rem", textAlign: "left" }}>Bloc XML &amp; Règle Métier</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.de} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.55rem 1rem", fontWeight: 800, color: "var(--burgundy)", fontFamily: "var(--font-mono)" }}>
                    DE {m.de}
                  </td>
                  <td style={{ padding: "0.55rem 1rem", fontWeight: 600 }}>{m.name}</td>
                  <td style={{ padding: "0.55rem 1rem", color: "#0284c7", fontFamily: "var(--font-mono)", fontSize: "0.76rem" }}>
                    &lt;{m.iso20022_xpath}&gt;
                  </td>
                  <td style={{ padding: "0.55rem 1rem", color: "var(--text-secondary)", fontSize: "0.76rem" }}>
                    {m.desc} (<code>{m.xml_block}</code>)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
