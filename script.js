// ========== ÉTAT AUTH ==========
let currentToken = null;
let currentUser = null;
let pinSetupValue = '';
let pinSetupStep = 'set'; // 'set' | 'confirm'
let pinSetupFirst = '';
let pinVerifyValue = '';
let selectedUserId = null;

function getAuthHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentToken };
}

// ========== INIT AUTH AU CHARGEMENT ==========
async function initAuth() {
  const token = localStorage.getItem('mybank_token');
  if (token) {
    try {
      const r = await fetch('/api/auth/verify-token', {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
      });
      if (r.ok) {
        const d = await r.json();
        currentToken = token;
        currentUser = { userId: d.userId, username: d.username, role: d.role };
        hideAuthOverlay();
        onAuthenticated();
        return;
      }
    } catch {}
    localStorage.removeItem('mybank_token');
  }
  currentToken = null;
  currentUser = null;
  selectedUserId = null;
  resetAppToEmptyState();
  showAuthOverlay();
  showAuthScreen('screenLogin');
}

function showAuthOverlay() {
  document.body.classList.add('auth-locked');
  document.body.classList.remove('settings-locked');
  const settingsOverlay = document.getElementById('settingsOverlay');
  if (settingsOverlay) settingsOverlay.style.display = 'none';
  document.getElementById('authOverlay').style.display = 'flex';
}
function hideAuthOverlay() {
  document.body.classList.remove('auth-locked');
  document.getElementById('authOverlay').style.display = 'none';
}

function showAuthScreen(id) {
  document.querySelectorAll('.auth-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ========== CONNEXION ==========
async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';

  if (!username || !password) {
    errEl.textContent = 'Veuillez remplir tous les champs.';
    return;
  }

  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await r.json();
    if (!r.ok) { errEl.textContent = data.error || 'Erreur de connexion'; return; }

    currentToken = data.token;
    currentUser = { userId: data.userId, username: data.username, role: data.role };
    localStorage.setItem('mybank_token', currentToken);
    sessionStorage.setItem('mybank_pin_ok', '1');
    hideAuthOverlay();
    onAuthenticated();
  } catch {
    errEl.textContent = 'Erreur réseau. Réessayez.';
  }
}

// ========== INSCRIPTION ==========
function goToPinSetup() {
  const lastName = document.getElementById('regLastName').value.trim();
  const firstName = document.getElementById('regFirstName').value.trim();
  const birthDate = document.getElementById('regBirthDate').value;
  const gender = document.getElementById('regGender').value;
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regPasswordConfirm').value;
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';

  if (!lastName || !firstName || !birthDate || !gender) {
    errEl.textContent = 'Nom, prénom, date de naissance et sexe sont obligatoires.'; return;
  }
  if (!username || !password || !confirm) {
    errEl.textContent = 'Veuillez remplir tous les champs.'; return;
  }
  if (username.length < 3) {
    errEl.textContent = 'Identifiant : 3 caractères minimum.'; return;
  }
  if (password.length < 4) {
    errEl.textContent = 'Mot de passe : 4 caractères minimum.'; return;
  }
  if (password !== confirm) {
    errEl.textContent = 'Les mots de passe ne correspondent pas.'; return;
  }

  pinSetupValue = '';
  pinSetupFirst = '';
  pinSetupStep = 'set';
  document.getElementById('pinSetupSubtitle').textContent = 'Définissez votre code PIN à 5 chiffres';
  updatePinDots('pinSetupDots', 0);
  document.getElementById('pinSetupError').textContent = '';
  showAuthScreen('screenPinSetup');
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPwd = input.type === 'password';
  input.type = isPwd ? 'text' : 'password';
  if (btn) btn.setAttribute('aria-label', isPwd ? 'Cacher le mot de passe' : 'Afficher le mot de passe');
  if (btn) btn.classList.toggle('pw-toggle--on', isPwd);
}

function showWelcomeModal(account) {
  const modal = document.getElementById('welcomeModal');
  if (!modal || !account) return;
  const fullName = [account.firstName, account.lastName].filter(Boolean).join(' ') || '—';
  document.getElementById('welcomeName').textContent = account.firstName || '';
  document.getElementById('welcomeHolder').textContent = fullName;
  document.getElementById('welcomeAccount').textContent = account.accountNumber || '—';
  const bal = Number(String(account.balance || '0').replace(',', '.')) || 0;
  document.getElementById('welcomeBalance').textContent = bal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  document.getElementById('welcomeDate').textContent = account.accountDate || new Date().toLocaleDateString('fr-FR');
  modal.style.display = 'flex';
}

function closeWelcomeModal() {
  const modal = document.getElementById('welcomeModal');
  if (modal) modal.style.display = 'none';
}

function pinSetupInput(digit) {
  if (pinSetupValue.length >= 5) return;
  pinSetupValue += digit;
  updatePinDots('pinSetupDots', pinSetupValue.length);

  if (pinSetupValue.length === 5) {
    setTimeout(() => {
      if (pinSetupStep === 'set') {
        pinSetupFirst = pinSetupValue;
        pinSetupValue = '';
        pinSetupStep = 'confirm';
        document.getElementById('pinSetupSubtitle').textContent = 'Confirmez votre code PIN';
        updatePinDots('pinSetupDots', 0);
        document.getElementById('pinSetupError').textContent = '';
      } else {
        if (pinSetupValue === pinSetupFirst) {
          doRegister(pinSetupValue);
        } else {
          document.getElementById('pinSetupError').textContent = 'Les codes PIN ne correspondent pas. Recommencez.';
          pinSetupValue = '';
          pinSetupFirst = '';
          pinSetupStep = 'set';
          document.getElementById('pinSetupSubtitle').textContent = 'Définissez votre code PIN à 5 chiffres';
          updatePinDots('pinSetupDots', 0);
        }
      }
    }, 150);
  }
}

