import pool from './conexion.js';
import { enviarCorreoDestino } from './correoDestino.js'; // ✅ Se importa la nueva función

export default async function guardarDestino(req, res) {
  const datos = req.body;
  console.log("📥 Datos recibidos en guardarDestino:", datos);

  if (!datos || !datos.destino || !datos.nombre || !datos.correo) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  try {
    // Generar el nuevo folio
    const resultFolio = await pool.query(`
      SELECT folio 
      FROM reservaciones 
      WHERE folio LIKE 'D-%'
      ORDER BY id DESC 
      LIMIT 1
    `);

    let nuevoFolio = 'D-0000001';
    if (resultFolio.rows.length > 0) {
      const lastFolio = resultFolio.rows[0].folio;
      const num = parseInt(lastFolio.split('-')[1]) + 1;
      nuevoFolio = `D-${num.toString().padStart(7, '0')}`;
    }

    // Concatenar teléfono completo
    const telefonoCompleto = `${datos.codigoPais}${datos.telefono}`;

    // Limpiar precio
    const precioLimpio = parseFloat(String(datos.precio).replace(/[^\d.]/g, ""));

    // Insertar la reserva
    await pool.query(`
      INSERT INTO reservaciones
      (folio, nombre_tour, tipo_servicio, estatus, tipo_transporte,
      nombre_cliente, correo_cliente, nota, fecha,
      capacidad, cantidad_pasajeros, hotel_llegada, hotel_salida,
      fecha_salida, hora_salida, precio_servicio, tipo_viaje, total_pago, telefono_cliente)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() AT TIME ZONE 'America/Mazatlan',
      $9,$10,$11,$12,$13,$14,$15,$16,$17, $18)
    `, [
      nuevoFolio,
      datos.destino,
      datos.tipo_viaje,
      1,
      datos.transporte,
      datos.nombre,
      datos.correo,
      datos.comentarios,
      datos.capacidad,
      datos.pasajeros,
      datos.hotel,
      datos.hotel,
      datos.fecha,
      datos.hora,
      precioLimpio,
      datos.tipo_viaje,
      precioLimpio,
      telefonoCompleto
    ]);

    console.log("✅ Reserva insertada con folio:", nuevoFolio);

    // ✅ Enviar correo después de insertar
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
      total_pago: precioLimpio
    });

    console.log("✅ Correo de destino enviado correctamente");

    res.status(200).json({ exito: true, folio: nuevoFolio });
  } catch (err) {
    console.error("❌ Error al insertar reserva o enviar correo:", err);
    res.status(500).json({ error: "Error interno al guardar" });
  }
}