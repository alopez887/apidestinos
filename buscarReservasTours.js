import pool from './conexion.js';

function iso(d) {
  if (!d) return null;
  return String(d).slice(0, 10);
}
function okDate(s){ return /^\d{4}-\d{2}-\d{2}$/.test(s || ''); }

export default async function buscarReservasTours(req, res) {
  try {
    const desde = iso(req.query.desde);
    const hasta = iso(req.query.hasta);
    if (!okDate(desde) || !okDate(hasta)) {
      return res.status(400).json({ ok:false, error:'Rango de fechas inválido' });
    }

    // Ajusta el nombre de tu tabla real de tours:
    // campos esperados por el front: folio, nombre_cliente, fecha (o fecha_salida),
    // cantidad_adulto, cantidad_nino, nombre_tour, hotel, zona, tipo_transporte (opcional)
    const q = `
      SELECT
        folio,
        nombre_cliente,
        fecha,
        cantidad_adulto,
        cantidad_nino,
        nombre_tour,
        hotel,
        zona,
        transporte AS tipo_transporte
      FROM reservaciones_tours
      WHERE fecha BETWEEN $1 AND $2
      ORDER BY fecha ASC, folio ASC
    `;
    const { rows } = await pool.query(q, [desde, hasta]);

    const reservas = rows.map(r => ({
      // folios de tours son distintos a los de transporte (D-xxxxx en tu sistema)
      folio: r.folio || '',
      tipo_viaje: 'Tours',
      nombre_cliente: r.nombre_cliente || '',
      fecha: r.fecha || null,               // tu front lo usa como “F. Sal”
      cantidad_adulto: r.cantidad_adulto ?? 0,
      cantidad_nino: r.cantidad_nino ?? 0,
      nombre_tour: r.nombre_tour || '',     // 👈 Campo clave para tu columna
      hotel: r.hotel || '',
      zona: r.zona || '',
      tipo_transporte: r.tipo_transporte || '' // si lo usas para Excel/tabla
    }));

    return res.json({ ok:true, servicio:'tours', reservas });
  } catch (e) {
    console.error('[buscarReservasTours] ERROR:', e);
    res.status(500).json({ ok:false, error:'Error interno' });
  }
}