function pinSetupDel() {
  if (pinSetupValue.length > 0) {
    pinSetupValue = pinSetupValue.slice(0, -1);
    updatePinDots('pinSetupDots', pinSetupValue.length);
  }
}

async function doRegister(pin) {
  const lastName = document.getElementById('regLastName').value.trim();
  const firstName = document.getElementById('regFirstName').value.trim();
  const birthDate = document.getElementById('regBirthDate').value;
  const gender = document.getElementById('regGender').value;
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl = document.getElementById('pinSetupError');

  try {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, pin, firstName, lastName, birthDate, gender })
    });
    const data = await r.json();
    if (!r.ok) {
      errEl.textContent = data.error || 'Erreur lors de la création du compte.';
      pinSetupValue = '';
      pinSetupFirst = '';
      pinSetupStep = 'set';
      document.getElementById('pinSetupSubtitle').textContent = 'Définissez votre code PIN à 5 chiffres';
      updatePinDots('pinSetupDots', 0);
      showAuthScreen('screenRegister');
      document.getElementById('registerError').textContent = data.error || 'Erreur';
      return;
    }
    currentToken = data.token;
    currentUser = { userId: data.userId, username: data.username, role: data.role };
    localStorage.setItem('mybank_token', currentToken);
    sessionStorage.setItem('mybank_pin_ok', '1');
    hideAuthOverlay();
    // Affiche la fenêtre de bienvenue avec les infos du nouveau compte
    showWelcomeModal(data.account || { firstName, lastName, accountNumber: '—', balance: '0' });
    onAuthenticated();
  } catch {
    errEl.textContent = 'Erreur réseau. Réessayez.';
  }
}

// ========== VÉRIFICATION PIN (retour) ==========
function pinVerifyInput(digit) {
  if (pinVerifyValue.length >= 5) return;
  pinVerifyValue += digit;
  updatePinDots('pinVerifyDots', pinVerifyValue.length);

  if (pinVerifyValue.length === 5) {
    setTimeout(() => doVerifyPin(), 150);
  }
}

function pinVerifyDel() {
  if (pinVerifyValue.length > 0) {
    pinVerifyValue = pinVerifyValue.slice(0, -1);
    updatePinDots('pinVerifyDots', pinVerifyValue.length);
  }
}

async function doVerifyPin() {
  const errEl = document.getElementById('pinVerifyError');
  errEl.textContent = '';
  const pin = pinVerifyValue;
  pinVerifyValue = '';
  updatePinDots('pinVerifyDots', 0);

  try {
    const r = await fetch('/api/auth/verify-pin', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pin })
    });
    const data = await r.json();
    if (!r.ok) {
      errEl.textContent = data.error || 'Code PIN incorrect';
      shakeDots('pinVerifyDots');
      return;
    }
    sessionStorage.setItem('mybank_pin_ok', '1');
    hideAuthOverlay();
    onAuthenticated();
  } catch {
    errEl.textContent = 'Erreur réseau.';
  }
}

// ========== DÉCONNEXION ==========
function doLogout() {
  if (dataRefreshTimer) { clearInterval(dataRefreshTimer); dataRefreshTimer = null; }
  localStorage.removeItem('mybank_token');
  sessionStorage.removeItem('mybank_pin_ok');
  currentToken = null;
  currentUser = null;
  selectedUserId = null;
  resetAppToEmptyState();
  closeSettings();
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').textContent = '';
  showAuthOverlay();
  showAuthScreen('screenLogin');
}

// ========== UTILS PIN ==========
function updatePinDots(containerId, count) {
  const dots = document.querySelectorAll('#' + containerId + ' .pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < count);
  });
}

function shakeDots(containerId) {
  const container = document.getElementById(containerId);
  container.classList.add('shake');
  setTimeout(() => container.classList.remove('shake'), 500);
}

// ========== POST AUTH ==========
let dataRefreshTimer = null;

function onAuthenticated() {
  resetAppToEmptyState();
  if (currentUser) {
    document.getElementById('settingsUsername').textContent = currentUser.username;
  }
  navigateTo('accueil');
  loadData();
  if (dataRefreshTimer) clearInterval(dataRefreshTimer);
  dataRefreshTimer = setInterval(loadData, 30000);
}

