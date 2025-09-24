const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();  // Carga variables de entorno desde .env

const app = express();  // Definir app AQUÍ, antes de cualquier ruta
const port = process.env.PORT || 5000;

// Configuración de la base de datos (usa .env o fallback hardcodeado)
const pool = new Pool({
  user: process.env.DB_USER || 'tu_usuario',      // Cambia si no usas .env
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tu_base_de_datos',  // Cambia por tu DB
  password: process.env.DB_PASSWORD || 'tu_contraseña',  // Cambia por tu contraseña
  port: process.env.DB_PORT || 5432,
});

// Middleware (debe ir antes de las rutas)
app.use(cors());
app.use(bodyParser.json());

// Ruta para obtener todos los items del inventario (incluye SKU y stock_minimo)
app.get('/api/inventario', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventario ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener inventario' });
  }
});

// Ruta para agregar un nuevo item (con validación de SKU único y stock_minimo)
app.post('/api/inventario', async (req, res) => {
  try {
    const { nombre, cantidad, sku, stock_minimo } = req.body;
    if (!nombre || !cantidad || !sku || stock_minimo === undefined) {
      return res.status(400).json({ error: 'Nombre, cantidad, SKU y stock mínimo son requeridos' });
    }
    if (parseInt(cantidad) < 0 || parseInt(stock_minimo) < 0) {
      return res.status(400).json({ error: 'Cantidad y stock mínimo deben ser 0 o mayores' });
    }

    // Verificar si el SKU ya existe
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
    if (err.code === '23505') {  // UNIQUE violation en PostgreSQL
      res.status(409).json({ error: 'El SKU ya existe. Debe ser único.' });
    } else {
      res.status(500).json({ error: 'Error al agregar item' });
    }
  }
});

// Ruta para actualizar un item (con validación de SKU único y stock_minimo)
app.put('/api/inventario/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, cantidad, sku, stock_minimo } = req.body;
    if (!nombre || !cantidad || !sku || stock_minimo === undefined) {
      return res.status(400).json({ error: 'Nombre, cantidad, SKU y stock mínimo son requeridos' });
    }
    if (parseInt(cantidad) < 0 || parseInt(stock_minimo) < 0) {
      return res.status(400).json({ error: 'Cantidad y stock mínimo deben ser 0 o mayores' });
    }

    // Verificar si el nuevo SKU ya existe en otro registro
    const skuCheck = await pool.query(
      'SELECT id FROM inventario WHERE sku = $1 AND id != $2',
      [sku.toUpperCase(), parseInt(id)]
    );
    if (skuCheck.rows.length > 0) {
      return res.status(409).json({ error: 'El SKU ya existe en otro artículo. Debe ser único.' });
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

// Ruta para eliminar un item
app.delete('/api/inventario/:id', async (req, res) => {
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

// Manejo de errores global (opcional, para capturar errores no manejados)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal en el servidor' });
});

// Iniciar el servidor (al final del archivo)
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
