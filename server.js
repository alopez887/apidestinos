// exportarExcelSalidasTours.js
import ExcelJS from 'exceljs';
import pool from './conexion.js';
import path from 'path';

const exportarExcelSalidasTours = async (req, res) => {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Parámetros desde y hasta requeridos' });
    }

    // Solo TOURS, mismas columnas + nombre_tour; Aerolínea/Vuelo → "—"
    const query = `
      SELECT 
        folio,
        nombre_cliente,
        nota,
        tipo_viaje,
        tipo_transporte,
        capacidad,
        cantidad_pasajeros,
        hotel_salida,
        zona,
        fecha_salida,
        hora_salida,
        COALESCE(aerolinea_salida, '—') AS aerolinea_salida,
        COALESCE(vuelo_salida, '—')     AS vuelo_salida,
        COALESCE(nombre_tour, '—')      AS nombre_tour
      FROM reservaciones
      WHERE (UPPER(tipo_servicio) = 'TOURS' OR UPPER(tipo_viaje) = 'TOURS')
        AND fecha_salida BETWEEN $1 AND $2
      ORDER BY fecha_salida ASC, hora_salida ASC
    `;
    const { rows } = await pool.query(query, [desde, hasta]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Salidas (Tours)');

    // Logo (no romper si falta)
    try {
      const logoId = wb.addImage({
        filename: path.resolve('public/logo.png'),
        extension: 'png'
      });
      ws.addImage(logoId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 4 } });
      ws.mergeCells('A1:B4');
      ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    } catch (_) {}

    // Título
    ws.mergeCells('C1:I4');
    const titleCell = ws.getCell('C1');
    titleCell.value = 'REPORTE DE SALIDAS (TOURS) - CABO TRAVELS SOLUTIONS';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Encabezados (mismos + Nombre Tour)
    const headers = [
      { header: 'Folio',          key: 'folio',              width: 14 },
      { header: 'Cliente',        key: 'nombre_cliente',     width: 22 },
      { header: 'Nota',           key: 'nota',               width: 22 },
      { header: 'Tipo viaje',     key: 'tipo_viaje',         width: 14 },
      { header: 'Transporte',     key: 'tipo_transporte',    width: 20 },
      { header: 'Capacidad',      key: 'capacidad',          width: 14 },
      { header: 'Pasajeros',      key: 'cantidad_pasajeros', width: 14 },
      { header: 'Hotel',          key: 'hotel_salida',       width: 20 },
      { header: 'Zona',           key: 'zona',               width: 14 },
      { header: 'Fecha salida',   key: 'fecha_salida',       width: 16 },
      { header: 'Hora',           key: 'hora_salida',        width: 12 },
      { header: 'Aerolínea',      key: 'aerolinea_salida',   width: 18 },
      { header: 'Vuelo',          key: 'vuelo_salida',       width: 14 },
      { header: 'Nombre Tour',    key: 'nombre_tour',        width: 26 }
    ];

    headers.forEach((h, i) => (ws.getColumn(i + 1).width = h.width));

    const headerRow = ws.getRow(6);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h.header;
      cell.font = { bold: true, color: { argb: 'FF0D2740' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDbe5f1' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
    });
    headerRow.height = 20;

    // Filas
    rows.forEach((r, idx) => {
      const row = ws.getRow(7 + idx);
      headers.forEach((h, i) => {
        let val = r[h.key];
        if (h.key === 'capacidad') val = (r.capacidad?.toString().trim() || '—');
        if (h.key === 'aerolinea_salida' || h.key === 'vuelo_salida' || h.key === 'nombre_tour') {
          val = (val == null || val === '') ? '—' : val;
        }
        const cell = row.getCell(i + 1);
        cell.value = val;
        if (h.key === 'fecha_salida' && val instanceof Date) cell.numFmt = 'yyyy-mm-dd';
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      });
      row.commit();
    });

    // >>> Enviar como BUFFER (evita ERR_INVALID_RESPONSE)
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="salidas_tours_${desde}_a_${hasta}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(200).end(Buffer.from(buffer));
  } catch (err) {
    console.error('❌ Error al generar Excel de salidas (Tours):', err);
    return res.status(500).json({ error: 'Error al generar Excel (Tours)' });
  }
};

export default exportarExcelSalidasTours;