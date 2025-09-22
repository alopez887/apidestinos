import pool from './conexion.js';

export const consultarSalidasTours = async (req, res) => {
  try {
    const { fecha, desde, hasta } = req.query;
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
      query += ` AND fecha_inicioviajesalida BETWEEN $1 AND $2 ORDER BY fecha_inicioviajesalida ASC, folio ASC`;
      values.push(desde, hasta);
    } else {
      query += ` AND fecha_inicioviajesalida = CURRENT_DATE ORDER BY fecha_inicioviajesalida ASC, folio ASC`;
    }

    const { rows } = await pool.query(query, values);
    res.json({ datos: rows });
  } catch (e) {
    console.error('❌ Error consultando salidas Tours:', e);
    res.status(500).json({ error: 'Error al obtener salidas (Tours)' });
  }
};