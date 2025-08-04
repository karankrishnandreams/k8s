import ExcelJS from "exceljs";
import { NextFunction, Response } from "express";
import PDFDocument from "pdfkit";
import puppeteer from "puppeteer";

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
      row[key] = Array.isArray(val)
        ? val.join(", ")
        : typeof val === "object" && val !== null
          ? JSON.stringify(val)
          : (val ?? "");
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
  fileLabel = "Export"
) => {
  if (!data.length) {
    res.status(400).send("No data to export");
    return;
  }

  const excludedFields = ["__v", "_id", "password", "deletedAt", "isDeleted"];
  const columns = Object.keys(data[0]).filter(
    (key) => !excludedFields.includes(key)
  );

  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margin: 30,
  });

  const buffers: any[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));
  doc.on("end", () => {
    const pdfBuffer = Buffer.concat(buffers);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileLabel}-${Date.now()}.pdf"`
    );
    res.send(pdfBuffer);
  });

  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = pageWidth / columns.length;
  let y = 50;

  // Title
  doc.fontSize(18).text(`${fileLabel.replace(/_/g, " ")} Report`, {
    align: "center",
  });
  y += 20;

  // Header
  const headerHeight = 25;
  doc
    .fillColor("#3f51b5")
    .rect(doc.page.margins.left, y, pageWidth, headerHeight)
    .fill();
  doc.fontSize(11).fillColor("white");

  columns.forEach((col, i) => {
    const x = doc.page.margins.left + i * columnWidth;
    const label = col
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase());
    doc.text(label, x + 5, y + 7, {
      width: columnWidth - 10,
      align: "left",
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
      if (Array.isArray(value)) value = value.join(", ");
      else if (typeof value === "object" && value !== null)
        value = JSON.stringify(value);
      else if (value == null) value = "";
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
      doc
        .fillColor("#f3f3f3")
        .rect(doc.page.margins.left, y, pageWidth, rowHeight)
        .fill();
    }

    // Row text
    doc.fillColor("black");

    columns.forEach((col, i) => {
      const x = doc.page.margins.left + i * columnWidth;
      let value = row[col];
      if (Array.isArray(value)) value = value.join(", ");
      else if (typeof value === "object" && value !== null)
        value = JSON.stringify(value);
      else if (value == null) value = "";

      doc.text(String(value), x + 5, y + 5, {
        width: columnWidth - 10,
        align: "left",
      });
    });

    y += rowHeight;
  }

  doc.end();
};

type Vendor = {
  userName: any;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
};

type WareHouse = {
  name: string;
  address1: string;
  cityName: string;
  stateName: string;
  countryName: string;
  zipcode: string;
};

type Rep = {
  name: string;
};

type Terms = {
  name: string;
};

type Tax = {
  name: string;
};

type Item = {
  item: { name: string };
  condition: { name: string };
  quantity: number;
  purchaseCostCAD: number;
  extendedCostCAD: number;
  purchaseCostUSD: number;
  extendedCostUSD: number;
  saleExtendedCostCAD?: number;
  saleExtendedCostUSD?: number;
  saleCostCAD?: number;
  saleCostUSD?: number;
};

type InvoiceData = {
  saleExtendedCostCAD: any;
  company: any;
  so: any;
  clientInfo?: any;
  baseAmount: any;
  CAD: any;
  clientSalesInfo: any;
  itemId: any;
  date: string;
  status: string;
  receive: string;
  purchaseType: string;
  saleType?: string;
  vendor: Vendor;
  vendorSO: string;
  wareHouse: WareHouse;
  shipDate: string;
  rep: Rep;
  terms: Terms;
  tax: Tax;
  items: Item[];
  extendedCost: number;
  saleExtendedCost?: number;
  type?: string;
  freight: number;
  extraCost: number;
  subTotal: number;
  total: number;
  internalComment?: string;
};

