// buscarReservas.js
import pool from './conexion.js';

function hoyMX() {
  // YYYY-MM-DD en zona Mazatlán
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Mazatlan' });
}

export default async function buscarReservas(req, res) {
  try {
    let { desde, hasta, servicio = 'transporte' } = req.query;
    const svc = String(servicio || '').toLowerCase().trim();

    // Fechas por defecto (hoy) si no vienen
    if (!desde) desde = hoyMX();
    if (!hasta) hasta = hoyMX();

    // Valida formato YYYY-MM-DD
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(desde) || !re.test(hasta)) {
      return res.status(400).json({ ok: false, error: 'Fechas mal formateadas (YYYY-MM-DD)' });
    }

    console.log('📥 buscarReservas:', { desde, hasta, servicio: svc });

    if (svc === 'transporte') {
      // Solo Transporte:
      // - tipo_servicio en ('Transportacion','Transporte')
      // - O bien tipo_servicio vacío PERO con folio TR-xxxxx (blindaje por prefijo)
      const sqlT = `
        SELECT
          folio,
          tipo_viaje,
          nombre_cliente,
          fecha_llegada,
          fecha_salida,
          cantidad_pasajeros
        FROM reservaciones
        WHERE fecha::date BETWEEN $1 AND $2
          AND (
            LOWER(TRIM(tipo_servicio)) IN ('transportacion','transporte')
            OR ( (tipo_servicio IS NULL OR TRIM(tipo_servicio) = '') AND folio LIKE 'TR-%' )
          )
        ORDER BY fecha DESC, folio DESC
      `;
      const { rows } = await pool.query(sqlT, [desde, hasta]);
      console.log(`✅ Transporte: ${rows.length} filas`);
      return res.json({ ok: true, reservas: rows });
    }

    if (svc === 'tours' || svc === 'tour') {
      // Solo Tours:
      // - tipo_servicio en ('Tours','Tour')
      // - O bien tipo_servicio vacío PERO con folio D-xxxxx (blindaje por prefijo)
      // Normalizamos salida a las columnas del grid de "Transporte" en Reservas (como ya hace tu front):
      const sqlTours = `
        SELECT
          folio,
          'Tours'::text AS tipo_viaje,
          nombre_cliente,
          NULL::date AS fecha_llegada,               -- tours no usan llegada en ese grid
          fecha::date  AS fecha_salida,
          COALESCE(cantidad_pasajeros,
                   COALESCE(cantidad_adulto,0) + COALESCE(cantidad_nino,0),
                   0) AS cantidad_pasajeros
        FROM reservaciones
        WHERE fecha::date BETWEEN $1 AND $2
          AND (
            LOWER(TRIM(tipo_servicio)) IN ('tours','tour')
            OR ( (tipo_servicio IS NULL OR TRIM(tipo_servicio) = '') AND folio LIKE 'D-%' )
          )
        ORDER BY fecha DESC, folio DESC
      `;
      const { rows } = await pool.query(sqlTours, [desde, hasta]);
      console.log(`✅ Tours: ${rows.length} filas`);
      return res.json({ ok: true, reservas: rows });
    }

    if (svc === 'actividades' || svc === 'actividad') {
      // Actividades: tu front usa un render distinto (renderPaginatedTableReservasAct)
      // y espera: folio, nombre_tour, proveedor, nombre_cliente, fecha, cantidad_adulto, cantidad_nino
      const sqlA = `
        SELECT
          folio,
          nombre_tour,
          proveedor,
          nombre_cliente,
          fecha::date AS fecha,
          COALESCE(cantidad_adulto,0) AS cantidad_adulto,
          COALESCE(cantidad_nino,0)   AS cantidad_nino
        FROM reservaciones
        WHERE fecha::date BETWEEN $1 AND $2
          AND LOWER(TRIM(tipo_servicio)) IN ('actividad','actividades')
        ORDER BY fecha DESC, folio DESC
      `;
      const { rows } = await pool.query(sqlA, [desde, hasta]);
      console.log(`✅ Actividades: ${rows.length} filas`);
      return res.json({ ok: true, reservas: rows });
    }

    // Si llega un servicio desconocido, responde vacío pero válido
    console.warn('⚠️ Servicio no reconocido en buscarReservas:', svc);
    return res.json({ ok: true, reservas: [] });

  } catch (err) {
    console.error('❌ Error en buscarReservas:', err.message);
    return res.status(500).json({ ok: false, error: 'Error interno en buscarReservas' });
  }
}