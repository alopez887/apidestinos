import pool from './conexion.js';

const consultarSalidas = async (req, res) => {
  try {
    const { fecha, desde, hasta } = req.query;
    console.log('📥 Parámetros recibidos (salidas TOURS):', { fecha, desde, hasta });

    let query = `
      SELECT 
        folio,
        nombre_cliente,
        nota,
        tipo_viaje,
        tipo_transporte,
        capacidad,
        cantidad_pasajeros,
        hotel_salida,
        zona,
        fecha_salida,
        hora_salida,
        '—'::text AS aerolinea_salida,      -- Tours: no aplica → relleno desde el back
        '—'::text AS vuelo_salida,           -- Tours: no aplica → relleno desde el back
        COALESCE(nombre_tour, tour) AS nombre_tour  -- columna para Tours
      FROM reservaciones
      WHERE (
        UPPER(tipo_servicio) = 'TOURS'
        OR UPPER(tipo_viaje) = 'TOURS'
      )
    `;
    const values = [];

    if (fecha) {
      console.log('🔍 Usando búsqueda por fecha exacta (Tours):', fecha);
      query += ` AND fecha_salida = $1 ORDER BY hora_salida ASC`;
      values.push(fecha);
    } else if (desde && hasta) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(desde) || !dateRegex.test(hasta)) {
        console.warn('⚠️ Formato de fecha inválido en desde/hasta (Tours):', { desde, hasta });
        return res.status(400).json({ error: 'Fechas mal formateadas' });
      }
      console.log(`🔍 Usando búsqueda por rango (Tours): ${desde} → ${hasta}`);
      query += ` AND fecha_salida BETWEEN $1 AND $2 ORDER BY fecha_salida ASC, hora_salida ASC`;
      values.push(desde, hasta);
    } else {
      console.log('🔍 Usando búsqueda por fecha actual (CURRENT_DATE) para salidas Tours');
      query += ` AND fecha_salida = CURRENT_DATE ORDER BY hora_salida ASC`;
    }

    const result = await pool.query(query, values);
    console.log('✅ Resultados encontrados (salidas TOURS):', result.rows.length);

    res.json({ datos: result.rows });
  } catch (error) {
    console.error('❌ Error consultando salidas Tours:', error.message);
    res.status(500).json({ error: 'Error al obtener salidas (Tours) desde la base de datos' });
  }
};

export default consultarSalidas;