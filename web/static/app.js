/**
 * ISO 8583 Host Authorization Platform - Frontend Logic
 * Contrôleur interactif, communication WebSocket et moteur d'essais.
 */

// État global de l'application
const state = {
  ws: null,
  wsConnected: false,
  serverRunning: true,
  host: "127.0.0.1",
  port: 5001,
  accounts: [],
  testCases: [],
  rules: [],
  kpis: {
    totalTx: 0,
    approved: 0,
    rejected: 0,
    totalLatencyMs: 0
  },
  loadTestTargetTPS: 100,
  loadTestDuration: 10,
  latestLoadReport: ""
};

// Initialisation au chargement du DOM
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initWebSocket();
  initHeaderControls();
  initTestSuite();
  initSimulator();
  initAccounts();
  initLoadTest();
  initRulesMatrix();
  initLogs();

  // Chargement initial des données
  refreshStatus();
  loadAccounts();
  loadTestDefinitions();
  loadRules();
});

// ==========================================================================
// 1. GESTION DES ONGLETS (TABS)
// ==========================================================================
function initTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const targetPaneId = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.remove("active");
        if (pane.id === targetPaneId) {
          pane.classList.add("active");
        }
      });
    });
  });

  // Sous-onglets de l'inspecteur dans le simulateur
  document.querySelectorAll(".insp-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".insp-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.insp;
      document.querySelectorAll(".insp-content").forEach(c => c.style.display = "none");
      document.getElementById(target).style.display = "block";
    });
  });
}

// ==========================================================================
// 2. WEBSOCKET TEMPS RÉEL & LOGS
// ==========================================================================
function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  function connect() {
    state.ws = new WebSocket(wsUrl);

    state.ws.onopen = () => {
      state.wsConnected = true;
      appendTerminalLog("SYSTEM", "Connexion WebSocket temps réel établie.");
    };

    state.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsEvent(msg);
      } catch (e) {
        console.error("Erreur parsing message WS :", e);
      }
    };

    state.ws.onclose = () => {
      state.wsConnected = false;
      setTimeout(connect, 3000); // Reconnexion auto
    };
  }

  connect();
}

function handleWsEvent(event) {
  const type = event.type;

  if (type === "INITIAL_STATE" || type === "SERVER_START" || type === "SERVER_STOP") {
    refreshStatus();
  }

  if (type === "TRANSACTION_0800") {
    state.kpis.totalTx++;
    state.kpis.approved++;
    updateKpis();
    appendTerminalLog("TRANSACTION_0800", event.message || "Message 0800 traité.");
  }

  if (type === "TRANSACTION_0200") {
    state.kpis.totalTx++;
    if (event.code === "00") {
      state.kpis.approved++;
    } else {
      state.kpis.rejected++;
    }
    updateKpis();
    appendTerminalLog("TRANSACTION_0200", event.message || `0200: DE 39 = ${event.code}`);
  }

  if (type === "TRANSACTION_0400") {
    state.kpis.totalTx++;
    updateKpis();
    appendTerminalLog("TRANSACTION_0400", event.message || `0400: Reversal DE 39 = ${event.code}`);
  }

  if (type === "ACCOUNTS_RESET") {
    loadAccounts();
    appendTerminalLog("SYSTEM", event.message);
  }

  if (type === "LOAD_TEST_PROGRESS") {
    updateLoadTestProgress(event.data);
  }

  if (type === "LOAD_TEST_COMPLETE") {
    handleLoadTestComplete(event.data);
  }

  if (type === "LOAD_TEST_ERROR") {
    handleLoadTestError(event.error);
  }
}

function appendTerminalLog(type, message) {
  const term = document.getElementById("terminal-logs");
  if (!term) return;

  const now = new Date().toTimeString().split(" ")[0];
  const line = document.createElement("div");
  line.className = "log-line";
  line.innerHTML = `
    <span class="log-time">[${now}]</span>
    <span class="log-type ${type}">${type}</span>
    <span class="log-msg">${escapeHtml(message)}</span>
  `;
  term.appendChild(line);

  // Auto-scroll si coché
  const autoscroll = document.getElementById("chk-autoscroll");
  if (autoscroll && autoscroll.checked) {
    term.scrollTop = term.scrollHeight;
  }
}