// ========== CHARGEMENT DONNÉES ==========
async function loadData() {
  try {
    const r = await fetch('/api/client-data', { headers: getAuthHeaders() });
    if (!r.ok) return;
    const data = await r.json();
    applyData(data);
  } catch (e) {
    console.log('Impossible de charger les données');
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setDisplay(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? '' : 'none';
}

function money(value) {
  const n = Number.parseFloat(value || '0');
  return (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR');
}

function cleanValue(value, fallback = '—') {
  const text = value == null ? '' : String(value).trim();
  return text || fallback;
}

function resetAppToEmptyState() {
  applyData({});
}

function applyData(data) {
  data = data || {};
  const alertAmount = Number.parseFloat(data.alert_amount || '0') || 0;
  const balance = Number.parseFloat(data.account_balance || '0') || 0;
  const pending = Number.parseFloat(data.account_pending || '0') || 0;
  const total = Number.parseFloat(data.synthese_total || data.account_balance || '0') || 0;
  const frozen = data.account_frozen === 'true' && alertAmount > 0;
  const accountNumber = cleanValue(data.account_number, '—');
  const accountDate = cleanValue(data.account_date, '—');
  const managerName = cleanValue(data.manager_name, '—');
  const managerPhoneRaw = String(data.manager_phone || '').trim();
  const managerEmailRaw = String(data.manager_email || '').trim();
  const lastname = cleanValue(data.holder_lastname, '—');
  const firstname = cleanValue(data.holder_firstname, '—');
  const birthdate = cleanValue(data.holder_birthdate, '—');
  const country = cleanValue(data.holder_country, '—');
  const city = cleanValue(data.holder_city, '—');
  const region = cleanValue(data.holder_region, '—');
  const fullName = [data.holder_firstname, data.holder_lastname].filter(v => String(v || '').trim()).join(' ') || '—';
  const last4 = accountNumber.replace(/\*/g, '').replace(/\D/g, '').slice(-4).padStart(4, '0');

  // Mémorise pour le virement
  window.__currentBalance = balance;
  window.__currentFrozen = frozen;
  window.__currentManagerPhone = managerPhoneRaw;

  setText('alertAmount', money(alertAmount) + ' €');
  setText('notifAlertText', frozen ? 'Votre compte est temporairement gelé. Montant à payer : ' + money(alertAmount) + ' €' : 'Aucune notification pour le moment.');
  setText('accountNumber', accountNumber === '—' ? 'N° —' : 'N° ' + accountNumber);
  setText('accountDate', accountDate);
  setText('mainBalance', money(balance) + ' €');
  setText('accountPending', money(pending));
  setDisplay('frozenBadge', frozen);
  setDisplay('alertBanner', frozen);

  const txs = [1, 2, 3].map(i => ({
    name: cleanValue(data['transaction' + i + '_name'], ''),
    date: cleanValue(data['transaction' + i + '_date'], ''),
    status: cleanValue(data['transaction' + i + '_status'], ''),
    amount: Number.parseFloat(data['transaction' + i + '_amount'] || '0') || 0
  }));

  txs.forEach((tx, idx) => {
    const n = idx + 1;
    const item = document.getElementById('t' + n + 'Name')?.closest('.transaction-item');
    if (item) item.style.display = tx.name ? '' : 'none';
    setText('t' + n + 'Name', tx.name || '');
    setText('t' + n + 'Date', tx.date || '');
    setText('t' + n + 'Status', tx.status || '');
    setText('t' + n + 'Amount', tx.amount > 0 ? '−' + money(tx.amount) + ' €' : (tx.name ? '0 €' : ''));
  });

  const list = document.getElementById('transactionList');
  let empty = document.getElementById('emptyTransactions');
  if (list && !empty) {
    empty = document.createElement('div');
    empty.id = 'emptyTransactions';
    empty.className = 'transaction-empty';
    empty.textContent = 'Aucune opération pour le moment';
    list.appendChild(empty);
  }
  if (empty) empty.style.display = txs.some(tx => tx.name) ? 'none' : 'block';

  setText('syntheseTotal', money(total) + ' €');
  setText('managerName', managerName);
  setText('contactManager', managerName);
  setText('settingsManagerName', managerName);

  // Téléphone & email du conseiller : affichés uniquement si l'admin les a configurés
  const phoneVisible = !!managerPhoneRaw;
  setDisplay('settingsManagerPhoneRow', phoneVisible);
  setDisplay('contactPhoneRow', phoneVisible);
  setText('settingsManagerPhone', managerPhoneRaw || '—');
  setText('contactPhone', managerPhoneRaw || '—');

  const emailVisible = !!managerEmailRaw;
  setDisplay('settingsManagerEmailRow', emailVisible);
  setText('settingsManagerEmail', managerEmailRaw || '—');

  setText('modalLastname', lastname);
  setText('modalFirstname', firstname);
  setText('modalBirthdate', birthdate);
  setText('modalCountry', country);
  setText('modalCity', city);
  setText('modalRegion', region);
  setText('modalAccountNumber', accountNumber === '—' ? '—' : '**** **** ' + last4);
  setText('modalBalance', money(balance) + ' €' + (frozen ? ' (gelé)' : ''));
  setText('modalPending', money(pending) + ' €');
  setText('modalAlert', frozen ? money(alertAmount) + ' € à payer' : '0 €');
  setText('modalManager', managerName);
  setText('profileName', fullName);
  setText('ribName', fullName);
  setText('ribIban', accountNumber === '—' ? 'FR76 3000 4000 0000 0000 0000 0000' : accountNumber);
  setText('virementAvailable', money(balance) + ' €');

  // Synthèse visible uniquement pour l'administrateur
  setDisplay('syntheseSection', !!(currentUser && currentUser.role === 'admin'));

  // Statut du compte (gelé / actif) affiché dans Mes Extras
  const statusEl = document.getElementById('extraAccountStatus');
  if (statusEl) {
    statusEl.textContent = frozen ? '🧊 Compte gelé' : '✅ Compte actif';
    statusEl.style.color = frozen ? '#c0392b' : '#1a7a4a';
  }

  // Charger les dernières opérations & notifications (asynchrone)
  refreshOperations();
  refreshNotifications();
}

// ========== OPÉRATIONS & NOTIFICATIONS DYNAMIQUES ==========
async function refreshOperations() {
  try {
    const r = await fetch('/api/transfers', { headers: getAuthHeaders() });
    if (!r.ok) return;
    const transfers = await r.json();
    const list = document.getElementById('transactionList');
    if (!list) return;
    if (!Array.isArray(transfers) || transfers.length === 0) {
      // Laisse les 3 emplacements vides
      return;
    }
    const last = transfers.slice(0, 5);
    list.innerHTML = last.map(t => {
      const raw = Number(t.amount || 0);
      const isCredit = t.type === 'credit' || (t.type !== 'debit' && raw > 0 && String(t.beneficiary||'').toLowerCase().includes('crédit'));
      const abs = Math.abs(raw).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const sign = isCredit ? '+' : '−';
      const color = isCredit ? '#1a7a4a' : '#c0392b';
      const statusLabel = t.status || (isCredit ? 'Validé' : 'À venir');
      const statusClass = statusLabel === 'À venir' ? 'blocked' : 'ok';
      const iconBg = isCredit ? '#1a7a4a' : '#2563eb';
      return '<div class="transaction-item">'
        + '<div class="transaction-icon" style="background:' + iconBg + ';color:#fff;">'
        + (isCredit ? '↓' : '↑') + '</div>'
        + '<div class="transaction-info">'
        + '<div class="transaction-name">' + escapeHtml(t.beneficiary || '—') + '</div>'
        + '<div class="transaction-date">' + escapeHtml(t.dateLabel || '') + '</div>'
        + '<div class="transaction-status ' + statusClass + '">' + escapeHtml(statusLabel) + '</div>'
        + '</div>'
        + '<div class="transaction-amount" style="color:' + color + ';font-weight:700;">' + sign + abs + ' €</div>'
        + '</div>';
    }).join('');
  } catch {}
}

async function refreshNotifications() {
  try {
    const r = await fetch('/api/notifications', { headers: getAuthHeaders() });
    if (!r.ok) return;
    const notifs = await r.json();
    const unread = (notifs || []).filter(n => !n.read).length;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.style.display = unread > 0 ? 'flex' : 'none';
    }
    const list = document.getElementById('notifList');
    if (list) {
      if (!notifs || notifs.length === 0) {
        list.innerHTML = '<div class="notif-item"><p class="notif-text">Aucune notification pour le moment.</p></div>';
      } else {
        list.innerHTML = notifs.map(n => {
          const d = n.date ? new Date(n.date).toLocaleString('fr-FR') : '';
          return '<div class="notif-item" style="' + (n.read ? '' : 'border-left:3px solid #00965e;background:#f0fdf4;') + '">'
            + '<p class="notif-title">' + escapeHtml(n.title || 'Notification') + '</p>'
            + '<p class="notif-text">' + escapeHtml(n.message || '') + '</p>'
            + '<p class="notif-text" style="font-size:11px;color:#888;margin-top:4px;">' + d + '</p>'
            + '</div>';
        }).join('');
      }
    }
  } catch {}
}

// ========== PARAMÈTRES ==========
function openSettings() {
  document.body.classList.add('settings-locked');
  const overlay = document.getElementById('settingsOverlay');
  overlay.style.display = 'flex';
  if (currentUser && currentUser.role === 'admin') {
    document.getElementById('settingsUser').style.display = 'none';
    document.getElementById('settingsAdmin').style.display = 'block';
    loadAdminUsers();
  } else {
    document.getElementById('settingsUser').style.display = 'block';
    document.getElementById('settingsAdmin').style.display = 'none';
  }
}

function closeSettings() {
  document.body.classList.remove('settings-locked');
  const overlay = document.getElementById('settingsOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ========== ADMIN ==========
function switchAdminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
  const map = {
    users: ['tabUsers','adminTabUsers'],
    edit: ['tabEdit','adminTabEdit'],
    history: ['tabHistory','adminTabHistory'],
    synthese: ['tabSynthese','adminTabSynthese'],
    docs: ['tabDocs','adminTabDocs']
  };
  const ids = map[tab] || map.users;
  document.getElementById(ids[0]).classList.add('active');
  document.getElementById(ids[1]).classList.add('active');
  if (tab === 'history' && selectedUserId) loadAdminTransfers(selectedUserId);
  if (tab === 'synthese') loadAdminSynthese();
}

async function loadAdminSynthese() {
  const el = document.getElementById('adminSyntheseContent');
  if (!el) return;
  el.innerHTML = '<p style="color:#888;font-size:13px;padding:16px;">Chargement…</p>';
  try {
    const r = await fetch('/api/admin/synthese', { headers: getAuthHeaders() });
    const d = await r.json();
    if (!r.ok) { el.innerHTML = '<p style="color:#c0392b;padding:16px;">Erreur</p>'; return; }
    const rows = d.rows || [];
    if (rows.length === 0) {
      el.innerHTML = '<p style="color:#888;font-size:13px;padding:16px;">Aucun utilisateur.</p>';
      return;
    }
    const fmt = n => Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
    el.innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">'
      + '<div style="background:#eaf6ef;padding:12px;border-radius:10px;"><div style="font-size:11px;color:#666;">Total des soldes</div><div style="font-size:18px;font-weight:700;color:#1a7a4a;">' + fmt(d.total) + ' €</div></div>'
      + '<div style="background:#eef4ff;padding:12px;border-radius:10px;"><div style="font-size:11px;color:#666;">Crédits accordés</div><div style="font-size:18px;font-weight:700;color:#2563eb;">' + fmt(d.totalCredits) + ' €</div></div>'
      + '</div>'
      + rows.map(u =>
          '<div class="history-item" style="cursor:pointer;" onclick="selectUser(\'' + u.id + '\',\'' + escapeHtml(u.username) + '\');switchAdminTab(\'edit\');">'
          + '<div class="history-row"><span class="history-bene">' + escapeHtml(u.fullName) + (u.frozen ? ' 🧊' : '') + '</span><span class="history-amount" style="color:#1a7a4a;font-weight:700;">' + fmt(u.balance) + ' €</span></div>'
          + '<div class="history-meta">@' + escapeHtml(u.username) + ' · Crédité : ' + fmt(u.credits) + ' €</div>'
          + (u.accountNumber ? '<div class="history-meta">' + escapeHtml(u.accountNumber) + '</div>' : '')
          + '</div>'
        ).join('');
  } catch {
    el.innerHTML = '<p style="color:#c0392b;padding:16px;">Erreur réseau.</p>';
  }
}

async function loadAdminUsers() {
  const listEl = document.getElementById('adminUserList');
  listEl.innerHTML = '<p style="color:#888;font-size:13px;padding:16px;">Chargement…</p>';
  try {
    const r = await fetch('/api/admin/users', { headers: getAuthHeaders() });
    const users = await r.json();
    if (!Array.isArray(users) || users.length === 0) {
      listEl.innerHTML = '<p style="color:#888;font-size:13px;padding:16px;">Aucun utilisateur.</p>';
      return;
    }
    listEl.innerHTML = '';
    users.forEach(u => {
      const item = document.createElement('div');
      item.className = 'admin-user-item' + (u.id === selectedUserId ? ' selected' : '');
      const date = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—';
      item.innerHTML = `
        <div class="admin-user-info">
          <span class="admin-user-name">${escapeHtml(u.username)}</span>
          <span class="admin-user-meta">${u.role === 'admin' ? '👑 Admin' : '👤 Titulaire'} · ${date}</span>
        </div>
        <button class="admin-user-edit-btn" onclick="selectUser('${u.id}','${escapeHtml(u.username)}')">Modifier ›</button>
      `;
      listEl.appendChild(item);
    });
  } catch {
    listEl.innerHTML = '<p style="color:#c0392b;font-size:13px;padding:16px;">Erreur de chargement.</p>';
  }
}

async function selectUser(userId, username) {
  selectedUserId = userId;
  document.getElementById('adminSelectedUsername').textContent = username;
  document.getElementById('adminHistoryUsername').textContent = username;
  document.getElementById('adminSaveStatus').textContent = '';
  document.getElementById('adm_new_password').value = '';
  document.getElementById('adm_credit_amount').value = '';
  const labelEl = document.getElementById('adm_credit_label'); if (labelEl) labelEl.value = '';

  try {
    const r = await fetch('/api/admin/users/' + userId + '/data', { headers: getAuthHeaders() });
    const data = await r.json();
    const fields = ['alert_amount','account_number','account_date','account_balance','account_frozen',
      'account_pending','holder_lastname','holder_firstname','holder_birthdate','holder_gender',
      'holder_country','holder_city','holder_region','manager_name','manager_phone','manager_email',
      'transaction1_name','transaction1_date','transaction1_status','transaction1_amount',
      'transaction2_name','transaction2_date','transaction2_status','transaction2_amount',
      'transaction3_name','transaction3_date','transaction3_status','transaction3_amount','synthese_total'];

    fields.forEach(key => {
      const el = document.getElementById('adm_' + key);
      if (el) {
        if (el.tagName === 'SELECT') el.value = data[key] || 'false';
        else el.value = data[key] || '';
      }
    });

    // Charger les identifiants en clair (admin uniquement)
    try {
      const cr = await fetch('/api/admin/users/' + userId + '/credentials', { headers: getAuthHeaders() });
      if (cr.ok) {
        const creds = await cr.json();
        const u = document.getElementById('adm_cred_username'); if (u) u.value = creds.username || '';
        const p = document.getElementById('adm_cred_password'); if (p) p.value = creds.passwordPlain || '';
        const pi = document.getElementById('adm_cred_pin'); if (pi) pi.value = creds.pinPlain || '';
      }
    } catch {}

    document.querySelectorAll('.admin-user-item').forEach(item => item.classList.remove('selected'));
    switchAdminTab('edit');
    loadAdminUsers();
    loadAdminTransfers(userId);
  } catch {
    alert('Impossible de charger les données de cet utilisateur.');
  }
}

function showAdminStatus(msg, ok) {
  const statusEl = document.getElementById('adminSaveStatus');
  statusEl.textContent = msg;
  statusEl.className = 'admin-save-status ' + (ok ? 'success' : 'error');
  statusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'admin-save-status'; }, 4000);
}

async function adminSaveSection(sectionName, fields) {
  if (!selectedUserId) { showAdminStatus('Sélectionnez d\'abord un utilisateur.', false); return; }
  const updates = {};
  fields.forEach(key => {
    const el = document.getElementById('adm_' + key);
    if (el) updates[key] = el.value;
  });
  try {
    const r = await fetch('/api/admin/users/' + selectedUserId + '/data', {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(updates)
    });
    if (r.ok) showAdminStatus('✅ Section "' + sectionName + '" enregistrée.', true);
    else { const d = await r.json(); showAdminStatus('❌ ' + (d.error || 'Erreur'), false); }
  } catch { showAdminStatus('❌ Erreur réseau', false); }
}

async function adminCreditAccount() {
  if (!selectedUserId) { showAdminStatus('Sélectionnez d\'abord un utilisateur.', false); return; }
  const amount = document.getElementById('adm_credit_amount').value;
  const label = (document.getElementById('adm_credit_label')?.value || '').trim();
  try {
    const r = await fetch('/api/admin/users/' + selectedUserId + '/credit', {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ amount, label })
    });
    const d = await r.json();
    if (r.ok) {
      showAdminStatus('✅ Opération enregistrée. Nouveau solde : ' + d.newBalance + ' € — visible dans Historique.', true);
      document.getElementById('adm_credit_amount').value = '';
      const labelEl = document.getElementById('adm_credit_label'); if (labelEl) labelEl.value = '';
      const fresh = await fetch('/api/admin/users/' + selectedUserId + '/data', { headers: getAuthHeaders() });
      if (fresh.ok) {
        const data = await fresh.json();
        document.getElementById('adm_account_balance').value = data.account_balance || '';
      }
      loadAdminTransfers(selectedUserId);
    } else showAdminStatus('❌ ' + (d.error || 'Erreur'), false);
  } catch { showAdminStatus('❌ Erreur réseau', false); }
}

