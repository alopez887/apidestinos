// buscarReservasTours.js (en apidestinos)
import pool from './conexion.js';

export default async function buscarReservasTours(req, res) {
  try {
    const { desde, hasta } = req.query;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(desde) || !re.test(hasta)) {
      return res.status(400).json({ ok:false, error:'Fechas mal formateadas' });
    }

    const sql = `
      SELECT
        folio,                       -- D-000123
        'Tours'::text AS tipo_viaje,
        nombre_cliente,
        NULL::date AS fecha_llegada,
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
    const { rows } = await pool.query(sql, [desde, hasta]);
    return res.json({ ok:true, reservas: rows });
  } catch (e) {
    console.error('buscarReservasTours err:', e.message);
    return res.status(500).json({ ok:false, error:'Error interno' });
  }
}