function updateKpis() {
  document.getElementById("val-total-tx").textContent = state.kpis.totalTx.toLocaleString();
  document.getElementById("val-approved-count").textContent = state.kpis.approved.toLocaleString();
  document.getElementById("val-rejections-count").textContent = state.kpis.rejected.toLocaleString();

  const total = state.kpis.approved + state.kpis.rejected;
  const rate = total > 0 ? ((state.kpis.approved / total) * 100).toFixed(1) : 100;
  document.getElementById("val-approval-rate").textContent = `${rate}%`;
}

// ==========================================================================
// 3. HEADER & CONTRÔLES SERVEUR
// ==========================================================================
function initHeaderControls() {
  const btnToggle = document.getElementById("btn-toggle-server");
  const btnReset = document.getElementById("btn-reset-db");

  btnToggle.addEventListener("click", async () => {
    if (state.serverRunning) {
      await fetch("/api/server/stop", { method: "POST" });
    } else {
      await fetch("/api/server/start", { method: "POST" });
    }
    refreshStatus();
  });

  btnReset.addEventListener("click", async () => {
    if (confirm("Réinitialiser les 50 comptes bancaires à leur solde et état d'origine ?")) {
      await fetch("/api/accounts/reset", { method: "POST" });
      loadAccounts();
    }
  });
}

async function refreshStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    state.serverRunning = data.is_running;
    state.host = data.host;
    state.port = data.port;

    const badge = document.getElementById("server-status-badge");
    const statusText = document.getElementById("status-text");
    const btnLabel = document.getElementById("btn-server-label");

    if (state.serverRunning) {
      badge.className = "server-status-pill";
      statusText.textContent = `TCP ${state.host}:${state.port} • EN LIGNE`;
      btnLabel.textContent = "Arrêter TCP";
    } else {
      badge.className = "server-status-pill offline";
      statusText.textContent = `TCP ${state.host}:${state.port} • ARRÊTÉ`;
      btnLabel.textContent = "Démarrer TCP";
    }

    if (data.total_requests !== undefined) {
      state.kpis.totalTx = data.total_requests;
      state.kpis.approved = data.approved;
      state.kpis.rejected = data.rejected;
      updateKpis();
    }

    if (data.total_balance_pool !== undefined) {
      document.getElementById("val-pool-balance").textContent = `${data.total_balance_pool.toLocaleString()} FCFA`;
    }
  } catch (e) {
    console.error("Échec rafraîchissement statut :", e);
  }
}

// ==========================================================================
// 4. SUITE D'HOMOLOGATION (TC-01 à TC-10 + 0800 + 0400)
// ==========================================================================
function initTestSuite() {
  const btnRunAll = document.getElementById("btn-run-all-tests");
  btnRunAll.addEventListener("click", runAllHomologationTests);
}

async function loadTestDefinitions() {
  try {
    const res = await fetch("/api/test/definitions");
    const data = await res.json();
    state.testCases = data.test_cases;
    renderInitialTestCasesTable();
  } catch (e) {
    console.error("Erreur chargement définitions de tests :", e);
  }
}

function renderInitialTestCasesTable() {
  const tbody = document.getElementById("test-cases-tbody");
  tbody.innerHTML = "";

  // Épreuve Echo Réseau 0800
  appendTableRow(tbody, {
    id: "TC-0800",
    title: "Echo Réseau (0800 -> 0810)",
    pan_masked: "N/A",
    amount: 0,
    rule_tested: "Liaison Réseau (< 100ms)",
    expected_de39: "00",
    actual_de39: "--",
    actual_balance_impact: 0,
    latency_ms: "--",
    passed: null
  });

  // Les 10 cas d'arbitrage
  state.testCases.forEach(tc => {
    appendTableRow(tbody, {
      id: tc.id,
      title: tc.title,
      pan_masked: maskPanClient(tc.pan),
      amount: tc.amount,
      rule_tested: tc.rule_tested,
      expected_de39: tc.expected_de39,
      actual_de39: "--",
      actual_balance_impact: 0,
      latency_ms: "--",
      passed: null
    });
  });

  // Épreuve Reversal 0400
  appendTableRow(tbody, {
    id: "TC-0400",
    title: "Annulation 0400 (Reversal)",
    pan_masked: "400012******0001",
    amount: 15000,
    rule_tested: "Restitution Fonds DE 90",
    expected_de39: "00",
    actual_de39: "--",
    actual_balance_impact: 15000,
    latency_ms: "--",
    passed: null
  });
}