async function loadAdminTransfers(userId) {
  const list = document.getElementById('adminTransfersList');
  list.innerHTML = '<p style="color:#888;font-size:13px;padding:16px;">Chargement…</p>';
  try {
    const r = await fetch('/api/admin/users/' + userId + '/transfers', { headers: getAuthHeaders() });
    const transfers = await r.json();
    list.innerHTML = renderTransfersHtml(transfers, 'Aucun virement réalisé par cet utilisateur.');
  } catch {
    list.innerHTML = '<p style="color:#c0392b;font-size:13px;padding:16px;">Erreur de chargement.</p>';
  }
}

function renderTransfersHtml(transfers, emptyMsg) {
  if (!Array.isArray(transfers) || transfers.length === 0) {
    return '<p style="color:#888;font-size:13px;padding:16px;text-align:center;">' + emptyMsg + '</p>';
  }
  return transfers.map(t => {
    const raw = Number(t.amount || 0);
    const isCredit = t.type === 'credit' || (t.type !== 'debit' && raw > 0 && (t.beneficiary || '').toLowerCase().includes('crédit'));
    const abs = Math.abs(raw).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = isCredit ? '+' : '−';
    const color = isCredit ? '#1a7a4a' : '#c0392b';
    return '<div class="history-item">'
      + '<div class="history-row"><span class="history-bene">' + escapeHtml(t.beneficiary || '—') + '</span><span class="history-amount" style="color:' + color + ';font-weight:700;">' + sign + abs + ' €</span></div>'
      + '<div class="history-meta">' + escapeHtml(t.dateLabel || t.date || '') + ' · ' + escapeHtml(t.status || 'Exécuté') + '</div>'
      + (t.iban ? '<div class="history-meta">IBAN : ' + escapeHtml(t.iban) + '</div>' : '')
      + (t.motif ? '<div class="history-meta">Motif : ' + escapeHtml(t.motif) + '</div>' : '')
      + (t.fromAccount ? '<div class="history-meta">Depuis : ' + escapeHtml(t.fromAccount) + '</div>' : '')
      + '</div>';
  }).join('');
}

