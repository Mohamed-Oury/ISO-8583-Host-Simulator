"use client";

import { useState, useEffect } from "react";
import {
  AppUser,
  fetchUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
} from "@/lib/api";

const AVAILABLE_ROLES = [
  {
    role: "SUPER_ADMIN",
    label: "Super Administrateur",
    badge: "👑 Super Admin",
    bg: "#f3e8ff",
    text: "#6b21a8",
    border: "#d8b4fe",
    desc: "Contrôle total : gestion des utilisateurs, arrêt/relance Host, réinitialisation base",
  },
  {
    role: "ADMIN",
    label: "Administrateur Monétique",
    badge: "🛡️ Admin",
    bg: "#e0e7ff",
    text: "#1e40af",
    border: "#bfdbfe",
    desc: "Administration des cartes, cassettes GAB, configuration Chaos et règles",
  },
  {
    role: "ROLE_EXPLOITATION",
    label: "Exploitant Monétique NOC",
    badge: "⚡ Exploitation NOC",
    bg: "#ecfdf5",
    text: "#047857",
    border: "#a7f3d0",
    desc: "Supervision des flux TCP, émission Echo 0800 et Reversal 0400",
  },
  {
    role: "ROLE_HOMOLOGATION",
    label: "Ingénieur Homologation & UAT",
    badge: "⊞ Recette UAT",
    bg: "#ffe4e6",
    text: "#be123c",
    border: "#fecdd3",
    desc: "Exécution des 24 cas d'homologation et simulateur multi-canal",
  },
  {
    role: "ROLE_CHAOS",
    label: "Ingénieur Chaos & Performance",
    badge: "🚨 Chaos & 100 TPS",
    bg: "#fef3c7",
    text: "#92400e",
    border: "#fde68a",
    desc: "Injection de pannes Host/HSM/GAB et bancs de charge 100 TPS",
  },
  {
    role: "ROLE_PCI_DSS",
    label: "Auditeur Sécurité PCI-DSS",
    badge: "🔒 Sécurité & Audit",
    bg: "#f1f5f9",
    text: "#334155",
    border: "#cbd5e1",
    desc: "Audit des logs masqués (PAN 6/4, PIN) et intégrité comptable",
  },
];

function getRoleBadge(role: string) {
  const found = AVAILABLE_ROLES.find((r) => r.role === role);
  if (found) {
    return {
      bg: found.bg,
      text: found.text,
      border: found.border,
      badge: found.badge,
    };
  }
  return {
    bg: "#f4f4f5",
    text: "#52525b",
    border: "#e4e4e7",
    badge: role,
  };
}

