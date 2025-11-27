import pool from './conexion.js';

export default async function loginUsuario(req, res) {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res
      .status(400)
      .json({ success: false, message: 'Faltan usuario o contraseña' });
  }

  try {
    // 1) Buscar SOLO por usuario (sin filtrar activo todavía)
    const result = await pool.query(
      'SELECT * FROM usuarios_proveedor WHERE UPPER(usuario) = UPPER($1)',
      [usuario.trim()]
    );

    // 🔴 No existe ese usuario
    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }

    const user = result.rows[0];

    // 🔴 Existe pero está INACTIVO
    if (!user.activo) {
      return res
        .status(403)
        .json({
          success: false,
          message: 'Usuario inactivo',
          inactivo: true,              // 👈 el iframe lo detecta
          error: 'USUARIO_INACTIVO',   // 👈 por si quieres usar el código también
        });
    }

    // 🔴 Contraseña incorrecta
    if (password !== user.password) {
      return res
        .status(401)
        .json({ success: false, message: 'Usuario o contraseña incorrectos' });
    }

    // ✅ Login OK
    res.json({
      success: true,
      message: 'Login exitoso',
      usuario: {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        rol: user.tipo_usuario   // 🔥 se mantiene tal cual
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error interno del servidor' });
  }
}
