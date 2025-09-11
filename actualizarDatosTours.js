// actualizarDatosTours.js — SIN luxon
import pool from './conexion.js';

// Tours: solo chofer interno, columnas *_destino
export default async function actualizarDatosTours(req, res) {
  try {
    const {
      token_qr,
      folio,                    // opcional
      representante_destino,    // string
      chofer_nombre,            // interno
      unit,                     // numero unidad
      comentarios,              // texto
      fecha_inicioviaje,        // ISO string (opcional)
      fecha_finalviaje,         // ISO string (opcional)
      cantidad_pasajerosok      // numero
    } = req.body || {};

    if (!token_qr && !folio) {
      return res.status(400).json({ success: false, message: 'Falta identificador: token_qr o folio' });
    }

    const identificador      = token_qr || folio;
    const campoIdentificador = token_qr ? 'token_qr' : 'folio';

    // existe la reserva?
    const chk = await pool.query(
      `SELECT 1 FROM reservaciones WHERE ${campoIdentificador} = $1 LIMIT 1`,
      [identificador]
    );
    if (chk.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Reservación no encontrada' });
    }

    const updates = [];
    const values  = [];
    let i = 1;
    const push = (frag, val) => { updates.push(frag.replace('?', `$${i++}`)); values.push(val); };

    // --- SOLO columnas DESTINO ---
    if (representante_destino !== undefined)
      push('representante_destino = ?', representante_destino?.toString().trim() || null);

    if (comentarios !== undefined)
      push('comentariosdestino = ?', comentarios?.toString().trim() || null);

    if (unit !== undefined)
      push('numero_unidaddestino = ?', (unit === '' || unit === null) ? null : unit.toString().trim());

    if (cantidad_pasajerosok !== undefined)
      push('cantidad_pasajerosokdestino = ?', (cantidad_pasajerosok === '' || cantidad_pasajerosok === null) ? null : Number(cantidad_pasajerosok));

    // Fechas -> estatus_viajedestino
    let estatusViaje = null;
    const toISO = (v) => {
      try { return new Date(v).toISOString(); } catch { return null; }
    };

    if (fecha_inicioviaje) {
      const iso = toISO(fecha_inicioviaje);
      if (iso) {
        push('fecha_inicioviajedestino = ?', iso);
        estatusViaje = 'asignado';
      }
    }
    if (fecha_finalviaje) {
      const iso = toISO(fecha_finalviaje);
      if (iso) {
        push('fecha_finalviajedestino = ?', iso);
        estatusViaje = 'finalizado';
      }
    }
    if (estatusViaje) {
      push('estatus_viajedestino = ?', estatusViaje);
    }

    // Chofer interno SIEMPRE; chofer externo SIEMPRE NULL
    if (chofer_nombre !== undefined)
      push('choferdestino = ?', (chofer_nombre === '' || chofer_nombre === null) ? null : chofer_nombre.toString().trim());
    updates.push('chofer_externonombre = NULL');
    updates.push('choferexterno_tel = NULL');
    updates.push('chofer_empresaext = NULL');

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No se recibieron campos para actualizar' });
    }

    const whereParam = `$${i}`;
    values.push(identificador);

    const sql = `
      UPDATE reservaciones
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE ${campoIdentificador} = ${whereParam}
    `;
    await pool.query(sql, values);

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ actualizarDatosTours error:', err);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
}