async function adminResetPassword() {
  if (!selectedUserId) return;
  const pw = document.getElementById('adm_new_password').value;
  if (!pw || pw.length < 4) { alert('Mot de passe : 4 caractères minimum.'); return; }
  if (!confirm('Réinitialiser le mot de passe de cet utilisateur ?')) return;
  try {
    const r = await fetch('/api/admin/users/' + selectedUserId + '/reset-password', {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ newPassword: pw })
    });
    const d = await r.json();
    if (r.ok) { showAdminStatus('✅ Mot de passe réinitialisé.', true); document.getElementById('adm_new_password').value = ''; }
    else showAdminStatus('❌ ' + (d.error || 'Erreur'), false);
  } catch { showAdminStatus('❌ Erreur réseau', false); }
}

async function adminDeleteUser() {
  if (!selectedUserId) return;
  const name = document.getElementById('adminSelectedUsername').textContent;
  if (!confirm('Supprimer définitivement le compte de "' + name + '" ?')) return;
  try {
    const r = await fetch('/api/admin/users/' + selectedUserId, {
      method: 'DELETE', headers: getAuthHeaders()
    });
    const d = await r.json();
    if (r.ok) {
      selectedUserId = null;
      document.getElementById('adminSelectedUsername').textContent = '—';
      switchAdminTab('users');
      loadAdminUsers();
      showAdminStatus('✅ Compte supprimé.', true);
    } else showAdminStatus('❌ ' + (d.error || 'Erreur'), false);
  } catch { showAdminStatus('❌ Erreur réseau', false); }
}

