#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur du Guide Utilisateur Officiel & Manuel d'Exploitation Monétique (HTML & PDF)
Projet : Simulateur Monétique Multi-Canal ISO 8583 (GAB / TPE / E-Commerce) & Chaos Lab
Auteur : M.Oury — Ingénieur IT BANKING & Expert Monétique - CBS
"""

import os

HTML_CONTENT = """<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Guide Utilisateur & Manuel d'Exploitation — Simulateur Monétique ISO 8583</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 16mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 9.5pt;
      line-height: 1.48;
    }
    code, pre {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    }
    .page-break {
      page-break-before: always;
    }

    /* PAGE DE GARDE */
    .cover {
      border: 2px solid #0f172a;
      border-top: 12px solid #7d1538;
      border-radius: 14px;
      padding: 28px 30px;
      background: linear-gradient(180deg, #fff1f2 0%, #ffffff 38%, #f8fafc 100%);
      margin-bottom: 18px;
    }
    .cover-top-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 7.5pt;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .badge-burgundy {
      background: #7d1538;
      color: #ffffff;
    }
    .badge-slate {
      background: #0f172a;
      color: #ffffff;
    }
    .badge-emerald {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .cover h1 {
      font-size: 21pt;
      font-weight: 900;
      color: #0f172a;
      margin: 0 0 8px 0;
      letter-spacing: -0.02em;
      line-height: 1.18;
    }
    .cover h2 {
      font-size: 12pt;
      font-weight: 700;
      color: #7d1538;
      margin: 0 0 14px 0;
    }
    .cover p.lead {
      font-size: 9.8pt;
      color: #334155;
      margin: 0 0 18px 0;
      line-height: 1.55;
    }
    .cover-meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid #cbd5e1;
    }
    .meta-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #7d1538;
      border-radius: 8px;
      padding: 8px 10px;
    }
    .meta-box .lbl {
      font-size: 7pt;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 700;
    }
    .meta-box .val {
      font-size: 8.8pt;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }

    /* TITRES DE CHAPITRES */
    .chapter-header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      border-left: 6px solid #7d1538;
      border-radius: 10px;
      padding: 10px 16px;
      margin: 18px 0 12px 0;
    }
    .chapter-header .ch-num {
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #fda4af;
      font-weight: 800;
    }
    .chapter-header h2 {
      margin: 2px 0 0 0;
      font-size: 13pt;
      font-weight: 800;
      color: #ffffff;
    }

    h3 {
      font-size: 10.5pt;
      font-weight: 800;
      color: #7d1538;
      margin: 12px 0 6px 0;
      padding-bottom: 3px;
      border-bottom: 1px solid #f1f5f9;
    }
    p {
      margin: 0 0 7px 0;
    }
    ul, ol {
      margin: 4px 0 9px 0;
      padding-left: 18px;
    }
    li {
      margin-bottom: 3.5px;
    }

    /* CARTES & ENCADRÉS */
    .card-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .card-grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-top: 3px solid #7d1538;
      border-radius: 8px;
      padding: 9px 11px;
      break-inside: avoid;
    }
    .info-card h4 {
      margin: 0 0 5px 0;
      font-size: 9.2pt;
      color: #0f172a;
      font-weight: 800;
    }
    .callout {
      background: #fff1f2;
      border: 1px solid #fecdd3;
      border-left: 4px solid #7d1538;
      border-radius: 8px;
      padding: 8px 12px;
      margin: 8px 0;
      font-size: 8.8pt;
      break-inside: avoid;
    }
    .callout-emerald {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      border-left: 4px solid #059669;
      border-radius: 8px;
      padding: 8px 12px;
      margin: 8px 0;
      font-size: 8.8pt;
      break-inside: avoid;
    }

    /* TABLEAUX */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 7px 0 11px 0;
      font-size: 8.2pt;
      break-inside: auto;
    }
    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 5.5px 8px;
      border: 1px solid #0f172a;
      font-size: 7.6pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .code-pill {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-weight: 700;
      font-size: 7.8pt;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      color: #0f172a;
    }
    .code-ok {
      background: #ecfdf5;
      border-color: #a7f3d0;
      color: #047857;
    }
    .code-err {
      background: #fef2f2;
      border-color: #fecaca;
      color: #b91c1c;
    }
    pre.cmd {
      background: #0f172a;
      color: #f8fafc;
      padding: 8px 11px;
      border-radius: 7px;
      font-size: 7.8pt;
      overflow-x: auto;
      margin: 5px 0 9px 0;
      line-height: 1.4;
    }
    .footer-sign {
      margin-top: 16px;
      padding-top: 10px;
      border-top: 2px solid #7d1538;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #475569;
    }
  </style>
