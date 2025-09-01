// generarQR.js
import QRCode from 'qrcode';

const BASE_URL = process.env.PUBLIC_APP_BASE_URL
  || 'https://nkmsistemas.wixsite.com/cabo-travel-activiti';


export async function generarQRValidar(token, { size = 320, margin = 1 } = {}) {
  if (!token) throw new Error('generarQRValidar: token requerido');
  const url = `${BASE_URL}/validar-qr?token=${encodeURIComponent(token)}`;
  try {
    return await QRCode.toDataURL(url, { width: size, margin });
  } catch (err) {
    console.error('❌ Error al generar QR (validar):', err);
    throw err;
  }
}


export async function generarQRTicket(token, { type = 'transporte', size = 320, margin = 1 } = {}) {
  if (!token) throw new Error('generarQRTicket: token requerido');
  const url = `${BASE_URL}/login?token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}`;
  try {
    return await QRCode.toDataURL(url, { width: size, margin });
  } catch (err) {
    console.error('❌ Error al generar QR (ticket):', err);
    throw err;
  }
}


export async function generarQRDataUrl(payload, { size = 320, margin = 1 } = {}) {
  try {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return await QRCode.toDataURL(data, { width: size, margin });
  } catch (err) {
    console.error('❌ Error al generar QR (genérico):', err);
    throw err;
  }
}

export default {
  generarQRValidar,
  generarQRTicket,
  generarQRDataUrl,
};