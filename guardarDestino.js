import pool from './conexion.js';

export default async function guardarDestino(req, res) {
  const datos = req.body;
  console.log("📥 Datos recibidos en guardarDestino:", datos);

  if (!datos || !datos.destino || !datos.nombre || !datos.correo) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  try {
    const resultado = await pool.query(`
      INSERT INTO destinos_reservas
      (destino, transporte, capacidad, hotel, fecha, hora, nombre, codigo_pais, telefono, correo, pasajeros, comentarios, precio)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id
    `, [
      datos.destino,
      datos.transporte,
      datos.capacidad,
      datos.hotel,
      datos.fecha,
      datos.hora,
      datos.nombre,
      datos.codigoPais,
      datos.telefono,
      datos.correo,
      datos.pasajeros,
      datos.comentarios,
      datos.precio
    ]);

    console.log("✅ Reserva insertada con ID:", resultado.rows[0].id);
    res.status(200).json({ exito: true, id: resultado.rows[0].id });
  } catch (err) {
    console.error("❌ Error al insertar reserva:", err);
    res.status(500).json({ error: "Error interno al guardar" });
  }
}