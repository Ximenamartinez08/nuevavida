// =====================================================
//  NuevaVida – servidor Node.js + Express + MySQL
//  Arrancar: node server.js
// =====================================================

const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;  // puerto 3001 para no chocar con AEP

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


const dbConfig = {
  host     : process.env.MYSQLHOST     || 'localhost',
  user     : process.env.MYSQLUSER     || 'root',
  password : process.env.MYSQLPASSWORD || 'diegardo74',
  database : process.env.MYSQLDATABASE || 'nuevavida_db',
  port     : parseInt(process.env.MYSQLPORT || '3306'),
  charset  : 'utf8mb4',
  ssl      : process.env.MYSQLHOST ? { rejectUnauthorized: false } : false,
};

let pool;

async function initDB() {
  try {
    pool = await mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 10 });
    console.log('✅ Conectado a MySQL');

    await pool.query(`CREATE TABLE IF NOT EXISTS usuarios (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      nombre     VARCHAR(120) NOT NULL,
      correo     VARCHAR(120) NOT NULL UNIQUE,
      password   VARCHAR(255) NOT NULL,
      creado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS postulaciones (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      nombre      VARCHAR(120) NOT NULL,
      correo      VARCHAR(120),
      telefono    VARCHAR(30),
      vacante     VARCHAR(120) NOT NULL,
      mensaje     TEXT,
      creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS voluntarios (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      nombre      VARCHAR(120) NOT NULL,
      correo      VARCHAR(120),
      area        VARCHAR(80),
      mensaje     TEXT,
      creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS orientacion (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      nombre      VARCHAR(120) NOT NULL,
      correo      VARCHAR(120),
      telefono    VARCHAR(30),
      mensaje     TEXT,
      creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS contacto (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      nombre      VARCHAR(120) NOT NULL,
      correo      VARCHAR(120) NOT NULL,
      mensaje     TEXT NOT NULL,
      creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS vacantes (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      empresa     VARCHAR(120) NOT NULL,
      puesto      VARCHAR(120) NOT NULL,
      descripcion TEXT,
      requisitos  TEXT,
      creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS admins (
      id       INT AUTO_INCREMENT PRIMARY KEY,
      usuario  VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    ) CHARACTER SET utf8mb4`);

    const [admins] = await pool.query('SELECT id FROM admins WHERE usuario = ?', ['admin']);
    if (admins.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query('INSERT INTO admins (usuario, password) VALUES (?, ?)', ['admin', hash]);
      console.log('👤 Admin creado  →  usuario: admin  |  password: admin123');
    }

} catch (err) {
    console.error('❌ Error MySQL:', err.message, err.code, err.sqlMessage);
    process.exit(1);
  }
}

// ── RUTAS PÚBLICAS ────────────────────────────────────

// Registro de usuario
app.post('/api/registro', async (req, res) => {
  const { nombre, correo, password } = req.body;
  if (!nombre || !correo || !password)
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await pool.query(
      'INSERT INTO usuarios (nombre, correo, password) VALUES (?, ?, ?)',
      [nombre.trim(), correo.trim().toLowerCase(), hash]
    );
    res.json({ ok: true, usuario_id: r.insertId, nombre: nombre.trim() });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(400).json({ error: 'Este correo ya está registrado.' });
    res.status(500).json({ error: 'Error al registrar.' });
  }
});