async function adminDeleteUser() {
  if (!selectedUserId) return;
  const name = document.getElementById('adminSelectedUsername').textContent;
  if (!confirm('Supprimer définitivement le compte de "' + name + '" ?')) return;
  try {
    const r = await fetch('/api/admin/users/' + selectedUserId, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const d = await r.json();
    if (r.ok) {
      selectedUserId = null;
      document.getElementById('adminSelectedUsername').textContent = '—';
      switchAdminTab('users');
      loadAdminUsers();
      alert('✅ Compte supprimé.');
    } else alert('❌ ' + (d.error || 'Erreur'));
  } catch { alert('Erreur réseau.'); }
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ========== NAVIGATION ==========
window.navigateTo = function(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === page) item.classList.add('active');
  });
  window.scrollTo(0, 0);
};

window.openModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) { modal.classList.add('open'); document.body.style.overflow = 'hidden'; }
};
window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
};

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
  });
});

// ===== Fenêtre d'information stylée (remplace les alert) =====
function showInfo(title, bodyHtml, icon) {
  document.getElementById('infoModalIcon').textContent = icon || '✨';
  document.getElementById('infoModalTitle').textContent = title || 'Information';
  document.getElementById('infoModalBody').innerHTML = bodyHtml || '';
  openModal('infoModal');
}
window.showInfo = showInfo;

