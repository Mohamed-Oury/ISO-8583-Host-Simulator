"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { decodeRawFrame, DecodedRawFrame, replayRawFrame, TransactionResponse, EmvTag } from "@/lib/api";

const SAMPLE_FRAMES = [
  {
    id: "tpe_emv_0200",
    label: "💳 Achat TPE EMV Contact (0200)",
    desc: "Achat standard 50 000 FCFA avec puce EMV, cryptogramme ARQC et tags DE 55",
    frame: "020072380000000000001640001234567800010000000050000000019F260811223344556677889F36020005950580000080009C01005F2A020952",
    format: "hex" as const,
  },
  {
    id: "gab_cash_0200",
    label: "🏧 Retrait GAB Espèces 25k (0200)",
    desc: "Retrait GAB 25 000 FCFA (DE 3=010000, DE 41=GAB001, DE 4=25000)",
    frame: "0200B2200000000000001640001234567800010100000000000250000001012812051GAB001  952",
    format: "ascii" as const,
  },
  {
    id: "web_3ds_0100",
    label: "🌐 E-Commerce 3-D Secure (0100)",
    desc: "Pré-autorisation Web 40 000 FCFA avec DE 48 (CVV2=123, 3DS=Y, ECI=05)",
    frame: "0100B2200000020000001640001234567800010000000000000400000001022812812ECOM000130CVV2=123;3DS=Y;ECI=05;CHANNEL=ECOM952",
    format: "ascii" as const,
  },
  {
    id: "reversal_0420",
    label: "↺ Avis d'Annulation DE 90 (0420)",
    desc: "Reversal Advice avec trame originale dans DE 90 (42 caractères)",
    frame: "0420B2200000000000021640001234567800010100000000000100000001032812051GAB001  95242020000010110261441000000000000100000000001",
    format: "ascii" as const,
  },
  {
    id: "echo_0800",
    label: "📡 Echo Test Réseau (0800)",
    desc: "Test de présence de liaison switch / HSM (DE 70 = 301)",
    frame: "08008220000000000000000104952003301",
    format: "ascii" as const,
  },
  {
    id: "zpk_0800",
    label: "🔐 Échange de Clé ZPK (0800)",
    desc: "Demande d'échange de clé de session ZPK sous ZMK (DE 70 = 101)",
    frame: "08008220000000000000000105952003101",
    format: "ascii" as const,
  },
  {
    id: "refund_0200",
    label: "↩️ Remboursement Marchand (200000)",
    desc: "Opération de crédit porteur 15 000 FCFA (DE 3=200000)",
    frame: "0200B2200000000000001640001234567800012000000000000150000001062812051TERM0001952",
    format: "ascii" as const,
  },
  {
    id: "cashback_0200",
    label: "💵 Achat + Cashback 10k (090000)",
    desc: "Achat 35 000 FCFA dont 10 000 FCFA de remise en liquide (DE 3=090000)",
    frame: "0200B2200000020000001640001234567800010900000000000350000001072812051TERM000115CASHBACK=10000952",
    format: "ascii" as const,
  },
];

