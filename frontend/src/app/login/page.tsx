"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./login.module.css";
import { saveUserSession } from "@/lib/auth";
import { loginUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [role, setRole] = useState("Auditeur Monétique Principal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!username || !password) {
      setError("Veuillez saisir votre identifiant et votre mot de passe.");
      setLoading(false);
      return;
    }

    try {
      const res = await loginUser(username.trim(), password.trim());
      if (res && res.user) {
        saveUserSession({
          id: res.user.id,
          username: res.user.email.split("@")[0],
          email: res.user.email,
          name: res.user.name,
          role: res.user.role,
          roles: res.user.roles,
          organization: "Banque Centrale & Réseau Interbancaire",
          department: res.user.department,
          loginTime: new Date().toLocaleTimeString(),
        });
        router.push("/homologation");
        return;
      }
    } catch (err: any) {
      // Si l'API retourne une erreur 401 ou compte désactivé, on l'affiche
      if (err.message && (err.message.includes("incorrect") || err.message.includes("désactivé"))) {
        setError(err.message);
        setLoading(false);
        return;
      }
      // Mode secours si API injoignable
      saveUserSession({
        username: username.trim(),
        name: username.charAt(0).toUpperCase() + username.slice(1),
        role: role,
        organization: "Banque Centrale & Réseau Interbancaire",
        loginTime: new Date().toLocaleTimeString(),
      });
      router.push("/homologation");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setUsername("admin");
    setPassword("admin123");
    setRole("Superviseur Homologation");
  };

  return (
    <main className={styles.loginContainer}>
      {/* PANE GAUCHE : ILLUSTRATION BANCAIRE & SÉCURITÉ */}
      <section className={styles.heroSection}>
        <Image
          src="/login-banner.jpg"
          alt="Plateforme de Qualification Monétique ISO 8583"
          fill
          priority
          className={styles.heroImage}
        />
        <div className={styles.heroOverlay} />

        <div className={styles.heroTop}>
          <div className={styles.heroLogo}>
            <div className={styles.heroChip}>
              <span />
              <span />
              <span />
            </div>
            <div>
              <div className={styles.heroSubtitle}>SYSTÈME MONÉTIQUE NATIONAL</div>
              <h1 className={styles.heroTitle}>ISO 8583 Host Simulator</h1>
            </div>
          </div>
        </div>

        <div className={styles.heroBottom}>
          <div className={styles.heroHeadline}>
            Plateforme Complète d'Ingénierie &amp; Homologation Monétique ISO 8583
          </div>
          <p className={styles.heroDesc}>
            Environnement de qualification bancaire certifié : simulateur multi-canal (GAB, TPE EMV/NFC, E-Commerce 3DS), décodeur dynamique de trames, rejeu de paquets, moteur de compensation (Clearing GIM-UEMOA), chaos lab et gestion RBAC.
          </p>

          <div className={styles.heroPills}>
            <div className={styles.heroPill}>
              <span>🏧</span> GAB / ATM &amp; Cassettes
            </div>
            <div className={styles.heroPill}>
              <span>💳</span> TPE EMV &amp; Sans-Contact
            </div>
            <div className={styles.heroPill}>
              <span>🌐</span> E-Com &amp; 3-D Secure 2.0
            </div>
            <div className={styles.heroPill}>
              <span>🔍</span> Décodeur Dynamique ISO
            </div>
            <div className={styles.heroPill}>
              <span>⚡</span> 100 TPS / Rejeu TCP :5001
            </div>
            <div className={styles.heroPill}>
              <span>🛡️</span> PCI-DSS &amp; Sécurité HSM
            </div>
          </div>

          <div
            style={{
              marginTop: "1.25rem",
              padding: "0.6rem 0.9rem",
              background: "rgba(125, 21, 56, 0.45)",
              border: "1px solid rgba(245, 158, 11, 0.5)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              backdropFilter: "blur(8px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem" }}>✍️</span>
              <div style={{ fontSize: "0.78rem", color: "#fef08a", fontWeight: 700 }}>
                Conçu &amp; Réalisé par M. Oury
              </div>
            </div>
            <span
              style={{
                fontSize: "0.7rem",
                color: "#e2e8f0",
                background: "rgba(15, 23, 42, 0.6)",
                padding: "2px 8px",
                borderRadius: "4px",
                border: "1px solid rgba(255, 255, 255, 0.15)",
              }}
            >
              Ingénieur IT Banking &amp; Expert Monétique - CBS
            </span>
          </div>
        </div>
      </section>

      {/* PANE DROIT : FORMULAIRE D'AUTHENTIFICATION */}
      <section className={styles.formSection}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <div className={styles.badgePci}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              PORTAIL D'HOMOLOGATION SÉCURISÉ
            </div>
            <h2 className={styles.formTitle}>Connexion Opérateur</h2>
            <p className={styles.formSubtitle}>
              Authentifiez-vous pour accéder au banc d'essais, au simulateur TPE et aux métriques du serveur d'autorisation.
            </p>
          </div>

          <div className={styles.quickFillBox}>
            <span>Compte de démonstration pré-configuré :</span>
            <button type="button" onClick={handleQuickDemo} className={styles.quickFillBtn}>
              Remplissage Rapide
            </button>
          </div>

          {error && (
            <div style={{ color: "#ef4444", fontSize: "0.85rem", background: "rgba(239,68,68,0.1)", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.3)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.loginForm}>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="login-username">
                Identifiant / Matricule
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: admin ou opérateur"
                className={styles.inputField}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="login-password">
                Mot de Passe Sécurisé
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className={styles.inputField}
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.inputLabel} htmlFor="login-role">
                Rôle & Habilitation
              </label>
              <select
                id="login-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={styles.inputField}
              >
                <option value="Auditeur Monétique Principal">Auditeur Monétique Principal</option>
                <option value="Superviseur Homologation">Superviseur Homologation</option>
                <option value="Ingénieur Bancaire Système">Ingénieur Bancaire Système</option>
                <option value="Opérateur Production Host">Opérateur Production Host</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-block btn-glow"
              style={{ marginTop: "0.75rem", padding: "0.85rem" }}
            >
              {loading ? (
                <span>Vérification des accréditations...</span>
              ) : (
                <>
                  <span>🔐</span> Se Connecter au Système d'Homologation
                </>
              )}
            </button>

            <div className={styles.securityNote}>
              <span>🔒</span>
              <span>Session auditée conformément à la norme PCI-DSS • Chiffrement SSL/TLS</span>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