function managerContactRowsHtml() {
  const phone = window.__currentManagerPhone || '';
  const rows = [];
  if (phone) {
    rows.push('<div class="info-row"><span class="label">Téléphone</span><span class="value"><a href="tel:' + phone.replace(/\s/g,'') + '" style="color:#1a7a4a;text-decoration:none;">' + escapeHtml(phone) + '</a></span></div>');
  } else {
    rows.push('<div class="info-row"><span class="label">Téléphone</span><span class="value" style="color:#888;">Non configuré</span></div>');
  }
  return rows.join('');
}

window.showVirement = () => {
  document.getElementById('virBeneficiary').value = '';
  document.getElementById('virIban').value = '';
  document.getElementById('virAmount').value = '';
  document.getElementById('virMotif').value = '';
  document.getElementById('virementError').textContent = '';
  openModal('virementModal');
};

window.showHistory = async () => {
  const list = document.getElementById('historyList');
  list.innerHTML = '<p style="color:#888;font-size:13px;padding:16px;text-align:center;">Chargement…</p>';
  openModal('historyModal');
  try {
    const r = await fetch('/api/transfers', { headers: getAuthHeaders() });
    const transfers = await r.json();
    list.innerHTML = renderTransfersHtml(transfers, 'Aucun virement effectué.');
  } catch {
    list.innerHTML = '<p style="color:#c0392b;font-size:13px;padding:16px;text-align:center;">Erreur de chargement.</p>';
  }
};

