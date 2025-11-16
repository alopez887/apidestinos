import pool from './conexion.js';
import { DateTime } from 'luxon';

function normalizarFechaMazatlan(fecha) {
  if (!fecha) return null;

  // Intentamos primero como ISO, luego como SQL (YYYY-MM-DD HH:mm:ss)
  let dt = DateTime.fromISO(fecha);
  if (!dt.isValid) {
    dt = DateTime.fromSQL(fecha);
  }

  if (!dt.isValid) {
    // Si aun así no es válido, regresamos tal cual para no reventar el flujo
    return fecha;
  }

  return dt.setZone('America/Mazatlan').toISO();
}

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
        const fechaInicioSalida = normalizarFechaMazatlan(fecha_inicioviaje);
        sets.push(`fecha_inicioviajesalida = $${i++}`);
        values.push(fechaInicioSalida);
        sets.push(`estatus_viajesalida = 'asignado'`);
        salidaStatusChanged = true;
      }
      if (fecha_finalviaje) {
        const fechaFinSalida = normalizarFechaMazatlan(fecha_finalviaje);
        sets.push(`fecha_finalviajesalida = $${i++}`);
        values.push(fechaFinSalida);
        sets.push(`estatus_viajesalida = 'finalizado'`);
        salidaStatusChanged = true;

        // Al finalizar SALIDA, preparamos LLEGADA:
        // - clonamos (si están vacíos) datos de *_salida a *_llegada
        // - abrimos llegada en 'asignado'
        // - inicializamos fecha_inicioviajellegada con hora de Mazatlán si está vacía
        sets.push(`representante_llegada = COALESCE(representante_llegada, representante_salida)`);
        sets.push(`choferllegada = COALESCE(choferllegada, chofersalida)`);
        sets.push(`numero_unidadllegada = COALESCE(numero_unidadllegada, numero_unidadsalida)`);
        sets.push(`cantidad_pasajerosokllegada = COALESCE(cantidad_pasajerosokllegada, cantidad_pasajerosoksalida)`);
        sets.push(`comentariosllegada = COALESCE(comentariosllegada, comentariossalida)`);
        sets.push(`estatus_viajellegada = 'asignado'`);

        // ⏱️ Aquí corregimos el problema: usamos hora Mazatlán desde Node, no NOW() del servidor/DB
        const fechaInicioLlegadaAuto = DateTime.now().setZone('America/Mazatlan').toISO();
        sets.push(`fecha_inicioviajellegada = COALESCE(fecha_inicioviajellegada, $${i++})`);
        values.push(fechaInicioLlegadaAuto);
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
        const fechaInicioLlegada = normalizarFechaMazatlan(fecha_inicioviaje);
        sets.push(`fecha_inicioviajellegada = $${i++}`);
        values.push(fechaInicioLlegada);
        sets.push(`estatus_viajellegada = 'asignado'`);
      }
      if (fecha_finalviaje) {
        const fechaFinLlegada = normalizarFechaMazatlan(fecha_finalviaje);
        sets.push(`fecha_finalviajellegada = $${i++}`);
        values.push(fechaFinLlegada);
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
