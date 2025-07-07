import nodemailer from 'nodemailer';
import axios from 'axios';

const politicasHTML = `
  <div style="margin-top:30px;padding-top:15px;border-top:1px solid #ccc;font-size:13px;color:#555;">
    <strong>📌 Cancellation Policy:</strong><br>
    - All cancellations or refund requests are subject to a 10% fee of the total amount paid.<br>
    <strong>- No refunds will be issued for cancellations made less than 24 hours in advance or in case of no-shows.</strong>
  </div>
`;

export async function enviarCorreoDestino(datos) {
  try {
    console.log("📥 Datos recibidos para correoDestino:", datos);

    const logoBuffer = await axios.get(
      'https://static.wixstatic.com/media/f81ced_636e76aeb741411b87c4fa8aa9219410~mv2.png',
      { responseType: 'arraybuffer' }
    );

    const logoAdjunto = {
      filename: 'logo.png',
      content: logoBuffer.data,
      cid: 'logoEmpresa',
      contentType: 'image/png'
    };

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const safeToFixed = (valor) => {
      const num = Number(valor);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    };

    const formatoHora12 = (hora) => {
      if (!hora) return '';
      const [h, m] = hora.split(':');
      const horaNum = parseInt(h, 10);
      const sufijo = horaNum >= 12 ? 'p.m.' : 'a.m.';
      const hora12 = (horaNum % 12) || 12;
      return `${hora12}:${m} ${sufijo}`;
    };

    const mensajeHTML = `
      <div style="max-width:600px;margin:0 auto;padding:20px 20px 40px;border:2px solid #ccc;border-radius:10px;font-family:Arial,sans-serif;">
        <table style="width:100%;margin-bottom:5px;">
          <tr>
            <td style="text-align:right;">
              <img src="cid:logoEmpresa" alt="Logo" style="height:45px;" />
            </td>
          </tr>
          <tr>
            <td style="text-align:left;">
              <h2 style="color:green;margin:0;">✅ Destination Reservation Confirmed</h2>
            </td>
          </tr>
        </table>

        <p><strong>Folio:</strong> ${datos.folio}</p>
        <p><strong>Name:</strong> ${datos.nombre_cliente}</p>
        <p><strong>Email:</strong> ${datos.correo_cliente}</p>
        <p><strong>Phone:</strong> ${datos.telefono_cliente}</p>
        <p><strong>Destination:</strong> ${datos.destino}</p>
        <p><strong>Transport:</strong> ${datos.tipo_transporte}</p>
        <p><strong>Capacity:</strong> ${datos.capacidad}</p>
        <p><strong>Trip Type:</strong> ${datos.tipo_viaje}</p>
        <p><strong>Hotel:</strong> ${datos.hotel_llegada}</p>
        <p><strong>Date:</strong> ${datos.fecha_llegada}</p>
        <p><strong>Time:</strong> ${formatoHora12(datos.hora_llegada)}</p>
        <p><strong>Passengers:</strong> ${datos.cantidad_pasajeros}</p>
        <p><strong>Total:</strong> $${safeToFixed(datos.total_pago)} USD</p>
        ${datos.nota && datos.nota.trim() !== '' ? `<p><strong>Note:</strong> ${datos.nota}</p>` : ''}

        <div style="background-color:#fff3cd;border-left:6px solid #ffa500;padding:10px 15px;margin-top:20px;border-radius:5px;">
          <strong style="color:#b00000;">⚠ Recommendations:</strong>
          <span style="color:#333;"> Please confirm your reservation at least 24 hours in advance to avoid any inconvenience.</span>
        </div>

        <p style="margin-top:20px;font-size:14px;color:#555;">
          📩 Confirmation sent to: <a href="mailto:${datos.correo_cliente}">${datos.correo_cliente}</a>
        </p>

        ${politicasHTML}
      </div>
    `;

    await transporter.sendMail({
      from: `Cabo Travels Solutions - Transport <${process.env.EMAIL_USER}>`,
      to: datos.correo_cliente,
      bcc: 'nkmsistemas@gmail.com',
      subject: `Destination Reservation - Folio ${datos.folio}`,
      html: mensajeHTML,
      attachments: [logoAdjunto]
    });

    console.log('📧 Correo de destino enviado correctamente');
  } catch (err) {
    console.error('❌ Error al enviar correo de destino:', err.message);
  }
}