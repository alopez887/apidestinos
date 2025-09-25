import pool from "./conexion.js";

const isYMD = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
const today = () => {
  const d = new Date();
  const p = n => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
};

export default async function buscarReservasTours(req, res) {
  try {
    let { desde, hasta } = req.query || {};
    if (!isYMD(desde)) desde = today();
    if (!isYMD(hasta)) hasta = today();

    // 🔎 TODO sale de la MISMA tabla `reservaciones`
    const sql = `
      SELECT
        folio,
        'Tours'::text AS tipo_viaje,
        COALESCE(nombre_cliente,'') AS nombre_cliente,

        ''::date        AS fecha_llegada,            -- tours no usa llegada
        fecha::date     AS fecha_salida,             -- campo de tours

        COALESCE(
          NULLIF((COALESCE(cantidad_adulto,0)+COALESCE(cantidad_nino,0))::int,0),
          NULLIF(cantidad_pasajeros,0),
          NULLIF(pasajeros,0),
          0
        ) AS cantidad_pasajeros,

        -- ÚNICA columna hotel para la tabla del front
        COALESCE(NULLIF(TRIM(hotel), ''),
                 NULLIF(TRIM(hotel_salida), ''),
                 NULLIF(TRIM(hotel_llegada), ''),
                 '') AS hotel,

        COALESCE(nombre_tour,'') AS nombre_tour
      FROM reservaciones
      WHERE tipo_servicio = 'Tours'
        AND fecha::date BETWEEN $1 AND $2
      ORDER BY fecha::date, folio;
    `;

    const { rows } = await pool.query(sql, [desde, hasta]);
    return res.json({ ok: true, reservas: rows });
  } catch (err) {
    console.error("[buscarReservasTours] ERROR:", err);
    return res.status(500).json({ ok:false, error:"Error interno" });
  }
}