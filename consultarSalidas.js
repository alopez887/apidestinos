// consultarSalidas.js
import pool from './conexion.js';

const consultarSalidas = async (req, res) => {
  try {
    const { fecha, desde, hasta } = req.query;
    console.log('📥 Parámetros recibidos (salidas TOURS):', { fecha, desde, hasta });

    // Para Tours, algunos registros tienen *_salida; otros usan fecha/hora "normales".
    const dateCol = `COALESCE(fecha_salida, fecha)`;
    const timeCol = `COALESCE(hora_salida, hora)`;

    let sql = `
      SELECT
        folio,
        nombre_cliente,
        nota,
        'Tours'::text AS tipo_viaje,                         -- forzamos etiqueta "Tours"
        COALESCE(tipo_transporte, '—') AS tipo_transporte,   -- NO usamos "transporte" (no existe)
        capacidad,
        COALESCE(cantidad_pasajeros, pasajeros, 0) AS cantidad_pasajeros,
        COALESCE(hotel_salida, hotel, '') AS hotel_salida,
        zona,
        ${dateCol} AS fecha_salida,
        ${timeCol} AS hora_salida,
        NULL::text AS aerolinea_salida,                      -- no aplica en tours
        NULL::text AS vuelo_salida,                          -- no aplica en tours
        COALESCE(nombre_tour, tour, '—') AS nombre_tour      -- propio de tours
      FROM reservaciones
      WHERE (UPPER(tipo_viaje) = 'TOURS' OR UPPER(tipo_servicio) = 'TOURS')
    `;

    const params = [];
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (fecha) {
      if (!dateRegex.test(fecha)) {
        return res.status(400).json({ error: 'Fecha mal formateada (YYYY-MM-DD)' });
      }
      console.log('🔍 Filtro por fecha exacta (Tours):', fecha);
      sql += ` AND ${dateCol} = $1 ORDER BY ${timeCol} ASC`;
      params.push(fecha);
    } else if (desde && hasta) {
      if (!dateRegex.test(desde) || !dateRegex.test(hasta)) {
        return res.status(400).json({ error: 'Fechas mal formateadas (YYYY-MM-DD)' });
      }
      console.log(`🔍 Filtro por rango (Tours): ${desde} → ${hasta}`);
      sql += ` AND ${dateCol} BETWEEN $1 AND $2 ORDER BY ${dateCol} ASC, ${timeCol} ASC`;
      params.push(desde, hasta);
    } else {
      console.log('🔍 Filtro por fecha actual (Tours): CURRENT_DATE');
      sql += ` AND ${dateCol} = CURRENT_DATE ORDER BY ${timeCol} ASC`;
    }

    const result = await pool.query(sql, params);
    console.log('✅ Salidas Tours encontradas:', result.rows.length);

    return res.json({ datos: result.rows });
  } catch (error) {
    console.error('❌ Error consultando salidas Tours:', error.message);
    return res.status(500).json({ error: 'Error al obtener salidas (Tours)' });
  }
};

export default consultarSalidas;