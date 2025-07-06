import express from 'express';
import cors from 'cors';
import pool from './conexion.js'; // ✅ Asegúrate de que este archivo esté bien configurado

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// 🔹 Endpoint: Obtener capacidades
app.get('/capacidades', async (req, res) => {
  const { destino, transporte } = req.query;

  if (!destino || !transporte) {
    return res.status(400).json({ error: 'Faltan parámetros (destino y transporte)' });
  }

  try {
    const result = await pool.query(`
      SELECT DISTINCT capacidad
      FROM tarifas_destinos
      WHERE UPPER(destino) = UPPER($1)
        AND UPPER(tipo_transporte) = UPPER($2)
        AND activo = true
      ORDER BY capacidad
    `, [destino, transporte]);

    res.json(result.rows);
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
    const result = await pool.query(`
      SELECT precio
      FROM tarifas_destinos
      WHERE UPPER(destino) = UPPER($1)
        AND UPPER(tipo_transporte) = UPPER($2)
        AND capacidad = $3
        AND activo = true
      LIMIT 1
    `, [destino, transporte, capacidad]);

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
app.get('/hoteles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT nombre_hotel
      FROM hoteles_zona
      ORDER BY nombre_hotel
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error al consultar hoteles:', err.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
});

// ✅ Prueba de conexión
app.get('/', (req, res) => {
  res.send('API Destinos activa 🎯');
});

app.listen(PORT, () => {
  console.log(`🚀 API de destinos corriendo en el puerto ${PORT}`);
});