"use client";

import { useState } from "react";
import {
  calculatePinBlock,
  calculateCvv,
  verifyArqc,
  executeThalesCommand,
  PinBlockResponse,
  CvvResponse,
  ArqcResponse,
  ThalesResponse,
} from "@/lib/api";

type CryptoTab = "pin" | "cvv" | "emv" | "thales";

export default function HsmCryptoStudio() {
  const [activeTab, setActiveTab] = useState<CryptoTab>("pin");

  // --- STATE PIN BLOCK ---
  const [pin, setPin] = useState("1234");
  const [pan, setPan] = useState("4000123456780001");
  const [pinFormat, setPinFormat] = useState("ISO-0");
  const [zpk, setZpk] = useState("1D2E3F4A5B6C7D8E9F0A1B2C3D4E5F6A");
  const [pinResult, setPinResult] = useState<PinBlockResponse | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");

  // Mode Traduction
  const [isTranslating, setIsTranslating] = useState(false);
  const [destZpk, setDestZpk] = useState("FEDCBA9876543210FEDCBA9876543210");
  const [translationResult, setTranslationResult] = useState<any>(null);

  // --- STATE CVV ---
  const [cvvPan, setCvvPan] = useState("4000123456780001");
  const [cvvExp, setCvvExp] = useState("2812");
  const [serviceCode, setServiceCode] = useState("101");
  const [cvk, setCvk] = useState("FEDCBA9876543210FEDCBA9876543210");
  const [cvvResult, setCvvResult] = useState<CvvResponse | null>(null);
  const [cvvLoading, setCvvLoading] = useState(false);

  // --- STATE ARQC / ARPC ---
  const [emvPan, setEmvPan] = useState("4000123456780001");
  const [atc, setAtc] = useState("0042");
  const [un, setUn] = useState("87A14F23");
  const [amountHex, setAmountHex] = useState("000000025000");
  const [tvr, setTvr] = useState("0000000000");
  const [arqcProvided, setArqcProvided] = useState("A1B2C3D4E5F67890");
  const [arc, setArc] = useState("00");
  const [arqcResult, setArqcResult] = useState<ArqcResponse | null>(null);
  const [arqcLoading, setArqcLoading] = useState(false);

  // --- STATE THALES CONSOLE ---
  const [thalesCmd, setThalesCmd] = useState("NO");
  const [thalesHistory, setThalesHistory] = useState<Array<{ cmd: string; resp: any; timestamp: string }>>([
    {
      cmd: "NO",
      resp: {
        command: "NO",
        response_code: "NP",
        error_code: "00",
        hsm_status: "ONLINE",
        model: "Thales payShield 10K - Host Security Module",
        firmware: "v2.4a (B99-PCI-HSM-v3)",
        lmk_check_value: "A89F12",
        raw_response: "NP00A89F12",
      },
      timestamp: "12:00:00",
    },
  ]);
  const [thalesLoading, setThalesLoading] = useState(false);

  // Handlers
  const handleCalculatePin = async () => {
    setPinLoading(true);
    setPinError("");
    try {
      if (isTranslating && pinResult?.encrypted_pin_block) {
        const res = await calculatePinBlock({
          pin,
          pan,
          format: pinFormat,
          zpk,
          dest_zpk: destZpk,
          encrypted_block: pinResult.encrypted_pin_block,
        });
        setTranslationResult(res);
      } else {
        const res = await calculatePinBlock({ pin, pan, format: pinFormat, zpk });
        setPinResult(res);
      }
    } catch (err: any) {
      setPinError(err.message || "Erreur de calcul PIN");
    } finally {
      setPinLoading(false);
    }
  };

  const handleCalculateCvv = async () => {
    setCvvLoading(true);
    try {
      const res = await calculateCvv({ pan: cvvPan, exp: cvvExp, service_code: serviceCode, cvk });
      setCvvResult(res);
    } catch (err) {
      alert("Erreur de calcul CVV");
    } finally {
      setCvvLoading(false);
    }
  };

  const handleVerifyArqc = async () => {
    setArqcLoading(true);
    try {
      const res = await verifyArqc({
        pan: emvPan,
        atc,
        unpredictable_number: un,
        amount_hex: amountHex,
        tvr,
        arqc_provided: arqcProvided,
        arc,
      });
      setArqcResult(res);
    } catch (err) {
      alert("Erreur de vérification ARQC");
    } finally {
      setArqcLoading(false);
    }
  };

  const handleSendThalesCommand = async (cmdToSend?: string) => {
    const command = cmdToSend || thalesCmd;
    setThalesLoading(true);
    try {
      const res = await executeThalesCommand(command);
      setThalesHistory((prev) => [
        {
          cmd: command,
          resp: res,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 19),
      ]);
    } catch (err) {
      alert("Erreur de commande Thales");
    } finally {
      setThalesLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header */}
      <div className="pane-header">
        <div className="pane-header-main">
          <div className="pane-title-row">
            <span className="badge-chip highlight">SÉCURITÉ &amp; CRYPTOGRAPHIE BANCAIRE</span>
            <span className="badge-chip subtle">THALES PAYSHIELD 10K • ANSI X9.8 • EMV BOOK 2</span>
            <span className="badge-chip success">PCI-DSS v4.0 SAD READY</span>
          </div>
          <h2 className="pane-title">Studio Cryptographique &amp; Émulateur HSM</h2>
          <p className="pane-subtitle">
            Calcul et validation des blocs PIN (ISO-0, ISO-1, ISO-3), dérivation des clés de session ZPK, contrôle CVV/CVV2/iCVV, vérification des cryptogrammes de puce EMV (ARQC / ARPC) et console de commandes Thales payShield 10K.
          </p>
        </div>
      </div>

      {/* Navigation Onglets */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setActiveTab("pin")}
          className={`btn ${activeTab === "pin" ? "btn-primary btn-glow" : "btn-outline"}`}
          style={{ fontSize: "0.82rem" }}
        >
          <span>🔢</span>
          <span>1. Calculateur &amp; Traducteur PIN Block</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("cvv")}
          className={`btn ${activeTab === "cvv" ? "btn-primary btn-glow" : "btn-outline"}`}
          style={{ fontSize: "0.82rem" }}
        >
          <span>💳</span>
          <span>2. Vérificateur CVV / CVV2 / iCVV</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("emv")}
          className={`btn ${activeTab === "emv" ? "btn-primary btn-glow" : "btn-outline"}`}
          style={{ fontSize: "0.82rem" }}
        >
          <span>🛡️</span>
          <span>3. Laboratoire Puce EMV ARQC &amp; ARPC</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("thales")}
          className={`btn ${activeTab === "thales" ? "btn-primary btn-glow" : "btn-outline"}`}
          style={{ fontSize: "0.82rem" }}
        >
          <span>🖥️</span>
          <span>4. Console Directe Thales payShield 10K</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : PIN BLOCK CALCULATOR & TRANSLATOR */}
      {/* ========================================================================= */}
      {activeTab === "pin" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr", gap: "1.25rem", alignItems: "start" }}>
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Paramètres du Bloc PIN</h3>
              <span className="tag">{pinFormat}</span>
            </div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Format PIN Block standard :</label>
                <select
                  value={pinFormat}
                  onChange={(e) => setPinFormat(e.target.value)}
                  className="form-control"
                  style={{ marginTop: "0.3rem" }}
                >
                  <option value="ISO-0">Format ISO-0 / ANSI X9.8 (Le plus répandu : Bloc PIN XOR PAN)</option>
                  <option value="ISO-1">Format ISO-1 (Paiement sans PAN ou E-Commerce)</option>
                  <option value="ISO-3">Format ISO-3 (Similaire ISO-0 avec padding pseudo-aléatoire)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Code PIN en clair :</label>
                  <input
                    type="password"
                    maxLength={12}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="form-control font-mono"
                    style={{ marginTop: "0.3rem", letterSpacing: "0.2em", fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Numéro de Carte (PAN) :</label>
                  <input
                    type="text"
                    maxLength={19}
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    className="form-control font-mono"
                    style={{ marginTop: "0.3rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Clé ZPK (Zone PIN Key - 32 Hex) :</label>
                <input
                  type="text"
                  value={zpk}
                  onChange={(e) => setZpk(e.target.value)}
                  className="form-control font-mono"
                  style={{ marginTop: "0.3rem", fontSize: "0.8rem" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="chkTranslate"
                  checked={isTranslating}
                  onChange={(e) => setIsTranslating(e.target.checked)}
                />
                <label htmlFor="chkTranslate" style={{ fontSize: "0.8rem", fontWeight: 600, cursor: "pointer" }}>
                  Activer la Traduction ZPK Acquéreur ➔ ZPK Émetteur (Commande Thales 'CC')
                </label>
              </div>

              {isTranslating && (
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--burgundy)" }}>ZPK Émetteur de Destination :</label>
                  <input
                    type="text"
                    value={destZpk}
                    onChange={(e) => setDestZpk(e.target.value)}
                    className="form-control font-mono"
                    style={{ marginTop: "0.3rem", fontSize: "0.8rem" }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleCalculatePin}
                disabled={pinLoading}
                className="btn btn-primary btn-glow"
                style={{ justifyContent: "center", marginTop: "0.5rem" }}
              >
                <span>{pinLoading ? "⏳" : "⚡"}</span>
                <span>{isTranslating ? "Traduire le Bloc PIN (Commande CC)" : "Générer & Chiffrer le Bloc PIN"}</span>
              </button>

              {pinError && (
                <div style={{ color: "#dc2626", fontSize: "0.8rem", background: "#fef2f2", padding: "0.5rem", borderRadius: "6px" }}>
                  ⚠️ {pinError}
                </div>
              )}
            </div>
          </div>

          {/* Résultat PIN */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Dissection Cryptographique du Bloc PIN</h3>
              <span className="tag" style={{ background: "#ecfdf5", color: "#065f46" }}>CONFORME ANSI X9.8</span>
            </div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {pinResult ? (
                <>
                  <div style={{ background: "#0b132b", color: "#38bdf8", padding: "1rem", borderRadius: "8px", fontFamily: "var(--font-mono)" }}>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "0.25rem" }}>BLOC PIN EN CLAIR (16 CARACTÈRES HEX = 8 OCTETS) :</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.15em", color: "#38bdf8" }}>
                      {pinResult.clear_pin_block}
                    </div>
                  </div>

                  <div style={{ background: "#1e1b4b", color: "#a5b4fc", padding: "1rem", borderRadius: "8px", fontFamily: "var(--font-mono)" }}>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "0.25rem" }}>BLOC PIN CHIFFRÉ SOUS ZPK (CHAMP ISO 8583 DE 52) :</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.15em", color: "#818cf8" }}>
                      {pinResult.encrypted_pin_block}
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8rem", background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.4rem", color: "var(--text-primary)" }}>Miroir de Décomposition ANSI X9.8 :</div>
                    <ul style={{ paddingLeft: "1.2rem", margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      <li><strong>Bloc 1 (PIN) :</strong> <code>0{pinResult.pin_length}{pin.padEnd(14, "F")}</code></li>
                      <li><strong>Bloc 2 (PAN) :</strong> <code>0000{pan.slice(-13, -1)}</code> (12 derniers chiffres sans Luhn)</li>
                      <li><strong>Opération :</strong> <code>Bloc 1 XOR Bloc 2 ➔ {pinResult.clear_pin_block}</code></li>
                      <li><strong>Chiffrement 3DES :</strong> <code>Triple-DES(ZPK, Bloc) ➔ DE 52 = {pinResult.encrypted_pin_block}</code></li>
                    </ul>
                  </div>

                  {translationResult && (
                    <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", padding: "0.85rem", borderRadius: "8px" }}>
                      <div style={{ fontWeight: 800, color: "#166534", marginBottom: "0.3rem" }}>✅ Traduction Thales 'CC' Réussie :</div>
                      <div style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "#15803d" }}>
                        Nouveau bloc DE 52 sous ZPK Dest : <strong>{translationResult.translated_encrypted}</strong>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🔐</div>
                  <div>Cliquez sur <strong>« Générer &amp; Chiffrer »</strong> pour visualiser la dissection cryptographique du bloc PIN.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : STUDIO CVV / CVV2 / iCVV */}
      {/* ========================================================================= */}
      {activeTab === "cvv" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr", gap: "1.25rem", alignItems: "start" }}>
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Paramètres de Sécurité CVV</h3>
              <span className="tag">VISA / MASTERCARD</span>
            </div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>PAN Carte Bancaire :</label>
                <input
                  type="text"
                  value={cvvPan}
                  onChange={(e) => setCvvPan(e.target.value)}
                  className="form-control font-mono"
                  style={{ marginTop: "0.3rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Date Expiration (YYMM) :</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={cvvExp}
                    onChange={(e) => setCvvExp(e.target.value)}
                    className="form-control font-mono"
                    style={{ marginTop: "0.3rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Code Service (Piste 2) :</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={serviceCode}
                    onChange={(e) => setServiceCode(e.target.value)}
                    className="form-control font-mono"
                    style={{ marginTop: "0.3rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Clé CVK (Card Verification Key - 32 Hex) :</label>
                <input
                  type="text"
                  value={cvk}
                  onChange={(e) => setCvk(e.target.value)}
                  className="form-control font-mono"
                  style={{ marginTop: "0.3rem", fontSize: "0.8rem" }}
                />
              </div>

              <button
                type="button"
                onClick={handleCalculateCvv}
                disabled={cvvLoading}
                className="btn btn-primary btn-glow"
                style={{ justifyContent: "center", marginTop: "0.5rem" }}
              >
                <span>{cvvLoading ? "⏳" : "⚡"}</span>
                <span>Calculer les Cryptogrammes CVV / CVV2 / iCVV</span>
              </button>
            </div>
          </div>

          {/* Résultat CVV */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Résultats de Dérivation Cryptographique</h3>
              <span className="tag" style={{ background: "#ecfdf5", color: "#065f46" }}>DOUBLE CLÉ DEA-3</span>
            </div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {cvvResult ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                    <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 700 }}>CVV (PISTE 2 GAB/TPE)</div>
                      <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "var(--burgundy)", fontFamily: "var(--font-mono)" }}>
                        {cvvResult.cvv}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Service Code {serviceCode}</div>
                    </div>

                    <div style={{ background: "#fff1f2", border: "1.5px solid #fecdd3", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.72rem", color: "#9f1239", fontWeight: 700 }}>CVV2 (E-COMMERCE DOS)</div>
                      <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#e11d48", fontFamily: "var(--font-mono)" }}>
                        {cvvResult.cvv2}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#9f1239" }}>Service Code 000 (3DS / DE 48)</div>
                    </div>

                    <div style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", padding: "1rem", borderRadius: "8px", textAlign: "center" }}>
                      <div style={{ fontSize: "0.72rem", color: "#166534", fontWeight: 700 }}>iCVV (PUCE EMV)</div>
                      <div style={{ fontSize: "1.8rem", fontWeight: 900, color: "#16a34a", fontFamily: "var(--font-mono)" }}>
                        {cvvResult.icvv}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#166534" }}>Service Code 999 (Anti-clonage)</div>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8rem", background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>🛡️ Règles Métier Anti-Fraude &amp; PCI-DSS :</div>
                    <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      L'<strong>iCVV</strong> inscrit dans la puce EMV empêche la création d'une fausse piste magnétique. Si un fraudeur copie la piste de la puce et tente de payer sur un TPE piste, le serveur d'autorisation détectera que l'iCVV ne correspond pas au CVV piste attendu et rejettera la transaction avec le code <strong>DE 39 = 82 (CVV Failure)</strong>.
                    </p>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>💳</div>
                  <div>Cliquez sur <strong>« Calculer »</strong> pour dériver les valeurs CVV, CVV2 et iCVV.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : LABORATOIRE ARQC & ARPC EMV */}
      {/* ========================================================================= */}
      {activeTab === "emv" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.3fr", gap: "1.25rem", alignItems: "start" }}>
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Vérification ARQC &amp; Calcul ARPC (DE 55)</h3>
              <span className="tag">EMV 4.3 BOOK 2</span>
            </div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>PAN Carte EMV :</label>
                  <input
                    type="text"
                    value={emvPan}
                    onChange={(e) => setEmvPan(e.target.value)}
                    className="form-control font-mono"
                    style={{ marginTop: "0.3rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Compteur ATC (Tag 9F36) :</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={atc}
                    onChange={(e) => setAtc(e.target.value)}
                    className="form-control font-mono"
                    style={{ marginTop: "0.3rem" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Nombre Aléatoire UN (Tag 9F37) :</label>
                  <input
                    type="text"
                    maxLength={8}
                    value={un}
                    onChange={(e) => setUn(e.target.value)}
                    className="form-control font-mono"
                    style={{ marginTop: "0.3rem" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>TVR Terminal (Tag 95) :</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={tvr}
                    onChange={(e) => setTvr(e.target.value)}
                    className="form-control font-mono"
                    style={{ marginTop: "0.3rem" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>ARQC Fourni par la Puce (Tag 9F26) :</label>
                <input
                  type="text"
                  value={arqcProvided}
                  onChange={(e) => setArqcProvided(e.target.value)}
                  className="form-control font-mono"
                  style={{ marginTop: "0.3rem", fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-secondary)" }}>Code Action Émetteur ARC (Tag 8A) :</label>
                <select
                  value={arc}
                  onChange={(e) => setArc(e.target.value)}
                  className="form-control"
                  style={{ marginTop: "0.3rem" }}
                >
                  <option value="00">00 — Autorisation Accordée (Approval)</option>
                  <option value="05">05 — Ne pas Honorer (Do Not Honor)</option>
                  <option value="51">51 — Provision Insuffisante (Insufficient Funds)</option>
                  <option value="Z3">Z3 — Incapable d'Autoriser en Ligne</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleVerifyArqc}
                disabled={arqcLoading}
                className="btn btn-primary btn-glow"
                style={{ justifyContent: "center", marginTop: "0.5rem" }}
              >
                <span>{arqcLoading ? "⏳" : "⚡"}</span>
                <span>Vérifier ARQC &amp; Générer Cryptogramme ARPC</span>
              </button>
            </div>
          </div>

          {/* Résultat EMV */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Audit &amp; Verdict d'Authentification Puce</h3>
              <span className="tag" style={{ background: arqcResult?.is_arqc_valid ? "#ecfdf5" : "#fef2f2", color: arqcResult?.is_arqc_valid ? "#065f46" : "#991b1b" }}>
                {arqcResult?.verdict || "EN ATTENTE"}
              </span>
            </div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {arqcResult ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.85rem", background: arqcResult.is_arqc_valid ? "#f0fdf4" : "#fef2f2", borderRadius: "8px", border: `1.5px solid ${arqcResult.is_arqc_valid ? "#86efac" : "#fca5a5"}` }}>
                    <span style={{ fontSize: "1.8rem" }}>{arqcResult.is_arqc_valid ? "✅" : "❌"}</span>
                    <div>
                      <div style={{ fontWeight: 800, color: arqcResult.is_arqc_valid ? "#166534" : "#991b1b" }}>
                        {arqcResult.is_arqc_valid ? "ARQC AUTHENTIFIÉ AVEC SUCCÈS" : "ANOMALIE DE CRYPTOGRAMME PUCE"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: arqcResult.is_arqc_valid ? "#15803d" : "#b91c1c" }}>
                        La puce est authentique et la clé dérivée UDK/SK_AC est intègre.
                      </div>
                    </div>
                  </div>

                  <div style={{ background: "#0b132b", color: "#38bdf8", padding: "1rem", borderRadius: "8px", fontFamily: "var(--font-mono)" }}>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "0.25rem" }}>CRYPTOGRAMME DE RÉPONSE ARPC (TAG EMV 91 À RETOURNER DANS DE 55) :</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 800, letterSpacing: "0.15em", color: "#4ade80" }}>
                      {arqcResult.generated_arpc}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.3rem" }}>
                      Calculé sous Method 1 : 3DES(SK_AC, ARQC ⊕ (ARC || 000000000000))
                    </div>
                  </div>

                  <div style={{ fontSize: "0.8rem", background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.3rem" }}>Détails des clés de session :</div>
                    <ul style={{ paddingLeft: "1.2rem", margin: 0, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                      <li><strong>Clé de Session Dérivée :</strong> <code>{arqcResult.session_key_sk_ac_masked}</code></li>
                      <li><strong>Code Action Retour (ARC) :</strong> <code>{arqcResult.action_code_arc}</code> (Tag 8A)</li>
                    </ul>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🛡️</div>
                  <div>Cliquez sur <strong>« Vérifier ARQC »</strong> pour tester la validation de puce EMV.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 4 : CONSOLE DIRECTE THALES PAYSHIELD 10K */}
      {/* ========================================================================= */}
      {activeTab === "thales" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.25rem", alignItems: "start" }}>
          <div className="card">
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span className="status-indicator-dot" />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Console Interactive Thales payShield 10K</h3>
              </div>
              <span className="tag" style={{ background: "#ecfdf5", color: "#065f46" }}>PORT HSM 1500 ONLINE</span>
            </div>
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  value={thalesCmd}
                  onChange={(e) => setThalesCmd(e.target.value.toUpperCase())}
                  placeholder="Tapez une commande (ex: NO, FA, CW, CY, CA)..."
                  className="form-control font-mono"
                  style={{ fontSize: "0.95rem", letterSpacing: "0.08em", fontWeight: 700 }}
                />
                <button
                  type="button"
                  onClick={() => handleSendThalesCommand()}
                  disabled={thalesLoading}
                  className="btn btn-primary btn-glow"
                  style={{ minWidth: "110px", justifyContent: "center" }}
                >
                  {thalesLoading ? "..." : "Envoyer"}
                </button>
              </div>

              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>Commandes Thales Prédéfinies :</label>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                  <button type="button" onClick={() => handleSendThalesCommand("NO")} className="preset-btn">
                    NO (Ping / Diag)
                  </button>
                  <button type="button" onClick={() => handleSendThalesCommand("FA")} className="preset-btn">
                    FA (Générer Clé ZPK)
                  </button>
                  <button type="button" onClick={() => handleSendThalesCommand("CY40001234567800012812101")} className="preset-btn">
                    CY (Calculer CVV)
                  </button>
                  <button type="button" onClick={() => handleSendThalesCommand("CW")} className="preset-btn">
                    CW (Verify ARQC)
                  </button>
                  <button type="button" onClick={() => handleSendThalesCommand("CA")} className="preset-btn">
                    CA (Translate PIN ZPK-&gt;LMK)
                  </button>
                </div>
              </div>

              {/* Terminal Logs */}
              <div
                style={{
                  background: "#0b132b",
                  borderRadius: "8px",
                  padding: "1rem",
                  minHeight: "260px",
                  maxHeight: "360px",
                  overflowY: "auto",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.78rem",
                  color: "#38bdf8",
                  lineHeight: 1.6,
                }}
              >
                <div style={{ color: "#64748b", borderBottom: "1px solid #1e293b", paddingBottom: "0.4rem", marginBottom: "0.6rem" }}>
                  THALES PAYSHIELD 10K TCP CONSOLE • ACTIVE SESSION #HSM-CI-01
                </div>
                {thalesHistory.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: "0.8rem" }}>
                    <div style={{ color: "#94a3b8" }}>
                      <span style={{ color: "#4ade80" }}>[{item.timestamp}] &gt;</span> TX: <strong>{item.cmd}</strong>
                    </div>
                    <div style={{ color: "#f8fafc", paddingLeft: "1rem" }}>
                      RX: <strong style={{ color: "#38bdf8" }}>{item.resp.raw_response || JSON.stringify(item.resp)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Fiche Technique HSM */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Spécifications Hôte HSM</h3>
              <span className="tag">LMK COMPLIANT</span>
            </div>
            <div style={{ padding: "1.25rem", fontSize: "0.82rem", lineHeight: 1.6, color: "var(--text-secondary)" }}>
              <div style={{ marginBottom: "0.8rem" }}>
                <strong style={{ color: "var(--text-primary)" }}>Modèle Émulé :</strong> Thales payShield 10K (Firmware v2.4a)
              </div>
              <div style={{ marginBottom: "0.8rem" }}>
                <strong style={{ color: "var(--text-primary)" }}>Algorithmes Supportés :</strong> Triple-DES (EDE 2-Key &amp; 3-Key), AES-128/256, RSA 2048
              </div>
              <div style={{ marginBottom: "0.8rem" }}>
                <strong style={{ color: "var(--text-primary)" }}>Formats Blocs PIN :</strong> ANSI X9.8 (ISO-0), ISO-1, ISO-3, ECI
              </div>
              <div style={{ marginBottom: "0.8rem" }}>
                <strong style={{ color: "var(--text-primary)" }}>Réseaux Compatibles :</strong> GIM-UEMOA, VISA, Mastercard, SWIFT
              </div>
              <div style={{ background: "#f8fafc", padding: "0.85rem", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "1rem" }}>
                💡 <em>Astuce Expert Monétique : Les commandes Thales 'CW' et 'CA' sont celles appelées par le moteur d'autorisation lors de chaque transaction financière 0200 pour valider le code PIN ou la puce EMV.</em>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
