import fs from 'fs';
import path from 'path';
import pool from '../conexion.js';

export default async function guardarFirmaTours(req, res) {
  try {
    const { token_qr, folio, firma_base64, tipo_viaje } = req.body || {};

    const identificador = token_qr || folio;
    const campoIdentificador = token_qr ? 'token_qr' : 'folio';
    if (!identificador || !firma_base64) {
      return res.status(400).json({ success: false, message: 'Faltan datos (folio/token_qr o firma_base64)' });
    }

    // preparar carpeta
    const dir = path.join(process.cwd(), 'firmas');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // guardar imagen
    const nombreArchivo = `firma_${identificador}_${Date.now()}.png`;
    const rutaArchivo = path.join(dir, nombreArchivo);
    const base64Data = String(firma_base64).replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(rutaArchivo, base64Data, 'base64');

    // URL detrás de proxy
    const proto = (req.headers['x-forwarded-proto'] || req.protocol);
    const host  = (req.headers['x-forwarded-host']  || req.get('host'));
    const urlFirma = `${proto}://${host}/firmas/${nombreArchivo}`;

    // decidir columna: default "salida" para TOURS
    const tipo = String(tipo_viaje || 'salida').toLowerCase();
    let campoFirma = 'firma_clientesalida';
    if (['llegada', 'redondo_llegada', 'shuttle'].includes(tipo)) {
      campoFirma = 'firma_clientellegada';
    } else if (['salida', 'redondo_salida', 'tours'].includes(tipo)) {
      campoFirma = 'firma_clientesalida';
    }

    const query = `UPDATE reservaciones SET ${campoFirma} = $1 WHERE ${campoIdentificador} = $2`;
    await pool.query(query, [urlFirma, identificador]);

    return res.json({ success: true, url: urlFirma });
  } catch (error) {
    console.error('❌ Error al guardar firma (tours):', error);
    return res.status(500).json({ success: false, message: 'Error guardando firma' });
  }
}