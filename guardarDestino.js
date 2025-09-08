// guardarDestino.js (versión ajustada con token QR de 40 chars y total normalizado)
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
// Token de 40 caracteres hex (20 bytes) — mismo estilo que transporte
function genTokenQR(){
  return crypto.randomBytes(20).toString('hex');
}

export default async function guardarDestino(req, res) {
  const datos = req.body || {};
  console.log("📥 Datos recibidos en guardarDestino:", datos);

  // Validaciones básicas
  if (!datos.destino || !datos.nombre || !datos.correo) {
    return res.status(400).json({ error: "Faltan datos requeridos (destino, nombre, correo)" });
  }

  try {
    // 🔢 Generar folio D-000001, D-000002, ...
    const resultFolio = await pool.query(`
      SELECT folio
      FROM reservaciones
      WHERE folio LIKE 'D-%'
      ORDER BY id DESC
      LIMIT 1
    `);

    let nuevoFolio = 'D-000001';
    if (resultFolio.rows.length > 0) {
      const lastFolio = resultFolio.rows[0].folio;
      const num = parseInt((lastFolio || 'D-000000').split('-')[1], 10) + 1;
      nuevoFolio = `D-${num.toString().padStart(6, '0')}`;
    }

    // 🔐 Token para QR (40 chars hex)
    const tokenQR = genTokenQR();

    // ☎ Teléfono completo
    const telefonoCompleto = `${datos.codigoPais || ''}${datos.telefono || ''}`.trim();

    // 💵 Total: aceptar total | total_pago | precio | monto
    const totalRaw = firstNonNil(datos.total, datos.total_pago, datos.precio, datos.monto);
    const totalNum = moneyNum(totalRaw);
    if (totalNum == null) {
      return res.status(400).json({ error: "total_pago inválido", recibido: totalRaw });
    }

    // 🗃 Insertar (incluyendo columna toquen_qr)
    await pool.query(`
      INSERT INTO reservaciones
      (folio, nombre_tour, tipo_servicio, estatus, tipo_transporte,
       nombre_cliente, correo_cliente, nota, fecha,
       capacidad, cantidad_pasajeros, hotel_llegada, hotel_salida,
       fecha_salida, hora_salida, precio_servicio, tipo_viaje, total_pago,
       telefono_cliente, toquen_qr)
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
      tokenQR                     // toquen_qr (guardado en BD)
    ]);

    console.log("✅ Reserva insertada con folio:", nuevoFolio);

    // 📧 Enviar correo con el mismo total y el token para generar el QR
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
      token_qr: tokenQR // 🔑 dispara la generación del QR en el correo
    });

    console.log("✅ Correo de destino enviado correctamente");
    res.status(200).json({ exito: true, folio: nuevoFolio, toquen_qr: tokenQR });

  } catch (err) {
    console.error("❌ Error al insertar reserva o enviar correo:", err);
    res.status(500).json({ error: "Error interno al guardar" });
  }
}