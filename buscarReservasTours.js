// buscarReservasTours.js
import pool from './conexion.js';

export default async function buscarReservasTours(req, res) {
  try {
    const { desde = '', hasta = '' } = req.query;

    // Validación simple de fechas (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      return res.status(400).json({ ok: false, error: 'Parámetros desde/hasta inválidos (YYYY-MM-DD)' });
    }

    // Tomamos TODO de la MISMA tabla 'reservaciones'
    // Solo Tours. Filtramos por **fecha de registro** (columna fecha), NO por fecha_salida.
    const sql = `
      SELECT
        folio,
        -- si la columna viene vacía, forzamos la etiqueta 'Tours'
        COALESCE(NULLIF(tipo_viaje, ''), 'Tours')                AS tipo_viaje,
        COALESCE(NULLIF(nombre_cliente, ''), '')                  AS nombre_cliente,

        -- La UI no usa llegada para tours: forzamos NULL
        NULL::date                                               AS fecha_llegada,

        -- Salida (solo se muestra; el filtro es por fecha de registro)
        fecha_salida,
        hora_salida,

        -- Unificamos 'hotel' para la UI: primero salida, si no hay usamos llegada
        CASE
          WHEN COALESCE(NULLIF(hotel_salida, ''), '') <> '' THEN hotel_salida
          ELSE COALESCE(hotel_llegada, '')
        END                                                     AS hotel,

        -- Nombre del tour
        COALESCE(NULLIF(nombre_tour, ''), '')                    AS nombre_tour,

        -- Pax: si no hay cantidad_pasajeros, usar adultos+niños (si existen)
        CASE
          WHEN COALESCE(cantidad_pasajeros, 0) > 0 THEN cantidad_pasajeros
          ELSE COALESCE(cantidad_adulto, 0) + COALESCE(cantidad_nino, 0)
        END                                                     AS cantidad_pasajeros

      FROM reservaciones
      WHERE
        -- Detectamos tours desde los datos que SÍ tienes
        (tipo_servicio ILIKE 'tour%' OR tipo_viaje ILIKE 'tour%')
        -- 🔹 FECHA DE REGISTRO (columna fecha), casteada a date
        AND fecha::date BETWEEN $1::date AND $2::date
      ORDER BY fecha_salida ASC, hora_salida ASC NULLS LAST, folio ASC
    `;

    const { rows } = await pool.query(sql, [desde, hasta]);
    return res.json({ ok: true, datos: rows });
  } catch (err) {
    console.error('[buscarReservasTours] ERROR:', err);
    return res.status(500).json({ ok: false, error: 'Error interno al buscar reservas de tours' });
  }
}
