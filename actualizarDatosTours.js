// actualizarDatosTours.js — Tours usando únicamente columnas *SALIDA*
import pool from './conexion.js';

export default async function actualizarDatosTours(req, res) {
  try {
    const {
      token_qr,
      folio,
      representante_salida,   // -> representante_salida
      chofer_nombre,          // -> chofersalida
      unit,                   // -> numero_unidadsalida
      comentarios,            // -> comentariossalida
      fecha_inicioviaje,      // -> fecha_inicioviajesalida (estatus 'asignado')
      fecha_finalviaje,       // -> fecha_finalviajesalida (estatus 'finalizado')
      cantidad_pasajerosok    // -> cantidad_pasajerosoksalida
    } = req.body || {};

    if (!token_qr && !folio) {
      return res.status(400).json({ success: false, message: 'Falta identificador: token_qr o folio' });
    }

    const identificador      = token_qr || folio;
    const campoIdentificador = token_qr ? 'token_qr' : 'folio';

    // validación de existencia
    const chk = await pool.query(
      `SELECT 1 FROM reservaciones WHERE ${campoIdentificador} = $1 LIMIT 1`,
      [identificador]
    );
    if (chk.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Reservación no encontrada' });
    }

    // construir UPDATE dinámico sólo con columnas *SALIDA*
    const sets   = [];
    const values = [];
    let i = 1;
    const set = (col, val) => { sets.push(`${col} = $${i++}`); values.push(val); };

    if (representante_salida !== undefined)
      set('representante_salida', representante_salida?.toString().trim() || null);

    if (comentarios !== undefined)
      set('comentariossalida', comentarios?.toString().trim() || null);

    if (unit !== undefined)
      set('numero_unidadsalida', (unit === '' || unit === null) ? null : unit.toString().trim());

    if (cantidad_pasajerosok !== undefined)
      set('cantidad_pasajerosoksalida', (cantidad_pasajerosok === '' || cantidad_pasajerosok === null) ? null : Number(cantidad_pasajerosok));

    // fechas -> estatus_viajesalida
    let estatusViaje = null;
    const toISO = (v) => { try { return new Date(v).toISOString(); } catch { return null; } };

    if (fecha_inicioviaje) {
      const iso = toISO(fecha_inicioviaje);
      if (iso) { set('fecha_inicioviajesalida', iso); estatusViaje = 'asignado'; }
    }
    if (fecha_finalviaje) {
      const iso = toISO(fecha_finalviaje);
      if (iso) { set('fecha_finalviajesalida', iso); estatusViaje = 'finalizado'; }
    }
    if (estatusViaje) set('estatus_viajesalida', estatusViaje);

    // chofer interno
    if (chofer_nombre !== undefined)
      set('chofersalida', (chofer_nombre === '' || chofer_nombre === null) ? null : chofer_nombre.toString().trim());

    // Tours NO usa chofer externo
    sets.push('chofer_externonombre = NULL');
    sets.push('choferexterno_tel   = NULL');
    sets.push('chofer_empresaext   = NULL');

    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: 'No se recibieron campos para actualizar' });
    }

    values.push(identificador);
    const whereIdx = `$${i}`;

    const sql = `
      UPDATE reservaciones
      SET ${sets.join(', ')}
      WHERE ${campoIdentificador} = ${whereIdx}
    `;
    await pool.query(sql, values);

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ actualizarDatosTours error:', err);
    return res.status(500).json({ success: false, message: 'Error en el servidor' });
  }
}