export default function UsersManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Modale Création
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("123456");
  const [createDepartment, setCreateDepartment] = useState("Direction Monétique & Systèmes de Paiement");
  const [createRoles, setCreateRoles] = useState<string[]>(["ROLE_EXPLOITATION"]);
  const [creating, setCreating] = useState(false);

  // Modale Édition
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modale Mot de Passe
  const [pwdUser, setPwdUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState("admin123");
  const [savingPwd, setSavingPwd] = useState(false);

  const loadAllUsers = async () => {
    try {
      setLoading(true);
      const res = await fetchUsers();
      if (res && res.users) {
        setUsers(res.users);
      }
    } catch (e: any) {
      setFeedback({ type: "error", message: "Erreur chargement utilisateurs : " + e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllUsers();
  }, []);

  const showToast = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Filtrage
  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q) ||
      u.roles.some((r) => r.toLowerCase().includes(q));

    if (!matchSearch) return false;
    if (roleFilter !== "ALL") {
      return u.role === roleFilter || u.roles.includes(roleFilter);
    }
    return true;
  });

  // Gestion Création
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.includes("@")) {
      showToast("error", "Veuillez saisir une adresse email valide.");
      return;
    }
    if (createRoles.length === 0) {
      showToast("error", "Veuillez attribuer au moins un rôle à l'utilisateur.");
      return;
    }
    setCreating(true);
    try {
      await createUser({
        name: createName.trim(),
        email: createEmail.trim(),
        password: createPassword.trim(),
        role: createRoles[0],
        roles: createRoles,
        department: createDepartment.trim(),
        active: true,
      });
      showToast("success", `Utilisateur ${createName} créé avec succès.`);
      setShowCreateModal(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("123456");
      setCreateRoles(["ROLE_EXPLOITATION"]);
      await loadAllUsers();
    } catch (err: any) {
      showToast("error", err.message || "Erreur de création");
    } finally {
      setCreating(false);
    }
  };

  // Gestion Édition
  const openEditModal = (u: AppUser) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditDepartment(u.department || "Monétique");
    setEditRoles(u.roles || [u.role]);
    setEditActive(u.active);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      await updateUser(editingUser.id, {
        name: editName.trim(),
        department: editDepartment.trim(),
        role: editRoles[0] || editingUser.role,
        roles: editRoles,
        active: editActive,
      });
      showToast("success", `Profil de ${editName} mis à jour avec succès.`);
      setEditingUser(null);
      await loadAllUsers();
    } catch (err: any) {
      showToast("error", err.message || "Erreur de mise à jour");
    } finally {
      setSavingEdit(false);
    }
  };

  // Bascule statut Actif / Suspendu
  const handleToggle = async (u: AppUser) => {
    try {
      await toggleUserStatus(u.id);
      showToast("success", `Statut de ${u.name} mis à jour.`);
      await loadAllUsers();
    } catch (err: any) {
      showToast("error", err.message || "Erreur de modification statut");
    }
  };

  // Réinitialisation mot de passe
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdUser) return;
    setSavingPwd(true);
    try {
      await resetUserPassword(pwdUser.id, newPassword);
      showToast("success", `Mot de passe de ${pwdUser.name} réinitialisé.`);
      setPwdUser(null);
      setNewPassword("admin123");
    } catch (err: any) {
      showToast("error", err.message || "Erreur mot de passe");
    } finally {
      setSavingPwd(false);
    }
  };

  // Suppression
  const handleDelete = async (u: AppUser) => {
    if (
      !confirm(
        `Êtes-vous sûr de vouloir supprimer définitivement le compte de ${u.name} (${u.email}) ?`
      )
    ) {
      return;
    }
    try {
      await deleteUser(u.id);
      showToast("success", `Utilisateur ${u.name} supprimé.`);
      await loadAllUsers();
    } catch (err: any) {
      showToast("error", err.message || "Erreur suppression");
    }
  };

  // Compteurs statistiques
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.active).length;
  const suspendedCount = totalCount - activeCount;
  const superAdminCount = users.filter((u) => u.roles.includes("SUPER_ADMIN")).length;

  return (
    <div className="homologation-container">
      {/* HEADER SECTION */}
      <div className="pane-header-enhanced">
        <div className="pane-header-main">
          <div className="pane-title-group">
            <div className="pane-badge-wrapper">
              <span className="badge-chip emerald">
                <span className="status-indicator-dot" />
                CONTRÔLE D'ACCÈS RBAC &amp; GOUVERNANCE
              </span>
              <span className="badge-chip subtle">BASE MYSQL : PAYWAY_ISO8583_SIMULATOR</span>
            </div>
            <h2 className="pane-title">Gestion des Utilisateurs &amp; Droits d'Exploitation</h2>
            <p className="pane-subtitle">
              Gestion centralisée des comptes opérateurs, habilitations par pôle (NOC, Homologation UAT, Chaos Lab, Audit PCI-DSS) et synchronisation MySQL.
            </p>
          </div>

          <div className="pane-actions-group">
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-glow"
              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span>➕</span>
              <span>Nouvel Utilisateur</span>
            </button>
            <button
              onClick={loadAllUsers}
              disabled={loading}
              className="btn btn-outline"
              title="Actualiser la liste depuis MySQL"
            >
              <span>↺</span>
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* TOOLBAR AVEC RECHERCHE ET FILTRES DE RÔLES */}
        <div className="pane-header-toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", flex: 1 }}>
            <div style={{ position: "relative", minWidth: "260px" }}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, email, département..."
                className="form-control"
                style={{ paddingLeft: "2.2rem", fontSize: "0.82rem" }}
              />
              <span
                style={{
                  position: "absolute",
                  left: "0.75rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                  fontSize: "0.85rem",
                }}
              >
                🔍
              </span>
            </div>

            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setRoleFilter("ALL")}
                className={`preset-btn ${roleFilter === "ALL" ? "btn-primary" : ""}`}
                style={{ fontSize: "0.74rem" }}
              >
                Tous ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("SUPER_ADMIN")}
                className={`preset-btn ${roleFilter === "SUPER_ADMIN" ? "btn-primary" : ""}`}
                style={{ fontSize: "0.74rem" }}
              >
                👑 Super Admins ({superAdminCount})
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("ROLE_EXPLOITATION")}
                className={`preset-btn ${roleFilter === "ROLE_EXPLOITATION" ? "btn-primary" : ""}`}
                style={{ fontSize: "0.74rem" }}
              >
                ⚡ Exploitation NOC
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("ROLE_HOMOLOGATION")}
                className={`preset-btn ${roleFilter === "ROLE_HOMOLOGATION" ? "btn-primary" : ""}`}
                style={{ fontSize: "0.74rem" }}
              >
                ⊞ Recette UAT
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("ROLE_CHAOS")}
                className={`preset-btn ${roleFilter === "ROLE_CHAOS" ? "btn-primary" : ""}`}
                style={{ fontSize: "0.74rem" }}
              >
                🚨 Chaos &amp; TPS
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("ROLE_PCI_DSS")}
                className={`preset-btn ${roleFilter === "ROLE_PCI_DSS" ? "btn-primary" : ""}`}
                style={{ fontSize: "0.74rem" }}
              >
                🔒 Audit PCI-DSS
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK TOAST */}
      {feedback && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            background: feedback.type === "success" ? "#ecfdf5" : "#fef2f2",
            border: `1px solid ${feedback.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            color: feedback.type === "success" ? "#047857" : "#b91c1c",
            fontSize: "0.85rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            {feedback.type === "success" ? "✅" : "⚠️"} {feedback.message}
          </span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* RUBAN KPI STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>
            TOTAL UTILISATEURS
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>
            {totalCount}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Enregistrés dans MySQL
          </div>
        </div>

        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>
            COMPTES ACTIFS
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#047857", marginTop: "4px" }}>
            {activeCount}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Session autorisée
          </div>
        </div>

        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>
            COMPTES SUSPENDUS
          </div>
          <div
            style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              color: suspendedCount > 0 ? "#dc2626" : "var(--text-primary)",
              marginTop: "4px",
            }}
          >
            {suspendedCount}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Accès bloqué
          </div>
        </div>

        <div className="card" style={{ padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>
            SUPER ADMINISTRATEURS
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--burgundy)", marginTop: "4px" }}>
            {superAdminCount}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Privilèges racine
          </div>
        </div>
      </div>

      {/* TABLEAU DES UTILISATEURS */}
      <div className="table-container-enhanced">
        <table className="data-table-enhanced">
          <thead>
            <tr>
              <th style={{ width: "45px" }}>#</th>
              <th style={{ minWidth: "180px" }}>UTILISATEUR</th>
              <th style={{ minWidth: "180px" }}>EMAIL &amp; MATRICULE</th>
              <th style={{ minWidth: "180px" }}>DÉPARTEMENT / PÔLE</th>
              <th style={{ minWidth: "220px" }}>RÔLES &amp; HABILITATIONS</th>
              <th style={{ width: "115px", textAlign: "center" }}>STATUT</th>
              <th style={{ width: "110px" }}>CRÉÉ LE</th>
              <th style={{ width: "135px", textAlign: "right" }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  Aucun utilisateur trouvé avec les critères actuels.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, idx) => {
                const isSuper = u.roles.includes("SUPER_ADMIN");
                const initial = u.name.charAt(0).toUpperCase();

                return (
                  <tr key={u.id}>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>{idx + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: isSuper ? "var(--sg-red-50)" : "#f1f5f9",
                            color: isSuper ? "var(--burgundy)" : "var(--text-primary)",
                            border: `1px solid ${isSuper ? "var(--sg-red-200)" : "#cbd5e1"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "0.85rem",
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{u.name}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            ID: {u.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: "0.78rem", color: "var(--text-primary)" }}>{u.email}</code>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      {u.department || "Monétique"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                        {u.roles.map((r) => {
                          const badgeStyle = getRoleBadge(r);
                          return (
                            <span
                              key={r}
                              style={{
                                padding: "2px 7px",
                                borderRadius: "5px",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                background: badgeStyle.bg,
                                color: badgeStyle.text,
                                border: `1px solid ${badgeStyle.border}`,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {badgeStyle.badge}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleToggle(u)}
                        style={{
                          background: u.active ? "#ecfdf5" : "#fef2f2",
                          border: `1px solid ${u.active ? "#a7f3d0" : "#fecaca"}`,
                          color: u.active ? "#047857" : "#b91c1c",
                          borderRadius: "999px",
                          padding: "3px 9px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title={u.active ? "Cliquer pour suspendre" : "Cliquer pour activer"}
                      >
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: u.active ? "#10b981" : "#ef4444",
                          }}
                        />
                        {u.active ? "Actif" : "Suspendu"}
                      </button>
                    </td>
                    <td style={{ fontSize: "0.74rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {u.created_at ? u.created_at.slice(0, 10) : "--"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.35rem" }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="btn-action-test"
                          title="Modifier le compte"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => setPwdUser(u)}
                          className="btn-action-test"
                          title="Changer le mot de passe"
                        >
                          🔑
                        </button>
                        {!isSuper && (
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            className="btn-action-test"
                            style={{ color: "#dc2626" }}
                            title="Supprimer l'utilisateur"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODALE CRÉATION D'UTILISATEUR */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "560px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div className="card-header">
              <h3 style={{ color: "var(--burgundy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>➕</span>
                <span>Créer un Nouvel Utilisateur Opérateur</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="form-group" style={{ marginBottom: "0.85rem" }}>
                <label>Nom Complet &amp; Titre *</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Ex: Oury Diallo (Ingénieur Monétique)"
                  className="form-control"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group col-6">
                  <label>Email Professionnel *</label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="ex: odiallo@bank.ci"
                    className="form-control"
                    required
                  />
                </div>
                <div className="form-group col-6">
                  <label>Mot de Passe Initial *</label>
                  <input
                    type="text"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    className="form-control font-mono"
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Département / Direction</label>
                <input
                  type="text"
                  value={createDepartment}
                  onChange={(e) => setCreateDepartment(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                <label style={{ fontWeight: 700, marginBottom: "0.4rem" }}>Habilitations &amp; Rôles RBAC *</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {AVAILABLE_ROLES.map((r) => {
                    const checked = createRoles.includes(r.role);
                    return (
                      <label
                        key={r.role}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.6rem",
                          padding: "0.55rem 0.75rem",
                          borderRadius: "8px",
                          border: checked ? "1px solid var(--burgundy)" : "1px solid var(--border-light)",
                          background: checked ? "var(--sg-red-50)" : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setCreateRoles(createRoles.filter((x) => x !== r.role));
                            } else {
                              setCreateRoles([...createRoles, r.role]);
                            }
                          }}
                          style={{ marginTop: "3px" }}
                        />
                        <div>
                          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {r.badge} — {r.label}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                            {r.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-outline"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary btn-glow"
                >
                  {creating ? "Création en cours..." : "Créer l'Utilisateur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE ÉDITION D'UTILISATEUR */}
      {editingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "560px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div className="card-header">
              <h3 style={{ color: "var(--burgundy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>✏️</span>
                <span>Modifier le Profil Opérateur</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="form-group" style={{ marginBottom: "0.85rem" }}>
                <label>Nom Complet &amp; Titre *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group col-7">
                  <label>Email Professionnel (Identifiant)</label>
                  <input
                    type="email"
                    value={editEmail}
                    disabled
                    className="form-control"
                    style={{ background: "#f1f5f9", color: "#64748b" }}
                  />
                </div>
                <div className="form-group col-5">
                  <label>Statut d'Accès</label>
                  <select
                    value={editActive ? "ACTIVE" : "SUSPENDED"}
                    onChange={(e) => setEditActive(e.target.value === "ACTIVE")}
                    className="form-control"
                  >
                    <option value="ACTIVE">Actif (Autorisé)</option>
                    <option value="SUSPENDED">Suspendu (Bloqué)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Département / Direction</label>
                <input
                  type="text"
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                <label style={{ fontWeight: 700, marginBottom: "0.4rem" }}>Habilitations &amp; Rôles RBAC</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {AVAILABLE_ROLES.map((r) => {
                    const checked = editRoles.includes(r.role);
                    return (
                      <label
                        key={r.role}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.6rem",
                          padding: "0.55rem 0.75rem",
                          borderRadius: "8px",
                          border: checked ? "1px solid var(--burgundy)" : "1px solid var(--border-light)",
                          background: checked ? "var(--sg-red-50)" : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setEditRoles(editRoles.filter((x) => x !== r.role));
                            } else {
                              setEditRoles([...editRoles, r.role]);
                            }
                          }}
                          style={{ marginTop: "3px" }}
                        />
                        <div>
                          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                            {r.badge} — {r.label}
                          </div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                            {r.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="btn btn-outline"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn btn-primary btn-glow"
                >
                  {savingEdit ? "Enregistrement..." : "Enregistrer les Modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE RÉINITIALISATION MOT DE PASSE */}
      {pwdUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            className="card"
            style={{ width: "100%", maxWidth: "440px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}
          >
            <div className="card-header">
              <h3 style={{ color: "var(--burgundy)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>🔑</span>
                <span>Réinitialiser Mot de Passe</span>
              </h3>
              <button
                type="button"
                onClick={() => setPwdUser(null)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPassword}>
              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "1rem" }}>
                Définissez un nouveau mot de passe pour <strong>{pwdUser.name}</strong> (<code>{pwdUser.email}</code>).
              </p>

              <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                <label>Nouveau Mot de Passe *</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-control font-mono"
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
                <button
                  type="button"
                  onClick={() => setPwdUser(null)}
                  className="btn btn-outline"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingPwd}
                  className="btn btn-primary btn-glow"
                >
                  {savingPwd ? "Mise à jour..." : "Appliquer le Mot de Passe"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