function appendTableRow(tbody, item) {
  const tr = document.createElement("tr");
  tr.id = `row-${item.id}`;

  let verdictHtml = `<span class="verdict-pill text-muted">En attente</span>`;
  if (item.passed === true) {
    verdictHtml = `<span class="verdict-pill pass">✓ SUCCÈS</span>`;
  } else if (item.passed === false) {
    verdictHtml = `<span class="verdict-pill fail">✕ ÉCHEC</span>`;
  }

  const amtStr = item.amount > 0 ? `${item.amount.toLocaleString()} FCFA` : "-";
  const balImpactStr = item.actual_balance_impact !== 0
    ? `${item.actual_balance_impact > 0 ? "+" : ""}${item.actual_balance_impact.toLocaleString()} FCFA`
    : "0 FCFA";

  tr.innerHTML = `
    <td><strong>${item.id}</strong></td>
    <td>
      <div><strong>${escapeHtml(item.title)}</strong></div>
      <small class="text-muted">${escapeHtml(item.rule_tested)}</small>
    </td>
    <td class="font-mono">${item.pan_masked}</td>
    <td>${amtStr}</td>
    <td><span class="tag">${item.rule_tested}</span></td>
    <td class="font-mono"><strong>${item.expected_de39}</strong></td>
    <td class="font-mono td-actual"><strong>${item.actual_de39}</strong></td>
    <td class="td-bal font-mono">${balImpactStr}</td>
    <td class="td-lat font-mono">${item.latency_ms !== "--" ? item.latency_ms + " ms" : "--"}</td>
    <td class="td-verdict">${verdictHtml}</td>
    <td>
      <button class="btn btn-sm btn-outline" onclick="runSingleTestCase('${item.id}')">Tester</button>
    </td>
  `;
  tbody.appendChild(tr);
}

