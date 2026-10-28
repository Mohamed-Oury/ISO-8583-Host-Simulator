# Plateforme de Qualification, d'Homologation & d'Exploitation Monétique Multi-Canal ISO 8583

Plateforme complète de simulation, d'homologation UAT, d'injection d'incidents (**Chaos Engineering Monétique**) et de supervision d'un **Host d'Autorisation Émetteur ISO 8583**, conçue pour un **Exploitant, Ingénieur et Expert Monétique** en conformité stricte avec **PCI-DSS v4.0** :

- **Persistance MySQL Professionnelle (`payway_iso8583_simulator`) :** Stockage relationnel sur `127.0.0.1:8889` (`bank_accounts`, `atm_terminals`, `transaction_audit_log`, `chaos_incident_config`, `load_test_reports`) avec bascule transparente en mémoire.
- **Simulation Multi-Canal Réaliste (GAB / TPE / E-Commerce) :**
  - **GAB (ATM) :** Retrait espèces (`010000`), Consultation de solde (`310000` avec retour `DE 54`), algorithme glouton de distribution par cassettes (`10 000`, `5 000`, `2 000 FCFA`), pannes mécaniques (`CASH_JAM`, `PARTIAL_DISPENSE`, `CASSETTE_EMPTY`).
  - **TPE (POS) :** Achat EMV Contact (`051`), Sans-Contact NFC (`071` avec seuil `15 000 FCFA`), Fallback Piste Magnétique (`801`), Pré-autorisation Hôtel/Location (`0100` $\rightarrow$ `0110`), Remboursement marchand (`200000`).
  - **E-Commerce (CNP / Web) :** Paiement en ligne (`DE 22 = 812`, `DE 25 = 59`), contrôle cryptogramme `CVV2` et authentification forte **3-D Secure (`ECI 05` vs `ECI 07`)** via `DE 48`.
- **Moteur Décisionnel Bancaire Élargi (18 Règles `R00` + `R01`–`R13`) :** Court-circuit déterministe couvrant la sécurité technique/HSM, l'opposition/capture (`04`/`41`/`43`), les plafonds, les permissions par canal, l'anti-fraude (vélocité & fallback) et les coupures GAB.
- **Décomposition Bout-en-Bout de la Latence (Waterfall) :** Calcul fin par maillon (`Réseau d'Accès` $\rightarrow$ `Acquéreur` $\rightarrow$ `Switch Interbancaire` $\rightarrow$ `HSM Thales PayShield` $\rightarrow$ `Host CBS` $\rightarrow$ `Socket TCP`).
- **Laboratoire d'Incidents de Production (Chaos Engineering) :** Simulation en direct de `Host Down (91)` avec bascule **Stand-In Processing (STIP)**, `Time-out (68)` avec **Auto-Reversal `0400`**, pannes **HSM (`63`, `96`, `55`)**, bourrages GAB avec **Reversal Partiel/Total**, doublons `STAN (94)`, erreurs de format `(30)` et routage BIN `(92)`.
- **Catalogue de 24 Codes `DE 39` & Runbooks Exploitant :** Chaque code réponse est documenté avec sa sévérité, le maillon défaillant, la cause racine et la procédure opérateur pas-à-pas.
- **Charte Graphique Unifiée :** Palette harmonisée avec le projet `MONETIQUE` (Bordeaux `#7d1538` / `#a01e4a`, Rouge Société Générale `#e60028`, Deep Slate `#0f172a` / `#1e293b`).

---

## 🚀 Démarrage Rapide

### 1. Configuration MySQL (`.env`)
Le projet se connecte automatiquement à l'instance MySQL locale (MAMP/MySQL sur le port `8889`, identique au projet `MONETIQUE`) et crée la base `payway_iso8583_simulator` au démarrage :
```env
DATABASE_URL="mysql://root:root@127.0.0.1:8889/payway_iso8583_simulator"
MYSQL_HOST="127.0.0.1"
MYSQL_PORT="8889"
MYSQL_USER="root"
MYSQL_PASSWORD="root"
MYSQL_DATABASE="payway_iso8583_simulator"
```

### 2. Lancer le Backend (Serveur TCP Port 5001 + API FastAPI Port 8000)
```bash
.venv/bin/python3 main.py
```
- **Serveur TCP Host ISO 8583 :** Écoute sur `127.0.0.1:5001` (Cadrage binaire 2-octets Big-Endian `!H`).
- **API REST & Passerelle WebSocket :** Accessible sur `http://127.0.0.1:8000`.

### 3. Lancer le Frontend Next.js (Port 3000 / 3001)
```bash
cd frontend
npm run dev
```
- **Cockpit Exploitant Next.js :** Accessible sur [http://localhost:3001](http://localhost:3001) (ou `http://localhost:3000`).

### 4. Exécuter la Suite Complète de Qualification QA en CLI
```bash
.venv/bin/python3 run_tests.py
```
Exécute automatiquement :
1. **24 Épreuves Fonctionnelles** (`12 Homologation Normative` + `12 UAT Multi-Canal GAB/TPE/E-Commerce`).
2. **6 Épreuves QA Chaos & Incidents de Production** (`QA-CH01` à `QA-CH06`).
3. **Campagne de Charge Haute Fréquence (100 TPS)** avec vérification des SLAs ($p_{50} < 15\text{ ms}$, $p_{95} < 30\text{ ms}$, $p_{99} < 50\text{ ms}$, erreurs $= 0,00\%$).

---

- **Décodeur Dynamique de Trames ISO 8583 (Wireshark-Grade) :** Analyseur syntaxique temps réel pour trames monétiques bancaires (ASCII brut, Hexadécimal de production avec ou sans cadrage TCP 2-octets). Décomposition instantanée du MTI en 4 niveaux, matrice 64/128 bits interactive, extraction des Data Elements avec masquage PCI-DSS, décodeur TLV EMV (DE 55) et rejeu socket TCP.
- **Gestion des Utilisateurs & Rôles RBAC :** Gestion fine des accès opérateurs (`ADMIN`, `OPERATOR`, `AUDITOR`) avec journalisation des connexions et persistance MySQL.
- **Compensation & Télécollecte Interbancaire (Clearing) :** Génération et rapprochement des fichiers de clearing interbancaires conformes GIM-UEMOA / VISA / Mastercard.
- **Guide Utilisateur Professionnel PDF :** Manuel d'exploitation complet téléchargeable directement depuis l'application (`GUIDE_UTILISATEUR_SIMULATEUR_MONETIQUE_ISO8583.pdf`).
- **Conformité PCI-DSS v4.0 :** Masquage strict du PAN (6/4) et protection des données sensibles (SAD : PIN DE 52, CVV2 DE 48).

---

## 👨‍💻 Concepteur & Architecte

**M. Oury**  
*Ingénieur IT Banking & Architecte Monétique - CBS*  
*Spécialiste Systèmes d'Autorisation Bancaire, Switch Interbancaire & Monétique Internationale*
