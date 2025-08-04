import ExcelJS from 'exceljs';
import { NextFunction, Response } from 'express';
import PDFDocument, { image } from 'pdfkit';
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




import puppeteer from "puppeteer";


export const generatePdfBufferFromHtml = async (
  html: string
): Promise<Buffer> => {
  
  let browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ["-no-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: {
      top: "20px",
      bottom: "20px",
      left: "20px",
      right: "20px",
    },
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
};

export const generateInvoiceHtml = (data: Record<string, string>) => {
    // Use the logo.svg from the images folder in the same directory
    const fs = require("fs");
    const logoFilePath = require("path").join(__dirname, "images", "logo.svg");
    const logoBase64 = fs.readFileSync(logoFilePath, "utf8");
    const logoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(logoBase64)}`;

  return `  
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; }
      .header { display: flex; justify-content: space-between; align-items: center; }
      .section { margin-bottom: 20px; }
      .label { font-weight: bold; color: #1b2850; }
      .value { color: #646b72; }
      .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; }
      .logo { height: 60px; }
    </style>
  </head>
  <body>
    <div class="header">
      <img src="${logoDataUri}" alt="Company Logo" class="logo" />
      <div>
        <h2>${data.invoice_label}</h2>
        <p>Issue Date: ${data.billed_date}</p>
      </div>
    </div>

    <div class="section">
      <div class="label">transaction receipt From:</div>
      <div class="value">${data.super_admin_name}</div>
    </div>
    <div class="section">
      <div class="label">transaction receipt To:</div>
      <div class="value">${data.company_name} (${data.company_email})</div>
    </div>

    <div class="section">
      <table style="width:100%; border-collapse: collapse;">
        <tr style="background: #f0f0f0;">
          <th style="text-align:left; padding: 8px;">Plan</th>
          <th style="text-align:left; padding: 8px;">Billing Cycle</th>
          <th style="text-align:left; padding: 8px;">Created Date</th>
          <th style="text-align:left; padding: 8px;">Expiring On</th>
          <th style="text-align:left; padding: 8px;">Amount</th>
        </tr>
        <tr>
          <td style="padding: 8px;">${data.plan_name} (${data.plan_type})</td>
          <td style="padding: 8px;">${data.billing_cycle}</td>
          <td style="padding: 8px;">${data.created_date}</td>
          <td style="padding: 8px;">${data.expiry_date}</td>
          <td style="padding: 8px;">${data.amount}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="label">Payment Info:</div>
      <div class="value">${data.payment_method}</div>
      <div class="value">Sub Total: ${data.sub_total}</div>
      <div class="value">Tax: ${data.tax}</div>
      <div class="value"><strong>Total: ${data.total}</strong></div>
    </div>

    <div class="footer">
      <p><strong>Terms & Conditions:</strong></p>
      <p>• All payments must be made according to the agreed schedule.</p>
      <p>• We are not liable for any indirect, incidental, or consequential damages.</p>
    </div>
  </body>
  </html>
  `;
};


export const generateSubscriptionHtml = (data: Record<string, string>): string => {
 
      const fs = require("fs");
    const logoFilePath = require("path").join(__dirname, "images", "logo.svg");
    const logoBase64 = fs.readFileSync(logoFilePath, "utf8");
    const logoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(logoBase64)}`;

 
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; }
      .header { display: flex; justify-content: space-between; align-items: center; }
      .logo { height: 60px; }
      .section { margin-bottom: 20px; }
      .label { font-weight: bold; color: #1b2850; }
      .value { color: #646b72; }
      .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style>
  </head>
  <body>
    <div class="header">
      <img src="${logoDataUri}" alt="Company Logo" class="logo" />
      <div>
        <p>Issue Date: ${data.billed_date}</p>
      </div>
    </div>

    <div class="section">
      <div class="label">From:</div>
      <div class="value">${data.super_admin_name}</div>
    </div>

    <div class="section">
      <div class="label">To:</div>
      <div class="value">${data.company_name} (${data.company_email})</div>
    </div>

    <div class="section">
      <table style="width:100%; border-collapse: collapse;">
        <tr style="background: #f0f0f0;">
          <th style="text-align:left; padding: 8px;">Plan</th>
          <th style="text-align:left; padding: 8px;">Billing Cycle</th>
          <th style="text-align:left; padding: 8px;">Created Date</th>
          <th style="text-align:left; padding: 8px;">Expiring On</th>
          <th style="text-align:left; padding: 8px;">Amount</th>
        </tr>
        <tr>
          <td style="padding: 8px;">${data.plan_name}</td>
          <td style="padding: 8px;">${data.billing_cycle}</td>
          <td style="padding: 8px;">${data.created_date}</td>
          <td style="padding: 8px;">${data.expiry_date}</td>
          <td style="padding: 8px;">${data.amount}</td>
        </tr>
      </table>
    </div>

    <div class="section">
      <div class="label">Payment Info:</div>
      <div class="value">Method: ${data.payment_method}</div>
      <div class="value">Sub Total: ${data.sub_total}</div>
      <div class="value">Tax: ${data.tax}</div>
      <div class="value"><strong>Total: ${data.total}</strong></div>
    </div>

    <div class="footer">
      <p><strong>Terms & Conditions:</strong></p>
      <p>• All payments must be made according to the agreed schedule.</p>
      <p>• We are not liable for any indirect, incidental, or consequential damages.</p>
    </div>
  </body>
  </html>
  `;
};
