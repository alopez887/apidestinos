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

export default async function guardarDestino(req, res) {
  const datos = req.body;
  console.log("📥 Datos recibidos en guardarDestino:", datos);

  if (!datos || !datos.destino || !datos.nombre || !datos.correo) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
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
      const num = parseInt(lastFolio.split('-')[1], 10) + 1;
      nuevoFolio = `D-${num.toString().padStart(6, '0')}`;
    }

    // ☎ Teléfono completo
    const telefonoCompleto = `${datos.codigoPais || ''}${datos.telefono || ''}`.trim();

    // 💵 Total: aceptar total | total_pago | precio | monto
    const totalRaw = firstNonNil(datos.total, datos.total_pago, datos.precio, datos.monto);
    const totalNum = moneyNum(totalRaw);
    if (totalNum == null) {
      return res.status(400).json({ error: "total_pago inválido", recibido: totalRaw });
    }

    // 🗃 Insertar (sin imágenes)
    await pool.query(`
      INSERT INTO reservaciones
      (folio, nombre_tour, tipo_servicio, estatus, tipo_transporte,
       nombre_cliente, correo_cliente, nota, fecha,
       capacidad, cantidad_pasajeros, hotel_llegada, hotel_salida,
       fecha_salida, hora_salida, precio_servicio, tipo_viaje, total_pago, telefono_cliente)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() AT TIME ZONE 'America/Mazatlan',
              $9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    `, [
      nuevoFolio,
      datos.destino,          // nombre_tour
      datos.tipo_viaje,       // tipo_servicio (así lo usas)
      1,                      // estatus
      datos.transporte,       // tipo_transporte
      datos.nombre,           // nombre_cliente
      datos.correo,           // correo_cliente
      datos.comentarios || '',// nota
      datos.capacidad,
      datos.pasajeros,
      datos.hotel,            // hotel_llegada
      datos.hotel,            // hotel_salida (mismo valor)
      datos.fecha,            // fecha_salida
      datos.hora,             // hora_salida
      totalNum,               // precio_servicio
      datos.tipo_viaje,
      totalNum,               // total_pago  ✅ ya numérico
      telefonoCompleto
    ]);

    console.log("✅ Reserva insertada con folio:", nuevoFolio);

    // 📧 Enviar correo con el mismo total normalizado
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
      total_pago: totalNum,                 // ✅ clave que usa el correo
      imagenDestino: datos.imagenDestino || '',
      imagenTransporte: datos.imagenTransporte || ''
    });

    console.log("✅ Correo de destino enviado correctamente");
    res.status(200).json({ exito: true, folio: nuevoFolio });

  } catch (err) {
    console.error("❌ Error al insertar reserva o enviar correo:", err);
    res.status(500).json({ error: "Error interno al guardar" });
  }
}