import pool from './conexion.js';

const consultarSalidasTours = async (req, res) => {
  try {
    const { fecha, desde, hasta } = req.query;
    console.log('📥 Parámetros (salidas Tours):', { fecha, desde, hasta });

    // Tours: usamos fecha_inicioviajesalida como "fecha_salida" (salida del hotel hacia el tour)
    // Devolvemos MISMAS columnas que /api/salidas (Transporte) para que el front no cambie nada.
    let query = `
      SELECT
        folio,
        nombre_cliente,
        COALESCE(comentariosalida, nota, '') AS nota,
        'tours'::text AS tipo_viaje,
        tipo_transporte,
        capacidad,
        COALESCE(cantidad_pasajerosoksalida, cantidad_pasajeros) AS cantidad_pasajeros,
        COALESCE(hotel_salida, hotel_llegada) AS hotel_salida,
        zona,
        fecha_inicioviajesalida AS fecha_salida,
        NULL::text AS hora_salida,
        NULL::text AS aerolinea_salida,
        NULL::text AS vuelo_salida
      FROM reservaciones
      WHERE (tipo_servicio ILIKE 'tours')
    `;

    const values = [];
    if (fecha) {
      query += ` AND fecha_inicioviajesalida = $1 ORDER BY fecha_inicioviajesalida ASC, folio ASC`;
      values.push(fecha);
    } else if (desde && hasta) {
      query += ` AND DATE(fecha_inicioviajesalida) BETWEEN $1 AND $2 ORDER BY fecha_inicioviajesalida ASC, folio ASC`;
      values.push(desde, hasta);
    } else {
      query += ` AND fecha_inicioviajesalida = CURRENT_DATE ORDER BY fecha_inicioviajesalida ASC, folio ASC`;
    }

    const { rows } = await pool.query(query, values);
    console.log('✅ Salidas Tours:', rows.length);
    res.json({ datos: rows });
  } catch (err) {
    console.error('❌ Error salidas Tours:', err);
    res.status(500).json({ error: 'Error al obtener salidas (Tours)' });
  }
};

export default consultarSalidasTours;