// Postulación a vacante
app.post('/api/postulacion', async (req, res) => {
  const { nombre, correo, telefono, vacante, mensaje } = req.body;
  if (!nombre || !vacante)
    return res.status(400).json({ error: 'Nombre y vacante son obligatorios.' });
  try {
    await pool.query(
      'INSERT INTO postulaciones (nombre, correo, telefono, vacante, mensaje) VALUES (?, ?, ?, ?, ?)',
      [nombre.trim(), correo || '', telefono || '', vacante.trim(), mensaje || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar postulación.' });
  }
});

// Voluntario
app.post('/api/voluntario', async (req, res) => {
  const { nombre, correo, area, mensaje } = req.body;
  if (!nombre)
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  try {
    await pool.query(
      'INSERT INTO voluntarios (nombre, correo, area, mensaje) VALUES (?, ?, ?, ?)',
      [nombre.trim(), correo || '', area || '', mensaje || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar.' });
  }
});

// Orientación
app.post('/api/orientacion', async (req, res) => {
  const { nombre, correo, telefono, mensaje } = req.body;
  if (!nombre)
    return res.status(400).json({ error: 'El nombre es obligatorio.' });
  try {
    await pool.query(
      'INSERT INTO orientacion (nombre, correo, telefono, mensaje) VALUES (?, ?, ?, ?)',
      [nombre.trim(), correo || '', telefono || '', mensaje || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar.' });
  }
});

// Contacto
app.post('/api/contacto', async (req, res) => {
  const { nombre, correo, mensaje } = req.body;
  if (!nombre || !correo || !mensaje)
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  try {
    await pool.query(
      'INSERT INTO contacto (nombre, correo, mensaje) VALUES (?, ?, ?)',
      [nombre.trim(), correo.trim(), mensaje.trim()]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al enviar.' });
  }
});

// Publicar vacante (empresa)
app.post('/api/vacante', async (req, res) => {
  const { empresa, puesto, descripcion, requisitos } = req.body;
  if (!empresa || !puesto)
    return res.status(400).json({ error: 'Empresa y puesto son obligatorios.' });
  try {
    await pool.query(
      'INSERT INTO vacantes (empresa, puesto, descripcion, requisitos) VALUES (?, ?, ?, ?)',
      [empresa.trim(), puesto.trim(), descripcion || '', requisitos || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al publicar vacante.' });
  }
});

// ── ADMIN ─────────────────────────────────────────────

app.post('/api/admin/login', async (req, res) => {
  const { usuario, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM admins WHERE usuario = ?', [usuario]);
    if (!rows.length) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    const ok = await bcrypt.compare(password, rows[0].password);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    const token = Buffer.from(`${rows[0].id}:${Date.now()}`).toString('base64');
    res.json({ ok: true, token });
  } catch (err) {
    res.status(500).json({ error: 'Error en login.' });
  }
});

function authAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    const dec = Buffer.from(token, 'base64').toString('utf8');
    if (!dec.includes(':')) throw new Error();
    next();
  } catch {
    res.status(401).json({ error: 'No autorizado.' });
  }
}

// GET resumen para dashboard
app.get('/api/admin/resumen', authAdmin, async (req, res) => {
  try {
    const [[u]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    const [[p]] = await pool.query('SELECT COUNT(*) AS total FROM postulaciones');
    const [[v]] = await pool.query('SELECT COUNT(*) AS total FROM voluntarios');
    const [[o]] = await pool.query('SELECT COUNT(*) AS total FROM orientacion');
    const [[c]] = await pool.query('SELECT COUNT(*) AS total FROM contacto');
    const [[va]] = await pool.query('SELECT COUNT(*) AS total FROM vacantes');

    const [recPostulaciones] = await pool.query(
      'SELECT nombre, vacante, correo, creado_en FROM postulaciones ORDER BY creado_en DESC LIMIT 10'
    );
    const [recUsuarios] = await pool.query(
      'SELECT nombre, correo, creado_en FROM usuarios ORDER BY creado_en DESC LIMIT 10'
    );

    res.json({ ok: true,
      totales: { usuarios: u.total, postulaciones: p.total, voluntarios: v.total,
                 orientacion: o.total, contacto: c.total, vacantes: va.total },
      recPostulaciones, recUsuarios
    });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// GET tabla completa por sección
app.get('/api/admin/:tabla', authAdmin, async (req, res) => {
  const tablas = ['usuarios','postulaciones','voluntarios','orientacion','contacto','vacantes'];
  const { tabla } = req.params;
  if (!tablas.includes(tabla)) return res.status(400).json({ error: 'Tabla inválida.' });
  try {
    const cols = tabla === 'usuarios'
      ? 'id, nombre, correo, creado_en'
      : '*';
    const [rows] = await pool.query(`SELECT ${cols} FROM ${tabla} ORDER BY creado_en DESC`);
    res.json({ ok: true, datos: rows });
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

// Exportar CSV
app.get('/api/admin/exportar/:tabla', authAdmin, async (req, res) => {
  const tablas = ['usuarios','postulaciones','voluntarios','orientacion','contacto','vacantes'];
  const { tabla } = req.params;
  if (!tablas.includes(tabla)) return res.status(400).json({ error: 'Tabla inválida.' });
  try {
    const cols = tabla === 'usuarios' ? 'id, nombre, correo, creado_en' : '*';
    const [rows] = await pool.query(`SELECT ${cols} FROM ${tabla} ORDER BY creado_en DESC`);
    if (!rows.length) return res.send('Sin datos');
    const header = Object.keys(rows[0]).join(',') + '\n';
    const body   = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="nuevavida_${tabla}.csv"`);
    res.send('\uFEFF' + header + body);
  } catch (err) { res.status(500).json({ error: 'Error.' }); }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor en http://localhost:${PORT}`);
    console.log(`📋 Admin en     http://localhost:${PORT}/admin.html`);
    console.log(`🏠 App en       http://localhost:${PORT}/index.html`);
  });
});
