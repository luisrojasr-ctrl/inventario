const express = require('express');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'tu_jwt_secreto_super_seguro';  // Cambia en .env

app.use(cors());
app.use(express.json());

// Conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'iacc',
  password: process.env.DB_PASSWORD || 'tesoro3515',
  port: process.env.DB_PORT || 5432,
});

// Middleware: Verificar JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];  // Bearer TOKEN
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// Middleware: Solo admin
const requireAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado: Solo admins' });
  }
  next();
};

// Route: Registro de usuario (default rol 'user')
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y password requeridos' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO usuarios (email, password, rol) VALUES ($1, $2, $3) RETURNING id, email, rol',
      [email, hashedPassword, 'user']  // Default 'user'
    );
    res.status(201).json({ message: 'Usuario registrado', user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {  // Unique violation
      res.status(400).json({ error: 'Email ya existe' });
    } else {
      console.error('Error registro:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

// Route: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: { id: user.id, email: user.email, rol: user.rol } });
  } catch (err) {
    console.error('Error login:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Routes: Inventario (existentes)
app.get('/api/inventario', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventario ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error GET inventario:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/api/inventario', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { nombre, cantidad, sku, stock_minimo, rfid_tag } = req.body;  // Nuevo: rfid_tag
    if (!nombre || !cantidad || !sku || stock_minimo === undefined) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, cantidad, sku, stock_minimo' });
    }
    const result = await pool.query(
      'INSERT INTO inventario (nombre, cantidad, sku, stock_minimo, rfid_tag) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nombre, parseInt(cantidad), sku, parseInt(stock_minimo), rfid_tag || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'SKU o RFID ya existe' });
    } else {
      console.error('Error POST inventario:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

app.put('/api/inventario/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cantidad, sku, stock_minimo, rfid_tag } = req.body;
    const result = await pool.query(
      'UPDATE inventario SET nombre=$1, cantidad=$2, sku=$3, stock_minimo=$4, rfid_tag=$5 WHERE id=$6 RETURNING *',
      [nombre, parseInt(cantidad), sku, parseInt(stock_minimo), rfid_tag || null, parseInt(id)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      res.status(400).json({ error: 'SKU o RFID ya existe' });
    } else {
      console.error('Error PUT inventario:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  }
});

app.delete('/api/inventario/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM inventario WHERE id=$1 RETURNING *', [parseInt(id)]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item no encontrado' });
    res.json({ message: 'Item eliminado' });
  } catch (err) {
    console.error('Error DELETE inventario:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Nuevos Routes: RFID
app.get('/api/inventario/rfid/:tag', authenticateToken, async (req, res) => {
  try {
    const { tag } = req.params;
    const result = await pool.query(
      'SELECT * FROM inventario WHERE rfid_tag = $1 OR sku = $1',  // Fallback a SKU
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

app.put('/api/inventario/rfid/:tag/stock', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { tag } = req.params;
    const { delta } = req.body;
    if (!delta || typeof delta !== 'number') {
      return res.status(400).json({ error: 'Delta requerido (número entero)' });
    }

    const result = await pool.query(
      'SELECT * FROM inventario WHERE rfid_tag = $1 OR sku = $1 FOR UPDATE',
      [tag]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado con RFID/SKU: ' + tag });
    }

    const item = result.rows[0];
    if (delta < 0 && item.cantidad === 0) {
      return res.status(400).json({ error: 'Stock insuficiente para salida' });
    }

    const newCantidad = Math.max(0, item.cantidad + delta);
    await pool.query(
      'UPDATE inventario SET cantidad = $1 WHERE rfid_tag = $2 OR sku = $2',
      [newCantidad, tag]
    );

    console.log(`RFID Update: ${tag} - Stock de ${item.cantidad} a ${newCantidad} (delta: ${delta}) por ${req.user.email}`);
    res.json({
      success: true,
      item: { ...item, cantidad: newCantidad },
      message: `Stock actualizado: ${newCantidad} unidades`
    });
  } catch (err) {
    console.error('Error actualizando stock RFID:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});
