// obtenerReservaTours.js
import pool from './conexion.js';

export async function obtenerReservaTours(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ success: false, error: 'Token requerido' });
  }

  try {
    const query = `
      SELECT
        -- Identificación / cliente
        folio,
        nombre_cliente,
        correo_cliente,
        telefono_cliente,

        -- Servicio
        tipo_servicio,
        tipo_viaje,
        tipo_transporte,

        -- 👇 SOLO este campo para el nombre del tour
        nombre_tour,

        -- Capacidad / pax / cobro
        capacidad,
        cantidad_pasajeros,
        total_pago,
        precio_servicio,
        porcentaje_descuento,
        codigo_descuento,

        -- Hoteles y fechas/horas
        hotel_llegada,
        fecha_llegada,
        hora_llegada,
        aerolinea_llegada,
        vuelo_llegada,

        hotel_salida,
        fecha_salida,
        hora_salida,
        aerolinea_salida,
        vuelo_salida,

        -- Estado general
        estatus,
        nota,
        proveedor,

        -- Llegada (legacy)
        representante_llegada,
        fecha_inicioviajellegada,
        fecha_finalviajellegada,
        comentariosllegada,
        firma_clientellegada,
        choferllegada,
        numero_unidadllegada,
        estatus_viajellegada,
        cantidad_pasajerosokllegada,

        -- Salida (legacy)
        representante_salida,
        fecha_inicioviajesalida,
        fecha_finalviajesalida,
        comentariossalida,
        firma_clientesalida,
        chofersalida,
        numero_unidadsalida,
        estatus_viajesalida,
        cantidad_pasajerosoksalida,

        -- Chofer externo (si aplica)
        chofer_externonombre,
        choferexterno_tel,
        chofer_empresaext,

        -- token eco
        token_qr
      FROM reservaciones
      WHERE token_qr = $1
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [token]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    const reserva = rows[0];

    // Marcas de finalizado (se conserva la lógica existente)
    const tipoViaje = String(reserva.tipo_viaje || '').toLowerCase();
    const respuesta = { success: true, reserva };

    if (tipoViaje === 'llegada' && reserva.estatus_viajellegada === 'finalizado') {
      respuesta.finalizado = true;
      respuesta.detalle_finalizado = {
        representante: reserva.representante_llegada,
        fecha_inicio: reserva.fecha_inicioviajellegada,
        chofer: reserva.choferllegada,
        fecha_final: reserva.fecha_finalviajellegada,
      };
    } else if (tipoViaje === 'salida' && reserva.estatus_viajesalida === 'finalizado') {
      respuesta.finalizado = true;
      respuesta.detalle_finalizado = {
        representante: reserva.representante_salida,
        fecha_inicio: reserva.fecha_inicioviajesalida,
        chofer: reserva.chofersalida,
        fecha_final: reserva.fecha_finalviajesalida,
      };
    }

    return res.json(respuesta);
  } catch (err) {
    console.error('❌ Error al obtener reserva (tours):', err);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}