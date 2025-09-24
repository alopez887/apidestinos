// guardarDestino.js — Tours (zona_id desde hoteles_zona)
import crypto from 'crypto';
import pool from './conexion.js';
import { enviarCorreoDestino } from './correoDestino.js';

function firstNonNil(...xs){ for (const v of xs) if (v !== undefined && v !== null && v !== '') return v; return null; }
function moneyNum(v){
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).replace(/[^0-9.-]/g,'').replace(/,/g,'');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function genTokenQR(){ return crypto.randomBytes(20).toString('hex'); }

export default async function guardarDestino(req, res) {
  const datos = req.body || {};
  console.log("📥 Datos recibidos en guardarDestino (Tours):", datos);

  if (!datos.destino || !datos.nombre || !datos.correo) {
    return res.status(400).json({ error: "Faltan datos requeridos (destino, nombre, correo)" });
  }

  try {
    // === Folio D-XXXXXX ===
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

    const tokenQR = genTokenQR();
    const telefonoCompleto = `${datos.codigoPais || ''}${datos.telefono || ''}`.trim();

    const totalRaw = firstNonNil(datos.total, datos.total_pago, datos.precio, datos.monto);
    const totalNum = moneyNum(totalRaw);
    if (totalNum == null) {
      return res.status(400).json({ error: "total_pago inválido", recibido: totalRaw });
    }

    const tipoServicio = 'Tours';
    const tipoViaje    = firstNonNil(datos.tipo_viaje, 'Tours');

    // ===========================
    // RESOLVER ZONA (usa zona_id)
    // ===========================
    let zonaBD = '';
    const hotelRef = (datos.hotel || datos.hotel_salida || datos.hotel_llegada || '').trim();

    if (datos.zona && String(datos.zona).trim() !== '') {
      zonaBD = String(datos.zona).trim();
      console.log("📍 Zona recibida desde frontend (Tours):", zonaBD);
    } else if (hotelRef) {
      try {
        // Igual que en guardarTransporte: buscar por nombre del hotel (LIKE)
        const rz = await pool.query(
          `SELECT zona_id
             FROM hoteles_zona
            WHERE UPPER(nombre_hotel) LIKE UPPER($1)
            LIMIT 1`,
          [`%${hotelRef}%`]
        );
        zonaBD = (rz.rows?.[0]?.zona_id ?? '').toString().trim();
        console.log("📍 Zona resuelta por DB (Tours):", zonaBD || '(vacía)', "hotelRef:", hotelRef);
      } catch (e) {
        console.warn('⚠️ No se pudo resolver zona desde hoteles_zona (Tours):', e.message);
      }
    }

    // ===========================
    // INSERT en reservaciones
    // ===========================
    await pool.query(`
      INSERT INTO reservaciones
      (folio, nombre_tour, tipo_servicio, estatus, tipo_transporte,
       nombre_cliente, correo_cliente, nota, fecha,
       capacidad, cantidad_pasajeros, hotel_llegada, hotel_salida, zona,
       fecha_salida, hora_salida, precio_servicio, tipo_viaje, total_pago,
       telefono_cliente, token_qr)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
              NOW() AT TIME ZONE 'America/Mazatlan',
              $9,$10,$11,$12,$13,
              $14,$15,$16,$17,$18,
              $19,$20)
    `, [
      nuevoFolio,                 // 1  folio
      datos.destino,              // 2  nombre_tour
      tipoServicio,               // 3  tipo_servicio = 'Tours'
      1,                          // 4  estatus
      datos.transporte,           // 5  tipo_transporte
      datos.nombre,               // 6  nombre_cliente
      datos.correo,               // 7  correo_cliente
      datos.comentarios || '',    // 8  nota
      datos.capacidad,            // 9  capacidad
      datos.pasajeros,            // 10 cantidad_pasajeros
      hotelRef,                   // 11 hotel_llegada
      hotelRef,                   // 12 hotel_salida
      zonaBD || null,             // 13 zona  ✅ (zona_id)
      datos.fecha,                // 14 fecha_salida
      datos.hora,                 // 15 hora_salida
      totalNum,                   // 16 precio_servicio
      tipoViaje,                  // 17 tipo_viaje
      totalNum,                   // 18 total_pago
      telefonoCompleto,           // 19 telefono_cliente
      tokenQR                     // 20 token_qr
    ]);

    console.log("✅ Reserva Tours insertada con folio:", nuevoFolio, "zona:", zonaBD || '(null)');

    // ===========================
    // Correo (si lo usas)
    // ===========================
    await enviarCorreoDestino({
      folio: nuevoFolio,
      tipo_viaje: tipoViaje,
      destino: datos.destino,
      tipo_transporte: datos.transporte,
      capacidad: datos.capacidad,
      hotel_llegada: hotelRef,
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
      zona: zonaBD || '',
      token_qr: tokenQR
    });

    return res.status(200).json({
      exito: true,
      folio: nuevoFolio,
      token_qr: tokenQR,
      zona: zonaBD || null
    });

  } catch (err) {
    console.error("❌ Error al insertar reserva (Tours) o enviar correo:", err);
    return res.status(500).json({ error: "Error interno al guardar (Tours)" });
  }
}