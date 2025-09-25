// buscarReservasTours.js — Tours: sólo salida
import pool from "./conexion.js";

const isYMD = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const today = () => {
  const d = new Date(); const p = (n) => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
};

export default async function buscarReservasTours(req, res) {
  try {
    let { desde, hasta } = req.query || {};
    if (!isYMD(desde)) desde = today();
    if (!isYMD(hasta)) hasta = today();

    const sql = `
      SELECT
        folio,
        COALESCE(nombre_cliente,'---')                         AS nombre_cliente,
        NULLIF(fecha_salida::text,'')::date                   AS fecha_salida,
        COALESCE(
          NULLIF(TRIM(nombre_tour), ''),
          '---'
        )                                                     AS nombre_tour,
        COALESCE(
          NULLIF(TRIM(hotel), ''),
          NULLIF(TRIM(hotel_salida), ''),
          NULLIF(TRIM(hotel_llegada), ''),
          '---'
        )                                                     AS hotel,
        COALESCE(
          NULLIF((COALESCE(cantidad_adulto,0) + COALESCE(cantidad_nino,0))::int, 0),
          NULLIF(cantidad_pasajeros, 0),
          NULLIF(pasajeros, 0),
          0
        )                                                     AS cantidad_pasajeros
      FROM reservaciones
      WHERE tipo_servicio = 'Tours'
        AND fecha_salida::date BETWEEN $1 AND $2
      ORDER BY fecha_salida NULLS LAST, folio;
    `;

    const { rows } = await pool.query(sql, [desde, hasta]);

    const out = rows.map(r => ({
      folio: r.folio,
      tipo_viaje: 'Tours',
      nombre_cliente: r.nombre_cliente || '---',
      fecha_llegada: '---',                // sólo para cumplir columnas de tu tabla en el front
      fecha_salida:  r.fecha_salida || '---',
      hotel: r.hotel || '---',
      nombre_tour: r.nombre_tour || '---',
      cantidad_pasajeros: Number(r.cantidad_pasajeros) || 0
    }));

    res.json({ ok: true, reservas: out });
  } catch (err) {
    console.error("[buscarReservasTours] ERROR:", err);
    res.status(500).json({ ok: false, error: "Error interno" });
  }
}