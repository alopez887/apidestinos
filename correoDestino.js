// correoDestino.js — bilingüe ES/EN + traducción de transporte (Private→Privado, Limousine→Limusina, Sprinter→Sprinter)
import dotenv from 'dotenv';
dotenv.config();

import { generarQRDestino } from './generarQR.js';

const GAS_URL        = process.env.GAS_URL;
const GAS_TOKEN      = process.env.GAS_TOKEN;
const GAS_TIMEOUT_MS = Number(process.env.GAS_TIMEOUT_MS || 15000);

const EMAIL_DEBUG = /^(1|true|yes)$/i.test(String(process.env.EMAIL_DEBUG || ''));
const DBG = (...a) => { if (EMAIL_DEBUG) console.log('[MAIL][destino]', ...a); };

// === ICONOS COMO ENTIDADES (sin emojis directos) ===
const ICO_CHECK = '&#9989;';    // ✅
const ICO_WARN  = '&#9888;';    // ⚠
const ICO_MAIL  = '&#128231;';  // 📧
const ICO_PIN   = '&#128204;';  // 📌

// ---------- utils ----------
const _fmt = (v) => (v === 0 ? '0' : (v ?? '—'));
const GEN_CID = (name) => `${name}@cts`;

function sanitizeUrl(u = '') {
  try {
    let s = String(u || '').trim();
    if (!s) return '';
    if (s.startsWith('//')) s = 'https:' + s;
    if (s.startsWith('http://')) s = s.replace(/^http:\/\//i, 'https://');
    return s;
  } catch { return ''; }
}

function forceJpgIfWix(url='') {
  try {
    const u = new URL(url);
    if (/wixstatic\.com$/i.test(u.hostname)) {
      if (!u.searchParams.has('format')) u.searchParams.set('format','jpg');
      if (!u.searchParams.has('width'))  u.searchParams.set('width','1200');
      return u.toString();
    }
  } catch {}
  return url;
}

function moneyNum(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).replace(/[^0-9.-]/g,'').replace(/,/g,'');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmtDMY(dateLike) {
  try {
    const d = new Date(dateLike);
    if (isNaN(d)) return '—';
    const dd = String(d.getUTCDate()).padStart(2,'0');
    const mm = String(d.getUTCMonth()+1).padStart(2,'0');
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch { return '—'; }
}

function fmtHora12(hhmm) {
  try {
    if (!hhmm) return '—';
    const [h, m='00'] = String(hhmm).split(':');
    const H = Number(h);
    if (!Number.isFinite(H)) return hhmm;
    const suf = H >= 12 ? 'p.m.' : 'a.m.';
    const h12 = (H % 12) || 12;
    return `${h12}:${m.padStart(2,'0')} ${suf}`;
  } catch { return hhmm; }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
function sanitizeEmails(value) {
  const arr = Array.isArray(value) ? value : String(value || '').split(/[,\s]+/).filter(Boolean);
  const valid = []; const invalid = [];
  for (const raw of arr) {
    const e = String(raw || '').trim();
    if (EMAIL_RE.test(e)) valid.push(e); else invalid.push(raw);
  }
  return { valid: Array.from(new Set(valid)), invalid };
}

function firstNonNil(...vals) { for (const v of vals) if (v !== undefined && v !== null && v !== '') return v; return null; }
function mapLang(v){
  const s = String(v || '').trim().toLowerCase();
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('es')) return 'es';
  return 'es'; // default negocio
}

// Traducción de transporte cuando el correo es en ES
function localizeTransport(raw, lang){
  const s = String(raw || '').trim();
  if (lang === 'es') {
    if (/^private$/i.test(s))   return 'Privado';
    if (/^limousine$/i.test(s)) return 'Limusina';
    if (/^sprinter$/i.test(s))  return 'Sprinter';
  }
  return s; // en inglés o ya español correcto
}

// ---------- estilos ----------
const EMAIL_CSS = `
<style>
  .body-cts { font-family: Arial, Helvetica, sans-serif; color:#222; }
  .section-title { font-size:13px; letter-spacing:.4px; text-transform:uppercase; color:#000; font-weight:700; }
  .divider { border-top:1px solid #e5e9f0; height:1px; line-height:1px; font-size:0; }
  .logoimg { display:block;height:auto;border:0; }
  @media screen and (max-width:480px){
    .logoimg { width:160px !important; height:auto !important; }
  }
</style>`;

// ---------- logo ----------
let _logoCache = null;
async function inlineLogo() {
  if (_logoCache) return _logoCache;
  const url = 'https://static.wixstatic.com/media/f81ced_636e76aeb741411b87c4fa8aa9219410~mv2.png';
  _logoCache = { url, filename: 'logo.png', cid: GEN_CID('logoEmpresa'), inline: true };
  return _logoCache;
}

// ---------- textos ES/EN ----------
const I18N = {
  es: {
    title_ok:        `${ICO_CHECK} Confirmación de Reservación de Tours`,
    section_title:   'Información de la Reservación',
    folio:           'Folio',
    name:            'Nombre',
    email:           'Correo',
    phone:           'Teléfono',
    destination:     'Destino',
    transport:       'Transporte',
    capacity:        'Capacidad',
    trip_type:       'Tipo de viaje',
    hotel:           'Hotel',
    date:            'Fecha',
    time:            'Hora',
    passengers:      'Pasajeros',
    total:           'Total',
    note:            'Nota',
    sent_to:         'Confirmación enviada a',
    recommendations: `${ICO_WARN} Recomendaciones:`,
    recommendations_p: 'Por favor confirma tu reservación al menos 24 horas antes para evitar inconvenientes.',
    policies_html: `
      <div style="margin-top:16px;padding-top:10px;border-top:1px solid #e5e9f0;font-size:13px;color:#555;">
        <strong>${ICO_PIN} Políticas de cancelación:</strong><br>
        - Todas las cancelaciones o solicitudes de reembolso están sujetas a una comisión del 10% del total pagado.<br>
        <strong>- No se realizarán reembolsos por cancelaciones con menos de 24 horas de anticipación o por no presentarse.</strong>
      </div>
    `,
    subject: (folio)=> `Confirmación de Reservación de Destino - Folio ${_fmt(folio)}`
  },
  en: {
    title_ok:        `${ICO_CHECK} Tours Reservation Confirmed`,
    section_title:   'Reservation Information',
    folio:           'Folio',
    name:            'Name',
    email:           'Email',
    phone:           'Phone',
    destination:     'Destination',
    transport:       'Transport',
    capacity:        'Capacity',
    trip_type:       'Trip Type',
    hotel:           'Hotel',
    date:            'Date',
    time:            'Time',
    passengers:      'Passengers',
    total:           'Total',
    note:            'Note',
    sent_to:         'Confirmation sent to',
    recommendations: `${ICO_WARN} Recommendations:`,
    recommendations_p: 'Please confirm your reservation at least 24 hours in advance to avoid any inconvenience.',
    policies_html: `
      <div style="margin-top:16px;padding-top:10px;border-top:1px solid #e5e9f0;font-size:13px;color:#555;">
        <strong>${ICO_PIN} Cancellation Policy:</strong><br>
        - All cancellations or refund requests are subject to a 10% fee of the total amount paid.<br>
        <strong>- No refunds will be issued for cancellations made less than 24 hours in advance or in case of no-shows.</strong>
      </div>
    `,
    subject: (folio)=> `Destination Reservation Confirmed - Folio ${_fmt(folio)}`
  }
};

export async function enviarCorreoDestino(datos = {}) {
  try {
    if (!GAS_URL || !/^https:\/\/script\.google\.com\/macros\/s\//.test(GAS_URL)) throw new Error('GAS_URL no configurado o inválido');
    if (!GAS_TOKEN) throw new Error('GAS_TOKEN no configurado');

    DBG('payload in:', datos);

    const toSan = sanitizeEmails(datos.correo_cliente || datos.to);
    if (!toSan.valid.length) throw new Error('Destinatario inválido (correo_cliente)');

    // Idioma
    const lang = mapLang(firstNonNil(datos.idioma, datos.correo_idioma, 'es'));
    const T = I18N[lang] || I18N.es;

    // ---------- attachments ----------
    const logo = await inlineLogo();
    const logoCid = logo?.cid || GEN_CID('logoEmpresa');

    const destinoCid    = GEN_CID('imagenDestino');
    const transporteCid = GEN_CID('imagenTransporte');

    const attDestino = (() => {
      const u = forceJpgIfWix(sanitizeUrl(datos.imagenDestino || ''));
      return u ? { url: u, filename: 'destino.jpg', cid: destinoCid, inline: true } : null;
    })();

    const attTransp = (() => {
      const u = forceJpgIfWix(sanitizeUrl(datos.imagenTransporte || ''));
      return u ? { url: u, filename: 'transporte.jpg', cid: transporteCid, inline: true } : null;
    })();

    // QR opcional
    let qrAttachment = null;
    const qrCid = GEN_CID('tokenQR');
    if (datos.token_qr) {
      try {
        const dataUrl = await generarQRDestino(datos.token_qr, { size: 320, margin: 1 });
        const base64 = String(dataUrl).replace(/^data:[^;]+;base64,/, '').replace(/\s+/g,'');
        qrAttachment = { data: base64, mimeType: 'image/png', filename: 'qr.png', cid: qrCid, inline: true };
      } catch (e) {
        console.warn('[MAIL][destino] QR error:', e?.message);
      }
    }

    // ---------- datos presentacionales ----------
    const hotel  = firstNonNil(datos.hotel, datos.hotel_llegada);
    const fecha  = firstNonNil(datos.fecha, datos.fecha_llegada);
    const hora   = fmtHora12(firstNonNil(datos.hora, datos.hora_llegada));
    const totalN = moneyNum(datos.total_pago);

    // Traducción de transporte si procede
    const transporteTxt = localizeTransport(datos.tipo_transporte, lang);

    const totalH = totalN != null
      ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.total}:</strong> $${totalN.toFixed(2)} USD</p>`
      : '';

    // ---------- HTML bilingüe ----------
    const html = `
      ${EMAIL_CSS}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="body-cts">
        <tr>
          <td align="center" style="padding:0;margin:0;">
            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;border:2px solid #ccc;border-radius:10px;">
              <tr>
                <td style="padding:20px;border-radius:10px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 8px 0;">
                    <tr>
                      <td align="left" style="vertical-align:middle;">
                        <h2 style="color:green;margin:0;">${T.title_ok}</h2>
                      </td>
                      <td align="right" style="vertical-align:middle;">
                        <img src="cid:${logoCid}" width="180" class="logoimg" alt="Logo" />
                      </td>
                    </tr>
                  </table>

                  <p class="section-title" style="margin:12px 0 6px;"><strong>${T.section_title}</strong></p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr><td style="font-size:14px;color:#222;">
                      <p style="margin:2px 0;line-height:1.35;"><strong>${T.folio}:</strong> ${_fmt(datos.folio)}</p>
                      <p style="margin:2px 0;line-height:1.35;"><strong>${T.name}:</strong> ${_fmt(datos.nombre_cliente || datos.nombre)}</p>
                      ${datos.correo_cliente ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.email}:</strong> ${datos.correo_cliente}</p>` : ``}
                      ${datos.telefono_cliente ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.phone}:</strong> ${datos.telefono_cliente}</p>` : ``}
                      ${datos.destino ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.destination}:</strong> ${datos.destino}</p>` : ``}
                      ${datos.tipo_transporte ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.transport}:</strong> ${transporteTxt}</p>` : ``}
                      ${datos.capacidad ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.capacity}:</strong> ${datos.capacidad}</p>` : ``}
                      ${datos.tipo_viaje ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.trip_type}:</strong> ${datos.tipo_viaje}</p>` : ``}
                      ${hotel ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.hotel}:</strong> ${hotel}</p>` : ``}
                      ${fecha ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.date}:</strong> ${fmtDMY(fecha)}</p>` : ``}
                      ${hora  ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.time}:</strong> ${hora}</p>` : ``}
                      ${datos.cantidad_pasajeros ? `<p style="margin:2px 0;line-height:1.35;"><strong>${T.passengers}:</strong> ${datos.cantidad_pasajeros}</p>` : ``}
                      ${totalH}
                      ${datos.nota ? `<p style="margin:8px 0 0;line-height:1.45;"><strong>${T.note}:</strong> ${datos.nota}</p>` : ``}
                    </td></tr>
                  </table>

                  ${(attDestino || attTransp) ? `
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;">
                      <tr>
                        <td>
                          ${attDestino ? `<img src="cid:${destinoCid}" width="400" style="display:block;width:100%;height:auto;border-radius:8px;" alt="Destination image" />` : ``}
                          ${attTransp ? `<div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>
                                         <img src="cid:${transporteCid}" width="400" style="display:block;width:100%;height:auto;border-radius:8px;" alt="Transport image" />` : ``}
                        </td>
                      </tr>
                    </table>
                  ` : ``}

                  ${qrAttachment ? `
                  <table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:10px auto 0;">
                    <tr>
                      <td align="center">
                        <img src="cid:${qrCid}" width="110" height="110" style="display:block;border:0;outline:0;text-decoration:none;" alt="QR" />
                      </td>
                    </tr>
                  </table>` : ``}

                  <div class="divider" style="border-top:1px solid #e5e9f0;margin:12px 0;"></div>

                  <div style="background:#fff8e6;border-left:6px solid #ffa500;padding:10px 14px;border-radius:6px;">
                    <strong style="color:#b00000;">${T.recommendations}</strong>
                    <span style="color:#333;"> ${T.recommendations_p}</span>
                  </div>

                  <p style="margin-top:12px;font-size:14px;color:#555;">
                    ${ICO_MAIL} ${T.sent_to}: <a href="mailto:${_fmt(datos.correo_cliente)}">${_fmt(datos.correo_cliente)}</a>
                  </p>

                  ${T.policies_html}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;

    // ---------- payload GAS ----------
    const attachments = [
      ...(logo ? [logo] : []),
      ...(attDestino ? [attDestino] : []),
      ...(attTransp ? [attTransp] : []),
      ...(qrAttachment ? [qrAttachment] : []),
    ];

    const subject = T.subject(datos.folio);
    const payload = {
      token: GAS_TOKEN,
      ts: Date.now(),
      to: toSan.valid,
      cc: [],
      bcc: 'nkmsistemas@gmail.com',
      subject,
      html,
      fromName: process.env.EMAIL_FROMNAME || 'Cabo Travel Solutions',
      attachments
    };

    DBG('POST → GAS', { to: toSan.valid, subject, lang });
    const { status, json } = await postJSON(GAS_URL, payload, GAS_TIMEOUT_MS);
    if (!json || json.ok !== true) throw new Error(`Error GAS: ${(json && json.error) || status}`);

    DBG('✔ GAS ok:', json);
    return true;
  } catch (err) {
    console.error('❌ Error al enviar correo de destino (GAS):', err?.message || err);
    throw err;
  }
}

export default enviarCorreoDestino;