export default function DynamicDecoder() {
  const router = useRouter();
  const [rawInput, setRawInput] = useState<string>(SAMPLE_FRAMES[0].frame);
  const [detectedFormat, setDetectedFormat] = useState<"ascii" | "hex">("hex");
  const [formatMode, setFormatMode] = useState<"auto" | "ascii" | "hex">("auto");
  const [decoded, setDecoded] = useState<DecodedRawFrame | null>(null);
  const [isDecoding, setIsDecoding] = useState<boolean>(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [filterDe, setFilterDe] = useState<string>("");
  const [selectedBit, setSelectedBit] = useState<number | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Rejeu TCP réel
  const [isReplaying, setIsReplaying] = useState<boolean>(false);
  const [replayResponse, setReplayResponse] = useState<TransactionResponse | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Détection automatique du format
  const cleanInput = useMemo(() => {
    return rawInput.trim().replace(/^\[(ASCII|HEX)\]\s*/i, "");
  }, [rawInput]);

  useEffect(() => {
    const compact = cleanInput.replace(/\s+/g, "");
    const isPureHex = /^[0-9a-fA-F]+$/.test(compact) && compact.length % 2 === 0;
    const looksLikeHexMti = compact.toUpperCase().startsWith("30323030") ||
      compact.toUpperCase().startsWith("30383030") ||
      compact.toUpperCase().startsWith("30343030") ||
      compact.toUpperCase().startsWith("30313030");
    const looksLikeRawHex = compact.startsWith("0200") || compact.startsWith("0100") || compact.startsWith("0800") || compact.startsWith("0420");

    if (formatMode === "ascii") {
      setDetectedFormat("ascii");
    } else if (formatMode === "hex") {
      setDetectedFormat("hex");
    } else {
      if (isPureHex && (looksLikeHexMti || !looksLikeRawHex)) {
        setDetectedFormat("hex");
      } else {
        setDetectedFormat("ascii");
      }
    }
  }, [cleanInput, formatMode]);

  // Décodage dynamique à chaque frappe avec debounce de 150ms
  useEffect(() => {
    if (!cleanInput) {
      setDecoded(null);
      setDecodeError(null);
      return;
    }

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      setIsDecoding(true);
      setDecodeError(null);
      try {
        const res = await decodeRawFrame(cleanInput, formatMode);
        if (res.success) {
          setDecoded(res);
        } else {
          setDecodeError(res.error || "Impossible de décoder la trame ISO 8583 fournie.");
          setDecoded(null);
        }
      } catch (err: any) {
        setDecodeError(err.message || "Erreur de décodage.");
        setDecoded(null);
      } finally {
        setIsDecoding(false);
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [cleanInput, formatMode]);

  const handleSelectSample = (sample: typeof SAMPLE_FRAMES[0]) => {
    setRawInput(sample.frame);
    setFormatMode(sample.format);
    setReplayResponse(null);
    setReplayError(null);
    setSelectedBit(null);
  };

  const handleCopyJson = () => {
    if (!decoded) return;
    navigator.clipboard.writeText(JSON.stringify(decoded, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInjectSimulator = () => {
    router.push("/simulateur");
  };

  const handleReplaySocket = async () => {
    if (!cleanInput) return;
    setIsReplaying(true);
    setReplayError(null);
    setReplayResponse(null);
    try {
      const res = await replayRawFrame(cleanInput, detectedFormat);
      setReplayResponse(res);
    } catch (err: any) {
      setReplayError(err.message || "Erreur lors du rejeu TCP sur :5001");
    } finally {
      setIsReplaying(false);
    }
  };

  // Traitement du bitmap (64 bits)
  const bitmapBits = useMemo(() => {
    if (!decoded?.bitmap_hex) return [];
    const hex = decoded.bitmap_hex;
    const bits: Array<{ bit: number; active: boolean; name: string }> = [];
    try {
      // 16 cars hex = 64 bits
      const val = BigInt("0x" + hex.slice(0, 16));
      for (let b = 1; b <= 64; b++) {
        const active = Boolean((val >> BigInt(64 - b)) & BigInt(1));
        const deObj = decoded.de_details?.find((d) => d.de === b);
        bits.push({
          bit: b,
          active,
          name: deObj ? deObj.name : `Champ DE ${b}`,
        });
      }
    } catch {
      // ignore
    }
    return bits;
  }, [decoded]);

  // Filtrage des Data Elements
  const filteredDeDetails = useMemo(() => {
    if (!decoded?.de_details) return [];
    return decoded.de_details.filter((d) => {
      if (selectedBit && d.de !== selectedBit) return false;
      if (!filterDe.trim()) return true;
      const q = filterDe.toLowerCase();
      return (
        String(d.de).includes(q) ||
        d.name.toLowerCase().includes(q) ||
        (d.masked_value && d.masked_value.toLowerCase().includes(q)) ||
        (d.value && d.value.toLowerCase().includes(q))
      );
    });
  }, [decoded, filterDe, selectedBit]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Entête & Présentation */}
      <div className="pane-header">
        <div className="pane-header-main">
          <div className="pane-title-row">
            <span className="badge-chip highlight">INSPECTION DE PAQUETS EN TEMPS RÉEL</span>
            <span className="badge-chip subtle">ISO 8583:1987 / 1993 / EMV TLV</span>
            <span className="badge-chip success">LIVE TYPING (0 MS LATENCY)</span>
          </div>
          <h2 className="pane-title">Décodeur Dynamique de Trame ISO 8583</h2>
          <p className="pane-subtitle">
            Analyseur syntaxique temps réel pour trames monétiques bancaires (ASCII brut, Hexadécimal de production avec ou sans cadrage TCP 2-octets). Décomposition instantanée du MTI, grille des bitmaps 64/128 bits, extraction des champs DE masqués PCI-DSS et parsing des tags EMV DE 55.
          </p>
        </div>

        <div className="pane-actions-group">
          <button
            type="button"
            onClick={handleCopyJson}
            disabled={!decoded}
            className="btn btn-outline"
            title="Copier la structure complète décodée au format JSON"
          >
            <span>{copied ? "✅" : "📋"}</span>
            <span>{copied ? "Copié !" : "Copier JSON"}</span>
          </button>
          <button
            type="button"
            onClick={handleInjectSimulator}
            className="btn btn-outline"
            style={{ borderColor: "var(--burgundy)", color: "var(--burgundy)", fontWeight: 700 }}
          >
            <span>↗️</span>
            <span>Ouvrir dans le Simulateur</span>
          </button>
          <button
            type="button"
            onClick={handleReplaySocket}
            disabled={isReplaying || !cleanInput}
            className="btn btn-primary btn-glow"
          >
            <span>{isReplaying ? "⏳" : "🚀"}</span>
            <span>{isReplaying ? "Transmission..." : "Rejouer sur Socket TCP :5001"}</span>
          </button>
        </div>
      </div>

      {/* Barre de Bibliothèque d'Exemples de Production */}
      <div
        className="card"
        style={{
          padding: "0.85rem 1rem",
          background: "linear-gradient(180deg, #fff1f2 0%, #ffffff 100%)",
          border: "1px solid rgba(125, 21, 56, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--burgundy)", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span>📚</span>
            <span>Échantillons de Trames de Production (Banque Centrale, Switch Interbancaire &amp; Réseaux Internationaux) :</span>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
            Cliquez sur un modèle pour charger et analyser instantanément sa trame
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {SAMPLE_FRAMES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectSample(s)}
              className="preset-btn"
              title={s.desc}
              style={{
                fontSize: "0.74rem",
                padding: "0.3rem 0.65rem",
                border: cleanInput === s.frame ? "1.5px solid var(--burgundy)" : "1px solid #cbd5e1",
                background: cleanInput === s.frame ? "var(--sg-red-50)" : "#ffffff",
                color: cleanInput === s.frame ? "var(--burgundy)" : "var(--text-primary)",
                fontWeight: cleanInput === s.frame ? 800 : 500,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Zone de Saisie Dynamique & Options d'Analyse */}
      <div className="card">
        <div className="card-header" style={{ paddingBottom: "0.6rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 800 }}>Saisie de Trame Brute</h3>
            <span className="tag" style={{ background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>
              {detectedFormat.toUpperCase()} DÉTECTÉ
            </span>
            <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
              {cleanInput.length} caractères • {cleanInput.length / (detectedFormat === "hex" ? 2 : 1)} octets estimés
            </span>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Format d'entrée :</label>
            <select
              value={formatMode}
              onChange={(e) => setFormatMode(e.target.value as any)}
              className="form-control"
              style={{ fontSize: "0.75rem", padding: "0.25rem 0.5rem", width: "auto" }}
            >
              <option value="auto">Auto-Détection</option>
              <option value="ascii">ASCII Brut</option>
              <option value="hex">Hexadécimal (Dump / Wireshark)</option>
            </select>

            <button
              type="button"
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) setRawInput(text);
                } catch {
                  // clipboard denied or not supported
                }
              }}
              className="btn btn-outline"
              style={{ fontSize: "0.72rem", padding: "0.25rem 0.55rem" }}
              title="Coller depuis le presse-papier"
            >
              📋 Coller
            </button>

            {cleanInput && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const noSpace = rawInput.replace(/\s+/g, "");
                    setRawInput(noSpace);
                  }}
                  className="btn btn-outline"
                  style={{ fontSize: "0.72rem", padding: "0.25rem 0.55rem" }}
                  title="Supprimer les espaces et retours chariot"
                >
                  ⚡ Compacter
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const clean = rawInput.replace(/[^0-9a-fA-F]/g, "");
                    const spaced = clean.match(/.{1,2}/g)?.join(" ") || clean;
                    setRawInput(spaced);
                  }}
                  className="btn btn-outline"
                  style={{ fontSize: "0.72rem", padding: "0.25rem 0.55rem" }}
                  title="Formater en paires d'octets hex (XX XX XX...)"
                >
                  🔤 Hex Spacé
                </button>

                <button
                  type="button"
                  onClick={() => setRawInput("")}
                  className="btn btn-outline"
                  style={{ fontSize: "0.72rem", padding: "0.25rem 0.55rem", color: "#dc2626" }}
                  title="Effacer la saisie"
                >
                  🧹 Effacer
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ padding: "0.85rem 1.25rem 1.25rem" }}>
          <textarea
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            placeholder="Collez ici votre trame ISO 8583 brute issue d'un log ou dump réseau (ex: 0200723800000881800016400012345678000100000000000250000228143200... ou 30323030...)..."
            rows={7}
            className="form-control font-mono"
            style={{
              width: "100%",
              minHeight: "170px",
              boxSizing: "border-box",
              fontSize: "0.92rem",
              lineHeight: 1.6,
              letterSpacing: "0.04em",
              wordBreak: "break-all",
              background: "#0b132b",
              color: "#38bdf8",
              borderColor: decodeError ? "#ef4444" : "rgba(125, 21, 56, 0.4)",
              borderRadius: "10px",
              padding: "1rem",
              boxShadow: "inset 0 2px 6px rgba(0,0,0,0.45)",
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.45rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
              💡 <em>Astuce : Vous pouvez coller des trames ASCII ou Hexadécimales avec ou sans en-tête TCP 2-octets. Le décodeur détecte automatiquement le cadrage.</em>
            </div>
            {isDecoding && (
              <div style={{ fontSize: "0.74rem", color: "var(--burgundy)", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <span>⚡</span>
                <span>Analyse et dissection dynamique en cours...</span>
              </div>
            )}
          </div>

          {decodeError && (
            <div
              style={{
                marginTop: "0.6rem",
                padding: "0.6rem 0.85rem",
                background: "#fef2f2",
                border: "1px solid #fecdd3",
                borderRadius: "8px",
                color: "#991b1b",
                fontSize: "0.78rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <span>⚠️</span>
              <span><strong>Anomalie de format :</strong> {decodeError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Résultat du Rejeu sur Socket TCP (si exécuté) */}
      {replayResponse && (
        <div
          className="card"
          style={{
            background: replayResponse.response?.de39 === "00" ? "#f0fdf4" : "#fef2f2",
            border: `1.5px solid ${replayResponse.response?.de39 === "00" ? "#86efac" : "#fca5a5"}`,
          }}
        >
          <div className="card-header" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.2rem" }}>
                {replayResponse.response?.de39 === "00" ? "✅" : "🚨"}
              </span>
              <h3 style={{ fontSize: "0.95rem", color: replayResponse.response?.de39 === "00" ? "#166534" : "#991b1b" }}>
                Résultat de l'Injection Socket TCP 127.0.0.1:5001
              </h3>
            </div>
            <span
              style={{
                padding: "0.2rem 0.6rem",
                borderRadius: "999px",
                fontSize: "0.75rem",
                fontWeight: 800,
                background: replayResponse.response?.de39 === "00" ? "#dcfce7" : "#fee2e2",
                color: replayResponse.response?.de39 === "00" ? "#15803d" : "#b91c1c",
              }}
            >
              DE 39 : {replayResponse.response?.de39 || "--"} ({replayResponse.response?.label || "Réponse Host"})
            </span>
          </div>
          <div style={{ padding: "0.85rem 1.25rem", fontSize: "0.8rem", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>MTI Réponse :</div>
              <div style={{ fontWeight: 800, fontFamily: "var(--font-mono)" }}>{replayResponse.response?.mti || "--"}</div>
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>Code Auth (DE 38) :</div>
              <div style={{ fontWeight: 800, fontFamily: "var(--font-mono)", color: "#166534" }}>
                {replayResponse.response?.de38 || "N/A"}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>Latence RTT Host :</div>
              <div style={{ fontWeight: 800, fontFamily: "var(--font-mono)" }}>
                {replayResponse.latency_ms?.toFixed(1) || 0} ms
              </div>
            </div>
            <div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.72rem" }}>Règle Arbitrage :</div>
              <div style={{ fontWeight: 700, color: "var(--burgundy)" }}>
                {replayResponse.rule_triggered || "Nominale"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grille Principale de Dissection (MTI + Bitmaps + Fields Tree) */}
      {decoded && (
        <>
          {/* Bloc Synthèse MTI & Métriques */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "1.25rem" }}>
            {/* Carte MTI & Décomposition ISO */}
            <div className="card">
              <div className="card-header">
                <h3>Message Type Identifier (MTI)</h3>
                <span className="tag" style={{ background: "var(--sg-red-50)", color: "var(--burgundy)", fontWeight: 800 }}>
                  {decoded.mti}
                </span>
              </div>
              <div style={{ padding: "1rem 1.25rem" }}>
                <div style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--burgundy)", marginBottom: "0.5rem" }}>
                  {decoded.mti_desc || `MTI ${decoded.mti}`}
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                  Canal détecté : <strong>{decoded.channel}</strong> • Taille : <strong>{decoded.payload_length_bytes} octets</strong> ({decoded.de_details?.length || 0} champs extraits)
                </div>

                {decoded.mti_breakdown && (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "0.75rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem",
                      fontSize: "0.76rem",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                      Décomposition des 4 Chiffres MTI :
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>1er car. (Version standard) :</span>
                      <strong style={{ fontFamily: "var(--font-mono)" }}>{decoded.mti_breakdown.version}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>2ème car. (Classe message) :</span>
                      <strong style={{ fontFamily: "var(--font-mono)" }}>{decoded.mti_breakdown.message_class}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>3ème car. (Fonction) :</span>
                      <strong style={{ fontFamily: "var(--font-mono)" }}>{decoded.mti_breakdown.function}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>4ème car. (Origine émetteur) :</span>
                      <strong style={{ fontFamily: "var(--font-mono)" }}>{decoded.mti_breakdown.origin}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Matrice Visuelle des Bitmaps (64 bits) */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Matrice du Bitmap Primaire (DE 1 à 64)</h3>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                    HEX : {decoded.bitmap_hex || "N/A"}
                  </div>
                </div>
                {selectedBit && (
                  <button
                    type="button"
                    onClick={() => setSelectedBit(null)}
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.2rem 0.5rem",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    ✕ Réinitialiser filtre (Bit {selectedBit})
                  </button>
                )}
              </div>
              <div style={{ padding: "0.85rem 1.25rem" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(16, 1fr)",
                    gap: "4px",
                    marginBottom: "0.6rem",
                  }}
                >
                  {bitmapBits.map((b) => (
                    <button
                      key={b.bit}
                      type="button"
                      onClick={() => setSelectedBit(selectedBit === b.bit ? null : b.bit)}
                      title={`Bit ${b.bit} (${b.name}) : ${b.active ? "PRÉSENT (1)" : "ABSENT (0)"}`}
                      style={{
                        padding: "5px 0",
                        fontSize: "0.68rem",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        textAlign: "center",
                        borderRadius: "4px",
                        border: selectedBit === b.bit ? "2px solid #000" : b.active ? "1px solid #059669" : "1px solid #e2e8f0",
                        background: b.active
                          ? selectedBit === b.bit
                            ? "#059669"
                            : "#d1fae5"
                          : "#f8fafc",
                        color: b.active
                          ? selectedBit === b.bit
                            ? "#ffffff"
                            : "#065f46"
                          : "#94a3b8",
                        cursor: b.active ? "pointer" : "default",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {b.bit}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.71rem", color: "var(--text-secondary)" }}>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: 10, height: 10, background: "#d1fae5", border: "1px solid #059669", borderRadius: 2 }} />
                      Actif dans le bitmap ({bitmapBits.filter((b) => b.active).length} champs)
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ width: 10, height: 10, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 2 }} />
                      Inactif (0)
                    </span>
                  </div>
                  <span>Astuce : cliquez sur un numéro pour filtrer le champ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Arborescence & Tableau des Data Elements (DE) Extraits */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <h3>Data Elements Décodés ({filteredDeDetails.length}/{decoded.de_details?.length || 0})</h3>
                <span className="tag" style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe" }}>
                  PCI-DSS v4.0 MASQUÉ
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="Filtrer un champ (ex: PAN, 54, Montant)..."
                  value={filterDe}
                  onChange={(e) => setFilterDe(e.target.value)}
                  className="form-control"
                  style={{ fontSize: "0.75rem", padding: "0.3rem 0.65rem", width: "240px" }}
                />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ fontSize: "0.78rem" }}>
                <thead>
                  <tr>
                    <th style={{ width: "90px" }}>Élément</th>
                    <th style={{ width: "240px" }}>Nom Standard ISO 8583</th>
                    <th style={{ width: "85px" }}>Format</th>
                    <th>Valeur Masquée (Sécurisée)</th>
                    <th>Interprétation Monétique &amp; Sous-Champs</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeDetails.map((d) => {
                    return (
                      <tr key={d.de} style={{ background: selectedBit === d.de ? "var(--sg-red-50)" : undefined }}>
                        <td>
                          <span
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontWeight: 800,
                              color: "var(--burgundy)",
                              background: "#fff1f2",
                              padding: "2px 7px",
                              borderRadius: "5px",
                              border: "1px solid rgba(125, 21, 56, 0.2)",
                            }}
                          >
                            DE {d.de}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{d.name}</td>
                        <td>
                          <code style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{d.type}</code>
                        </td>
                        <td>
                          <code style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {d.masked_value}
                          </code>
                        </td>
                        <td>
                          {/* Interprétations intelligentes par type de champ */}
                          {d.de === 2 && (
                            <span style={{ fontSize: "0.72rem", color: "#166534", fontWeight: 600 }}>
                              💳 Carte Bancaire • BIN : {d.value?.slice(0, 6)} • Masquage 6/4 conforme
                            </span>
                          )}
                          {d.de === 3 && (
                            <span style={{ fontSize: "0.72rem", color: "#0369a1", fontWeight: 600 }}>
                              ⚙️ Opération : {d.value === "000000" ? "Achat / Vente Standard" : d.value === "010000" ? "Retrait d'Espèces GAB" : d.value === "090000" ? "Achat + Cashback" : d.value === "200000" ? "Remboursement Marchand" : d.value === "310000" ? "Consultation de Solde" : d.value === "380000" ? "Mini-Relevé GAB" : d.value === "900000" ? "Changement Code PIN" : `Code ${d.value}`}
                            </span>
                          )}
                          {d.de === 4 && (
                            <span style={{ fontSize: "0.72rem", color: "#166534", fontWeight: 700 }}>
                              💰 Montant : {Number(d.value).toLocaleString()} FCFA
                            </span>
                          )}
                          {d.de === 22 && (
                            <span style={{ fontSize: "0.72rem", color: "#92400e", fontWeight: 600 }}>
                              📶 Mode Saisie : {d.value.startsWith("05") ? "Puce EMV Contact" : d.value.startsWith("07") ? "Sans-Contact NFC" : d.value.startsWith("80") ? "Piste Magnétique Fallback" : d.value.startsWith("81") ? "E-Commerce / Web" : d.value}
                            </span>
                          )}
                          {d.de === 39 && (
                            <span style={{ fontSize: "0.72rem", color: d.value === "00" ? "#166534" : "#991b1b", fontWeight: 700 }}>
                              🎯 Code Réponse : {d.value === "00" ? "00 - Approuvé / Succès" : `${d.value} - Rejet Émetteur`}
                            </span>
                          )}
                          {d.de === 48 && (
                            <div style={{ fontSize: "0.71rem", color: "#475569", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                              {d.value.split(";").map((token, idx) => (
                                <span key={idx} style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: 3 }}>
                                  {token}
                                </span>
                              ))}
                            </div>
                          )}
                          {d.de === 54 && (
                            <span style={{ fontSize: "0.72rem", color: "#166534", fontWeight: 700 }}>
                              💵 Solde Porteur : {d.value}
                            </span>
                          )}
                          {d.de === 90 && (
                            <div style={{ fontSize: "0.71rem", color: "#b45309", fontFamily: "var(--font-mono)" }}>
                              ↺ MTI Orig: {d.value.slice(0, 4)} • STAN: {d.value.slice(4, 10)} • Date: {d.value.slice(10, 20)}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tags EMV Décodés (DE 55) si présents */}
          {decoded.emv_tags && decoded.emv_tags.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span>🔬</span>
                  <h3>Données Puce EMV Décodées (DE 55 Tag-Length-Value)</h3>
                  <span className="tag" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                    {decoded.emv_tags.length} TAGS EMV PARSÉS
                  </span>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ fontSize: "0.77rem" }}>
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>Tag Hex</th>
                      <th style={{ width: "260px" }}>Nom du Tag EMV</th>
                      <th style={{ width: "70px" }}>Longueur</th>
                      <th>Valeur Hexadécimale</th>
                      <th>Signification Métier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decoded.emv_tags.map((t, idx) => (
                      <tr key={idx}>
                        <td>
                          <code style={{ color: "var(--burgundy)", fontWeight: 800 }}>{t.tag}</code>
                        </td>
                        <td style={{ fontWeight: 600 }}>{t.name}</td>
                        <td>{t.length} octets</td>
                        <td>
                          <code style={{ fontSize: "0.75rem" }}>{t.value_hex}</code>
                        </td>
                        <td style={{ color: "#0369a1", fontWeight: 600 }}>{t.meaning || t.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dump Hexadécimal & ASCII Synchronisé (Wireshark-like Inspector) */}
          {decoded.hex_dump_lines && decoded.hex_dump_lines.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <span>🧬</span>
                  <h3>Dissection d'Octets Hexadécimaux &amp; Caractères ASCII (Wireshark Mode)</h3>
                </div>
                <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  Affichage standard 16 octets / ligne avec offset mémoire
                </span>
              </div>
              <div
                style={{
                  padding: "0.85rem 1.25rem",
                  background: "#090d16",
                  color: "#cbd5e1",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.76rem",
                  overflowX: "auto",
                  lineHeight: 1.6,
                }}
              >
                {decoded.hex_dump_lines.map((line, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "1.5rem" }}>
                    <span style={{ color: "#64748b" }}>{line.offset}</span>
                    <span style={{ color: "#38bdf8", minWidth: "360px", letterSpacing: "1px" }}>{line.hex}</span>
                    <span style={{ color: "#34d399", borderLeft: "1px solid #334155", paddingLeft: "1rem" }}>
                      {line.ascii}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
