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
  return '**** ' + crypto.randomInt(0, 10000).toString().padStart(4, '0');
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
    holder_country: '',
    holder_city: '',
    holder_region: '',
    manager_name: '',
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
    synthese_total: '0'
  };
}

async function initFileStorage() {
  const users = readUsers();
  if (!users.find(u => u.username === 'buzzinfluence')) {
    const pwHash = await bcrypt.hash('arrow2025', 10);
    const pinHash = await bcrypt.hash('12345', 10);
    const adminId = 'admin-' + crypto.randomBytes(8).toString('hex');
    users.push({ id: adminId, username: 'buzzinfluence', passwordHash: pwHash, pinHash, role: 'admin', createdAt: new Date().toISOString() });
    writeUsers(users);
    writeAccountFile(adminId, getEmptyData());
  }
  console.log('✅ Stockage JSON initialisé');
}

async function initDB() {
  if (!useDB) {
    await initFileStorage();
    return;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        pin_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS account_data (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        key VARCHAR(100) NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, key)
      )
    `);
    const adminCheck = await client.query(`SELECT id FROM users WHERE username = $1`, ['buzzinfluence']);
    if (adminCheck.rows.length === 0) {
      const pwHash = await bcrypt.hash('arrow2025', 10);
      const pinHash = await bcrypt.hash('12345', 10);
      const res = await client.query(
        `INSERT INTO users (username, password_hash, pin_hash, role) VALUES ($1,$2,$3,'admin') RETURNING id`,
        ['buzzinfluence', pwHash, pinHash]
      );
      const seed = getEmptyData();
      for (const [key, value] of Object.entries(seed)) {
        await client.query(
          `INSERT INTO account_data (user_id, key, value) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [res.rows[0].id, key, value]
        );
      }
    }
    console.log('✅ PostgreSQL initialisé');
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
  if (!useDB) {
    return readUsers().find(u => u.username === username) || null;
  }
  const r = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return { id: String(row.id), username: row.username, passwordHash: row.password_hash, pinHash: row.pin_hash, role: row.role, createdAt: row.created_at };
}

async function findUserById(id) {
  if (!useDB) {
    return readUsers().find(u => u.id === id) || null;
  }
  const r = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return { id: String(row.id), username: row.username, passwordHash: row.password_hash, pinHash: row.pin_hash, role: row.role, createdAt: row.created_at };
}

async function createUser(username, passwordHash, pinHash) {
  const seed = getEmptyData();

  if (!useDB) {
    const users = readUsers();
    const id = generateUserId();
    const user = { id, username, passwordHash, pinHash, role: 'user', createdAt: new Date().toISOString() };
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
  const user = { id: String(row.id), username: row.username, passwordHash: row.password_hash, pinHash: row.pin_hash, role: row.role, createdAt: row.created_at };
  for (const [key, value] of Object.entries(seed)) {
    await pool.query(
      `INSERT INTO account_data (user_id, key, value) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [row.id, key, value]
    );
  }
  return user;
}

async function getAllUsers() {
  if (!useDB) {
    return readUsers().map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }));
  }
  const r = await pool.query(`SELECT id, username, role, created_at FROM users ORDER BY created_at`);
  return r.rows.map(row => ({ id: String(row.id), username: row.username, role: row.role, createdAt: row.created_at }));
}

async function getAccountData(userId) {
  if (!useDB) {
    const data = readAccountFile(userId);
    if (data && Object.keys(data).length) return data;
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

async function updateUserPassword(userId, newHash) {
  if (!useDB) {
    const users = readUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) { users[idx].passwordHash = newHash; writeUsers(users); }
    return;
  }
  await pool.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [newHash, userId]);
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
    const { username, password, pin } = req.body;
    if (!username || !password || !pin) return res.status(400).json({ error: 'Tous les champs sont requis' });
    if (username.trim().length < 3) return res.status(400).json({ error: 'Identifiant : 3 caractères minimum' });
    if (password.length < 4) return res.status(400).json({ error: 'Mot de passe : 4 caractères minimum' });
    if (!/^\d{5}$/.test(pin)) return res.status(400).json({ error: 'Le code PIN doit être composé de 5 chiffres' });

    const existing = await findUser(username.trim());
    if (existing) return res.status(409).json({ error: 'Cet identifiant est déjà utilisé' });

    const pwHash = await bcrypt.hash(password, 10);
    const pinHash = await bcrypt.hash(pin, 10);
    const user = await createUser(username.trim(), pwHash, pinHash);

    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, token, userId: user.id, username: user.username, role: user.role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/verify-token', auth, (req, res) => {
  res.json({ valid: true, userId: req.user.userId, username: req.user.username, role: req.user.role });
});

app.get('/api/client-data', auth, async (req, res) => {
  try {
    res.json(await getAccountData(req.user.userId));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/client-data', auth, async (req, res) => {
  try {
    await saveAccountData(req.user.userId, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

app.post('/api/admin/users/:id/reset-password', auth, adminOnly, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Mot de passe : 4 caractères minimum' });
    await updateUserPassword(req.params.id, await bcrypt.hash(newPassword, 10));
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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', async () => {
  await initDB();
  console.log(`MyBank démarré sur le port ${PORT}`);
});
