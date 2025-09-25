//server.js  modificado
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';

import pool from './conexion.js';
import guardarDestino from './guardarDestino.js';
import loginUsuario from './loginUsuario.js';
import { obtenerReservaTours } from './obtenerReservaTours.js';
import actualizarDatosTours from './actualizarDatosTours.js';
import guardarFirmaTours from './firmas/guardarFirmaTours.js'; // <- este es el handler correcto
import consultarHoteles from './consultarHoteles.js';
import consultarSalidas from './consultarSalidas.js';
import exportarExcelSalidasTours from './exportarExcelSalidasTours.js';
import exportarExcelSalidasAmbos from './exportarExcelSalidasAmbos.js';
import buscarReservas from './buscarReservasTours.js';

const app = express();
const PORT = process.env.PORT || 4000;

// Behind proxy (Railway/Heroku)
app.set('trust proxy', 1);

// CORS + body size (firmas base64)
app.use(cors());
app.options('*', cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: false, limit: '15mb' }));

// servir imágenes de firmas
app.use('/firmas', express.static(path.join(process.cwd(), 'firmas')));

// ======= Endpoints existentes =======
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

// Guardar destino (si lo usas)
app.post('/guardar-destino', guardarDestino);
app.post('/api/guardar-firma-tours', guardarFirmaTours);
app.post('/api/login-usuario', loginUsuario);
app.get('/api/obtener-reserva-tours', obtenerReservaTours);
app.post('/api/actualizar-datos-tours', actualizarDatosTours);
app.get('/api/consultar-hoteles', consultarHoteles);
app.get('/api/salidas', consultarSalidas);
app.get('/api/exportarExcelSalidas', exportarExcelSalidasTours);
app.get('/api/exportarExcelSalidasAmbos', exportarExcelSalidasAmbos);
app.get('/api/buscar-reservas-tours', buscarReservasTours);
app.get('/', (_req, res) => res.send('API Destinos activa 🎯'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Error handler
app.use((err, _req, res, _next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, () => console.log(`🚀 API de destinos corriendo en el puerto ${PORT}`));