async function runAllHomologationTests() {
  const btn = document.getElementById("btn-run-all-tests");
  btn.disabled = true;
  btn.innerHTML = `<span class="pulse-dot"></span> Exécution en cours via TCP...`;

  try {
    const res = await fetch("/api/test/suite", { method: "POST" });
    const data = await res.json();
    renderTestSuiteResults(data);
    loadAccounts(); // Mettre à jour les soldes impactés
  } catch (e) {
    alert("Erreur lors de l'exécution de la suite : " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">▶</span> Exécuter les 12 Épreuves d'Homologation`;
  }
}

function renderTestSuiteResults(data) {
  const summary = data.summary;
  const results = data.results;

  // Bannière d'homologation
  const certBadge = document.getElementById("cert-badge-status");
  const certRate = document.getElementById("cert-rate-val");
  const certPassed = document.getElementById("cert-passed");
  const certFailed = document.getElementById("cert-failed");
  const certTotal = document.getElementById("cert-total");

  certTotal.textContent = summary.total;
  certPassed.textContent = summary.passed;
  certFailed.textContent = summary.failed;
  certRate.textContent = `${summary.compliance_rate}%`;

  if (summary.certified) {
    certBadge.className = "cert-badge certified";
    certBadge.textContent = "HOMOLOGATION VALIDÉE (100% SUCCÈS)";
  } else {
    certBadge.className = "cert-badge failed";
    certBadge.textContent = "HOMOLOGATION REFUSÉE (ÉCHECS DÉTECTÉS)";
  }

  // Mise à jour des lignes de tableau
  results.forEach(res => {
    const row = document.getElementById(`row-${res.id}`);
    if (row) {
      row.querySelector(".td-actual").innerHTML = `<strong>${res.actual_de39}</strong>`;
      row.querySelector(".td-lat").textContent = `${res.latency_ms} ms`;
      row.querySelector(".td-bal").textContent = `${res.actual_balance_impact > 0 ? "+" : ""}${res.actual_balance_impact.toLocaleString()} FCFA`;

      const verdictTd = row.querySelector(".td-verdict");
      if (res.passed) {
        verdictTd.innerHTML = `<span class="verdict-pill pass">✓ SUCCÈS</span>`;
      } else {
        verdictTd.innerHTML = `<span class="verdict-pill fail">✕ ÉCHEC (${res.error || "DE39 discordant"})</span>`;
      }
    }
  });
}

window.runSingleTestCase = async function(tcId) {
  if (tcId === "TC-0800") {
    applyPreset("0800");
  } else if (tcId === "TC-0400") {
    applyPreset("0400");
  } else {
    const num = tcId.toLowerCase().replace("-", "");
    applyPreset(num);
  }
  // Basculer sur l'onglet simulateur et soumettre
  document.getElementById("tab-nav-simulator").click();
  document.getElementById("sim-form").dispatchEvent(new Event("submit"));
};

// ==========================================================================
// 5. SIMULATEUR DE TERMINAL INTERACTIF
// ==========================================================================
function initSimulator() {
  const form = document.getElementById("sim-form");
  const mtiSelect = document.getElementById("sim-mti");
  const de90Group = document.getElementById("group-de90");
  const quickPanSelect = document.getElementById("sim-pan-quick");

  // Masquer / Afficher champ DE 90 si 0400 Reversal
  mtiSelect.addEventListener("change", () => {
    if (mtiSelect.value === "0400") {
      de90Group.style.display = "flex";
    } else {
      de90Group.style.display = "none";
    }
  });

  // Sélection rapide de PAN
  quickPanSelect.addEventListener("change", () => {
    if (quickPanSelect.value) {
      document.getElementById("sim-pan").value = quickPanSelect.value;
    }
  });

  // Préréglages rapides
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      applyPreset(btn.dataset.preset);
    });
  });

  // Soumission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = document.getElementById("btn-send-sim");
    btn.disabled = true;
    btn.innerHTML = `<span class="pulse-dot"></span> Traitement TCP en cours...`;

    const payload = {
      mti: document.getElementById("sim-mti").value,
      pan: document.getElementById("sim-pan").value,
      amount: parseInt(document.getElementById("sim-amount").value || "0"),
      currency: document.getElementById("sim-currency").value,
      pin: document.getElementById("sim-pin").value,
      exp: document.getElementById("sim-exp").value,
      stan: document.getElementById("sim-stan").value,
      terminal_id: document.getElementById("sim-terminal").value,
      de_90: document.getElementById("sim-de90").value || null
    };

    try {
      const res = await fetch("/api/test/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      renderSimulatorResponse(data);
      loadAccounts(); // Actualisation du solde
    } catch (err) {
      alert("Erreur communication : " + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="btn-icon">🚀</span> Envoyer la Trame au Serveur TCP`;
    }
  });
}

function applyPreset(preset) {
  const mtiEl = document.getElementById("sim-mti");
  const panEl = document.getElementById("sim-pan");
  const amtEl = document.getElementById("sim-amount");
  const currEl = document.getElementById("sim-currency");
  const pinEl = document.getElementById("sim-pin");
  const expEl = document.getElementById("sim-exp");
  const stanEl = document.getElementById("sim-stan");
  const de90Group = document.getElementById("group-de90");
  const de90El = document.getElementById("sim-de90");

  de90Group.style.display = "none";
  mtiEl.value = "0200";
  currEl.value = "952";
  stanEl.value = String(Math.floor(Math.random() * 900000) + 100000);

  switch (preset) {
    case "0800":
      mtiEl.value = "0800";
      panEl.value = "4000123456780001";
      amtEl.value = "0";
      break;
    case "tc01":
      panEl.value = "4000123456780001";
      amtEl.value = "5000";
      pinEl.value = "1234";
      expEl.value = "2812";
      break;
    case "tc03":
      panEl.value = "4000123456780003"; // Volée
      amtEl.value = "5000";
      pinEl.value = "1234";
      expEl.value = "2812";
      break;
    case "tc04":
      panEl.value = "4000123456780002"; // Expirée 2401
      amtEl.value = "5000";
      pinEl.value = "1234";
      expEl.value = "2401";
      break;
    case "tc05":
      panEl.value = "4000123456780001";
      amtEl.value = "5000";
      pinEl.value = "0000"; // Faux PIN
      expEl.value = "2812";
      break;
    case "tc07":
      panEl.value = "4000123456780005"; // Solde 2000
      amtEl.value = "50000";
      pinEl.value = "1234";
      expEl.value = "2812";
      break;
    case "tc09":
      panEl.value = "4000123456780007"; // Plafond jour 980k/1M
      amtEl.value = "30000";
      pinEl.value = "1234";
      expEl.value = "2812";
      break;
    case "0400":
      mtiEl.value = "0400";
      panEl.value = "4000123456780001";
      amtEl.value = "5000";
      de90Group.style.display = "flex";
      de90El.value = `0200${stanEl.value}10261441000000000000100000000001`;
      break;
  }
}

function renderSimulatorResponse(data) {
  const banner = document.getElementById("sim-resp-banner");
  const codeVal = document.getElementById("resp-code-val");
  const codeLabel = document.getElementById("resp-code-label");
  const de38Val = document.getElementById("resp-de38");
  const latVal = document.getElementById("resp-lat");
  const actionVal = document.getElementById("resp-action");
  const badge = document.getElementById("sim-resp-badge");

  if (!data.success) {
    banner.className = "resp-banner rejected";
    codeVal.textContent = "ERR";
    codeLabel.textContent = "Erreur de transmission TCP";
    actionVal.textContent = data.error;
    badge.textContent = "ÉCHEC";
    return;
  }

  const resp = data.response;
  codeVal.textContent = resp.de39;
  codeLabel.textContent = resp.label;
  de38Val.textContent = resp.de38 || "N/A";
  latVal.textContent = `${data.latency_ms} ms`;
  actionVal.textContent = resp.action;

  if (resp.de39 === "00") {
    banner.className = "resp-banner approved";
    badge.textContent = "APPROUVÉ";
  } else {
    banner.className = "resp-banner rejected";
    badge.textContent = "REFUSÉ";
  }

  // Tableau des champs DE
  const tbody = document.getElementById("sim-fields-tbody");
  tbody.innerHTML = "";
  if (resp.fields) {
    Object.keys(resp.fields).sort((a,b) => Number(a)-Number(b)).forEach(de => {
      const tr = document.createElement("tr");
      let valDisplay = resp.fields[de];
      if (de === "2") valDisplay = maskPanClient(valDisplay);
      tr.innerHTML = `
        <td><strong>DE ${de}</strong></td>
        <td>${getFieldDefinitionName(de)}</td>
        <td class="font-mono">${escapeHtml(valDisplay)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Trames brutes (ASCII + Hex)
  document.getElementById("raw-req-display").textContent = 
    `[ASCII] ${data.request.raw_ascii}\n[HEX]   ${data.request.raw_hex}`;
  document.getElementById("raw-resp-display").textContent = 
    `[ASCII] ${resp.raw_ascii}\n[HEX]   ${resp.raw_hex}`;
}

function getFieldDefinitionName(de) {
  const names = {
    "2": "Primary Account Number (PAN)",
    "3": "Processing Code",
    "4": "Amount, Transaction",
    "7": "Transmission Date & Time",
    "11": "STAN",
    "12": "Time, Local Transaction",
    "13": "Date, Local Transaction",
    "14": "Date, Expiration",
    "38": "Authorization Code",
    "39": "Action Code / Response",
    "41": "Terminal ID",
    "42": "Merchant ID",
    "49": "Currency Code",
    "52": "PIN Data Cryptogram",
    "70": "Network Management Code",
    "90": "Original Data Elements"
  };
  return names[de] || `Data Element ${de}`;
}

// ==========================================================================
// 6. RÉFÉRENTIEL DES 50 COMPTES BANCAIRES
// ==========================================================================
function initAccounts() {
  document.getElementById("btn-refresh-accounts").addEventListener("click", loadAccounts);
  document.getElementById("search-accounts").addEventListener("input", (e) => {
    filterAccounts(e.target.value);
  });

  // Modal d'édition
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
  document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("modal-form").addEventListener("submit", submitAccountModal);
}

async function loadAccounts() {
  try {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    state.accounts = data.accounts;
    renderAccountsTable(state.accounts);
    populateSimulatorPanDropdown(state.accounts);
  } catch (e) {
    console.error("Erreur chargement comptes :", e);
  }
}

function renderAccountsTable(accounts) {
  const tbody = document.getElementById("accounts-tbody");
  tbody.innerHTML = "";

  accounts.forEach((acc, idx) => {
    const tr = document.createElement("tr");

    let statusPill = `<span class="tag">${acc.status}</span>`;
    if (acc.status === "ACTIVE") statusPill = `<span class="verdict-pill pass">ACTIVE</span>`;
    else if (acc.status === "STOLEN") statusPill = `<span class="verdict-pill fail">STOLEN (43)</span>`;
    else if (acc.status === "LOST") statusPill = `<span class="verdict-pill fail">LOST (41)</span>`;
    else if (acc.status === "SUSPENDED") statusPill = `<span class="verdict-pill text-muted">SUSPENDED (57)</span>`;

    const pinBadge = acc.pin_tries >= 3 
      ? `<span class="verdict-pill fail">${acc.pin_tries}/3 (Bloqué)</span>`
      : `<span class="font-mono">${acc.pin_tries}/3</span>`;

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td class="font-mono"><strong>${acc.masked_pan}</strong></td>
      <td>${statusPill}</td>
      <td class="font-mono"><strong>${acc.balance.toLocaleString()} FCFA</strong></td>
      <td class="font-mono">${acc.daily_spent.toLocaleString()} / ${acc.daily_ceiling.toLocaleString()} FCFA</td>
      <td class="font-mono">${acc.max_tx_limit.toLocaleString()} FCFA</td>
      <td>${pinBadge}</td>
      <td class="font-mono">${acc.exp}</td>
      <td><small class="text-muted">${escapeHtml(acc.notes || "")}</small></td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="openEditModal('${acc.pan}')">Éditer</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterAccounts(query) {
  const q = query.toLowerCase().trim();
  if (!q) {
    renderAccountsTable(state.accounts);
    return;
  }
  const filtered = state.accounts.filter(a => 
    a.pan.includes(q) || a.masked_pan.toLowerCase().includes(q) || a.status.toLowerCase().includes(q)
  );
  renderAccountsTable(filtered);
}

function populateSimulatorPanDropdown(accounts) {
  const sel = document.getElementById("sim-pan-quick");
  sel.innerHTML = `<option value="">-- Choisir parmi les 50 --</option>`;
  accounts.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.pan;
    opt.textContent = `${a.masked_pan} (${a.status} - ${a.balance.toLocaleString()} F)`;
    sel.appendChild(opt);
  });
}

window.openEditModal = function(pan) {
  const acc = state.accounts.find(a => a.pan === pan);
  if (!acc) return;

  document.getElementById("modal-pan").value = acc.pan;
  document.getElementById("modal-pan-display").textContent = `${acc.masked_pan} (Brut: ${acc.pan})`;
  document.getElementById("modal-balance").value = acc.balance;
  document.getElementById("modal-status").value = acc.status;
  document.getElementById("modal-pin-tries").value = acc.pin_tries;

  document.getElementById("modal-account").style.display = "flex";
};

function closeModal() {
  document.getElementById("modal-account").style.display = "none";
}

async function submitAccountModal(e) {
  e.preventDefault();
  const pan = document.getElementById("modal-pan").value;
  const balance = parseInt(document.getElementById("modal-balance").value);
  const status = document.getElementById("modal-status").value;
  const pin_tries = parseInt(document.getElementById("modal-pin-tries").value);

  await fetch("/api/accounts/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pan, balance, status, pin_tries })
  });

  closeModal();
  loadAccounts();
}

// ==========================================================================
// 7. LABORATOIRE DE TEST DE CHARGE (ÉTAPE 04)
// ==========================================================================
function initLoadTest() {
  const tpsSlider = document.getElementById("lt-tps");
  const tpsVal = document.getElementById("val-lt-tps");
  const durVal = document.getElementById("val-lt-duration");
  const btnStart = document.getElementById("btn-start-loadtest");
  const btnCancel = document.getElementById("btn-cancel-loadtest");
  const btnCopy = document.getElementById("btn-copy-report");
  const btnDownload = document.getElementById("btn-download-report");

  tpsSlider.addEventListener("input", (e) => {
    state.loadTestTargetTPS = parseInt(e.target.value);
    tpsVal.textContent = state.loadTestTargetTPS;
  });

  document.querySelectorAll(".dur-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".dur-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.loadTestDuration = parseInt(btn.dataset.dur);
      durVal.textContent = `${state.loadTestDuration} s`;
    });
  });

  btnStart.addEventListener("click", async () => {
    btnStart.style.display = "none";
    btnCancel.style.display = "inline-flex";
    document.getElementById("lt-progress-box").style.display = "block";

    try {
      await fetch("/api/loadtest/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tps: state.loadTestTargetTPS,
          duration: state.loadTestDuration
        })
      });
    } catch (e) {
      alert("Erreur démarrage test de charge : " + e.message);
      btnStart.style.display = "inline-flex";
      btnCancel.style.display = "none";
    }
  });

  btnCancel.addEventListener("click", async () => {
    await fetch("/api/loadtest/cancel", { method: "POST" });
  });

  btnCopy.addEventListener("click", () => {
    if (state.latestLoadReport) {
      navigator.clipboard.writeText(state.latestLoadReport);
      alert("Rapport copié dans le presse-papiers !");
    }
  });

  btnDownload.addEventListener("click", () => {
    if (state.latestLoadReport) {
      const blob = new Blob([state.latestLoadReport], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport_homologation_iso8583_${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });
}

function updateLoadTestProgress(data) {
  const bar = document.getElementById("lt-progress-bar");
  const text = document.getElementById("lt-progress-text");
  const stats = document.getElementById("lt-live-stats");

  bar.style.width = `${data.progress_pct}%`;
  text.textContent = `Progression : ${data.second} / ${data.total_seconds}s (${data.progress_pct}%)`;
  stats.textContent = `${data.total_sent.toLocaleString()} Tx • ${data.errors} erreurs • p50: ${data.cumulative_p50} ms • p95: ${data.cumulative_p95} ms`;

  // Mettre à jour en direct les cartes de latence
  document.getElementById("val-p50").textContent = `${data.cumulative_p50} ms`;
  document.getElementById("val-p95").textContent = `${data.cumulative_p95} ms`;
}

function handleLoadTestComplete(data) {
  document.getElementById("btn-start-loadtest").style.display = "inline-flex";
  document.getElementById("btn-cancel-loadtest").style.display = "none";
  document.getElementById("lt-progress-box").style.display = "none";

  const metrics = data.metrics;
  const sla = data.sla;
  state.latestLoadReport = data.report_markdown;

  document.getElementById("val-p50").textContent = `${metrics.latency_p50_ms} ms`;
  document.getElementById("val-p95").textContent = `${metrics.latency_p95_ms} ms`;
  document.getElementById("val-p99").textContent = `${metrics.latency_p99_ms} ms`;
  document.getElementById("val-error-rate").textContent = `${metrics.error_rate_pct}%`;
  document.getElementById("val-errors-count").textContent = `${metrics.errors} erreurs sur ${metrics.total_sent} requêtes`;

  // Badges SLA
  updateSlaCard("sla-card-p50", sla.p50_passed);
  updateSlaCard("sla-card-p95", sla.p95_passed);
  updateSlaCard("sla-card-p99", sla.p99_passed);
  updateSlaCard("sla-card-error", sla.error_passed);

  // Boîte de rapport
  document.getElementById("report-text").textContent = data.report_markdown;
  loadAccounts(); // Actualisation des comptes
}

function handleLoadTestError(err) {
  document.getElementById("btn-start-loadtest").style.display = "inline-flex";
  document.getElementById("btn-cancel-loadtest").style.display = "none";
  document.getElementById("lt-progress-box").style.display = "none";
  alert("Test de charge interrompu : " + err);
}

function updateSlaCard(id, passed) {
  const card = document.getElementById(id);
  if (passed) {
    card.className = "sla-card pass";
  } else {
    card.className = "sla-card fail";
  }
}

// ==========================================================================
// 8. MATRICE DES 10 RÈGLES
// ==========================================================================
async function loadRules() {
  try {
    const res = await fetch("/api/rules");
    const data = await res.json();
    state.rules = data.rules;
    renderRulesTable(state.rules);
  } catch (e) {
    console.error("Erreur chargement règles :", e);
  }
}

function renderRulesTable(rules) {
  const tbody = document.getElementById("rules-tbody");
  tbody.innerHTML = "";

  rules.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${r.id}</strong></td>
      <td><span class="tag">${r.prio}</span></td>
      <td><strong>${escapeHtml(r.rule)}</strong></td>
      <td>${escapeHtml(r.fail)}</td>
      <td class="font-mono"><span class="verdict-pill fail">${r.code}</span></td>
      <td><em>${escapeHtml(r.label)}</em></td>
      <td><small class="text-muted">${escapeHtml(r.behavior)}</small></td>
    `;
    tbody.appendChild(tr);
  });
}

function initRulesMatrix() {
  // Pas d'actions particulières
}

// ==========================================================================
// 9. LOGS
// ==========================================================================
function initLogs() {
  document.getElementById("btn-clear-logs").addEventListener("click", () => {
    document.getElementById("terminal-logs").innerHTML = "";
  });
}

// ==========================================================================
// UTILITAIRES
// ==========================================================================
function maskPanClient(pan) {
  if (!pan || pan.length < 10) return "****************";
  return pan.slice(0, 6) + "*".repeat(pan.length - 10) + pan.slice(-4);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
