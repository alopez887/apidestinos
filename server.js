import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './conexion.js';
import guardarDestino from './guardarDestino.js'; // ✅ Mantiene tu flujo actual
import loginUsuario from './loginUsuario.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Recomendado en Railway/Heroku para IP real
app.set('trust proxy', 1);

// Middlewares
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false })); // ✅ NUEVO: soporta x-www-form-urlencoded (iframe login)

// 🔹 Endpoint: Obtener capacidades
app.get('/capacidades', async (req, res) => {
  const { destino, transporte } = req.query;

  if (!destino || !transporte) {
    return res.status(400).json({ error: 'Faltan parámetros (destino y transporte)' });
  }

  try {
    const result = await pool.query(
      `
      SELECT TRIM(UPPER(capacidad)) AS capacidad
      FROM tarifas_destinos
      WHERE UPPER(destino) = UPPER($1)
        AND UPPER(tipo_transporte) = UPPER($2)
        AND activo = true
      GROUP BY TRIM(UPPER(capacidad))
      ORDER BY TRIM(UPPER(capacidad))
      `,
      [destino, transporte]
    );

    const capacidades = result.rows.map(r => r.capacidad);
    const capacidadesUnicas = [...new Set(capacidades)];
    res.json(capacidadesUnicas);
  } catch (err) {
    console.error('❌ Error al consultar capacidades:', err.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
});

// 🔹 Endpoint: Obtener precio
app.get('/precio', async (req, res) => {
  const { destino, transporte, capacidad } = req.query;

  if (!destino || !transporte || !capacidad) {
    return res.status(400).json({ error: 'Faltan parámetros (destino, transporte y capacidad)' });
  }

  try {
    const result = await pool.query(
      `
      SELECT precio
      FROM tarifas_destinos
      WHERE UPPER(destino) = UPPER($1)
        AND UPPER(tipo_transporte) = UPPER($2)
        AND TRIM(UPPER(capacidad)) = TRIM(UPPER($3))
        AND activo = true
      LIMIT 1
      `,
      [destino, transporte, capacidad]
    );

    if (result.rows.length > 0) {
      res.json({ precio: result.rows[0].precio });
    } else {
      res.status(404).json({ error: 'Tarifa no encontrada' });
    }
  } catch (err) {
    console.error('❌ Error al consultar precio:', err.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
});

// 🔹 Endpoint: Obtener hoteles
app.get('/hoteles', async (_req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT DISTINCT nombre_hotel
      FROM hoteles_zona
      WHERE nombre_hotel IS NOT NULL AND nombre_hotel <> ''
      ORDER BY nombre_hotel
      `
    );

    const hoteles = result.rows.map(r => r.nombre_hotel);
    res.json(hoteles);
  } catch (err) {
    console.error('❌ Error al consultar hoteles:', err.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
});

// 🔹 Endpoint: Guardar destino (nuevo)
app.post('/guardar-destino', guardarDestino);

// 🔹 Login usuarios (iframe envía x-www-form-urlencoded)
app.post('/api/login-usuario', loginUsuario);

// ✅ Healthcheck
app.get('/', (_req, res) => {
  res.send('API Destinos activa 🎯');
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Start
app.listen(PORT, () => {
  console.log(`🚀 API de destinos corriendo en el puerto ${PORT}`);
});