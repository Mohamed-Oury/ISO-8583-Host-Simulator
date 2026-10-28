"use client";

import { useState, useEffect } from "react";
import { BankAccount, createAccount, updateAccount } from "@/lib/api";

interface EditAccountModalProps {
  account: BankAccount | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditAccountModal({ account, onClose, onSaved }: EditAccountModalProps) {
  const isCreating = Boolean(account && account.pan === "");

  const [pan, setPan] = useState("4970101234560099");
  const [cardholderName, setCardholderName] = useState("CLIENT PRODUCTION TEST");
  const [cardProduct, setCardProduct] = useState("VISA PREMIER XOF");
  const [exp, setExp] = useState("2812");
  const [pin, setPin] = useState("1234");
  const [cvv2, setCvv2] = useState("123");
  const [balance, setBalance] = useState(500000);
  const [dailySpent, setDailySpent] = useState(0);
  const [status, setStatus] = useState("ACTIVE");
  const [pinTries, setPinTries] = useState(0);
  const [maxTxLimit, setMaxTxLimit] = useState(300000);
  const [dailyCeiling, setDailyCeiling] = useState(1000000);
  const [allowAtm, setAllowAtm] = useState(true);
  const [allowPos, setAllowPos] = useState(true);
  const [allowEcom, setAllowEcom] = useState(true);
  const [allowInternational, setAllowInternational] = useState(false);
  const [threedsEnrolled, setThreedsEnrolled] = useState(true);
  const [txCountHour, setTxCountHour] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account) {
      if (account.pan === "") {
        // Mode Création d'un porteur sur-mesure
        setPan("497010123456" + String(Math.floor(1000 + Math.random() * 9000)));
        setCardholderName("PORTEUR PROD SUR-MESURE");
        setCardProduct("VISA PREMIER XOF");
        setExp("2812");
        setPin("1234");
        setCvv2("123");
        setBalance(500000);
        setDailySpent(0);
        setStatus("ACTIVE");
        setPinTries(0);
        setMaxTxLimit(300000);
        setDailyCeiling(1000000);
        setAllowAtm(true);
        setAllowPos(true);
        setAllowEcom(true);
        setAllowInternational(false);
        setThreedsEnrolled(true);
        setTxCountHour(0);
        setNotes("Cas réel de production créé par l'exploitant");
      } else {
        setPan(account.pan);
        setCardholderName(account.cardholder_name || "PORTEUR TEST");
        setCardProduct(account.card_product || "VISA CLASSIC XOF");
        setExp(account.exp || "2812");
        setPin(account.pin || "1234");
        setCvv2(account.cvv2 || "123");
        setBalance(account.balance);
        setDailySpent(account.daily_spent || 0);
        setStatus(account.status);
        setPinTries(account.pin_tries);
        setMaxTxLimit(account.max_tx_limit);
        setDailyCeiling(account.daily_ceiling);
        setAllowAtm(account.channel_gab_enabled ?? account.allow_atm ?? true);
        setAllowPos(account.channel_tpe_enabled ?? account.allow_pos ?? true);
        setAllowEcom(account.channel_ecom_enabled ?? account.allow_ecom ?? true);
        setAllowInternational(account.international_enabled ?? account.allow_international ?? false);
        setThreedsEnrolled(account.threeds_enrolled ?? true);
        setTxCountHour(account.velocity_tx_1h ?? account.tx_count_hour ?? 0);
        setNotes(account.notes || "");
      }
    }
  }, [account]);

  if (!account) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isCreating) {
        await createAccount({
          pan: pan.trim(),
          cardholder_name: cardholderName,
          card_product: cardProduct,
          exp,
          pin,
          cvv2,
          balance,
          daily_spent: dailySpent,
          status,
          pin_tries: pinTries,
          max_tx_limit: maxTxLimit,
          daily_ceiling: dailyCeiling,
          allow_atm: allowAtm,
          allow_pos: allowPos,
          allow_ecom: allowEcom,
          allow_international: allowInternational,
          threeds_enrolled: threedsEnrolled,
          tx_count_hour: txCountHour,
          notes,
        });
      } else {
        await updateAccount({
          pan: account.pan,
          cardholder_name: cardholderName,
          card_product: cardProduct,
          exp,
          pin,
          cvv2,
          balance,
          daily_spent: dailySpent,
          status,
          pin_tries: pinTries,
          max_tx_limit: maxTxLimit,
          daily_ceiling: dailyCeiling,
          allow_atm: allowAtm,
          allow_pos: allowPos,
          allow_ecom: allowEcom,
          allow_international: allowInternational,
          threeds_enrolled: threedsEnrolled,
          tx_count_hour: txCountHour,
          notes,
        });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      alert("Erreur lors de la sauvegarde MySQL : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "1rem",
      }}
    >
      <div
        className="card"
        style={{
          width: "96%",
          maxWidth: "660px",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#ffffff",
          border: "1px solid var(--border-light)",
          borderRadius: "16px",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.25)",
        }}
      >
        <div className="card-header" style={{ borderColor: "var(--border-light)" }}>
          <div>
            <h3 style={{ color: "var(--text-primary)", fontWeight: "700" }}>
              {isCreating
                ? "➕ Créer un Porteur / BIN de Production Sur-Mesure (MySQL)"
                : `✏️ Éditer Porteur MySQL — ${account.cardholder_name || account.masked_pan}`}
            </h3>
            <div className="font-mono text-muted" style={{ fontSize: "0.75rem" }}>
              {isCreating
                ? "Définissez librement le PAN/BIN, PIN, CVV2, l'expiration et les plafonds pour reproduire un cas réel"
                : `${account.masked_pan} • ${account.card_product || "VISA"}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              fontSize: "1.5rem",
              cursor: "pointer",
            }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Ligne 1 : PAN, Nom Porteur, Gamme */}
          <div className="form-row">
            <div className="form-group col-4">
              <label>PAN (12-19 chiffres, DE 2) :</label>
              <input
                type="text"
                value={pan}
                onChange={(e) => setPan(e.target.value.replace(/\D/g, ""))}
                disabled={!isCreating}
                maxLength={19}
                className="form-control font-mono"
                placeholder="Ex: 4970101234560001"
                required
              />
            </div>
            <div className="form-group col-4">
              <label>Nom du Porteur :</label>
              <input
                type="text"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
                className="form-control"
                required
              />
            </div>
            <div className="form-group col-4">
              <label>Produit / Gamme Carte :</label>
              <select
                value={cardProduct}
                onChange={(e) => setCardProduct(e.target.value)}
                className="form-control"
              >
                <option value="VISA PREMIER XOF">VISA PREMIER XOF</option>
                <option value="VISA CLASSIC XOF">VISA CLASSIC XOF</option>
                <option value="VISA INFINITE">VISA INFINITE</option>
                <option value="MASTERCARD GOLD">MASTERCARD GOLD</option>
                <option value="MASTERCARD PLATINUM">MASTERCARD PLATINUM</option>
                <option value="GIM-UEMOA RETRAIT">GIM-UEMOA RETRAIT</option>
              </select>
            </div>
          </div>

          {/* Ligne 2 : Données Cryptographiques & Expiration (DE 14, DE 52, CVV2) */}
          <div className="form-row">
            <div className="form-group col-4">
              <label>Expiration YYMM (DE 14) :</label>
              <input
                type="text"
                value={exp}
                onChange={(e) => setExp(e.target.value)}
                maxLength={4}
                className="form-control font-mono"
                placeholder="2812"
                required
              />
            </div>
            <div className="form-group col-4">
              <label>Code PIN Référence (DE 52) :</label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={6}
                className="form-control font-mono"
                placeholder="1234"
                required
              />
            </div>
            <div className="form-group col-4">
              <label>Code CVV2 / CVC2 (DE 48) :</label>
              <input
                type="text"
                value={cvv2}
                onChange={(e) => setCvv2(e.target.value)}
                maxLength={4}
                className="form-control font-mono"
                placeholder="123"
                required
              />
            </div>
          </div>

          {/* Ligne 3 : Solde & Statut */}
          <div className="form-row">
            <div className="form-group col-6">
              <label htmlFor="modal-bal">Solde Disponible (FCFA) :</label>
              <input
                id="modal-bal"
                type="number"
                value={balance}
                onChange={(e) => setBalance(Number(e.target.value))}
                className="form-control font-mono"
                min="0"
                required
              />
            </div>

            <div className="form-group col-6">
              <label htmlFor="modal-stat">Statut de la Carte :</label>
              <select
                id="modal-stat"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="form-control"
              >
                <option value="ACTIVE">ACTIVE - Opérationnelle (00)</option>
                <option value="STOLEN">STOLEN - Volée (Rejet 43)</option>
                <option value="LOST">LOST - Perdue (Rejet 41)</option>
                <option value="CAPTURE">CAPTURE - Ordre Capture GAB (04)</option>
                <option value="WATCHLIST">WATCHLIST - Surveillance Fraude (01)</option>
                <option value="SUSPENDED">SUSPENDED - Bloquée (Rejet 57)</option>
              </select>
            </div>
          </div>

          {/* Ligne 4 : Plafonds & Cumul 24h */}
          <div className="form-row">
            <div className="form-group col-4">
              <label>Plafond Unitaire (FCFA) :</label>
              <input
                type="number"
                value={maxTxLimit}
                onChange={(e) => setMaxTxLimit(Number(e.target.value))}
                className="form-control font-mono"
                min="0"
              />
            </div>
            <div className="form-group col-4">
              <label>Plafond Journalier 24h :</label>
              <input
                type="number"
                value={dailyCeiling}
                onChange={(e) => setDailyCeiling(Number(e.target.value))}
                className="form-control font-mono"
                min="0"
              />
            </div>
            <div className="form-group col-4">
              <label>Cumul Déjà Consommé 24h :</label>
              <input
                type="number"
                value={dailySpent}
                onChange={(e) => setDailySpent(Number(e.target.value))}
                className="form-control font-mono"
                min="0"
              />
            </div>
          </div>

          {/* Ligne 5 : Compteurs PIN & Vélocité + Notes */}
          <div className="form-row">
            <div className="form-group col-4">
              <label htmlFor="modal-tries">Échecs PIN (Seuil = 3) :</label>
              <input
                id="modal-tries"
                type="number"
                value={pinTries}
                onChange={(e) => setPinTries(Number(e.target.value))}
                className="form-control font-mono"
                min="0"
                max="10"
              />
            </div>
            <div className="form-group col-4">
              <label>Vélocité Horaire (tx/1h) :</label>
              <input
                type="number"
                value={txCountHour}
                onChange={(e) => setTxCountHour(Number(e.target.value))}
                className="form-control font-mono"
                min="0"
                max="50"
              />
            </div>
            <div className="form-group col-4">
              <label>Note / Ticket Incident :</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="form-control"
                placeholder="Ex: Ticket INC-4092"
              />
            </div>
          </div>

          {/* Permissions Canaux */}
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid var(--border-light)",
              borderRadius: "10px",
              padding: "0.85rem",
            }}
          >
            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
              Droits par Canal &amp; Sécurité Carte :
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.8rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={allowAtm} onChange={(e) => setAllowAtm(e.target.checked)} />
                <span>🏧 Retraits GAB (allow_atm)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={allowPos} onChange={(e) => setAllowPos(e.target.checked)} />
                <span>💳 Paiements TPE (allow_pos)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={allowEcom} onChange={(e) => setAllowEcom(e.target.checked)} />
                <span>🌐 Paiements E-Com (allow_ecom)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input type="checkbox" checked={threedsEnrolled} onChange={(e) => setThreedsEnrolled(e.target.checked)} />
                <span>🛡️ Enrôlé 3-D Secure (3DS)</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={allowInternational}
                  onChange={(e) => setAllowInternational(e.target.checked)}
                />
                <span>🌍 Devises Internationales (USD/EUR)</span>
              </label>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary btn-glow">
              {saving
                ? "Persistance MySQL..."
                : isCreating
                ? "➕ Créer la Carte dans MySQL"
                : "💾 Enregistrer dans MySQL"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
