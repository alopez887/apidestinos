import pool from './conexion.js';

export default async function actualizarDatosTours(req, res) {
  try {
    const {
      token_qr,
      folio,
      tipo_viaje,            // 'salida' | 'llegada'
      representante_salida,  // opcional
      chofer_nombre,         // -> chofersalida (F1)
      unit,                  // -> numero_unidadsalida (F1)
      comentarios,           // -> comentariossalida (F1) | comentariosllegada (F2)
      fecha_inicioviaje,     // -> fecha_inicioviajesalida | fecha_inicioviajellegada
      fecha_finalviaje,      // -> fecha_finalviajesalida | fecha_finalviajellegada
      cantidad_pasajerosok   // -> cantidad_pasajerosoksalida (F1)
    } = req.body || {};

    const identificador = token_qr || folio;
    const campoIdentificador = token_qr ? 'token_qr' : 'folio';
    if (!identificador) {
      return res.status(400).json({ success: false, message: 'Falta folio o token_qr' });
    }

    const lowerTipo = (tipo_viaje || '').toLowerCase();
    if (lowerTipo !== 'salida' && lowerTipo !== 'llegada') {
      return res.status(400).json({ success: false, message: "tipo_viaje debe ser 'salida' o 'llegada'" });
    }

    const sets = [];
    const values = [];
    let i = 1;

    // =========================================================
    // FASE 1 — SALIDA (Hotel → Tour)
    // =========================================================
    if (lowerTipo === 'salida') {
      if (representante_salida) {
        sets.push(`representante_salida = $${i++}`);
        values.push(representante_salida);
      }
      if (chofer_nombre) {
        sets.push(`chofersalida = $${i++}`);
        values.push(chofer_nombre);
      }
      if (unit) {
        sets.push(`numero_unidadsalida = $${i++}`);
        values.push(unit);
      }
      if (typeof cantidad_pasajerosok !== 'undefined') {
        sets.push(`cantidad_pasajerosoksalida = $${i++}`);
        values.push(Number(cantidad_pasajerosok) || 0);
      }
      if (typeof comentarios === 'string') {
        sets.push(`comentariossalida = $${i++}`);
        values.push(comentarios);
      }

      // Manejo de fechas y estatus de SALIDA solamente
      let salidaStatusChanged = false;
      if (fecha_inicioviaje) {
        sets.push(`fecha_inicioviajesalida = $${i++}`);
        values.push(fecha_inicioviaje);
        sets.push(`estatus_viajesalida = 'asignado'`);
        salidaStatusChanged = true;
      }
      if (fecha_finalviaje) {
        sets.push(`fecha_finalviajesalida = $${i++}`);
        values.push(fecha_finalviaje);
        sets.push(`estatus_viajesalida = 'finalizado'`);
        salidaStatusChanged = true;

        // Al finalizar SALIDA, preparamos LLEGADA:
        // - clonamos (si están vacíos) datos de *_salida a *_llegada
        // - abrimos llegada en 'asignado' e inicializamos fecha_inicioviajellegada si no existe
        sets.push(`representante_llegada = COALESCE(representante_llegada, representante_salida)`);
        sets.push(`choferllegada = COALESCE(choferllegada, chofersalida)`);
        sets.push(`numero_unidadllegada = COALESCE(numero_unidadllegada, numero_unidadsalida)`);
        sets.push(`cantidad_pasajerosokllegada = COALESCE(cantidad_pasajerosokllegada, cantidad_pasajerosoksalida)`);
        sets.push(`comentariosllegada = COALESCE(comentariosllegada, comentariossalida)`);
        sets.push(`estatus_viajellegada = 'asignado'`);
        sets.push(`fecha_inicioviajellegada = COALESCE(fecha_inicioviajellegada, NOW())`);
      }

      if (!salidaStatusChanged && sets.length === 0) {
        return res.status(400).json({ success: false, message: 'Sin cambios (salida)' });
      }
    }

    // =========================================================
    // FASE 2 — LLEGADA (Tour → Hotel)
    // =========================================================
    if (lowerTipo === 'llegada') {
      if (typeof comentarios === 'string') {
        sets.push(`comentariosllegada = $${i++}`);
        values.push(comentarios);
      }
      if (fecha_inicioviaje) {
        sets.push(`fecha_inicioviajellegada = $${i++}`);
        values.push(fecha_inicioviaje);
        sets.push(`estatus_viajellegada = 'asignado'`);
      }
      if (fecha_finalviaje) {
        sets.push(`fecha_finalviajellegada = $${i++}`);
        values.push(fecha_finalviaje);
        sets.push(`estatus_viajellegada = 'finalizado'`);
      }

      if (sets.length === 0) {
        return res.status(400).json({ success: false, message: 'Sin cambios (llegada)' });
      }
    }

    // =========================================================
    // Ejecutar UPDATE
    // =========================================================
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