// exportarExcelSalidasAmbos.js
import ExcelJS from 'exceljs';
import pool from './conexion.js';
import path from 'path';

export default async function exportarExcelSalidasAmbos(req, res) {
  try {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
      return res.status(400).json({ error: 'Parámetros desde y hasta requeridos' });
    }

    // Unificamos columnas. Para Tours rellenamos Aerolínea/Vuelo con '—' y sí ponemos nombre_tour.
    // Para Transporte rellenamos nombre_tour con '—'.
    const sql = `
      WITH t_transporte AS (
        SELECT 
          folio,
          nombre_cliente,
          COALESCE(nota,'') AS nota,
          tipo_viaje,
          tipo_transporte,
          TRIM(capacidad) AS capacidad,
          cantidad_pasajeros,
          hotel_salida,
          zona::text AS zona,
          fecha_salida,
          hora_salida,
          COALESCE(aerolinea_salida,'—') AS aerolinea_salida,
          COALESCE(vuelo_salida,'—')     AS vuelo_salida,
          '—'::text                      AS nombre_tour
        FROM reservaciones
        WHERE (
          tipo_viaje ILIKE 'salida'
           OR (tipo_viaje ILIKE 'redondo' AND fecha_salida IS NOT NULL)
        )
          AND (tipo_servicio ILIKE 'transport%' OR tipo_servicio ILIKE 'transporte%')
          AND fecha_salida BETWEEN $1 AND $2
      ),
      t_tours AS (
        SELECT
          folio,
          nombre_cliente,
          COALESCE(nota,'') AS nota,
          'Tours'::text     AS tipo_viaje,
          COALESCE(tipo_transporte,'—') AS tipo_transporte,
          TRIM(COALESCE(capacidad,'—')) AS capacidad,
          COALESCE(cantidad_pasajeros, 0) AS cantidad_pasajeros,
          COALESCE(hotel_salida, hotel_llegada, '') AS hotel_salida,
          zona::text AS zona,
          fecha_salida,
          hora_salida,
          '—'::text AS aerolinea_salida,
          '—'::text AS vuelo_salida,
          COALESCE(nombre_tour, '—') AS nombre_tour
        FROM reservaciones
        WHERE tipo_servicio ILIKE 'tours'
          AND fecha_salida BETWEEN $1 AND $2
      )
      SELECT * FROM t_transporte
      UNION ALL
      SELECT * FROM t_tours
      ORDER BY fecha_salida ASC, hora_salida ASC, folio ASC
    `;

    const { rows } = await pool.query(sql, [desde, hasta]);

    // ===== Excel =====
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Salidas (Ambos)');

    // Logo (opcional)
    try {
      const logoId = wb.addImage({
        filename: path.resolve('public/logo.png'),
        extension: 'png'
      });
      ws.addImage(logoId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 4 } });
      ws.mergeCells('A1:B4');
      ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    } catch {
      // sin logo, no pasa nada
    }

    // Título
    ws.mergeCells('C1:I4');
    const titleCell = ws.getCell('C1');
    titleCell.value = 'REPORTE DE SALIDAS (TRANSPORTE + TOURS)';
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Encabezados unificados
    const headers = [
      { header: 'Folio',          key: 'folio', width: 14 },
      { header: 'Cliente',        key: 'nombre_cliente', width: 22 },
      { header: 'Nota',           key: 'nota', width: 22 },
      { header: 'Tipo',           key: 'tipo_viaje', width: 10 },
      { header: 'Transporte',     key: 'tipo_transporte', width: 20 },
      { header: 'Capacidad',      key: 'capacidad', width: 14 },
      { header: 'Pax',            key: 'cantidad_pasajeros', width: 8 },
      { header: 'Hotel',          key: 'hotel_salida', width: 22 },
      { header: 'Zona',           key: 'zona', width: 10 },
      { header: 'F. Salida',      key: 'fecha_salida', width: 14 },
      { header: 'Hora',           key: 'hora_salida', width: 12 },
      { header: 'Aerolínea',      key: 'aerolinea_salida', width: 16 },
      { header: 'Vuelo',          key: 'vuelo_salida', width: 14 },
      { header: 'Nombre Tour',    key: 'nombre_tour', width: 22 }
    ];

    headers.forEach((h, i) => ws.getColumn(i + 1).width = h.width);

    const headerRow = ws.getRow(6);
    headers.forEach((h, i) => {
      const c = headerRow.getCell(i + 1);
      c.value = h.header;
      c.font = { bold: true, color: { argb: 'FF0D2740' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDbe5f1' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
    });
    headerRow.height = 20;

    // Filas
    rows.forEach((r, idx) => {
      const row = ws.getRow(7 + idx);
      headers.forEach((h, i) => {
        let val = r[h.key];
        if (val == null || val === '') val = (h.key === 'capacidad' ? '—' : (h.key === 'nombre_tour' ? '—' : ''));
        const cell = row.getCell(i + 1);
        cell.value = val;
        if (h.key === 'fecha_salida' && val instanceof Date) cell.numFmt = 'yyyy-mm-dd';
        cell.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      });
      row.commit();
    });

    // Enviar Excel
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="salidas_ambos_${desde}_a_${hasta}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('❌ Error al generar Excel de salidas (Ambos):', err.message);
    res.status(500).json({ error: 'Error al generar Excel (Ambos)' });
  }
}