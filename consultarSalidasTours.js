import pool from './conexion.js';

const consultarSalidasTours = async (req, res) => {
  try {
    const { fecha, desde, hasta } = req.query;
    console.log('📥 Parámetros recibidos (salidas TOURS):', { fecha, desde, hasta });

    let query = `
      SELECT 
        folio,
        nombre_cliente,
        nota,
        'tours'::text AS tipo_viaje,
        tipo_transporte,
        capacidad,
        COALESCE(cantidad_pasajerosoksalida, cantidad_pasajeros) AS cantidad_pasajeros,
        COALESCE(hotel_salida, hotel_llegada) AS hotel_salida,
        zona,
        DATE(fecha_inicioviajesalida) AS fecha_salida,
        TO_CHAR(CAST(fecha_inicioviajesalida AS time), 'HH24:MI:SS') AS hora_salida,
        '---'::text AS aerolinea_salida,
        '---'::text AS vuelo_salida
      FROM reservaciones
      WHERE tipo_servicio ILIKE 'tours'
    `;

    const values = [];
    if (fecha) {
      console.log('🔍 Tours: por fecha exacta', fecha);
      query += ` AND DATE(fecha_inicioviajesalida) = $1 ORDER BY fecha_inicioviajesalida ASC`;
      values.push(fecha);

    } else if (desde && hasta) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(desde) || !dateRegex.test(hasta)) {
        console.warn('⚠️ Fechas mal formateadas (tours):', { desde, hasta });
        return res.status(400).json({ error: 'Fechas mal formateadas' });
      }
      console.log(`🔍 Tours: rango ${desde} → ${hasta}`);
      query += ` AND DATE(fecha_inicioviajesalida) BETWEEN $1 AND $2 ORDER BY fecha_inicioviajesalida ASC`;
      values.push(desde, hasta);

    } else {
      console.log('🔍 Tours: CURRENT_DATE');
      query += ` AND DATE(fecha_inicioviajesalida) = CURRENT_DATE ORDER BY fecha_inicioviajesalida ASC`;
    }

    const { rows } = await pool.query(query, values);
    console.log('✅ Resultados (salidas TOURS):', rows.length);
    res.json({ datos: rows });
  } catch (error) {
    console.error('❌ Error salidas TOURS:', error.message);
    res.status(500).json({ error: 'Error al obtener salidas (TOURS)' });
  }
};

export default consultarSalidasTours;