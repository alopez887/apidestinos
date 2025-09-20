// consultarHoteles.js
import pool from './conexion.js';

export default async function consultarHoteles(req, res) {
  try {
    const { q = '' } = req.query;

    const params = [];
    const where = q
      ? `WHERE nombre_hotel ILIKE $1`
      : '';

    if (q) params.push(`%${q}%`);

    const sql = `
      SELECT DISTINCT TRIM(nombre_hotel) AS nombre
      FROM hoteles_zona
      ${where}
      ORDER BY TRIM(nombre_hotel) ASC
    `;

    const result = await pool.query(sql, params);

    const lista = (result.rows || [])
      .map(r => (r?.nombre ?? '').toString().trim())
      .filter(Boolean);

    return res.json(lista);
  } catch (err) {
    console.error('❌ Error consultando hoteles:', err.message);
    return res.status(500).json({ error: 'Error consultando hoteles' });
  }
}