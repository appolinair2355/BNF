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
  localStorage.removeItem('mybank_token');
  sessionStorage.removeItem('mybank_pin_ok');
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
  const lastname = cleanValue(data.holder_lastname, '—');
  const firstname = cleanValue(data.holder_firstname, '—');
  const birthdate = cleanValue(data.holder_birthdate, '—');
  const country = cleanValue(data.holder_country, '—');
  const city = cleanValue(data.holder_city, '—');
  const region = cleanValue(data.holder_region, '—');
  const fullName = [data.holder_firstname, data.holder_lastname].filter(v => String(v || '').trim()).join(' ') || '—';
  const last4 = accountNumber.replace(/\*/g, '').replace(/\D/g, '').slice(-4).padStart(4, '0');

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
  setText('ribIban', 'FR76 3000 4000 1500 0000 0000 ' + last4);
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

  if (tab === 'users') {
    document.getElementById('tabUsers').classList.add('active');
    document.getElementById('adminTabUsers').classList.add('active');
  } else {
    document.getElementById('tabEdit').classList.add('active');
    document.getElementById('adminTabEdit').classList.add('active');
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
  document.getElementById('adminSaveStatus').textContent = '';
  document.getElementById('adm_new_password').value = '';

  try {
    const r = await fetch('/api/admin/users/' + userId + '/data', { headers: getAuthHeaders() });
    const data = await r.json();
    const fields = ['alert_amount','account_number','account_date','account_balance','account_frozen',
      'account_pending','holder_lastname','holder_firstname','holder_birthdate','holder_country',
      'holder_city','holder_region','manager_name','transaction1_name','transaction1_date',
      'transaction1_status','transaction1_amount','transaction2_name','transaction2_date',
      'transaction2_status','transaction2_amount','transaction3_name','transaction3_date',
      'transaction3_status','transaction3_amount','synthese_total'];

    fields.forEach(key => {
      const el = document.getElementById('adm_' + key);
      if (el) {
        if (el.tagName === 'SELECT') el.value = data[key] || 'false';
        else el.value = data[key] || '';
      }
    });

    document.querySelectorAll('.admin-user-item').forEach(item => item.classList.remove('selected'));
    switchAdminTab('edit');
    loadAdminUsers();
  } catch {
    alert('Impossible de charger les données de cet utilisateur.');
  }
}

async function adminSaveData() {
  if (!selectedUserId) return;
  const statusEl = document.getElementById('adminSaveStatus');
  statusEl.textContent = '';
  statusEl.className = 'admin-save-status';

  const fields = ['alert_amount','account_number','account_date','account_balance','account_frozen',
    'account_pending','holder_lastname','holder_firstname','holder_birthdate','holder_country',
    'holder_city','holder_region','manager_name','transaction1_name','transaction1_date',
    'transaction1_status','transaction1_amount','transaction2_name','transaction2_date',
    'transaction2_status','transaction2_amount','transaction3_name','transaction3_date',
    'transaction3_status','transaction3_amount','synthese_total'];

  const updates = {};
  fields.forEach(key => {
    const el = document.getElementById('adm_' + key);
    if (el) updates[key] = el.value;
  });

  try {
    const r = await fetch('/api/admin/users/' + selectedUserId + '/data', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    if (r.ok) {
      statusEl.textContent = '✅ Modifications enregistrées !';
      statusEl.className = 'admin-save-status success';
    } else {
      const d = await r.json();
      statusEl.textContent = '❌ ' + (d.error || 'Erreur');
      statusEl.className = 'admin-save-status error';
    }
  } catch {
    statusEl.textContent = '❌ Erreur réseau';
    statusEl.className = 'admin-save-status error';
  }
  setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'admin-save-status'; }, 4000);
}

async function adminResetPassword() {
  if (!selectedUserId) return;
  const pw = document.getElementById('adm_new_password').value;
  if (!pw || pw.length < 4) { alert('Mot de passe : 4 caractères minimum.'); return; }
  if (!confirm('Réinitialiser le mot de passe de cet utilisateur ?')) return;
  try {
    const r = await fetch('/api/admin/users/' + selectedUserId + '/reset-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ newPassword: pw })
    });
    const d = await r.json();
    if (r.ok) { alert('✅ Mot de passe réinitialisé.'); document.getElementById('adm_new_password').value = ''; }
    else alert('❌ ' + (d.error || 'Erreur'));
  } catch { alert('Erreur réseau.'); }
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