export const generateInvoiceHtml = (data: InvoiceData) => {
  try {
    const fs = require("fs");
    const logoFilePath = require("path").join(__dirname, "images", "logo.svg");
    const logoBase64 = fs.readFileSync(logoFilePath, "utf8");
    const logoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(logoBase64)}`;

    return `  
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 25px; color: #333; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .logo { height: 40px; }
    .title { font-size: 18px; font-weight: bold; color: #1b2850; }
    .section { margin-bottom: 15px; }
    .label { font-weight: bold; color: #1b2850; margin-bottom: 2px; }
    .value { color: #646b72; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
    th { background: #f0f0f0; font-size: 11px; }
    td { font-size: 11px; }
    .footer { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 6px; font-size: 10px; color: #777; }
  
    /* New styles for summary alignment */
    .summary-section {
      display: flex;
      justify-content: flex-end;
    }
    .summary-box {
      text-align: right;
      max-width: 250px;
    }
  </style>
  </head>
  <body>
    <div class="header">
      <img src="${logoDataUri}" alt="Company Logo" class="logo" />
      <div>
        <div class="title">Purchase Order</div>
        <div class="value">Date: ${new Date(data.date).toLocaleDateString()}</div>
        <div class="value">Status: ${data.status} | Receive: ${data.receive}</div>
        <div class="value">PO Type: ${data.purchaseType.toUpperCase()}</div>
      </div>
    </div>
  
    <div class="section">
      <div class="label">Vendor:</div>
      <div class="value">${data.vendor.name}</div>
      <div class="value">${data.vendor.firstName} ${data.vendor.lastName} | ${data.vendor.email} | ${data.vendor.phone}</div>
      <div class="value">${data.vendor.address}</div>
      <div class="value">Vendor SO: ${data.vendorSO}</div>
    </div>
  
    <div class="section">
      <div class="label">Items:</div>
      <table>
        <tr>
          <th>Item Name</th>
          <th>Condition</th>
          <th>Qty</th>
          <th>Cost (CAD)</th>
          <th>Ext. Cost (CAD)</th>
          <th>Cost (USD)</th>
          <th>Ext. Cost (USD)</th>
        </tr>
        ${data.items
        .map(
          (item) => `
        <tr>
          <td>${item.item.name}</td>
          <td>${item.condition.name}</td>
          <td>${item.quantity}</td>
          <td>${item.purchaseCostCAD}</td>
          <td>${item.extendedCostCAD}</td>
          <td>${item.purchaseCostUSD}</td>
          <td>${item.extendedCostUSD}</td>
        </tr>`
        )
        .join("")}
      </table>
    </div>
  
    <div class="section summary-section">
      <div class="summary-box">
        <div class="label">Summary:</div>
        <div class="value">Extended Cost: ${data.extendedCost}</div>
        <div class="value">Freight: ${data.freight}</div>
        <div class="value">Extra Cost: ${data.extraCost}</div>
        <div class="value">Subtotal: ${data.subTotal}</div>
        <div class="value"><strong>Total: ${data.total}</strong></div>
      </div>
    </div>
  
    <div class="footer">
      <p><strong>Internal Comment:</strong> ${data.internalComment || "-"}</p>
      <p>• All items must be checked upon receipt.</p>
      <p>• Goods are subject to terms and conditions of sale.</p>
    </div>
  </body>
  </html>
    `;
  } catch (error) {
    console.log('error ----', error);
  }
};

export const generateSaleInvoiceHtml = (data: InvoiceData) => {
  // Use the logo.svg from the images folder in the same directory
  const fs = require("fs");
  const logoFilePath = require("path").join(__dirname, "images", "logo.svg");
  const logoBase64 = fs.readFileSync(logoFilePath, "utf8");
  const logoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(logoBase64)}`;

  return `  
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 25px; color: #333; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .logo { height: 40px; }
  .title { font-size: 18px; font-weight: bold; color: #1b2850; }
  .section { margin-bottom: 15px; }
  .label { font-weight: bold; color: #1b2850; margin-bottom: 2px; }
  .value { color: #646b72; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
  th { background: #f0f0f0; font-size: 11px; }
  td { font-size: 11px; }
  .footer { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 6px; font-size: 10px; color: #777; }
</style>
</head>
<body>
  <div class="header">
    <img src="${logoDataUri}" alt="Company Logo" class="logo" />
    <div>
      <div class="title">Sales Order</div>
      <div class="value">Date: ${new Date(data.date).toLocaleDateString()}</div>
      <div class="value">SO Type: ${(data.type || "").toUpperCase()}</div>
    </div>
  </div>

  <div class="section">
    <div class="label">client:</div>
    <div class="value">${data.clientInfo[0].firstName} ${data.clientInfo[0].lastName}</div>
    <div class="value">${data.clientInfo[0].email}</div>
    <div class="value">${data.clientInfo[0].phone}</div>
    <div class="value">${data.clientInfo[0].address}</div>
  </div>

  

  <div class="section">
    <div class="label">Items:</div>
    <table>
      <tr>
        <th>Item Name</th>
        <th>Qty</th>
        <th>Cost</th>
      </tr>
      ${data.itemId
      .map(
        (item: any) => `
      <tr>
        <td>${item.itemDetails?.itemName}</td>
        <td>${(
            data.clientSalesInfo?.[0]?.items?.find(
              (i: any) =>
                i.item?.toString?.() === item.itemDetails?._id?.toString?.()
            )?.quantity || 0
          )
          }</td>
        <td>${item.amount || 0}</td>
      </tr>`
      )
      .join("")}
      
    </table>
  </div>

  <div class="section">
    <div class="label">Summary:</div>
    <div class="value">Amount: ${data.baseAmount}</div>
    <div class="value">Tax: ${data.tax}</div>
    <div class="value">CAD: ${data.CAD}</div>
    <div class="value">Subtotal: ${data.subTotal}</div>
    <div class="value"><strong>Total: ${data.total}</strong></div>
  </div>

  <div class="footer">
    <p><strong>Internal Comment:</strong> ${data.internalComment || "-"}</p>
    <p>• All items must be checked upon receipt.</p>
    <p>• Goods are subject to terms and conditions of sale.</p>
  </div>
</body>
</html>
  `;
};

export const generateFullSaleInvoiceHtml = (data: InvoiceData) => {
  // Use the logo.svg from the images folder in the same directory
  const fs = require("fs");
  const logoFilePath = require("path").join(__dirname, "images", "logo.svg");
  const logoBase64 = fs.readFileSync(logoFilePath, "utf8");
  const logoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(logoBase64)}`;

  return `  
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; padding: 25px; color: #333; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .logo { height: 40px; }
  .title { font-size: 18px; font-weight: bold; color: #1b2850; }
  .section { margin-bottom: 15px; }
  .label { font-weight: bold; color: #1b2850; margin-bottom: 2px; }
  .value { color: #646b72; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
  th { background: #f0f0f0; font-size: 11px; }
  td { font-size: 11px; }
  .footer { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 6px; font-size: 10px; color: #777; }
</style>
</head>
<body>
  <div class="header">
    <img src="${logoDataUri}" alt="Company Logo" class="logo" />
    <div>
      <div class="title">Sales Order</div>
      <div class="value">Date: ${new Date(data.date).toLocaleDateString()}</div>
      <div class="value">Status: ${data.status}</div>
      <div class="value">SO Type: ${(data.saleType || '').toUpperCase()}</div>
    </div>
  </div>

  <div class="section">
    <div class="label">Vendor:</div>
    <div class="value">${data.vendor.name}</div>
    <div class="value">${data.vendor.firstName} ${data.vendor.lastName} | ${data.vendor.email} | ${data.vendor.phone}</div>
    <div class="value">${data.vendor.address}</div>
    <div class="value">Order No: ${data.so}</div>
  </div>

  <div class="section">
    <div class="label">Company:</div>
    <div class="value">${data.company.name}</div>
    <div class="value">${data.company.email}</div>
    <div class="value">Address: ${data.company.address}</div>
    <div class="value">Ship Date: ${new Date(data.date).toLocaleDateString()}</div>
  </div>

  <div class="section">
    <div class="label">Items:</div>
    <table>
      <tr>
        <th>Item Name</th>
        <th>Condition</th>
        <th>Qty</th>
        <th>Cost (CAD)</th>
        <th>Ext. Cost (CAD)</th>
        <th>Cost (USD)</th>
        <th>Ext. Cost (USD)</th>
      </tr>
      ${data.items
      .map(
        (item) => `
      <tr>
        <td>${item.item.name}</td>
        <td>${item.condition.name}</td>
        <td>${item.quantity}</td>
        <td>${item.saleCostCAD || 0}</td>
        <td>${item.saleExtendedCostCAD || 0}</td>
        <td>${item.saleCostUSD || 0}</td>
        <td>${item.saleExtendedCostUSD || 0}</td>
      </tr>`
      )
      .join("")}
    </table>
  </div>

  <div class="section">
    <div class="label">Summary:</div>
    <div class="value">Freight: ${data.freight}</div>
    <div class="value">Extra Cost: ${data.extraCost}</div>
    <div class="value">Subtotal: ${data.subTotal}</div>
    <div class="value"><strong>Total: ${data.total}</strong></div>
  </div>

  <div class="footer">
    <p><strong>Internal Comment:</strong> ${data.internalComment || "-"}</p>
    <p>• All items must be checked upon receipt.</p>
    <p>• Goods are subject to terms and conditions of sale.</p>
  </div>
</body>
</html>
  `;
};

export const generatePdfBufferFromHtml = async (
  html: string
): Promise<Buffer> => {
  let browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
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