</head>
<body>

  <!-- =====================================================================
       PAGE 1 : COUVERTURE, SOMMAIRE & ARCHITECTURE GLOBALE
       ===================================================================== -->
  <div class="cover">
    <div class="cover-top-badges">
      <span class="badge badge-burgundy">MANUEL OFFICIEL D'EXPLOITATION &amp; UAT</span>
      <span class="badge badge-slate">ISO 8583:1987 • TCP 2-BYTES BIG-ENDIAN</span>
      <span class="badge badge-emerald">CONFORME PCI-DSS v4.0 • MYSQL :8889</span>
    </div>
    <h1>GUIDE UTILISATEUR COMPLET — SIMULATEUR MONÉTIQUE MULTI-CANAL (GAB, TPE &amp; E-COMMERCE)</h1>
    <h2>Laboratoire d'Homologation Émetteur, Rejeu de Traces de Production, Waterfall de Latence &amp; Chaos Engineering</h2>
    <p class="lead">
      Ce document constitue le manuel de référence destiné aux <strong>Exploitants Monétiques (NOC)</strong>,
      <strong>Ingénieurs Monétiques &amp; Core Banking (CBS)</strong>, <strong>Analystes Homologation / Recette UAT</strong>
      et <strong>Auditeurs Sécurité PCI-DSS</strong>. Il détaille pas-à-pas le fonctionnement, le paramétrage et les procédures
      opérationnelles des <strong>7 pages spécialisées</strong> de la plateforme.
    </p>
    <div class="cover-meta-grid">
      <div class="meta-box">
        <div class="lbl">Auteur &amp; Architecte</div>
        <div class="val">M.Oury (Expert Monétique)</div>
      </div>
      <div class="meta-box">
        <div class="lbl">Canaux Supportés</div>
        <div class="val">GAB (ATM) • TPE (POS) • Web</div>
      </div>
      <div class="meta-box">
        <div class="lbl">Ports Réseau</div>
        <div class="val">TCP :5001 • API :8000 • UI :3000</div>
      </div>
      <div class="meta-box">
        <div class="lbl">Base de Données</div>
        <div class="val">MySQL :8889 (similateur_monetique)</div>
      </div>
    </div>
  </div>

  <div class="chapter-header">
    <div class="ch-num">Chapitre 1</div>
    <h2>Architecture Technique &amp; Flux de Bout-en-Bout</h2>
  </div>

  <p>
    Contrairement à une maquette statique, le <strong>Simulateur Monétique</strong> met en œuvre une véritable chaîne d'acquisition
    et d'autorisation bancaire sur <strong>socket TCP/IP asynchrone</strong> avec persistance relationnelle dans <strong>MySQL</strong> :
  </p>

  <div class="card-grid-2">
    <div class="info-card">
      <h4>1. Serveur Socket TCP ISO 8583 (Port 5001)</h4>
      <ul>
        <li>Écoute binaire permanente sur <code>127.0.0.1:5001</code>.</li>
        <li>Cadrage protocolaire <strong>2 octets Big-Endian (<code>struct.pack('!H', length)</code>)</strong> identique aux switchs de production (<em>PayWay, Base24, PowerCARD, Postilion</em>).</li>
        <li>Supporte les MTI <code>0800/0810</code> (Echo/Sign-On/Key Change), <code>0200/0210</code> (Autorisation financière) et <code>0400/0410</code> (Reversal d'annulation automatique ou manuelle).</li>
      </ul>
    </div>
    <div class="info-card">
      <h4>2. Moteur d'Arbitrage (18 Règles) &amp; Base MySQL (Port 8889)</h4>
      <ul>
        <li>Base MySQL <code>similateur_monetique</code> comprenant <strong>4 tables synchronisées en temps réel</strong> : <code>monetique_cards</code> (50+ cartes), <code>monetique_atms</code> (3 GAB avec cassettes), <code>monetique_transactions</code> (journal d'audit) et <code>monetique_load_tests</code>.</li>
        <li>Calcul de la <strong>cascade de latence (Waterfall)</strong> sur 4 segments : <em>Terminal &rarr; Switch</em>, <em>Switch &rarr; HSM</em>, <em>Moteur Règles &amp; CBS MySQL</em>, et <em>Retour Réseau</em>.</li>
      </ul>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Composant</th>
        <th style="width: 23%;">Adresse / Port</th>
        <th style="width: 55%;">Rôle Opérationnel &amp; Sécurité PCI-DSS v4.0</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Interface Web Next.js</strong></td>
        <td><code>http://localhost:3000</code></td>
        <td>Cockpit opérateur découpé en 7 pages dédiées, thème clair ergonomique <em>MONETIQUE</em>, WebSocket temps réel.</td>
      </tr>
      <tr>
        <td><strong>API REST &amp; WebSocket</strong></td>
        <td><code>http://127.0.0.1:8000</code></td>
        <td>Passerelle FastAPI d'orchestration, décodage/rejeu de trames brutes, contrôle du Chaos Lab et diffusion live (<code>/ws</code>).</td>
      </tr>
      <tr>
        <td><strong>Host TCP ISO 8583</strong></td>
        <td><code>127.0.0.1:5001</code></td>
        <td>Serveur d'autorisation Émetteur traitant les trames binaires ISO 8583:1987 avec débit/crédit atomique des soldes.</td>
      </tr>
      <tr>
        <td><strong>MySQL Server (MAMP)</strong></td>
        <td><code>127.0.0.1:8889</code></td>
        <td>Persistance relationnelle des cartes, cassettes GAB et journaux d'audit avec <strong>masquage PAN 6/4</strong> (<code>400012******0001</code>) et protection absolue des PIN/CVV2.</td>
      </tr>
    </tbody>
  </table>

  <div class="chapter-header">
    <div class="ch-num">Chapitre 2</div>
    <h2>Démarrage, Authentification RBAC &amp; Navigation Globale</h2>
  </div>

  <h3>2.1. Commandes de Lancement de la Plateforme</h3>
  <pre class="cmd"># 1. Démarrer le Backend Python (Serveur TCP :5001 + API FastAPI :8000 + Synchronisation MySQL :8889)
.venv/bin/python3 main.py

# 2. Démarrer le Frontend Next.js (Interface Opérateur sur http://localhost:3000)
cd frontend &amp;&amp; npm run dev</pre>

  <h3>2.2. Connexion RBAC (/login) &amp; Barre de Télémétrie Supérieure</h3>
  <p>
    La page <code>/login</code> propose <strong>3 profils métiers pré-configurés</strong> accessibles en 1 clic :
    <strong>Exploitant Monétique NOC</strong> (Supervision, Runbooks, Reversal 0400),
    <strong>Ingénieur QA &amp; Homologation UAT</strong> (Campagnes 24 cas, Simulateur, Charge 100 TPS) et
    <strong>Auditeur Sécurité PCI-DSS</strong> (Contrôle du masquage PAN/PIN/CVV2 et des règles d'arbitrage).
  </p>
  <p>
    Une fois connecté, l'interface affiche :
  </p>
  <ul>
    <li><strong>À gauche (Sidebar Ardoise)</strong> : Le statut en direct du serveur (<code>TCP :5001</code> et <code>MySQL :8889</code>), les 3 groupes de navigation (<em>EXPLOITATION</em>, <em>EXPERTISE &amp; OUTILS</em>, <em>RÉFÉRENTIELS &amp; MYSQL</em>) et les 3 boutons d'administration rapide en bas de barre : <code>⚡ Stop/Start TCP</code>, <code>↺ Reset DB</code> (restaure les 50 cartes, les 3 GAB et désactive le Chaos) et <code>🚪 Sortir</code>.</li>
    <li><strong>En haut (Header Fixe)</strong> : Le fil d'Ariane de la page active et les pastilles d'état (<code>🔥 CHAOS ACTIF</code> en cas d'incident injecté, <code>🟢 MySQL :8889</code>, <code>ISO 8583 • 2B BE</code>, <code>🟢 TCP :5001 Actif</code>, <code>↺ Actualiser</code>).</li>
    <li><strong>Sous le Header (Ruban des 4 KPI)</strong> : <em>Transactions Traitées</em> (avec latence moyenne et répartition GAB/TPE/E-Com), <em>Taux d'Approbation (Code 00)</em>, <em>Refus &amp; Reversals (0400)</em>, et <em>Référentiel &amp; Parc GAB</em> (nombre de cartes et liquidité totale).</li>
  </ul>

  <!-- =====================================================================
       PAGE 2 : GUIDE DÉTAILLÉ DES PAGES 1 & 2 (/homologation & /simulateur)
       ===================================================================== -->
  <div class="page-break"></div>

  <div class="chapter-header">
    <div class="ch-num">Chapitre 3</div>
    <h2>Guide Détaillé des 7 Pages de l'Application</h2>
  </div>

  <h3>3.1. Page 1 — Homologation &amp; UAT Multi-Canal (Route : <code>/homologation</code> ou <code>/</code>)</h3>
  <p>
    Cette page permet de certifier le bon fonctionnement du serveur d'autorisation à travers <strong>24 épreuves automatisées</strong> envoyées séquentiellement sur le socket TCP <code>127.0.0.1:5001</code> :
  </p>
  <ul>
    <li><strong>Bouton « ▶ Exécuter les 24 Épreuves (Homologation + UAT) »</strong> : Réinitialise l'environnement de test et exécute en une seule passe les <strong>12 cas normatifs d'homologation émetteur</strong> (<code>TC-01</code> à <code>TC-10</code> + <code>TC-0800</code> Echo + <code>TC-0400</code> Reversal) ainsi que les <strong>12 cas UAT Multi-Canaux</strong> (<code>TC-11</code> à <code>TC-22</code>).</li>
    <li><strong>Bannière « Passeport d'Homologation »</strong> : Affiche le taux de conformité global (cible <code>100.0% — 24/24 réussis</code>).</li>
    <li><strong>Filtres rapides</strong> : Filtrez le tableau par <em>Tous (24)</em>, <em>Socle Homologation (12)</em>, <em>Scénarios UAT (12)</em>, <em>Conformes</em> ou <em>Échecs</em>.</li>
    <li><strong>Action « Simuler ↗ » sur chaque ligne</strong> : Cliquez sur le bouton d'une ligne pour ouvrir directement la page <code>/simulateur?preset=TC-xx</code> avec tous les champs du cas pré-remplis.</li>
  </ul>

  <table>
    <thead>
      <tr>
        <th style="width: 9%;">ID</th>
        <th style="width: 11%;">Canal</th>
        <th style="width: 34%;">Scénario de Test (Homologation &amp; UAT)</th>
        <th style="width: 24%;">Carte / Condition</th>
        <th style="width: 10%;">DE 39</th>
        <th style="width: 12%;">Règle</th>
      </tr>
    </thead>
    <tbody>
      <tr><td><code>TC-01</code></td><td>TPE</td><td>Paiement EMV Contact Nominal (5 000 F)</td><td><code>400012...0001</code> (ACTIVE)</td><td><span class="code-pill code-ok">00</span></td><td><code>R00-OK</code></td></tr>
      <tr><td><code>TC-02</code></td><td>TPE</td><td>PAN Inexistant en base MySQL</td><td><code>400012...9999</code> (Inconnu)</td><td><span class="code-pill code-err">14</span></td><td><code>R01</code></td></tr>
      <tr><td><code>TC-03</code></td><td>TPE</td><td>Carte déclarée Volée (Opposition)</td><td><code>400012...0003</code> (STOLEN)</td><td><span class="code-pill code-err">43</span></td><td><code>R02</code></td></tr>
      <tr><td><code>TC-04</code></td><td>TPE</td><td>Carte Expirée (DE 14 = 2401)</td><td><code>400012...0002</code> (Exp 2401)</td><td><span class="code-pill code-err">54</span></td><td><code>R03</code></td></tr>
      <tr><td><code>TC-05</code></td><td>TPE</td><td>Code PIN Erroné (DE 52 = 0000)</td><td><code>400012...0001</code> (PIN 1234)</td><td><span class="code-pill code-err">55</span></td><td><code>R05</code></td></tr>
      <tr><td><code>TC-06</code></td><td>TPE</td><td>Tentatives PIN Dépassées (3 échecs)</td><td><code>400012...0004</code> (pin_tries=3)</td><td><span class="code-pill code-err">75</span></td><td><code>R04</code></td></tr>
      <tr><td><code>TC-07</code></td><td>TPE</td><td>Dépassement Plafond Unitaire (50 000 F &gt; 30 000 F)</td><td><code>400012...0005</code></td><td><span class="code-pill code-err">61</span></td><td><code>R07</code></td></tr>
      <tr><td><code>TC-08</code></td><td>TPE</td><td>Dépassement Plafond Journalier 24h</td><td><code>400012...0006</code></td><td><span class="code-pill code-err">65</span></td><td><code>R08</code></td></tr>
      <tr><td><code>TC-09</code></td><td>TPE</td><td>Solde Disponible Insuffisant (30 000 F &gt; 12 000 F)</td><td><code>400012...0007</code></td><td><span class="code-pill code-err">51</span></td><td><code>R09</code></td></tr>
      <tr><td><code>TC-10</code></td><td>TPE</td><td>Devise Étrangère (USD 840) non autorisée</td><td><code>400012...0001</code> (Locale)</td><td><span class="code-pill code-err">58</span></td><td><code>R06</code></td></tr>
      <tr><td><code>TC-11</code></td><td>GAB</td><td>Retrait Espèces GAB Nominal (25 000 F = 2x10k + 1x5k)</td><td><code>400012...0001</code> on <code>GAB00001</code></td><td><span class="code-pill code-ok">00</span></td><td><code>R11-OK</code></td></tr>
      <tr><td><code>TC-12</code></td><td>GAB</td><td>Consultation de Solde GAB (DE 3=310000 &rarr; Solde DE 54)</td><td><code>400012...0001</code></td><td><span class="code-pill code-ok">00</span></td><td><code>R11-BAL</code></td></tr>
      <tr><td><code>TC-13</code></td><td>GAB</td><td>Montant Retrait Non Multiple des Cassettes (5 500 F)</td><td><code>400012...0001</code> on <code>GAB00001</code></td><td><span class="code-pill code-err">13</span></td><td><code>R11</code></td></tr>
      <tr><td><code>TC-14</code></td><td>TPE</td><td>Paiement Sans Contact NFC &le; 15 000 F sans PIN (10 000 F)</td><td><code>DE 22 = 071</code></td><td><span class="code-pill code-ok">00</span></td><td><code>R12-NFC</code></td></tr>
      <tr><td><code>TC-15</code></td><td>TPE</td><td>Paiement Sans Contact NFC &gt; 15 000 F sans PIN (20 000 F)</td><td><code>DE 22 = 071</code></td><td><span class="code-pill code-err">65</span></td><td><code>R12</code></td></tr>
      <tr><td><code>TC-16</code></td><td>TPE</td><td>Fallback Piste Magnétique sur Carte EMV (DE 22 = 801)</td><td><code>DE 22 = 801</code></td><td><span class="code-pill code-err">59</span></td><td><code>R12</code></td></tr>
      <tr><td><code>TC-17</code></td><td>ECOM</td><td>Achat E-Commerce Nominal avec CVV2 valide &amp; 3DS ECI 05</td><td><code>DE 22 = 812</code>, <code>CVV2=123</code></td><td><span class="code-pill code-ok">00</span></td><td><code>R13-OK</code></td></tr>
      <tr><td><code>TC-18</code></td><td>ECOM</td><td>Achat E-Commerce avec CVV2 Erroné (CVV2=999)</td><td><code>DE 22 = 812</code>, <code>CVV2=999</code></td><td><span class="code-pill code-err">05</span></td><td><code>R13</code></td></tr>
      <tr><td><code>TC-19</code></td><td>ECOM</td><td>Achat E-Commerce &gt; 25 000 F sans 3-D Secure (ECI 07)</td><td><code>60 000 F</code>, <code>3DS=N</code></td><td><span class="code-pill code-err">05</span></td><td><code>R13</code></td></tr>
      <tr><td><code>TC-20</code></td><td>ECOM</td><td>Carte avec Canal E-Commerce Désactivé</td><td><code>400012...0011</code></td><td><span class="code-pill code-err">57</span></td><td><code>R10</code></td></tr>
      <tr><td><code>TC-21</code></td><td>GAB</td><td>Instruction de Capture Physique Carte au GAB</td><td><code>400012...0012</code> (CAPTURE)</td><td><span class="code-pill code-err">04</span></td><td><code>R02</code></td></tr>
      <tr><td><code>TC-22</code></td><td>TPE</td><td>Dépassement Vélocité Horaire Anti-Fraude (&ge; 5 tx/h)</td><td><code>400012...0013</code> (Vélocité)</td><td><span class="code-pill code-err">59</span></td><td><code>R08b</code></td></tr>
      <tr><td><code>0800</code></td><td>NET</td><td>Echo Test Réseau (MTI 0800 &rarr; 0810, DE 70 = 301)</td><td>Test de vie Switch</td><td><span class="code-pill code-ok">00</span></td><td><code>NET-ECHO</code></td></tr>
      <tr><td><code>0400</code></td><td>TPE</td><td>Annulation / Reversal Financier (MTI 0400 &rarr; 0410, DE 90)</td><td>Recréditation solde</td><td><span class="code-pill code-ok">00</span></td><td><code>REV-0400</code></td></tr>
    </tbody>
  </table>

  <h3>3.2. Page 2 — Simulateur GAB / TPE / E-Commerce &amp; Rejoueur Prod (Route : <code>/simulateur</code>)</h3>
  <p>
    C'est le laboratoire principal d'injection et de reproduction de cas réels. Il se compose de <strong>4 zones complémentaires</strong> :
  </p>
  <ol>
    <li><strong>En-tête &amp; Ruban des 12 Scénarios Rapides</strong> : Permet de charger en 1 clic n'importe quel cas type (Retrait GAB, Solde DE 54, Coupure invalide, NFC, Fallback, E-Commerce 3DS, Capture, Vélocité, Reversal 0400).</li>
    <li><strong>Laboratoire « 🧬 Rejouer / Décoder Trame Brute Prod »</strong> (bouton en haut à droite de l'en-tête) :
      <ul>
        <li>Collez n'importe quelle trame brute issue d'un log de production (en <strong>ASCII</strong> ou en <strong>Hexadécimal</strong>, avec ou sans les 2 octets d'entête TCP).</li>
        <li>Cliquez sur <strong>« 🔍 Décoder &amp; Pré-remplir Formulaire »</strong> pour extraire tous les Data Elements (<code>MTI</code>, <code>Bitmap</code>, <code>DE 2</code> à <code>DE 90</code>) et pré-remplir automatiquement le simulateur, OU cliquez sur <strong>« 🚀 Rejouer sur Socket TCP :5001 »</strong> pour envoyer les octets bruts tels quels (y compris une trame volontairement corrompue pour tester <code>DE 39 = 30 Format Error</code>).</li>
      </ul>
    </li>
    <li><strong>Sélecteur de Canal (GAB / TPE / E-Commerce) &amp; Formulaire Dynamique</strong> :
      <ul>
        <li>Adapte automatiquement les champs selon le canal : <strong>GAB</strong> (Opération <code>010000</code> Retrait ou <code>310000</code> Solde, choix du GAB et état des cassettes 10k/5k/2k), <strong>TPE</strong> (Mode d'entrée <code>051</code> Puce EMV, <code>071</code> Sans Contact NFC, <code>801</code> Fallback Piste, MCC), <strong>E-Commerce</strong> (CVV2, statut 3-D Secure <code>Y/N/U</code> et ECI <code>05/06/07</code>).</li>
        <li><strong>Provisionnement MySQL en 1 clic</strong> : Si vous saisissez un PAN de production inconnu, un bandeau jaune vous propose <strong>« ➕ Créer ce PAN dans MySQL (500k F) »</strong> pour l'enregistrer immédiatement sans quitter la page.</li>
      </ul>
    </li>
    <li><strong>Panneau de Diagnostic Temps Réel (à droite)</strong> :
      <ul>
        <li>Affiche le <strong>Verdict (DE 39)</strong>, le code d'autorisation <strong>DE 38</strong>, le détail des billets distribués par cassette (sur GAB), la <strong>Cascade de Latence (Waterfall 4 segments en ms)</strong>, et 3 onglets : <em>Runbook Exploitant</em>, <em>Data Elements Décodés</em> et <em>Trames Brutes ASCII/HEX</em>.</li>
      </ul>
    </li>
  </ol>

  <!-- =====================================================================
       PAGE 3 : GUIDE DÉTAILLÉ DES PAGES 3, 4, 5, 6 & 7
       ===================================================================== -->
  <div class="page-break"></div>

  <h3>3.3. Page 3 — Supervision NOC &amp; Logs TCP (Route : <code>/supervision</code>)</h3>
  <ul>
    <li><strong>Bannière d'Alerting NOC</strong> : Surveille en continu le taux d'approbation global et déclenche une alerte visuelle dès que le taux passe sous <code>80%</code> ou qu'un code critique (<code>91</code> Host Down, <code>68</code> Timeout, <code>96/63</code> Panne HSM, <code>30</code> Format Error) survient.</li>
    <li><strong>Mode « 📊 Inspecteur d'Audit MySQL »</strong> : Liste toutes les transactions enregistrées dans la table MySQL <code>monetique_transactions</code> avec filtres par canal (<em>GAB, TPE, ECOM</em>) et par statut (<em>Approuvés 00, Rejets, Incidents Critiques</em>).</li>
    <li><strong>Fiche Diagnostic Interactive &amp; Actions Rapides NOC</strong> : Cliquez sur n'importe quelle transaction du tableau pour ouvrir son inspecteur à droite (Waterfall de latence, composant défaillant, Runbook pas-à-pas) et déclencher en 1 clic :
      <ul>
        <li><code>📡 Envoyer Echo Test 0800</code> (vérifie la disponibilité immédiate du socket TCP 5001),</li>
        <li><code>↺ Émettre Reversal 0400 sur ce STAN</code> (annule la transaction sélectionnée et recrédite le porteur),</li>
        <li><code>🛡️ Purger Chaos / Rétablir Host &amp; HSM</code> (remet immédiatement le système en état nominal).</li>
      </ul>
    </li>
    <li><strong>Mode « 📡 Console Flux TCP Brut »</strong> : Affiche le flux réseau WebSocket en direct avec masquage PCI-DSS v4.0.</li>
  </ul>

  <h3>3.4. Page 4 — Incidents Prod, Chaos Lab &amp; Cassettes GAB (Route : <code>/chaos</code>)</h3>
  <p>
    Cette page permet aux exploitants et ingénieurs QA de déclencher des <strong>incidents de production réalistes sans modifier le code</strong> :
  </p>
  <div class="card-grid-2">
    <div class="info-card">
      <h4>Pannes Réseau, Host CBS &amp; Stand-In (STIP)</h4>
      <ul>
        <li><strong>Panne Host Émetteur (<code>DE 39 = 91</code>)</strong> : Simule l'indisponibilité du Core Banking System.</li>
        <li><strong>Secours Stand-In Processing (STIP)</strong> : Lorsqu'il est activé pendant une panne Host, le switch approuve localement les transactions &le; au plafond STIP (ex. <code>50 000 FCFA</code>) si la carte est active et solvable.</li>
        <li><strong>Timeout &amp; Auto-Reversal 0400 (<code>DE 39 = 68</code>)</strong> : Injecte une latence supérieure au SLA et déclenche automatiquement une trame <code>0400 Reversal</code> pour éviter tout débit fantôme.</li>
      </ul>
    </div>
    <div class="info-card">
      <h4>Pannes HSM Cryptographique &amp; Matériel GAB</h4>
      <ul>
        <li><strong>Panne HSM</strong> : Simule <code>HSM_DOWN (DE 39=96)</code>, <code>MAC_ERROR (DE 39=63)</code> ou <code>ZPK_PARITY_ERROR (DE 39=55)</code>.</li>
        <li><strong>Anomalies Protocole</strong> : Contrôle d'idempotence <code>Duplicate STAN (DE 39=94)</code>, corruption bitmap <code>Format Error (DE 39=30)</code>, et table de routage BIN <code>Routing Error (DE 39=92)</code>.</li>
        <li><strong>Gestionnaire des 3 GAB MySQL</strong> : Videz une coupure (<code>10 000 F</code>, <code>5 000 F</code>, <code>2 000 F</code>), simulez un bourrage (<code>CASH_JAM</code>) ou cliquez sur <strong>« 🏧 Recharger Cassettes GAB »</strong>.</li>
      </ul>
    </div>
  </div>

  <h3>3.5. Page 5 — Laboratoire de Charge &amp; Benchmark 100 TPS (Route : <code>/charge</code>)</h3>
  <ul>
    <li>Permet de régler la <strong>Cadence Cible (10 à 150 TPS)</strong> et la <strong>Durée du tir (1 à 15 secondes)</strong> pour injecter en parallèle des centaines de trames financières <code>0200</code> sur le socket TCP <code>:5001</code>.</li>
    <li>Calcule en temps réel via WebSocket la distribution des temps de réponse : <strong>Médiane (p50)</strong>, <strong>95e centile (p95)</strong>, <strong>99e centile (p99)</strong> et taux d'erreur, puis sauvegarde le résultat dans la table MySQL <code>monetique_load_tests</code>.</li>
    <li>Génère automatiquement le <strong>Procès-Verbal Officiel d'Homologation (Markdown)</strong> téléchargeable en 1 clic.</li>
  </ul>

  <h3>3.6. Page 6 — Référentiel des 18 Règles &amp; 24 Runbooks DE 39 (Route : <code>/regles</code>)</h3>
  <ul>
    <li><strong>Vue « 📐 18 Règles d'Arbitrage (R00-R13) »</strong> : Documente l'ordre exact d'évaluation par court-circuit (Priorité 0 : Chaos/Technique/HSM/STIP &rarr; Priorités 1 à 10 : Socle Émetteur &rarr; Priorité 11 : GAB &rarr; Priorité 12 : TPE &rarr; Priorité 13 : E-Commerce).</li>
    <li><strong>Vue « 🛠️ Catalogue des 24 Codes DE 39 &amp; Runbooks »</strong> : Moteur de recherche instantané par code (<code>00</code>, <code>05</code>, <code>14</code>, <code>30</code>, <code>51</code>, <code>55</code>, <code>68</code>, <code>91</code>, <code>96</code>...) affichant la cause racine et la procédure opérateur.</li>
  </ul>

  <h3>3.7. Page 7 — Référentiel MySQL des 50+ Cartes &amp; BIN de Prod (Route : <code>/cartes</code>)</h3>
  <ul>
    <li>Explorez les 50 cartes pré-chargées dans MySQL (<code>monetique_cards</code>) avec recherche instantanée par PAN, nom porteur ou statut.</li>
    <li><strong>Bouton « ➕ Créer un Porteur / BIN de Prod »</strong> : Créez n'importe quel numéro de carte (12 à 19 chiffres) pour reproduire un cas client de production avec son solde exact, son code PIN, son CVV2, sa date d'expiration (<code>YYMM</code>) et ses droits par canal.</li>
    <li><strong>Bouton « Éditer » sur chaque ligne</strong> : Modifiez à chaud le solde, le statut (<code>ACTIVE</code>, <code>STOLEN</code>, <code>LOST</code>, <code>CAPTURE</code>, <code>WATCHLIST</code>, <code>SUSPENDED</code>), les plafonds, le compteur d'échecs PIN ou la vélocité horaire.</li>
  </ul>

  <!-- =====================================================================
       PAGE 4 : RECETTES PRATIQUES PAS-À-PAS (RUNBOOKS D'EXPLOITATION)
       ===================================================================== -->
  <div class="page-break"></div>

  <div class="chapter-header">
    <div class="ch-num">Chapitre 4</div>
    <h2>Fiches Pratiques Pas-à-Pas (Reproduction d'Incidents de Production)</h2>
  </div>

  <div class="callout">
    <strong>Cas Pratique N°1 — Reproduire un rejet client réel observé en Production (BIN/PAN spécifique ou Trame Log Switch)</strong>
    <ol style="margin-top: 5px;">
      <li>Ouvrez la page <strong><code>/cartes</code></strong> et cliquez sur <strong>« ➕ Créer un Porteur / BIN de Prod »</strong> (ou utilisez directement le bouton rapide sous le champ PAN dans <code>/simulateur</code>).</li>
      <li>Renseignez le PAN du cas (ex. <code>4970109988776655</code>), le solde exact du client au moment de l'incident, sa date d'expiration (<code>DE 14</code>), son PIN (<code>DE 52</code>), son CVV2 et ses plafonds, puis cliquez sur <strong>Enregistrer dans MySQL</strong>.</li>
      <li>Rendez-vous sur <strong><code>/simulateur</code></strong> :
        <ul>
          <li><em>Si vous disposez de la trame brute (ASCII ou Hex) extraite des logs du switch :</em> cliquez sur <strong>« 🧬 Rejouer / Décoder Trame Brute Prod »</strong>, collez la trame et cliquez sur <strong>« 🔍 Décoder &amp; Pré-remplir Formulaire »</strong> ou <strong>« 🚀 Rejouer sur Socket TCP :5001 »</strong>.</li>
          <li><em>Si vous disposez des paramètres du ticket d'incident :</em> choisissez le canal (<code>GAB</code>, <code>TPE</code> ou <code>ECOM</code>), renseignez le montant et cliquez sur <strong>Envoyer la Transaction</strong>.</li>
        </ul>
      </li>
      <li>Observez dans le panneau de droite la règle exacte déclenchée (<code>R00</code> à <code>R13</code>), le code <code>DE 39</code> retourné et le Runbook associé.</li>
    </ol>
  </div>

  <div class="callout-emerald">
    <strong>Cas Pratique N°2 — Simuler une Panne du Core Banking (DE 39 = 91) et Valider le Secours Stand-In (STIP)</strong>
    <ol style="margin-top: 5px;">
      <li>Allez sur la page <strong><code>/chaos</code></strong> (<em>Incidents Prod &amp; Chaos Lab</em>).</li>
      <li>Activez l'interrupteur <strong>« Panne Host CBS Émetteur (DE 39 = 91) »</strong> en laissant <em>Stand-In Processing (STIP)</em> désactivé.</li>
      <li>Allez sur <strong><code>/simulateur</code></strong> et envoyez un paiement TPE de <code>15 000 FCFA</code> : la transaction est rejetée avec <strong><code>DE 39 = 91 (Issuer or Switch Inoperative)</code></strong>.</li>
      <li>Retournez sur <strong><code>/chaos</code></strong>, activez <strong>« Autorisation Secours Stand-In (STIP) »</strong> avec un plafond de <code>50 000 FCFA</code>.</li>
      <li>Relancez le paiement de <code>15 000 FCFA</code> sur <strong><code>/simulateur</code></strong> : la transaction est cette fois <strong>Approuvée en secours (<code>DE 39 = 00</code>, Règle <code>R00-STIP</code>)</strong> ! Essayez ensuite avec <code>75 000 FCFA</code> (&gt; plafond STIP) : le serveur retourne bien <code>DE 39 = 91</code>.</li>
    </ol>
  </div>

  <div class="callout">
    <strong>Cas Pratique N°3 — Simuler un Time-out Réseau (DE 39 = 68) avec Auto-Reversal 0400 et Vérification Comptable MySQL</strong>
    <ol style="margin-top: 5px;">
      <li>Sur la page <strong><code>/chaos</code></strong>, activez <strong>« Simuler Time-out Réseau (DE 39 = 68 + Auto-Reversal 0400) »</strong>.</li>
      <li>Sur <strong><code>/simulateur</code></strong>, sélectionnez la carte <code>4000123456780001</code> (solde initial <code>500 000 FCFA</code>) et lancez un retrait GAB de <code>25 000 FCFA</code>.</li>
      <li>Le simulateur affiche <strong><code>DE 39 = 68 (Response Received Too Late)</code></strong> ainsi que la bannière <strong>« Auto-Reversal 0400 Exécuté »</strong> confirmant que le solde MySQL du porteur a été intégralement protégé/recrédité à <code>500 000 FCFA</code>.</li>
      <li>Vérifiez la trace complète dans <strong><code>/supervision</code></strong>, puis cliquez sur <strong>« 🛡️ Rétablir État Nominal »</strong> pour revenir à la normale.</li>
    </ol>
  </div>

  <div class="chapter-header">
    <div class="ch-num">Chapitre 5</div>
    <h2>Aide-Mémoire des Principaux Data Elements ISO 8583 Utilisés</h2>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 10%;">Champ</th>
        <th style="width: 16%;">Format</th>
        <th style="width: 34%;">Nom Normalisé ISO 8583:1987</th>
        <th style="width: 40%;">Usage dans le Simulateur &amp; Règle PCI-DSS</th>
      </tr>
    </thead>
    <tbody>
      <tr><td><code>DE 2</code></td><td><code>LLVAR ..19</code></td><td>Primary Account Number (PAN)</td><td>Numéro de carte porteur — <strong>Masqué 6/4 (<code>400012******0001</code>) dans tous les logs</strong>.</td></tr>
      <tr><td><code>DE 3</code></td><td><code>FIXED 6</code></td><td>Processing Code</td><td><code>000000</code> (Achat TPE/Web), <code>010000</code> (Retrait GAB), <code>310000</code> (Solde GAB).</td></tr>
      <tr><td><code>DE 4</code></td><td><code>FIXED 12</code></td><td>Amount, Transaction</td><td>Montant sur 12 chiffres zéro-paddés (ex. <code>000000025000</code> pour 25 000 FCFA).</td></tr>
      <tr><td><code>DE 11</code></td><td><code>FIXED 6</code></td><td>System Trace Audit Number (STAN)</td><td>Numéro d'audit unique de la transaction (contrôlé par l'anti-rejeu <code>DE 39 = 94</code>).</td></tr>
      <tr><td><code>DE 14</code></td><td><code>FIXED 4</code></td><td>Date, Expiration (YYMM)</td><td>Date d'expiration de la carte (contrôlée par la règle <code>R03 &rarr; DE 39 = 54</code>).</td></tr>
      <tr><td><code>DE 18</code></td><td><code>FIXED 4</code></td><td>Merchant Category Code (MCC)</td><td><code>6011</code> (Automate GAB), <code>5411</code> (Supermarché TPE), <code>5732</code> (E-Commerce).</td></tr>
      <tr><td><code>DE 22</code></td><td><code>FIXED 3</code></td><td>POS Entry Mode</td><td><code>051</code> (Puce EMV), <code>071</code> (Sans Contact NFC), <code>801</code> (Fallback Piste), <code>812</code> (Web).</td></tr>
      <tr><td><code>DE 38</code></td><td><code>FIXED 6</code></td><td>Authorization ID Response</td><td>Code d'autorisation alphanumérique généré par le Host lors d'un accord (<code>DE 39 = 00</code>).</td></tr>
      <tr><td><code>DE 39</code></td><td><code>FIXED 2</code></td><td>Response Code</td><td>Verdict d'autorisation (<code>00</code> Approuvé, <code>05</code> Refus, <code>14</code> PAN inconnu, <code>51</code> Solde, <code>91</code> Host Down...).</td></tr>
      <tr><td><code>DE 41 / 42</code></td><td><code>FIXED 8 / 15</code></td><td>Terminal ID (TID) / Merchant ID</td><td>Identifiant de l'automate (ex. <code>GAB00001</code>) et de l'accepteur.</td></tr>
      <tr><td><code>DE 48</code></td><td><code>LLLVAR</code></td><td>Additional Private Data</td><td>Données E-Commerce (<code>CVV2=***;3DS=Y;ECI=05</code>) — <strong>CVV2 masqué PCI-DSS</strong>.</td></tr>
      <tr><td><code>DE 49</code></td><td><code>FIXED 3</code></td><td>Currency Code</td><td>Code devise ISO 4217 (<code>952</code> = XOF / FCFA, <code>840</code> = USD, <code>978</code> = EUR).</td></tr>
      <tr><td><code>DE 52</code></td><td><code>FIXED 16</code></td><td>PIN Data Block</td><td>Bloc PIN chiffré — <strong>Intégralement masqué (<code>****************</code>) dans les logs</strong>.</td></tr>
      <tr><td><code>DE 54</code></td><td><code>LLLVAR</code></td><td>Additional Amounts</td><td>Retourne le solde disponible du compte lors d'une consultation de solde GAB (<code>DE 3 = 310000</code>).</td></tr>
      <tr><td><code>DE 90</code></td><td><code>FIXED 42</code></td><td>Original Data Elements</td><td>Référence de la transaction originale à annuler dans un message <code>0400 Reversal</code>.</td></tr>
    </tbody>
  </table>

  <div class="footer-sign">
    <span><strong>Simulateur Monétique Multi-Canal ISO 8583</strong> — Guide Utilisateur &amp; Manuel d'Exploitation</span>
    <span>&copy; 2026 <strong>M.Oury</strong> — Ingénieur IT BANKING &amp; Expert Monétique - CBS</span>
  </div>

</body>
</html>
"""

def main():
    import shutil
    import subprocess

    os.makedirs("docs", exist_ok=True)
    html_path = os.path.abspath("docs/GUIDE_UTILISATEUR_SIMULATEUR_MONETIQUE_ISO8583.html")
    pdf_path = os.path.abspath("GUIDE_UTILISATEUR_SIMULATEUR_MONETIQUE_ISO8583.pdf")
    public_pdf_path = os.path.abspath("frontend/public/GUIDE_UTILISATEUR_SIMULATEUR_MONETIQUE_ISO8583.pdf")

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(HTML_CONTENT)
    print(f"HTML generated at: {html_path}")

    chrome_bin = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if os.path.exists(chrome_bin):
        subprocess.run(
            [
                chrome_bin,
                "--headless",
                "--disable-gpu",
                "--no-pdf-header-footer",
                f"--print-to-pdf={pdf_path}",
                f"file://{html_path}",
            ],
            check=True,
        )
        if os.path.exists(pdf_path):
            os.makedirs(os.path.dirname(public_pdf_path), exist_ok=True)
            shutil.copyfile(pdf_path, public_pdf_path)
            print(f"PDF generated at: {pdf_path} ({os.path.getsize(pdf_path)} bytes)")
            print(f"Public PDF copied to: {public_pdf_path}")


if __name__ == "__main__":
    main()