window.doTransfer = async () => {
  const beneficiary = document.getElementById('virBeneficiary').value.trim();
  const iban = document.getElementById('virIban').value.trim();
  const amount = document.getElementById('virAmount').value.trim();
  const motif = document.getElementById('virMotif').value.trim();
  const errEl = document.getElementById('virementError');
  errEl.textContent = '';
  if (!beneficiary) { errEl.textContent = 'Le nom du bénéficiaire est requis.'; return; }
  const amt = Number.parseFloat(amount.replace(',', '.'));
  if (!Number.isFinite(amt) || amt <= 0) { errEl.textContent = 'Montant invalide.'; return; }
  try {
    const r = await fetch('/api/transfers', {
      method: 'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ beneficiary, iban, amount, motif })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || 'Erreur lors du virement.'; return; }
    closeModal('virementModal');
    showInfo('Virement effectué ✅',
      '<p>Votre virement a été enregistré avec succès.</p>'
      + '<div class="info-row"><span class="label">Bénéficiaire</span><span class="value">' + escapeHtml(beneficiary) + '</span></div>'
      + '<div class="info-row"><span class="label">Montant</span><span class="value">−' + amt.toLocaleString('fr-FR', {minimumFractionDigits:2,maximumFractionDigits:2}) + ' €</span></div>'
      + '<div class="info-row"><span class="label">Nouveau solde</span><span class="value" style="color:#1a7a4a;">' + Number(d.newBalance).toLocaleString('fr-FR', {minimumFractionDigits:2,maximumFractionDigits:2}) + ' €</span></div>'
      + '<p style="margin-top:10px;color:#666;font-size:13px;">Retrouvez-le dans <strong>Mes virements</strong>.</p>', '💸');
    loadData();
  } catch {
    errEl.textContent = 'Erreur réseau.';
  }
};

window.showRIB = () => openModal('ribModal');
window.showPlafonds = () => openModal('plafondsModal');
window.showNotifications = async () => {
  await refreshNotifications();
  openModal('notifModal');
  try { await fetch('/api/notifications/read-all', { method: 'POST', headers: getAuthHeaders() }); } catch {}
  setTimeout(() => { const b = document.getElementById('notifBadge'); if (b) b.style.display = 'none'; }, 600);
};

window.showWero = () => showInfo('Wero — Paiement entre amis',
  '<p>Envoyez et recevez de l\'argent en quelques secondes avec vos contacts Wero, partout en Europe.</p>'
  + '<div class="info-row"><span class="label">Limite par envoi</span><span class="value">1 000 €</span></div>'
  + '<div class="info-row"><span class="label">Frais</span><span class="value" style="color:#1a7a4a;">Gratuit</span></div>'
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Activez Wero depuis votre application mobile BNP Paribas.</p>', '💸');

window.showAllAccounts = () => showInfo('Mes comptes',
  '<div class="info-row"><span class="label">Compte de chèques</span><span class="value">Actif</span></div>'
  + '<div class="info-row"><span class="label">Livret A</span><span class="value">Non souscrit</span></div>'
  + '<div class="info-row"><span class="label">PEL</span><span class="value">Non souscrit</span></div>'
  + '<div class="info-row"><span class="label">Assurance-vie</span><span class="value">Non souscrit</span></div>'
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Ouvrez un nouveau produit en agence ou via votre conseiller.</p>', '🏦');

window.showInsurance = () => showInfo('Mes assurances',
  '<div class="info-row"><span class="label">Assurance habitation</span><span class="value">Non souscrit</span></div>'
  + '<div class="info-row"><span class="label">Assurance auto</span><span class="value">Non souscrit</span></div>'
  + '<div class="info-row"><span class="label">Assurance santé</span><span class="value">Non souscrit</span></div>'
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Demandez un devis personnalisé auprès de votre conseiller.</p>', '🛡️');

window.showAllTransactions = () => window.showHistory();

window.showTransactionDetail = (id) => showInfo('Détail de l\'opération',
  '<div class="info-row"><span class="label">Référence</span><span class="value">#' + id + '</span></div>'
  + '<div class="info-row"><span class="label">Statut</span><span class="value">En traitement</span></div>'
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Le détail complet sera disponible après confirmation bancaire.</p>', '🧾');

window.showSynthese = () => showInfo('Synthèse de mon patrimoine',
  '<div class="info-row"><span class="label">Comptes courants</span><span class="value">0,00 €</span></div>'
  + '<div class="info-row"><span class="label">Épargne</span><span class="value">0,00 €</span></div>'
  + '<div class="info-row"><span class="label">Crédits</span><span class="value">0,00 €</span></div>'
  + '<div class="info-row"><span class="label" style="font-weight:700;">Total</span><span class="value" style="font-weight:700;color:#1a7a4a;">0,00 €</span></div>', '📊');

window.contactManager = () => {
  const name = document.getElementById('managerName')?.textContent || '—';
  showInfo('Mon conseiller',
    '<p>Votre conseiller BNP Paribas est à votre écoute.</p>'
    + '<div class="info-row"><span class="label">Nom</span><span class="value">' + escapeHtml(name) + '</span></div>'
    + managerContactRowsHtml()
    + '<div class="info-row"><span class="label">Horaires</span><span class="value">Lun-Ven 9h-18h</span></div>', '👤');
};

window.activateCashback = () => showInfo('Cashback activé',
  '<p>🎉 Votre programme de cashback est désormais actif sur vos achats éligibles.</p>'
  + '<div class="info-row"><span class="label">Taux moyen</span><span class="value" style="color:#1a7a4a;">jusqu\'à 5%</span></div>'
  + '<div class="info-row"><span class="label">Cumul ce mois</span><span class="value">0,00 €</span></div>', '💰');

window.showOpportunities = () => showInfo('Opportunités du moment',
  '<p>Découvrez nos offres exclusives :</p>'
  + '<div class="info-row"><span class="label">Livret d\'épargne</span><span class="value" style="color:#1a7a4a;">3% brut</span></div>'
  + '<div class="info-row"><span class="label">PEL nouvelle gén.</span><span class="value" style="color:#1a7a4a;">2,25%</span></div>'
  + '<div class="info-row"><span class="label">Prêt personnel</span><span class="value">dès 4,90% TAEG</span></div>', '✨');

window.showImmobilier = () => showInfo('Crédit immobilier',
  '<p>Concrétisez votre projet immobilier avec BNP Paribas.</p>'
  + '<div class="info-row"><span class="label">Taux dès</span><span class="value" style="color:#1a7a4a;">3,45% TAEG</span></div>'
  + '<div class="info-row"><span class="label">Durée</span><span class="value">jusqu\'à 25 ans</span></div>'
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Une simulation détaillée vous sera envoyée par votre conseiller.</p>', '🏠');

window.showChat = () => showInfo('Messagerie sécurisée',
  '<p>Échangez en toute confidentialité avec votre conseiller.</p>'
  + '<div class="info-row"><span class="label">Nouveaux messages</span><span class="value">0</span></div>'
  + '<div class="info-row"><span class="label">Délai moyen</span><span class="value">sous 24h</span></div>', '💬');

window.showPhone = () => {
  const phone = window.__currentManagerPhone || '';
  if (phone) { window.location.href = 'tel:' + phone.replace(/\s/g,''); }
  else showInfo('Téléphone non configuré', '<p>Votre conseiller n\'a pas encore renseigné de numéro de téléphone. Contactez-le par messagerie sécurisée.</p>', '📞');
};

window.showSecurity = () => showInfo('Sécurité de mon compte',
  '<div class="info-row"><span class="label">Authentification forte</span><span class="value" style="color:#1a7a4a;">Activée</span></div>'
  + '<div class="info-row"><span class="label">Code PIN</span><span class="value" style="color:#1a7a4a;">Configuré</span></div>'
  + '<div class="info-row"><span class="label">Dernière connexion</span><span class="value">' + new Date().toLocaleString('fr-FR') + '</span></div>'
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Ne communiquez jamais votre code PIN ou vos identifiants.</p>', '🔒');

window.showHelp = () => showInfo('Aide & Support',
  '<p>Notre équipe est disponible pour répondre à toutes vos questions.</p>'
  + '<div class="info-row"><span class="label">Mon conseiller</span><span class="value">' + escapeHtml(document.getElementById('managerName')?.textContent || '—') + '</span></div>'
  + managerContactRowsHtml()
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Utilisez la messagerie sécurisée pour toute demande.</p>', '🆘');

window.goBack = () => navigateTo('accueil');

document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBalance');
  const balanceEl = document.getElementById('mainBalance');
  let shown = false;
  if (toggleBtn && balanceEl) {
    toggleBtn.addEventListener('click', () => { shown = !shown; balanceEl.classList.toggle('hidden', !shown); });
  }
  document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('loginUsername').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPassword').focus(); });
  initAuth();
});

window.doLogin = doLogin;
window.goToPinSetup = goToPinSetup;
window.pinSetupInput = pinSetupInput;
window.pinSetupDel = pinSetupDel;
window.pinVerifyInput = pinVerifyInput;
window.pinVerifyDel = pinVerifyDel;
window.showAuthScreen = showAuthScreen;
window.doLogout = doLogout;
window.togglePassword = togglePassword;
window.closeWelcomeModal = closeWelcomeModal;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.switchAdminTab = switchAdminTab;
window.selectUser = selectUser;
window.adminSaveSection = adminSaveSection;
window.adminCreditAccount = adminCreditAccount;
window.adminResetPassword = adminResetPassword;
window.adminDeleteUser = adminDeleteUser;