window.showVirement = () => openModal('virementModal');
window.showRIB = () => openModal('ribModal');
window.showPlafonds = () => openModal('plafondsModal');
window.showNotifications = () => openModal('notifModal');

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

window.showAllTransactions = () => showInfo('Toutes mes opérations',
  '<p>Retrouvez ici l\'historique complet de vos opérations.</p>'
  + '<div class="info-row"><span class="label">Ce mois-ci</span><span class="value">0 opération</span></div>'
  + '<div class="info-row"><span class="label">Mois précédent</span><span class="value">0 opération</span></div>'
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Les opérations apparaîtront ici dès la première transaction.</p>', '📋');

window.showTransactionDetail = (id) => showInfo('Détail de l\'opération',
  '<div class="info-row"><span class="label">Référence</span><span class="value">#' + id + '</span></div>'
  + '<div class="info-row"><span class="label">Statut</span><span class="value">En traitement</span></div>'
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Le détail complet sera disponible après confirmation bancaire.</p>', '🧾');

window.showSynthese = () => showInfo('Synthèse de mon patrimoine',
  '<div class="info-row"><span class="label">Comptes courants</span><span class="value">0,00 €</span></div>'
  + '<div class="info-row"><span class="label">Épargne</span><span class="value">0,00 €</span></div>'
  + '<div class="info-row"><span class="label">Crédits</span><span class="value">0,00 €</span></div>'
  + '<div class="info-row"><span class="label" style="font-weight:700;">Total</span><span class="value" style="font-weight:700;color:#1a7a4a;">0,00 €</span></div>', '📊');

window.contactManager = () => showInfo('Contacter mon gestionnaire',
  '<p>Votre conseiller BNP Paribas est à votre écoute.</p>'
  + '<div class="info-row"><span class="label">Téléphone</span><span class="value">+33 1 40 40 20 00</span></div>'
  + '<div class="info-row"><span class="label">Horaires</span><span class="value">Lun-Ven 9h-18h</span></div>'
  + '<div class="info-row"><span class="label">Email</span><span class="value">conseiller@bnpparibas.fr</span></div>', '👤');

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

window.showPhone = () => { window.location.href = 'tel:+33140402000'; };

window.showSecurity = () => showInfo('Sécurité de mon compte',
  '<div class="info-row"><span class="label">Authentification forte</span><span class="value" style="color:#1a7a4a;">Activée</span></div>'
  + '<div class="info-row"><span class="label">Code PIN</span><span class="value" style="color:#1a7a4a;">Configuré</span></div>'
  + '<div class="info-row"><span class="label">Dernière connexion</span><span class="value">' + new Date().toLocaleString('fr-FR') + '</span></div>'
  + '<p style="margin-top:10px;color:#666;font-size:13px;">Ne communiquez jamais votre code PIN ou vos identifiants.</p>', '🔒');

window.showHelp = () => showInfo('Aide & Support',
  '<p>Notre équipe est disponible pour répondre à toutes vos questions.</p>'
  + '<div class="info-row"><span class="label">Service client</span><span class="value">+33 1 40 40 20 00</span></div>'
  + '<div class="info-row"><span class="label">Urgence carte (24/7)</span><span class="value">+33 9 69 32 30 30</span></div>'
  + '<div class="info-row"><span class="label">Email</span><span class="value">contact@bnpparibas.fr</span></div>', '🆘');

window.goBack = () => navigateTo('accueil');

// Balance toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggleBalance');
  const balanceEl = document.getElementById('mainBalance');
  let shown = false;
  if (toggleBtn && balanceEl) {
    toggleBtn.addEventListener('click', () => {
      shown = !shown;
      balanceEl.classList.toggle('hidden', !shown);
    });
  }

  // Enter key on login
  document.getElementById('loginPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('loginUsername').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginPassword').focus();
  });

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
window.adminSaveData = adminSaveData;
window.adminResetPassword = adminResetPassword;
window.adminDeleteUser = adminDeleteUser;
