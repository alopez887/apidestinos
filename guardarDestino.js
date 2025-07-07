import pool from './conexion.js';

export default async function guardarDestino(req, res) {
  const datos = req.body;
  console.log("📥 Datos recibidos en guardarDestino:", datos);

  if (!datos || !datos.destino || !datos.nombre || !datos.correo) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  try {
    // 🔹 Obtener último folio
    const folioResult = await pool.query(`
      SELECT folio 
      FROM reservaciones 
      WHERE folio LIKE 'D-%' 
      ORDER BY id DESC 
      LIMIT 1
    `);

    let nuevoFolio = "D-0000001";
    if (folioResult.rows.length > 0) {
      const ultimoFolio = folioResult.rows[0].folio;
      const num = parseInt(ultimoFolio.replace("D-", ""), 10) + 1;
      nuevoFolio = `D-${num.toString().padStart(7, "0")}`;
    }

    // 🔹 Limpiar precio (quitar texto)
    const precioLimpio = parseFloat(String(datos.precio).replace(/[^\d.]/g, "")) || 0;

    // 🔹 Insertar en reservaciones
    const insertResult = await pool.query(`
      INSERT INTO reservaciones
      (folio, nombre_tour, tipo_servicio, estatus, tipo_transporte, nombre_cliente, correo_cliente, nota, fecha,
       capacidad, cantidad_pasajeros, hotel_llegada, hotel_salida, fecha_salida, hora_salida, precio_servicio, tipo_viaje)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING folio
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
      datos.tipo_viaje
    ]);

    console.log("✅ Reserva insertada con folio:", insertResult.rows[0].folio);
    res.status(200).json({ exito: true, folio: insertResult.rows[0].folio });

  } catch (err) {
    console.error("❌ Error al insertar reserva:", err);
    res.status(500).json({ error: "Error interno al guardar" });
  }
}