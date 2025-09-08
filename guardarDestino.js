// guardarDestino.js (usa columna DB: token_qr)
import crypto from 'crypto';
import pool from './conexion.js';
import { enviarCorreoDestino } from './correoDestino.js';

// Helpers
function firstNonNil(...xs){ for (const v of xs) if (v !== undefined && v !== null && v !== '') return v; return null; }
function moneyNum(v){
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).replace(/[^0-9.-]/g,'').replace(/,/g,'');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function genTokenQR(){ return crypto.randomBytes(20).toString('hex'); } // 40 chars

export default async function guardarDestino(req, res) {
  const datos = req.body || {};
  console.log("📥 Datos recibidos en guardarDestino:", datos);

  if (!datos.destino || !datos.nombre || !datos.correo) {
    return res.status(400).json({ error: "Faltan datos requeridos (destino, nombre, correo)" });
  }

  try {
    // Folio incremental D-XXXXXX
    const resultFolio = await pool.query(`
      SELECT folio
      FROM reservaciones
      WHERE folio LIKE 'D-%'
      ORDER BY id DESC
      LIMIT 1
    `);

    let nuevoFolio = 'D-000001';
    if (resultFolio.rows.length > 0) {
      const lastFolio = resultFolio.rows[0].folio || 'D-000000';
      const num = parseInt(lastFolio.split('-')[1], 10) + 1;
      nuevoFolio = `D-${num.toString().padStart(6, '0')}`;
    }

    // Token QR (40 chars)
    const tokenQR = genTokenQR();

    // Teléfono completo
    const telefonoCompleto = `${datos.codigoPais || ''}${datos.telefono || ''}`.trim();

    // Total normalizado (acepta total | total_pago | precio | monto)
    const totalRaw = firstNonNil(datos.total, datos.total_pago, datos.precio, datos.monto);
    const totalNum = moneyNum(totalRaw);
    if (totalNum == null) {
      return res.status(400).json({ error: "total_pago inválido", recibido: totalRaw });
    }

    // INSERT: usa la columna correcta: token_qr
    await pool.query(`
      INSERT INTO reservaciones
      (folio, nombre_tour, tipo_servicio, estatus, tipo_transporte,
       nombre_cliente, correo_cliente, nota, fecha,
       capacidad, cantidad_pasajeros, hotel_llegada, hotel_salida,
       fecha_salida, hora_salida, precio_servicio, tipo_viaje, total_pago,
       telefono_cliente, token_qr)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() AT TIME ZONE 'America/Mazatlan',
              $9,$10,$11,$12,$13,$14,$15,$16,$17,
              $18, $19)
    `, [
      nuevoFolio,                 // folio
      datos.destino,              // nombre_tour
      datos.tipo_viaje,           // tipo_servicio
      1,                          // estatus
      datos.transporte,           // tipo_transporte
      datos.nombre,               // nombre_cliente
      datos.correo,               // correo_cliente
      datos.comentarios || '',    // nota
      datos.capacidad,            // capacidad
      datos.pasajeros,            // cantidad_pasajeros
      datos.hotel,                // hotel_llegada
      datos.hotel,                // hotel_salida
      datos.fecha,                // fecha_salida
      datos.hora,                 // hora_salida
      totalNum,                   // precio_servicio
      datos.tipo_viaje,           // tipo_viaje
      totalNum,                   // total_pago
      telefonoCompleto,           // telefono_cliente
      tokenQR                     // ✅ token_qr (BD)
    ]);

    console.log("✅ Reserva insertada con folio:", nuevoFolio);

    // Enviar correo (correoDestino espera token_qr)
    await enviarCorreoDestino({
      folio: nuevoFolio,
      tipo_viaje: datos.tipo_viaje,
      destino: datos.destino,
      tipo_transporte: datos.transporte,
      capacidad: datos.capacidad,
      hotel_llegada: datos.hotel,
      fecha_llegada: datos.fecha,
      hora_llegada: datos.hora,
      nombre_cliente: datos.nombre,
      correo_cliente: datos.correo,
      telefono_cliente: telefonoCompleto,
      cantidad_pasajeros: datos.pasajeros,
      nota: datos.comentarios,
      total_pago: totalNum,
      imagenDestino: datos.imagenDestino || '',
      imagenTransporte: datos.imagenTransporte || '',
      token_qr: tokenQR // 🔑 activa el QR en el correo
    });

    console.log("✅ Correo de destino enviado correctamente");
    res.status(200).json({ exito: true, folio: nuevoFolio, token_qr: tokenQR });

  } catch (err) {
    console.error("❌ Error al insertar reserva o enviar correo:", err);
    res.status(500).json({ error: "Error interno al guardar" });
  }
}