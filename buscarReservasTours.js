// buscarReservasTours.js — SOLO salida; nada de llegada
import pool from "./conexion.js";

const isYMD = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const today = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
};

export default async function buscarReservasTours(req, res) {
  try {
    let { desde, hasta } = req.query || {};
    if (!isYMD(desde)) desde = today();
    if (!isYMD(hasta)) hasta = today();

    // IMPORTANTe:
    // - Solo usamos fecha/hora de SALIDA, llegada va en NULL para no mezclar.
    // - Si fecha está '' o NULL no rompe el casteo.
    const sql = `
      WITH tours AS (
        SELECT
          folio,
          'Tours'::text AS tipo_viaje,
          COALESCE(nombre_cliente, '') AS nombre_cliente,

          /* NO usamos llegada en tours */
          NULL::date  AS fecha_llegada,
          NULL::text  AS hora_llegada,

          /* Fecha/hora de salida seguras */
          CASE
            WHEN fecha IS NULL OR fecha::text = '' THEN NULL
            ELSE fecha::date
          END AS fecha_salida,
          NULLIF(TRIM(COALESCE(hora, '')), '') AS hora_salida,

          COALESCE(
            NULLIF((COALESCE(cantidad_adulto,0)+COALESCE(cantidad_nino,0))::int,0),
            NULLIF(cantidad_pasajeros,0),
            NULLIF(pasajeros,0),
            0
          ) AS cantidad_pasajeros,

          /* Hotel único para front */
          COALESCE(
            NULLIF(TRIM(COALESCE(hotel, '')), ''),
            NULLIF(TRIM(COALESCE(hotel_salida, '')), ''),
            NULLIF(TRIM(COALESCE(hotel_llegada, '')), ''),
            '---'
          ) AS hotel,

          COALESCE(NULLIF(TRIM(nombre_tour), ''), '---') AS nombre_tour
        FROM reservaciones
        WHERE tipo_servicio = 'Tours'
      )
      SELECT *
      FROM tours
      WHERE fecha_salida >= $1::date AND fecha_salida <= $2::date
      ORDER BY fecha_salida NULLS LAST, hora_salida NULLS LAST, folio;
    `;

    const { rows } = await pool.query(sql, [desde, hasta]);
    // Relleno visual: campos vacíos a '---' para que no queden huecos en tabla
    const neat = rows.map(r => ({
      ...r,
      hora_salida: r.hora_salida || '---',
      hotel: r.hotel || '---',
      nombre_tour: r.nombre_tour || '---',
      // llegada siempre '---' por política de tours
      fecha_llegada: '---',
      hora_llegada: '---'
    }));
    res.json({ ok: true, reservas: neat });
  } catch (err) {
    console.error("[buscarReservasTours] ERROR:", err);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
}