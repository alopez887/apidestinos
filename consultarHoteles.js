// consultarHoteles.js
import pool from './conexion.js';

export default async function consultarHoteles(req, res) {
  try {
    const { zona = '', q = '' } = req.query;

    const where = [];
    const params = [];

    if (zona) {
      where.push('COALESCE(zona, \'\') = $' + (params.length + 1));
      params.push(zona);
    }
    if (q) {
      where.push('nombre ILIKE $' + (params.length + 1));
      params.push(`%${q}%`);
    }

    const sql = `
      SELECT nombre
      FROM hoteles_zona
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY nombre ASC
    `;

    const result = await pool.query(sql, params);

    const lista = Array.from(
      new Set(
        (result.rows || [])
          .map(r => (r?.nombre ?? '').toString().trim())
          .filter(Boolean)
      )
    );

    return res.json(lista);
  } catch (err) {
    console.error('❌ Error consultando hoteles:', err.message);
    return res.status(500).json({ error: 'Error consultando hoteles' });
  }
}