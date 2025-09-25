const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';  // Usa .env o fallback

// Configuración de la base de datos
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'iacc',
  password: process.env.DB_PASSWORD || 'tesoro3515',
  port: process.env.DB_PORT || 5432,
});

app.use(cors());
app.use(bodyParser.json());

// Middleware para verificar JWT (protege rutas)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];  // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;  // user = { id, email, rol }
    next();
  });
};

// Middleware para verificar rol admin (opcional, para editar/eliminar)
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Requiere rol admin' });
  }
  next();
};

// === RUTAS DE AUTENTICACIÓN (PÚBLICAS) ===

// Registro de usuario
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, rol } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password requeridos' });
    }
    if (rol && !['user', 'admin'].includes(rol)) {
      return res.status(400).json({ error: 'Rol debe ser "user" o "admin"' });
    }

    // Verificar si email ya existe
    const emailCheck = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email ya registrado' });
    }

    // Hash del password
    const hashedPassword = bcrypt.hashSync(password, 10);

    const result = await pool.query(
      'INSERT INTO usuarios (email, password, rol) VALUES ($1, $2, $3) RETURNING id, email, rol',
      [email, hashedPassword, rol || 'user']
    );

    // Generar JWT
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, JWT_SECRET, { expiresIn: '1h' });

    res.status(201).json({ message: 'Usuario registrado', token, user: { id: user.id, email: user.email, rol: user.rol } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login de usuario
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y password requeridos' });
    }

    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const isValidPassword = bcrypt.compareSync(password, user.password);

    if (!isValidPassword) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar JWT
    const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login exitoso', token, user: { id: user.id, email: user.email, rol: user.rol } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

// === RUTAS DE INVENTARIO (PROTEGIDAS) ===
// RFID
// Nuevo: Buscar item por RFID tag
app.get('/api/inventario/rfid/:tag', authenticateToken, async (req, res) => {
  try {
    const { tag } = req.params;
    const result = await pool.query(
      'SELECT * FROM inventario WHERE rfid_tag = $1 OR sku = $1',  // Busca en rfid_tag O sku (fallback)
      [tag]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado con RFID/SKU: ' + tag });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error buscando RFID:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// Nuevo: Actualizar stock por RFID (solo admin)
app.put('/api/inventario/rfid/:tag/stock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tag } = req.params;
    const { delta } = req.body;  // ej: 1 para +1, -1 para -1
    if (!delta || typeof delta !== 'number') {
      return res.status(400).json({ error: 'Delta requerido (número entero)' });
    }
    // Buscar item
    const result = await pool.query(
      'SELECT * FROM inventario WHERE rfid_tag = $1 OR sku = $1 FOR UPDATE',  // Lock para concurrencia
      [tag]
    );

// RFID
// GET: Obtener inventario (requiere token, user puede ver)
app.get('/api/inventario', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventario ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// POST: Agregar item (requiere admin)
app.post('/api/inventario', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { nombre, cantidad, sku, stock_minimo } = req.body;
    if (!nombre || !cantidad || !sku || stock_minimo === undefined) {
      return res.status(400).json({ error: 'Nombre, cantidad, SKU y stock mínimo son requeridos' });
    }
    if (parseInt(cantidad) < 0 || parseInt(stock_minimo) < 0) {
      return res.status(400).json({ error: 'Cantidad y stock mínimo deben ser 0 o mayores' });
    }

    const skuCheck = await pool.query('SELECT id FROM inventario WHERE sku = $1', [sku.toUpperCase()]);
    if (skuCheck.rows.length > 0) {
      return res.status(409).json({ error: 'El SKU ya existe. Debe ser único.' });
    }

    const result = await pool.query(
      'INSERT INTO inventario (nombre, cantidad, sku, stock_minimo) VALUES ($1, $2, $3, $4) RETURNING *',
      [nombre, parseInt(cantidad), sku.toUpperCase(), parseInt(stock_minimo)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'El SKU ya existe. Debe ser único.' });
    } else {
      res.status(500).json({ error: 'Error al agregar item' });
    }
  }
});

// PUT: Actualizar item (requiere admin)
app.put('/api/inventario/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cantidad, sku, stock_minimo } = req.body;
    if (!nombre || !cantidad || !sku || stock_minimo === undefined) {
      return res.status(400).json({ error: 'Nombre, cantidad, SKU y stock mínimo son requeridos' });
    }
    if (parseInt(cantidad) < 0 || parseInt(stock_minimo) < 0) {
      return res.status(400).json({ error: 'Cantidad y stock mínimo deben ser 0 o mayores' });
    }

    const skuCheck = await pool.query(
      'SELECT id FROM inventario WHERE sku = $1 AND id != $2',
      [sku.toUpperCase(), parseInt(id)]
    );
    if (skuCheck.rows.length > 0) {
      return res.status(409).json({ error: 'El SKU ya existe en otro artículo.' });
    }

    const result = await pool.query(
      'UPDATE inventario SET nombre = $1, cantidad = $2, sku = $3, stock_minimo = $4 WHERE id = $5 RETURNING *',
      [nombre, parseInt(cantidad), sku.toUpperCase(), parseInt(stock_minimo), parseInt(id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'El SKU ya existe. Debe ser único.' });
    } else {
      res.status(500).json({ error: 'Error al actualizar item' });
    }
  }
});

// DELETE: Eliminar item (requiere admin)
app.delete('/api/inventario/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM inventario WHERE id = $1 RETURNING *', [parseInt(id)]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    res.json({ message: 'Item eliminado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
