"use client";

import { useState, useEffect } from "react";
import {
  BankAccount,
  AtmTerminal,
  TransactionPayload,
  TransactionResponse,
  DecodedRawFrame,
  sendTransaction,
  fetchAccounts,
  fetchAtms,
  createAccount,
  decodeRawFrame,
  replayRawFrame,
} from "@/lib/api";

interface TerminalSimulatorProps {
  initialPreset?: string | null;
  onRefresh?: () => void;
}

const SAMPLE_PROD_TRACES = {
  tpe_ascii:
    "0200723C448000C09000164000123456780001000000000000015000102714094984920114094926102812541105100TPE00001MERCH_ABIDJAN019521234            ",
  gab_hex:
    "00893032303037323343343438303030433039303030313634303030313233343536373830303031303130303030303030303030303235303030313032373134303934393931303435353134303934393236313032383132363031313035313032474142303030303142414e4b5f41544d5f30303120202039353231323334202020202020202020202020",
  malformed_30: "0200ZZZZ_CORRUPTED_PROD_FRAME_TEST_DE39_30",
};

export default function TerminalSimulator({ initialPreset, onRefresh }: TerminalSimulatorProps) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [atms, setAtms] = useState<AtmTerminal[]>([]);

  const [channel, setChannel] = useState<"GAB" | "TPE" | "ECOM">("TPE");
  const [mti, setMti] = useState("0200");
  const [pan, setPan] = useState("4000123456780001");
  const [processingCode, setProcessingCode] = useState("000000");
  const [amount, setAmount] = useState(5000);
  const [currency, setCurrency] = useState("952");
  const [pin, setPin] = useState("1234");
  const [exp, setExp] = useState("2812");
  const [stan, setStan] = useState("000123");
  const [terminalId, setTerminalId] = useState("TPE00001");
  const [merchantId, setMerchantId] = useState("MERCH_ABIDJAN01");
  const [mcc, setMcc] = useState("5411");
  const [posEntryMode, setPosEntryMode] = useState("051");
  const [posConditionCode, setPosConditionCode] = useState("00");
  const [cvv2, setCvv2] = useState("123");
  const [threedsStatus, setThreedsStatus] = useState("Y");
  const [eci, setEci] = useState("05");
  const [de90, setDe90] = useState("");
  const [netCode, setNetCode] = useState("301");
  const [cashbackAmount, setCashbackAmount] = useState(5000);
  const [newPin, setNewPin] = useState("5678");

  const generateDe90 = () => {
    const origStan = stan || "000123";
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    const dt = `${mm}${dd}${hh}${min}${ss}`;
    const generated = `0200${origStan.padStart(6, "0")}${dt}${"00000000001".padEnd(11, "0")}${"00000000001".padEnd(11, "0")}`;
    setDe90(generated);
  };

  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<TransactionResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"runbook" | "fields" | "raw">("runbook");

  // Mode Rejeu / Décodage de Trame Brute ISO 8583 de Production
  const [showRawLab, setShowRawLab] = useState(false);
  const [rawFrameInput, setRawFrameInput] = useState(SAMPLE_PROD_TRACES.tpe_ascii);
  const [rawFormat, setRawFormat] = useState<"auto" | "ascii" | "hex">("auto");
  const [decodedPreview, setDecodedPreview] = useState<DecodedRawFrame | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [provisioningPan, setProvisioningPan] = useState(false);

  const loadContext = () => {
    fetchAccounts().then((d) => setAccounts(d.accounts)).catch(console.error);
    fetchAtms().then((d) => setAtms(d.atms)).catch(console.error);
  };

  useEffect(() => {
    loadContext();
  }, []);

  useEffect(() => {
    if (initialPreset) {
      applyPreset(initialPreset);
    }
  }, [initialPreset]);

  const switchChannelMode = (newChan: "GAB" | "TPE" | "ECOM") => {
    setChannel(newChan);
    if (newChan === "GAB") {
      setMti("0200");
      setProcessingCode("010000");
      setPosEntryMode("051");
      setPosConditionCode("02");
      setMcc("6011");
      setTerminalId("GAB00001");
      setMerchantId("BANK_ATM_001   ");
      if (amount % 1000 !== 0 || amount === 0) setAmount(20000);
    } else if (newChan === "TPE") {
      setMti("0200");
      setProcessingCode("000000");
      setPosEntryMode("051");
      setPosConditionCode("00");
      setMcc("5411");
      setTerminalId("TPE00001");
      setMerchantId("SUPERMARCHE_01 ");
    } else if (newChan === "ECOM") {
      setMti("0200");
      setProcessingCode("000000");
      setPosEntryMode("812");
      setPosConditionCode("59");
      setMcc("5732");
      setTerminalId("WEB00001");
      setMerchantId("BOUTIQUE_WEB_CI");
      setCvv2("123");
      setThreedsStatus("Y");
      setEci("05");
    }
  };

  const applyPreset = (preset: string) => {
    const randomStan = String(Math.floor(Math.random() * 900000) + 100000);
    setStan(randomStan);
    setCurrency("952");
    setExp("2812");
    setPin("1234");
    setCvv2("123");
    setThreedsStatus("Y");
    setEci("05");

    const p = preset.toLowerCase().replace("-", "");
    if (p === "0800" || p === "tc0800" || p === "echo") {
      setMti("0800");
      setNetCode("301");
      setPan("4000123456780001");
      setAmount(0);
    } else if (p === "logon" || p === "0800logon") {
      setMti("0800");
      setNetCode("001");
      setPan("4000123456780001");
      setAmount(0);
    } else if (p === "logoff" || p === "0800logoff") {
      setMti("0800");
      setNetCode("002");
      setPan("4000123456780001");
      setAmount(0);
    } else if (p === "keyexchange" || p === "0800key") {
      setMti("0800");
      setNetCode("101");
      setPan("4000123456780001");
      setAmount(0);
    } else if (p === "cutover" || p === "0800cutover") {
      setMti("0800");
      setNetCode("201");
      setPan("4000123456780001");
      setAmount(0);
    } else if (p === "0100" || p === "preauth") {
      switchChannelMode("TPE");
      setMti("0100");
      setProcessingCode("000000");
      setAmount(75000);
      setMcc("7011");
    } else if (p === "0120") {
      switchChannelMode("TPE");
      setMti("0120");
      setProcessingCode("000000");
      setAmount(75000);
      setMcc("7011");
    } else if (p === "0220" || p === "completion") {
      switchChannelMode("TPE");
      setMti("0220");
      setProcessingCode("000000");
      setAmount(75000);
      setMcc("7011");
    } else if (p === "0420" || p === "reversaladvice") {
      setMti("0420");
      setPan("4000123456780001");
      setAmount(20000);
      setDe90(`0200${randomStan}10261441000000000000100000000001`);
    } else if (p === "0400" || p === "tc0400") {
      setMti("0400");
      setPan("4000123456780001");
      setAmount(15000);
      setDe90(`0200${randomStan}10261441000000000000100000000001`);
    } else if (p === "refund" || p === "proc200000") {
      switchChannelMode("TPE");
      setMti("0200");
      setProcessingCode("200000");
      setAmount(10000);
    } else if (p === "cashback" || p === "proc090000") {
      switchChannelMode("TPE");
      setMti("0200");
      setProcessingCode("090000");
      setAmount(20000);
      setCashbackAmount(5000);
    } else if (p === "pinchange" || p === "proc900000") {
      switchChannelMode("GAB");
      setMti("0200");
      setProcessingCode("900000");
      setAmount(0);
      setNewPin("5678");
    } else if (p === "ministatement" || p === "proc380000") {
      switchChannelMode("GAB");
      setMti("0200");
      setProcessingCode("380000");
      setAmount(0);
    } else if (p === "transfer" || p === "proc400000") {
      switchChannelMode("GAB");
      setMti("0200");
      setProcessingCode("400000");
      setAmount(30000);
    } else if (p === "billpay" || p === "proc500000") {
      switchChannelMode("ECOM");
      setMti("0200");
      setProcessingCode("500000");
      setAmount(12500);
    } else if (p === "tc01") {
      switchChannelMode("TPE");
      setPan("4000123456780001");
      setAmount(5000);
    } else if (p === "tc02") {
      switchChannelMode("TPE");
      setPan("4000123456789999");
      setAmount(5000);
    } else if (p === "tc03") {
      switchChannelMode("TPE");
      setPan("4000123456780003");
      setAmount(5000);
    } else if (p === "tc04") {
      switchChannelMode("TPE");
      setPan("4000123456780002");
      setAmount(5000);
      setExp("2401");
    } else if (p === "tc05") {
      switchChannelMode("TPE");
      setPan("4000123456780001");
      setAmount(5000);
      setPin("0000");
    } else if (p === "tc06") {
      switchChannelMode("TPE");
      setPan("4000123456780004");
      setAmount(5000);
    } else if (p === "tc07") {
      switchChannelMode("TPE");
      setPan("4000123456780005");
      setAmount(50000);
    } else if (p === "tc08") {
      switchChannelMode("TPE");
      setPan("4000123456780006");
      setAmount(60000);
    } else if (p === "tc09") {
      switchChannelMode("TPE");
      setPan("4000123456780007");
      setAmount(30000);
    } else if (p === "tc10") {
      switchChannelMode("TPE");
      setPan("4000123456780001");
      setCurrency("840");
    } else if (p === "tc11") {
      switchChannelMode("GAB");
      setPan("4000123456780001");
      setAmount(25000);
    } else if (p === "tc12") {
      switchChannelMode("GAB");
      setPan("4000123456780001");
      setProcessingCode("310000");
      setAmount(0);
    } else if (p === "tc13") {
      switchChannelMode("GAB");
      setPan("4000123456780001");
      setProcessingCode("010000");
      setAmount(5500);
    } else if (p === "tc14") {
      switchChannelMode("TPE");
      setPan("4000123456780001");
      setPosEntryMode("071");
      setPin("");
      setAmount(10000);
    } else if (p === "tc15") {
      switchChannelMode("TPE");
      setPan("4000123456780001");
      setPosEntryMode("071");
      setPin("");
      setAmount(20000);
    } else if (p === "tc16") {
      switchChannelMode("TPE");
      setPan("4000123456780001");
      setPosEntryMode("801");
      setAmount(10000);
    } else if (p === "tc17") {
      switchChannelMode("ECOM");
      setPan("4000123456780001");
      setAmount(15000);
      setCvv2("123");
      setEci("05");
    } else if (p === "tc18") {
      switchChannelMode("ECOM");
      setPan("4000123456780001");
      setAmount(15000);
      setCvv2("999");
      setEci("05");
    } else if (p === "tc19") {
      switchChannelMode("ECOM");
      setPan("4000123456780001");
      setAmount(60000);
      setCvv2("123");
      setThreedsStatus("N");
      setEci("07");
    } else if (p === "tc20") {
      switchChannelMode("ECOM");
      setPan("4000123456780011");
      setAmount(10000);
    } else if (p === "tc21") {
      switchChannelMode("GAB");
      setPan("4000123456780012");
      setAmount(10000);
    } else if (p === "tc22") {
      switchChannelMode("TPE");
      setPan("4000123456780013");
      setAmount(5000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: TransactionPayload = {
      mti,
      pan: mti === "0800" ? "" : pan,
      processing_code: processingCode,
      amount: (processingCode === "310000" || processingCode === "380000" || processingCode === "900000" || mti === "0800") ? 0 : amount,
      currency,
      pin: posEntryMode === "071" || channel === "ECOM" || mti === "0800" ? "" : pin,
      exp,
      stan,
      terminal_id: terminalId,
      merchant_id: merchantId,
      mcc,
      pos_entry_mode: posEntryMode,
      pos_condition_code: posConditionCode,
      channel,
      cvv2: channel === "ECOM" ? cvv2 : "",
      threeds_status: channel === "ECOM" ? threedsStatus : "Y",
      eci: channel === "ECOM" ? eci : "05",
      de_90: (mti === "0400" || mti === "0420") ? de90 : null,
      net_code: mti === "0800" ? netCode : undefined,
      cashback_amount: processingCode === "090000" ? cashbackAmount : undefined,
      new_pin: processingCode === "900000" ? newPin : undefined,
    };

    try {
      const res = await sendTransaction(payload);
      setResponse(res);
      loadContext();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("Erreur lors de l'envoi : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecodeAndFill = async () => {
    setRawError(null);
    setLoading(true);
    try {
      const decoded = await decodeRawFrame(rawFrameInput, rawFormat);
      setDecodedPreview(decoded);
      const p = decoded.preset;
      if (p) {
        if (p.channel === "GAB" || p.channel === "TPE" || p.channel === "ECOM") {
          setChannel(p.channel);
        }
        if (p.mti) setMti(p.mti);
        if (p.pan) setPan(p.pan);
        if (p.processing_code) setProcessingCode(p.processing_code);
        if (typeof p.amount === "number") setAmount(p.amount);
        if (p.currency) setCurrency(p.currency);
        if (p.exp) setExp(p.exp);
        if (p.stan) setStan(p.stan);
        if (p.terminal_id) setTerminalId(p.terminal_id);
        if (p.merchant_id) setMerchantId(p.merchant_id);
        if (p.mcc) setMcc(p.mcc);
        if (p.pos_entry_mode) setPosEntryMode(p.pos_entry_mode);
        if (p.pos_condition_code) setPosConditionCode(p.pos_condition_code);
        if (p.cvv2) setCvv2(p.cvv2);
        if (p.threeds_status) setThreedsStatus(p.threeds_status);
        if (p.eci) setEci(p.eci);
        if (p.de_90) setDe90(p.de_90);
      }
    } catch (err: any) {
      setRawError(err.message || "Erreur de décodage de la trame brute");
    } finally {
      setLoading(false);
    }
  };

  const handleReplayRawOnSocket = async () => {
    setRawError(null);
    setLoading(true);
    try {
      const res = await replayRawFrame(rawFrameInput, rawFormat);
      setResponse(res);
      loadContext();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setRawError(err.message || "Erreur lors du rejeu sur socket TCP :5001");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickProvisionPan = async () => {
    const cleanPan = pan.replace(/\s+/g, "");
    if (cleanPan.length < 12) return;
    setProvisioningPan(true);
    try {
      await createAccount({
        pan: cleanPan,
        cardholder_name: `PORTEUR PROD (${cleanPan.slice(0, 6)})`,
        card_product: "VISA PROD CLONE",
        status: "ACTIVE",
        balance: 500000,
        daily_spent: 0,
        daily_ceiling: 1000000,
        max_tx_limit: 500000,
        exp: exp || "2812",
        pin: pin || "1234",
        cvv2: cvv2 || "123",
        allow_atm: true,
        allow_pos: true,
        allow_ecom: true,
        allow_international: true,
        threeds_enrolled: true,
        notes: "Porteur créé à la volée depuis le Simulateur de Cas de Prod",
      });
      loadContext();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert("Erreur création PAN MySQL : " + err.message);
    } finally {
      setProvisioningPan(false);
    }
  };

  const getFieldName = (de: string) => {
    const names: Record<string, string> = {
      "2": "Primary Account Number (PAN)",
      "3": "Processing Code (Opération)",
      "4": "Amount, Transaction",
      "7": "Transmission Date & Time",
      "11": "System Trace Audit Number (STAN)",
      "12": "Time, Local Transaction",
      "13": "Date, Local Transaction",
      "14": "Date, Expiration (YYMM)",
      "18": "Merchant Category Code (MCC)",
      "22": "POS Entry Mode (Puce/NFC/Web)",
      "25": "POS Condition Code",
      "32": "Acquiring Institution ID",
      "37": "Retrieval Reference Number (RRN)",
      "38": "Authorization ID Response (DE 38)",
      "39": "Response Code (DE 39)",
      "41": "Card Acceptor Terminal ID",
      "42": "Card Acceptor Merchant ID",
      "43": "Card Acceptor Name/Location",
      "48": "Additional Private Data (CVV2 / 3DS ECI)",
      "49": "Currency Code (952 = XOF)",
      "52": "PIN Data (ANSI X9.8)",
      "54": "Additional Amounts (Solde GAB)",
      "55": "EMV Chip ICC Data (TLV)",
      "64": "Message Authentication Code (MAC)",
      "70": "Network Management Code",
      "90": "Original Data Elements (Reversal)",
    };
    return names[de] || `Data Element ${de}`;
  };

  const isApproved = response?.response?.de39 === "00";
  const selectedAtm = atms.find((a) => a.terminal_id === terminalId);
  const selectedAccount = accounts.find((a) => a.pan === pan);
  const lb = response?.latency_breakdown;

  return (
    <div className="homologation-container">
      {/* Header & Presets */}
      <div className="pane-header-enhanced">
        <div className="pane-header-main">
          <div className="pane-title-group">
            <div className="pane-badge-wrapper">
              <span className="badge-chip emerald">
                <span className="status-indicator-dot" />
                MULTI-CANAL (GAB • TPE • E-COMMERCE)
              </span>
              <span className="badge-chip subtle">WATERFALL LATENCE &amp; RUNBOOKS EXPLOITANT</span>
            </div>
            <h2 className="pane-title">Simulateur de Paiement GAB, TPE &amp; E-Commerce</h2>
            <p className="pane-subtitle">
              Injection interactive de trames ISO 8583 sur socket TCP réelle avec sélection du canal d'acquisition, calcul des latences par maillon et diagnostic monétique.
            </p>
          </div>

          <div className="pane-actions-group">
            <button
              type="button"
              onClick={() => setShowRawLab((v) => !v)}
              className={`btn ${showRawLab ? "btn-primary btn-glow" : "btn-outline"}`}
              style={{
                borderColor: "var(--burgundy)",
                color: showRawLab ? "#ffffff" : "var(--burgundy)",
                fontWeight: 700,
              }}
            >
              <span>🧬</span>
              <span>{showRawLab ? "Masquer Décodeur Trame Prod" : "Rejouer / Décoder Trame Brute Prod"}</span>
            </button>
          </div>
        </div>

        <div className="pane-header-toolbar" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.6rem" }}>
          {/* Ligne 1 : MTI & Cycles de Transaction */}
          <div className="quick-presets" style={{ flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
            <span className="presets-label" style={{ minWidth: "125px", fontWeight: 700, color: "var(--burgundy)" }}>
              📨 MTI &amp; Cycles :
            </span>
            <button onClick={() => applyPreset("0100")} className="preset-btn" title="Demande de pré-autorisation hôtelière / caution">
              🏨 0100 Pré-Auto (00)
            </button>
            <button onClick={() => applyPreset("0120")} className="preset-btn" title="Avis d'autorisation différée">
              📨 0120 Auth Advice
            </button>
            <button onClick={() => applyPreset("tc11")} className="preset-btn" title="Débit standard immédiat">
              💳 0200 Débit Direct (00)
            </button>
            <button onClick={() => applyPreset("0220")} className="preset-btn" title="Confirmation de débit différée / Off-line">
              ✅ 0220 Completion Advice
            </button>
            <button onClick={() => applyPreset("0400")} className="preset-btn" title="Annulation immédiate sur incident technique">
              ↺ 0400 Reversal
            </button>
            <button onClick={() => applyPreset("0420")} className="preset-btn" title="Avis d'annulation répété jusqu'à acquittement">
              ↺ 0420 Reversal Advice
            </button>
          </div>

          {/* Ligne 2 : Gestion Réseau ISO 8583 (0800) */}
          <div className="quick-presets" style={{ flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
            <span className="presets-label" style={{ minWidth: "125px", fontWeight: 700, color: "#166534" }}>
              📡 Réseau (0800) :
            </span>
            <button onClick={() => applyPreset("0800")} className="preset-btn" title="Test de ligne / Heartbeat 301">
              💓 0800 Echo (DE 70=301)
            </button>
            <button onClick={() => applyPreset("logon")} className="preset-btn" title="Ouverture de session réseau 001">
              🔑 0800 Logon (001)
            </button>
            <button onClick={() => applyPreset("keyexchange")} className="preset-btn" title="Échange dynamique de clé ZPK sous ZMK">
              🔐 0800 Clé ZPK (101)
            </button>
            <button onClick={() => applyPreset("cutover")} className="preset-btn" title="Arrêté comptable journalier / Fin de journée">
              📊 0800 Cutover (201)
            </button>
            <button onClick={() => applyPreset("logoff")} className="preset-btn" title="Clôture de session réseau 002">
              🛑 0800 Logoff (002)
            </button>
          </div>

          {/* Ligne 3 : Opérations Bancaires Multi-Canaux */}
          <div className="quick-presets" style={{ flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
            <span className="presets-label" style={{ minWidth: "125px", fontWeight: 700, color: "#92400e" }}>
              🏦 Opérations (DE 3) :
            </span>
            <button onClick={() => applyPreset("tc12")} className="preset-btn" title="Consultation de solde DE 54">
              💰 Solde GAB (310000)
            </button>
            <button onClick={() => applyPreset("ministatement")} className="preset-btn" title="Mini-relevé des 10 dernières écritures">
              📜 Mini-Relevé GAB (380000)
            </button>
            <button onClick={() => applyPreset("refund")} className="preset-btn" title="Remboursement / Crédit compte porteur">
              ↩️ Remboursement (200000)
            </button>
            <button onClick={() => applyPreset("cashback")} className="preset-btn" title="Achat avec retrait d'espèces en caisse">
              💵 Achat + Cashback (090000)
            </button>
            <button onClick={() => applyPreset("pinchange")} className="preset-btn" title="Changement de code PIN porteur">
              🔢 Changement PIN (900000)
            </button>
            <button onClick={() => applyPreset("transfer")} className="preset-btn" title="Virement de compte à compte">
              ↔️ Virement (400000)
            </button>
            <button onClick={() => applyPreset("billpay")} className="preset-btn" title="Paiement de facture">
              🧾 Paiement Facture (500000)
            </button>
          </div>

          {/* Ligne 4 : Scénarios Cas Limites & Refus */}
          <div className="quick-presets" style={{ flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
            <span className="presets-label" style={{ minWidth: "125px", fontWeight: 700, color: "var(--text-secondary)" }}>
              🧪 Cas &amp; Refus :
            </span>
            <button onClick={() => applyPreset("tc13")} className="preset-btn">🏧 Coupure 5.5k (13)</button>
            <button onClick={() => applyPreset("tc14")} className="preset-btn">💳 NFC 10k (00)</button>
            <button onClick={() => applyPreset("tc15")} className="preset-btn">💳 NFC &gt;15k (65)</button>
            <button onClick={() => applyPreset("tc16")} className="preset-btn">💳 Fallback Piste (59)</button>
            <button onClick={() => applyPreset("tc17")} className="preset-btn">🌐 Web 3DS+CVV2 (00)</button>
            <button onClick={() => applyPreset("tc18")} className="preset-btn">🌐 Faux CVV2 (05)</button>
            <button onClick={() => applyPreset("tc19")} className="preset-btn">🌐 Sans 3DS &gt;25k (05)</button>
            <button onClick={() => applyPreset("tc21")} className="preset-btn">🚨 Capture Carte (04)</button>
            <button onClick={() => applyPreset("tc22")} className="preset-btn">🚨 Anti-Fraude Vélocité (59)</button>
          </div>
        </div>
      </div>

      {/* Laboratoire de Rejeu & Décodage de Trame Brute ISO 8583 de Production */}
      {showRawLab && (
        <div
          className="card"
          style={{
            marginBottom: "1.25rem",
            border: "1px solid rgba(125, 21, 56, 0.3)",
            background: "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)",
          }}
        >
          <div className="card-header" style={{ borderBottom: "1px solid rgba(125, 21, 56, 0.15)" }}>
            <div>
              <h3 style={{ color: "var(--burgundy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                🧬 Rejoueur &amp; Décodeur de Trame Brute ISO 8583 de Production (PayWay / Base24 / PowerCARD / Postilion)
              </h3>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                Collez une trace brute issue d'un log de production (ASCII ou Hexadécimal, avec ou sans l'entête TCP 2 octets Big-Endian) pour la décoder dans le formulaire ou l'injecter telle quelle sur le socket TCP <code>127.0.0.1:5001</code>.
              </p>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  setRawFrameInput(SAMPLE_PROD_TRACES.tpe_ascii);
                  setRawFormat("auto");
                }}
              >
                📄 Trace Prod TPE (ASCII)
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  setRawFrameInput(SAMPLE_PROD_TRACES.gab_hex);
                  setRawFormat("hex");
                }}
              >
                🔢 Dump TCP GAB (HEX)
              </button>
              <button
                type="button"
                className="preset-btn"
                onClick={() => {
                  setRawFrameInput(SAMPLE_PROD_TRACES.malformed_30);
                  setRawFormat("ascii");
                }}
              >
                💥 Trame Corrompue (Test DE 39=30)
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: "1rem", alignItems: "start" }}>
            <div>
              <textarea
                rows={3}
                value={rawFrameInput}
                onChange={(e) => setRawFrameInput(e.target.value)}
                className="form-control font-mono"
                style={{ fontSize: "0.78rem", width: "100%", resize: "vertical" }}
                placeholder="Collez ici la trame brute ISO 8583 (ex: 0200F23E... ou 303230304632...)"
              />
              {rawError && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#dc2626", fontWeight: 600 }}>
                  ⚠️ {rawError}
                </div>
              )}
              {decodedPreview && (
                <div
                  style={{
                    marginTop: "0.65rem",
                    padding: "0.65rem 0.85rem",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px solid var(--border-light)",
                    fontSize: "0.76rem",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.35rem" }}>
                    ✅ Trame décodée ({decodedPreview.payload_length_bytes} octets) — MTI <code>{decodedPreview.mti}</code> • Bitmap <code>{decodedPreview.bitmap_hex}</code> ({decodedPreview.de_details.length} Data Elements extraits et injectés dans le formulaire ci-dessous)
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {decodedPreview.de_details.map((d) => (
                      <span
                        key={d.de}
                        style={{
                          padding: "0.18rem 0.45rem",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "5px",
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.71rem",
                        }}
                      >
                        <strong>DE {d.de}</strong>: {d.masked_value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <select
                value={rawFormat}
                onChange={(e) => setRawFormat(e.target.value as "auto" | "ascii" | "hex")}
                className="form-control"
                style={{ fontSize: "0.78rem" }}
              >
                <option value="auto">Format : Auto-détection (ASCII / Hex)</option>
                <option value="ascii">Format : ASCII Brut</option>
                <option value="hex">Format : Hexadécimal (Dump TCP)</option>
              </select>

              <button
                type="button"
                onClick={handleDecodeAndFill}
                disabled={loading}
                className="btn"
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--burgundy)",
                  color: "var(--burgundy)",
                  fontWeight: 700,
                  fontSize: "0.78rem",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                🔍 Décoder &amp; Pré-remplir Formulaire
              </button>

              <button
                type="button"
                onClick={handleReplayRawOnSocket}
                disabled={loading}
                className="btn btn-primary"
                style={{
                  fontSize: "0.78rem",
                  padding: "0.6rem 0.75rem",
                }}
              >
                🚀 Rejouer sur Socket TCP :5001
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sélecteur de Canal (GAB / TPE / E-Commerce) — Style Clair MONETIQUE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1.25rem" }}>
        <button
          type="button"
          onClick={() => switchChannelMode("GAB")}
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            border: channel === "GAB" ? "2px solid var(--burgundy)" : "1px solid var(--border-light)",
            background: channel === "GAB" ? "var(--sg-red-50)" : "#ffffff",
            color: "var(--text-primary)",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            boxShadow: channel === "GAB" ? "0 4px 12px rgba(125, 21, 56, 0.12)" : "var(--shadow-sm)",
            transition: "all 0.2s ease",
          }}
        >
          <span style={{ fontSize: "2rem" }}>🏧</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: channel === "GAB" ? "var(--burgundy)" : "var(--text-primary)" }}>
              Canal GAB / ATM
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Retrait Billets (DE 3=010000), Solde (310000), Cassettes 10k/5k/2k
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => switchChannelMode("TPE")}
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            border: channel === "TPE" ? "2px solid var(--burgundy)" : "1px solid var(--border-light)",
            background: channel === "TPE" ? "var(--sg-red-50)" : "#ffffff",
            color: "var(--text-primary)",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            boxShadow: channel === "TPE" ? "0 4px 12px rgba(125, 21, 56, 0.12)" : "var(--shadow-sm)",
            transition: "all 0.2s ease",
          }}
        >
          <span style={{ fontSize: "2rem" }}>💳</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: channel === "TPE" ? "var(--burgundy)" : "var(--text-primary)" }}>
              Canal TPE Point de Vente
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              EMV Contact (051), Sans Contact NFC (071 &le; 15k), Fallback Piste (801)
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => switchChannelMode("ECOM")}
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "12px",
            border: channel === "ECOM" ? "2px solid var(--burgundy)" : "1px solid var(--border-light)",
            background: channel === "ECOM" ? "var(--sg-red-50)" : "#ffffff",
            color: "var(--text-primary)",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            boxShadow: channel === "ECOM" ? "0 4px 12px rgba(125, 21, 56, 0.12)" : "var(--shadow-sm)",
            transition: "all 0.2s ease",
          }}
        >
          <span style={{ fontSize: "2rem" }}>🌐</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: channel === "ECOM" ? "var(--burgundy)" : "var(--text-primary)" }}>
              Canal E-Commerce / En Ligne
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Paiement Web (DE 22=812), Vérification CVV2 (DE 48) &amp; 3-D Secure ECI
            </div>
          </div>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "1.5rem" }}>
        {/* Formulaire de saisie Multi-Canal */}
        <div className="card">
          <div className="card-header">
            <h3>Paramètres de la Transaction ({channel})</h3>
            <span className="tag">ISO 8583:1987</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group col-4">
                <label htmlFor="tpe-mti">MTI (Type de Message)</label>
                <select id="tpe-mti" value={mti} onChange={(e) => setMti(e.target.value)} className="form-control">
                  <optgroup label="Transactions Financières">
                    <option value="0200">0200 - Demande Débit / Achat / Retrait</option>
                    <option value="0220">0220 - Avis Financier (Advice / Completion)</option>
                  </optgroup>
                  <optgroup label="Autorisations &amp; Pré-autorisations">
                    <option value="0100">0100 - Demande d'Autorisation (Pré-Auth)</option>
                    <option value="0120">0120 - Avis d'Autorisation (Auth Advice)</option>
                  </optgroup>
                  <optgroup label="Annulations / Reversals">
                    <option value="0400">0400 - Demande d'Annulation (Reversal)</option>
                    <option value="0420">0420 - Avis d'Annulation (Reversal Advice)</option>
                  </optgroup>
                  <optgroup label="Gestion de Réseau">
                    <option value="0800">0800 - Gestion de Réseau (Echo/Logon/ZPK)</option>
                  </optgroup>
                </select>
              </div>

              <div className="form-group col-8">
                <label htmlFor="tpe-pan">Carte Porteur (PAN - DE 2)</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    id="tpe-pan"
                    type="text"
                    value={pan}
                    onChange={(e) => {
                      setPan(e.target.value);
                      const found = accounts.find((a) => a.pan === e.target.value);
                      if (found) setExp(found.exp);
                    }}
                    className="form-control font-mono"
                    style={{ flex: 1 }}
                    required={mti !== "0800"}
                    disabled={mti === "0800"}
                    placeholder={mti === "0800" ? "Non requis pour 0800 Gestion Réseau" : "4000 1234 5678 9010"}
                  />
                  <select
                    value={pan}
                    onChange={(e) => {
                      if (e.target.value) {
                        setPan(e.target.value);
                        const found = accounts.find((a) => a.pan === e.target.value);
                        if (found) setExp(found.exp);
                      }
                    }}
                    className="form-control"
                    style={{ width: "185px", fontSize: "0.75rem" }}
                  >
                    {accounts.map((a) => (
                      <option key={a.pan} value={a.pan}>
                        {a.pan.slice(-4)} • {a.cardholder_name || a.status} ({a.status})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedAccount ? (
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "4px", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                    <span>👤 <strong>{selectedAccount.cardholder_name}</strong></span>
                    <span>• Solde: <strong>{selectedAccount.balance.toLocaleString()} FCFA</strong></span>
                    <span>• CVV2: <code>{selectedAccount.cvv2}</code></span>
                    <span>• Vélocité: <code>{selectedAccount.tx_count_hour ?? 0}/{selectedAccount.max_tx_per_hour ?? 5} tx/h</code></span>
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "#b45309",
                      marginTop: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      padding: "0.35rem 0.6rem",
                      borderRadius: "6px",
                    }}
                  >
                    <span>
                      ⚠️ PAN absent de MySQL (testera <code>DE 39 = 14 Carte inconnue</code> ou BIN routing)
                    </span>
                    <button
                      type="button"
                      disabled={provisioningPan || pan.replace(/\s+/g, "").length < 12}
                      onClick={handleQuickProvisionPan}
                      style={{
                        background: "var(--burgundy)",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "5px",
                        padding: "0.22rem 0.55rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {provisioningPan ? "Création..." : "➕ Créer ce PAN dans MySQL (500k F)"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Gestion de Réseau ISO 8583 (0800) */}
            {mti === "0800" && (
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "10px",
                  padding: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#166534", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span>📡</span>
                  <span>Gestion de Réseau ISO 8583 (DE 70 - Network Management Information Code)</span>
                </div>
                <div className="form-row">
                  <div className="form-group col-12">
                    <label>Fonction Réseau (DE 70)</label>
                    <select
                      value={netCode}
                      onChange={(e) => setNetCode(e.target.value)}
                      className="form-control font-mono"
                    >
                      <option value="301">301 - Test de Ligne / Echo Test (Heartbeat périodique)</option>
                      <option value="001">001 - Connexion / Logon Session Réseau (Initialisation canal)</option>
                      <option value="002">002 - Déconnexion / Logoff Session Réseau (Clôture canal)</option>
                      <option value="101">101 - Échange de Clés Cryptographiques (ZPK sous ZMK + KCV dans DE 48)</option>
                      <option value="201">201 - Fin de Journée / Cutover Réconciliation (Changement date comptable)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* DE 90 pour Reversal Request (0400) ou Advice (0420) */}
            {(mti === "0400" || mti === "0420") && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "10px",
                  padding: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#92400e", marginBottom: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>↺ DE 90 - Éléments de la Transaction d'Origine (Original Data Elements, 42 car.)</span>
                  <button
                    type="button"
                    onClick={generateDe90}
                    style={{
                      background: "#92400e",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.25rem 0.6rem",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ⚡ Auto-générer DE 90 conforme
                  </button>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <input
                    id="tpe-de90"
                    type="text"
                    value={de90}
                    onChange={(e) => setDe90(e.target.value)}
                    className="form-control font-mono"
                    placeholder="MTI(4) + STAN(6) + DateTime(10) + Acq(11) + Fwd(11)"
                  />
                  <div style={{ fontSize: "0.71rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                    Structure fixe 42 car. : MTI d'origine (4) + STAN (6) + Date/Heure Transmission MMDDhhmmss (10) + Code Acquéreur (11) + Code Forwarding (11)
                  </div>
                </div>
              </div>
            )}

            {/* Paramètres spécifiques par canal */}
            {channel === "GAB" && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-light)",
                  borderRadius: "10px",
                  padding: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--burgundy)", marginBottom: "0.5rem" }}>
                  🏧 Configuration Automate GAB (DE 3 &amp; Cassettes DE 41)
                </div>
                <div className="form-row">
                  <div className="form-group col-6">
                    <label>Opération GAB (DE 3 Processing Code)</label>
                    <select
                      value={processingCode}
                      onChange={(e) => setProcessingCode(e.target.value)}
                      className="form-control"
                    >
                      <option value="010000">010000 - Retrait d'Espèces (Cash Withdrawal)</option>
                      <option value="310000">310000 - Consultation Solde Porteur (DE 54)</option>
                      <option value="380000">380000 - Mini-Relevé GAB (10 dernières écritures)</option>
                      <option value="900000">900000 - Changement de Code PIN</option>
                      <option value="400000">400000 - Virement de Compte à Compte</option>
                      <option value="500000">500000 - Paiement Facture sur GAB</option>
                    </select>
                  </div>
                  <div className="form-group col-6">
                    <label>Automate GAB (DE 41 Terminal ID)</label>
                    <select
                      value={terminalId}
                      onChange={(e) => setTerminalId(e.target.value)}
                      className="form-control"
                    >
                      {atms.map((atm) => (
                        <option key={atm.terminal_id} value={atm.terminal_id}>
                          {atm.terminal_id} — {atm.location} ({atm.total_cash.toLocaleString()} F)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {selectedAtm && (
                  <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                    <span>💵 <strong>10 000 F</strong> : {selectedAtm.cassette_10000} billets</span>
                    <span>💵 <strong>5 000 F</strong> : {selectedAtm.cassette_5000} billets</span>
                    <span>💵 <strong>2 000 F</strong> : {selectedAtm.cassette_2000} billets</span>
                    <span>• Statut : <strong>{selectedAtm.status}</strong></span>
                  </div>
                )}
              </div>
            )}

            {channel === "TPE" && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-light)",
                  borderRadius: "10px",
                  padding: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--burgundy)", marginBottom: "0.5rem" }}>
                  💳 Configuration TPE Point de Vente (DE 3, DE 22 &amp; DE 18 MCC)
                </div>
                <div className="form-row">
                  <div className="form-group col-12">
                    <label>Opération TPE (DE 3 Processing Code)</label>
                    <select
                      value={processingCode}
                      onChange={(e) => setProcessingCode(e.target.value)}
                      className="form-control"
                    >
                      <option value="000000">000000 - Achat / Vente Marchandise (Standard Purchase)</option>
                      <option value="090000">090000 - Achat avec Cashback (Purchase + Retrait Espèces)</option>
                      <option value="200000">200000 - Remboursement / Crédit Porteur (Refund)</option>
                      <option value="310000">310000 - Demande de Solde Porteur (Balance Inquiry)</option>
                      <option value="900000">900000 - Changement de Code PIN</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group col-7">
                    <label>Mode d'Entrée Carte (DE 22 POS Entry Mode)</label>
                    <select
                      value={posEntryMode}
                      onChange={(e) => setPosEntryMode(e.target.value)}
                      className="form-control"
                    >
                      <option value="051">051 - Puce EMV Contact + PIN (Standard)</option>
                      <option value="071">071 - Sans Contact NFC (Plafond 15 000 FCFA sans PIN)</option>
                      <option value="801">801 - Fallback Piste Magnétique sur Carte EMV (Refus 57)</option>
                    </select>
                  </div>
                  <div className="form-group col-5">
                    <label>Catégorie Commerçant (DE 18 MCC)</label>
                    <select value={mcc} onChange={(e) => setMcc(e.target.value)} className="form-control">
                      <option value="5411">5411 - Supermarché / Hypermarché</option>
                      <option value="5812">5812 - Restaurant / Fast-Food</option>
                      <option value="5541">5541 - Station-Service</option>
                      <option value="7011">7011 - Hôtel &amp; Hébergement</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {channel === "ECOM" && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid var(--border-light)",
                  borderRadius: "10px",
                  padding: "0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--burgundy)", marginBottom: "0.5rem" }}>
                  🌐 Configuration E-Commerce / Passerelle Web (DE 3, DE 48 : CVV2 &amp; 3-D Secure)
                </div>
                <div className="form-row">
                  <div className="form-group col-12">
                    <label>Opération E-Commerce (DE 3 Processing Code)</label>
                    <select
                      value={processingCode}
                      onChange={(e) => setProcessingCode(e.target.value)}
                      className="form-control"
                    >
                      <option value="000000">000000 - Paiement Sécurisé E-Commerce (Standard Purchase)</option>
                      <option value="200000">200000 - Remboursement E-Commerce (Refund)</option>
                      <option value="500000">500000 - Paiement Facture en Ligne (Bill Pay)</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group col-4">
                    <label>Cryptogramme CVV2</label>
                    <input
                      type="text"
                      value={cvv2}
                      onChange={(e) => setCvv2(e.target.value)}
                      className="form-control font-mono"
                      maxLength={3}
                      placeholder="123"
                    />
                  </div>
                  <div className="form-group col-4">
                    <label>Statut 3-D Secure</label>
                    <select
                      value={threedsStatus}
                      onChange={(e) => {
                        setThreedsStatus(e.target.value);
                        setEci(e.target.value === "Y" ? "05" : "07");
                      }}
                      className="form-control"
                    >
                      <option value="Y">Y - Authentifié OTP 3DS</option>
                      <option value="N">N - Non Authentifié (Frictionless/No 3DS)</option>
                    </select>
                  </div>
                  <div className="form-group col-4">
                    <label>Indicateur ECI</label>
                    <select value={eci} onChange={(e) => setEci(e.target.value)} className="form-control">
                      <option value="05">ECI 05 - Full 3DS (Sécurisé)</option>
                      <option value="06">ECI 06 - Merchant Attempt</option>
                      <option value="07">ECI 07 - Non-3DS (Seuil 25 000 F)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Assistant Cashback (DE 3 = 090000) */}
            {processingCode === "090000" && (
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "10px",
                  padding: "0.75rem 0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <div className="form-group col-12" style={{ marginBottom: 0 }}>
                    <label style={{ color: "#1e40af", fontWeight: 700 }}>
                      💵 Part Cashback / Espèces Remises en Caisse (FCFA)
                    </label>
                    <input
                      type="number"
                      value={cashbackAmount}
                      onChange={(e) => setCashbackAmount(Number(e.target.value))}
                      className="form-control font-mono"
                      min="1000"
                      step="1000"
                      placeholder="Ex: 10000"
                    />
                    <div style={{ fontSize: "0.71rem", color: "#3b82f6", marginTop: "4px" }}>
                      Le montant total débité au porteur sera le Montant Transaction (DE 4) dont {cashbackAmount.toLocaleString()} FCFA remis en liquide.
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Assistant Changement PIN (DE 3 = 900000) */}
            {processingCode === "900000" && (
              <div
                style={{
                  background: "#fdf4ff",
                  border: "1px solid #f0abfc",
                  borderRadius: "10px",
                  padding: "0.75rem 0.85rem",
                  marginBottom: "1rem",
                }}
              >
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <div className="form-group col-12" style={{ marginBottom: 0 }}>
                    <label style={{ color: "#86198f", fontWeight: 700 }}>
                      🔢 Nouveau Code PIN Souhaité (4 chiffres)
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="form-control font-mono"
                      placeholder="Ex: 9876"
                      required
                    />
                    <div style={{ fontSize: "0.71rem", color: "#a21caf", marginTop: "4px" }}>
                      Après validation, le PIN de la carte sera mis à jour dynamiquement dans la base bancaire.
                    </div>
                  </div>
                </div>
              </div>
            )}


            <div className="form-row">
              <div className="form-group col-4">
                <label htmlFor="tpe-amount">Montant (FCFA - DE 4)</label>
                <input
                  id="tpe-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="form-control font-mono"
                  min="0"
                  disabled={processingCode === "310000"}
                  required
                />
              </div>

              <div className="form-group col-4">
                <label htmlFor="tpe-currency">Devise (DE 49)</label>
                <select
                  id="tpe-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="form-control"
                >
                  <option value="952">952 - FCFA / XOF</option>
                  <option value="840">840 - USD (International)</option>
                  <option value="978">978 - EUR (International)</option>
                </select>
              </div>

              <div className="form-group col-4">
                <label htmlFor="tpe-pin">Code PIN (DE 52)</label>
                <input
                  id="tpe-pin"
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="form-control font-mono"
                  maxLength={4}
                  disabled={posEntryMode === "071" || channel === "ECOM"}
                  placeholder={posEntryMode === "071" || channel === "ECOM" ? "Sans PIN" : "1234"}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group col-4">
                <label htmlFor="tpe-exp">Expiration (DE 14 : YYMM)</label>
                <input
                  id="tpe-exp"
                  type="text"
                  value={exp}
                  onChange={(e) => setExp(e.target.value)}
                  className="form-control font-mono"
                  maxLength={4}
                />
              </div>

              <div className="form-group col-4">
                <label htmlFor="tpe-stan">Audit STAN (DE 11)</label>
                <input
                  id="tpe-stan"
                  type="text"
                  value={stan}
                  onChange={(e) => setStan(e.target.value)}
                  className="form-control font-mono"
                  maxLength={6}
                />
              </div>

              <div className="form-group col-4">
                <label htmlFor="tpe-term">Terminal ID (DE 41)</label>
                <input
                  id="tpe-term"
                  type="text"
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  className="form-control font-mono"
                  maxLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-block btn-glow"
              style={{ marginTop: "0.75rem", padding: "0.85rem" }}
            >
              <span>{loading ? "⏳" : "🚀"}</span>
              <span>
                {loading
                  ? "Transmission TCP en cours..."
                  : `Injecter la Trame ${channel} (${mti}) sur Socket TCP`}
              </span>
            </button>
          </form>
        </div>

        {/* Visualiseur de Réponse, Waterfall Latence & Runbook Exploitant */}
        <div className="card">
          <div className="card-header">
            <h3>Diagnostic Émetteur &amp; Waterfall Latence</h3>
            <span className="tag">
              {response ? `${response.channel || channel} • ${isApproved ? "APPROUVÉ (00)" : `REJET (${response.response.de39})`}` : "EN ATTENTE"}
            </span>
          </div>

          {/* Bannière Verdict */}
          <div
            style={{
              background: response
                ? isApproved
                  ? "#ecfdf5"
                  : "#fef2f2"
                : "#f8fafc",
              border: response
                ? `1px solid ${isApproved ? "#a7f3d0" : "#fecdd3"}`
                : "1px solid var(--border-light)",
              borderLeft: response
                ? `5px solid ${isApproved ? "var(--accent-success)" : "var(--accent-danger)"}`
                : "5px solid var(--text-dim)",
              borderRadius: "12px",
              padding: "1.1rem",
              display: "flex",
              alignItems: "center",
              gap: "1.25rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "80px" }}>
              <div
                style={{
                  fontSize: "2.3rem",
                  fontWeight: "900",
                  fontFamily: "var(--font-mono)",
                  color: response ? (isApproved ? "#047857" : "#b91c1c") : "var(--text-primary)",
                  lineHeight: 1,
                }}
              >
                {response?.response?.de39 || "--"}
              </div>
              <div style={{ fontSize: "0.72rem", fontWeight: "700", marginTop: "4px", color: "var(--text-muted)", textAlign: "center" }}>
                {response?.response?.label || "Prêt"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.82rem", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                <span>
                  <strong style={{ color: "var(--text-muted)" }}>Règle : </strong>
                  <span className="rule-badge">{response?.rule_triggered || "—"}</span>
                </span>
                <span>
                  <strong style={{ color: "var(--text-muted)" }}>DE 38 Auth : </strong>
                  <span className="font-mono" style={{ color: "#047857", fontWeight: 700 }}>
                    {response?.response?.de38 || "N/A"}
                  </span>
                </span>
              </div>
              <div>
                <strong style={{ color: "var(--text-muted)" }}>Action Terminal : </strong>
                <span style={{ color: "var(--text-primary)" }}>{response?.response?.action || "En attente d'injection"}</span>
              </div>
              {response?.response?.de54 && (
                <div style={{ color: "#047857", fontSize: "0.78rem", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  💰 Solde GAB (DE 54) : {response.response.de54}
                </div>
              )}
              {response?.atm_notes_dispensed && Object.keys(response.atm_notes_dispensed).length > 0 && (
                <div style={{ color: "#b45309", fontSize: "0.78rem", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                  🏧 Billets distribués :{" "}
                  {Object.entries(response.atm_notes_dispensed)
                    .map(([denom, count]) => `${count}x ${Number(denom).toLocaleString()} F`)
                    .join(" + ")}
                </div>
              )}
              {response?.auto_reversal_triggered && (
                <div
                  style={{
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    color: "#b45309",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    marginTop: "2px",
                  }}
                >
                  ↺ AUTO-REVERSAL 0400 EXÉCUTÉ : {response.auto_reversal_reason}
                </div>
              )}
              {response?.stip_approved && (
                <div
                  style={{
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: "#047857",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    marginTop: "2px",
                  }}
                >
                  🛡️ APPROUVÉ PAR DÉLÉGATION STAND-IN (STIP) — Host CBS Indisponible
                </div>
              )}
            </div>
          </div>

          {/* Waterfall des Temps de Latence par Maillon */}
          {lb && (
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid var(--border-light)",
                borderRadius: "10px",
                padding: "0.85rem 1rem",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  ⏱️ Décomposition Latence Bout-en-Bout (Waterfall Monétique)
                </span>
                <span className="font-mono" style={{ fontSize: "0.8rem", fontWeight: 800, color: "#047857" }}>
                  Total : {lb.total_chain_ms} ms (Socket RTT: {lb.socket_rtt_ms} ms)
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.45rem", fontSize: "0.72rem" }}>
                <div style={{ background: "#ffffff", border: "1px solid var(--border-light)", padding: "0.4rem 0.5rem", borderRadius: "6px" }}>
                  <div style={{ color: "var(--text-muted)" }}>1. Réseau Accès</div>
                  <div className="font-mono" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{lb.access_network_ms} ms</div>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid var(--border-light)", padding: "0.4rem 0.5rem", borderRadius: "6px" }}>
                  <div style={{ color: "var(--text-muted)" }}>2. Acquéreur</div>
                  <div className="font-mono" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{lb.acquirer_ms} ms</div>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid var(--border-light)", padding: "0.4rem 0.5rem", borderRadius: "6px" }}>
                  <div style={{ color: "var(--text-muted)" }}>3. Switch GIM</div>
                  <div className="font-mono" style={{ fontWeight: 700, color: "var(--text-primary)" }}>{lb.switch_ms} ms</div>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid var(--border-light)", padding: "0.4rem 0.5rem", borderRadius: "6px" }}>
                  <div style={{ color: "var(--text-muted)" }}>4. HSM Crypto</div>
                  <div className="font-mono" style={{ fontWeight: 700, color: "#b45309" }}>{lb.hsm_crypto_ms} ms</div>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid var(--border-light)", padding: "0.4rem 0.5rem", borderRadius: "6px" }}>
                  <div style={{ color: "var(--text-muted)" }}>5. Host CBS</div>
                  <div className="font-mono" style={{ fontWeight: 700, color: "#047857" }}>{lb.issuer_host_cbs_ms} ms</div>
                </div>
              </div>
            </div>
          )}

          {/* Onglets : Runbook Exploitant | Champs DE | Trame Brute */}
          <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid var(--border-light)", overflow: "hidden" }}>
            <div style={{ display: "flex", background: "#f8fafc", borderBottom: "1px solid var(--border-light)" }}>
              <button
                type="button"
                onClick={() => setActiveTab("runbook")}
                className={`tab-btn ${activeTab === "runbook" ? "active" : ""}`}
                style={{ borderRadius: 0, padding: "0.6rem 0.9rem", fontSize: "0.75rem" }}
              >
                🛠️ Runbook Exploitant
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("fields")}
                className={`tab-btn ${activeTab === "fields" ? "active" : ""}`}
                style={{ borderRadius: 0, padding: "0.6rem 0.9rem", fontSize: "0.75rem" }}
              >
                📋 Champs ISO 8583 (DE)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("raw")}
                className={`tab-btn ${activeTab === "raw" ? "active" : ""}`}
                style={{ borderRadius: 0, padding: "0.6rem 0.9rem", fontSize: "0.75rem" }}
              >
                🖧 Trame Hex / ASCII
              </button>
            </div>

            <div style={{ padding: "1rem", maxHeight: "260px", overflowY: "auto" }}>
              {activeTab === "runbook" ? (
                response ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", fontSize: "0.82rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <span className="tag">Catégorie : {response.response.category || "N/A"}</span>
                      <span className="tag">Sévérité : {response.response.severity || "INFO"}</span>
                      <span className="tag">Composant : {response.response.component || "Host Émetteur"}</span>
                    </div>
                    <div style={{ background: "#f8fafc", padding: "0.65rem", borderRadius: "8px", border: "1px solid var(--border-light)", borderLeft: "3px solid var(--primary)" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700 }}>CAUSE TECHNIQUE / MÉTIER :</div>
                      <div style={{ color: "var(--text-primary)", marginTop: "2px" }}>{response.response.meaning}</div>
                    </div>
                    <div style={{ background: "#ecfdf5", padding: "0.65rem", borderRadius: "8px", border: "1px solid #a7f3d0", borderLeft: "3px solid #10b981" }}>
                      <div style={{ fontSize: "0.72rem", color: "#047857", fontWeight: 700 }}>PROCÉDURE EXPLOITANT MONÉTIQUE (RUNBOOK) :</div>
                      <div style={{ color: "#065f46", marginTop: "2px", fontWeight: 500 }}>
                        {response.response.operator_runbook || "Aucune intervention requise."}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted" style={{ padding: "1.5rem 0", fontSize: "0.82rem" }}>
                    Injectez une transaction pour afficher le diagnostic et le Runbook Exploitant associé au code DE 39.
                  </div>
                )
              ) : activeTab === "fields" ? (
                <table className="data-table" style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}>
                  <thead>
                    <tr>
                      <th>DE</th>
                      <th>Nom du Champ</th>
                      <th>Valeur Transmise / Reçue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {response?.response?.fields ? (
                      Object.keys({ ...response.request.fields, ...response.response.fields })
                        .sort((a, b) => Number(a) - Number(b))
                        .map((de) => (
                          <tr key={de}>
                            <td>
                              <strong>DE {de}</strong>
                            </td>
                            <td>{getFieldName(de)}</td>
                            <td className="font-mono">
                              {response.response.fields[de] ?? response.request.fields[de]}
                            </td>
                          </tr>
                        ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="text-center text-muted">
                          Aucune transaction envoyée.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                      Requête Émise (Header TCP 2-octets Big-Endian inclus) :
                    </div>
                    <pre
                      className="font-mono"
                      style={{
                        background: "#0f172a",
                        padding: "0.75rem",
                        borderRadius: "6px",
                        fontSize: "0.74rem",
                        wordBreak: "break-all",
                        whiteSpace: "pre-wrap",
                        color: "#e2e8f0",
                      }}
                    >
                      {response ? `[ASCII] ${response.request.raw_ascii}\n[HEX]   ${response.request.raw_hex}` : "--"}
                    </pre>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                      Réponse Reçue de l'Émetteur :
                    </div>
                    <pre
                      className="font-mono"
                      style={{
                        background: "#0f172a",
                        padding: "0.75rem",
                        borderRadius: "6px",
                        fontSize: "0.74rem",
                        wordBreak: "break-all",
                        whiteSpace: "pre-wrap",
                        color: "#e2e8f0",
                      }}
                    >
                      {response ? `[ASCII] ${response.response.raw_ascii}\n[HEX]   ${response.response.raw_hex}` : "--"}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
