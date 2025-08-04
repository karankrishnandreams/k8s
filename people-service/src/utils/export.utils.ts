import ExcelJS from 'exceljs';
import { NextFunction, Response } from 'express';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';


export const generateExcelDownload = async (
  res: Response,
  data: any[],
  fileLabel = "export" // default fallback
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(fileLabel);

  const allKeys = Array.from(
    new Set(data.flatMap((item) => Object.keys(item)))
  );

  worksheet.columns = allKeys.map((key) => ({
    header: key,
    key,
    width: 30,
  }));

  data.forEach((item) => {
    const row: Record<string, any> = {};

    allKeys.forEach((key) => {
      const val = item[key];
      row[key] =
        Array.isArray(val)
          ? val.join(", ")
          : typeof val === "object" && val !== null
          ? JSON.stringify(val)
          : val ?? "";
    });

    worksheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${fileLabel}-${Date.now()}.xlsx`
  );

  res.send(buffer);
};


export const generatePdfDownload = async (
  res: Response,
  data: any[] = [],
  fileLabel = 'Export'
) => {
  if (!data.length) {
    res.status(400).send('No data to export');
    return;
  }

  const excludedFields = ['__v', '_id', 'password', 'deletedAt', 'isDeleted'];
  const columns = Object.keys(data[0]).filter(
    (key) => !excludedFields.includes(key)
  );

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 30,
  });

  const buffers: any[] = [];
  doc.on('data', (chunk) => buffers.push(chunk));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(buffers);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileLabel}-${Date.now()}.pdf"`
    );
    res.send(pdfBuffer);
  });

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = pageWidth / columns.length;
  let y = 50;

  // Title
  doc.fontSize(18).text(`${fileLabel.replace(/_/g, ' ')} Report`, {
    align: 'center',
  });
  y += 20;

  // Header
  const headerHeight = 25;
  doc.fillColor('#3f51b5').rect(doc.page.margins.left, y, pageWidth, headerHeight).fill();
  doc.fontSize(11).fillColor('white');

  columns.forEach((col, i) => {
    const x = doc.page.margins.left + i * columnWidth;
    const label = col
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase());
    doc.text(label, x + 5, y + 7, {
      width: columnWidth - 10,
      align: 'left',
    });
  });

  y += headerHeight;

  // Data Rows
  doc.fontSize(10);

  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    const isEvenRow = rowIndex % 2 === 0;

    // Measure height of each cell's text
    const cellHeights = columns.map((col) => {
      let value = row[col];
      if (Array.isArray(value)) value = value.join(', ');
      else if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
      else if (value == null) value = '';
      return doc.heightOfString(String(value), {
        width: columnWidth - 10,
      });
    });

    const rowHeight = Math.max(...cellHeights) + 10;

    // Add new page if needed
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = 50;
    }

    // Alternate row background
    if (isEvenRow) {
      doc.fillColor('#f3f3f3').rect(doc.page.margins.left, y, pageWidth, rowHeight).fill();
    }

    // Row text
    doc.fillColor('black');

    columns.forEach((col, i) => {
      const x = doc.page.margins.left + i * columnWidth;
      let value = row[col];
      if (Array.isArray(value)) value = value.join(', ');
      else if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
      else if (value == null) value = '';

      doc.text(String(value), x + 5, y + 5, {
        width: columnWidth - 10,
        align: 'left',
      });
    });

    y += rowHeight;
  }

  doc.end();
};


