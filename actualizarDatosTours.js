import pool from './conexion.js';

export default async function actualizarDatosTours(req, res) {
  try {
    const {
      // Identificador
      token_qr,
      folio,

      // Datos genéricos que pueden llegar desde distintos clientes
      tipo_viaje,             // 'salida' | 'llegada' (para tours usamos 'salida' en Fase 1 y 'llegada' en Fase 2)
      representante_salida,   // (opcional) ya asignado en otra pantalla
      chofer_nombre,          // -> chofersalida (si aplica)
      unit,                   // -> numero_unidadsalida
      comentarios,            // -> comentariossalida / comentariosllegada
      fecha_inicioviaje,      // -> *_inicioviaje(salida|llegada)
      fecha_finalviaje,       // -> *_finalviaje(salida|llegada)
      cantidad_pasajerosok    // -> cantidad_pasajerosoksalida
    } = req.body || {};

    const identificador = token_qr || folio;
    const campoIdentificador = token_qr ? 'token_qr' : 'folio';

    if (!identificador) {
      return res.status(400).json({ success: false, message: 'Falta folio o token_qr' });
    }

    // Construimos UPDATE dinámico
    const sets = [];
    const values = [];
    let i = 1;

    const lowerTipo = (tipo_viaje || '').toLowerCase();

    // ---------- Soporte genérico para *_salida (Fase 1) ----------
    // Estos campos son seguros de actualizar si vienen en el payload
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
      // Para tours usaremos comentariossalida en Fase 1; en Fase 2 se maneja aparte si se requiere
      sets.push(`comentariossalida = $${i++}`);
      values.push(comentarios);
    }

    // Manejo de fechas y estatus de SALIDA
    let estatusSalida; // para saber si se finalizó
    if (fecha_inicioviaje) {
      sets.push(`fecha_inicioviajesalida = $${i++}`);
      values.push(fecha_inicioviaje);
      // si solo recibimos inicio, consideramos estatus asignado
      sets.push(`estatus_viajesalida = 'asignado'`);
      estatusSalida = 'asignado';
    }
    if (fecha_finalviaje) {
      sets.push(`fecha_finalviajesalida = $${i++}`);
      values.push(fecha_finalviaje);
      sets.push(`estatus_viajesalida = 'finalizado'`);
      estatusSalida = 'finalizado';
    }

    // ---------- Si se FINALIZA Fase 1, preparamos Fase 2 ----------
    // Clonamos valores *_salida -> *_llegada y abrimos llegada
    if (estatusSalida === 'finalizado') {
      sets.push(`representante_llegada = COALESCE(representante_llegada, representante_salida)`);
      sets.push(`choferllegada = COALESCE(choferllegada, chofersalida)`);
      sets.push(`numero_unidadllegada = COALESCE(numero_unidadllegada, numero_unidadsalida)`);
      sets.push(`cantidad_pasajerosokllegada = COALESCE(cantidad_pasajerosokllegada, cantidad_pasajerosoksalida)`);
      // Usamos el comentario de salida para inicializar el de llegada si aún no existe
      sets.push(`comentariosllegada = COALESCE(comentariosllegada, comentariossalida)`);
      // Abrimos Fase 2
      sets.push(`estatus_viajellegada = 'asignado'`);
      sets.push(`fecha_inicioviajellegada = COALESCE(fecha_inicioviajellegada, NOW())`);
      // NOTA: la firma de llegada se guarda en otro endpoint (guardarFirmaTours)
    }

    // ---------- Soporte para actualizar llegada explícitamente (Fase 2) ----------
    if (lowerTipo === 'llegada') {
      // Comentarios de llegada si vinieran desde el panel (opcional)
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
    }

    if (sets.length === 0) {
      return res.status(400).json({ success: false, message: 'Sin cambios' });
    }

    // WHERE
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