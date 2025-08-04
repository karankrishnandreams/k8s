import csvParser from "csv-parser";
import streamifier from "streamifier";
import XLSX from "xlsx";
import { Express } from "express";

const parseCSV = (buffer: Buffer): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    streamifier
      .createReadStream(buffer)
      .pipe(csvParser())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};

const parseFile = async (file: Express.Multer.File): Promise<any[]> => {
  const mimeType = file.mimetype;
  if (mimeType.includes("sheet") || file.originalname.endsWith(".xlsx")) {
    const workbook = XLSX.read(file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet);
  } else if (mimeType.includes("csv")) {
    return parseCSV(file.buffer);
  } else {
    throw new Error("Unsupported file format");
  }
};

interface ImportOptions {
  file: Express.Multer.File;
  uniqueFields: string[];         // Fields to check uniqueness on (individually)
  requiredFields: string[];      // Required fields
  validStatus: string[];         // Allowed status values
  transformRow: (row: any) => any; // Transform function for cleaned data
  existingRecords: any[];        // Existing records from DB [{category: 'val', categorySlug: 'val'}]
}

export const handleFileImport = async (options: ImportOptions) => {
  const {
    file,
    uniqueFields,
    requiredFields,
    validStatus,
    transformRow,
    existingRecords,
  } = options;

  const rows = await parseFile(file);

  if (!rows.length) {
    return { error: { status: 400, message: "Uploaded file is empty" } };
  }

  let validationErrors = 0;
  const validRows: any[] = [];

  // For checking duplicates in file per field
  const fileUniqueFieldValues: Record<string, Set<string>> = {};
  uniqueFields.forEach((field) => fileUniqueFieldValues[field] = new Set());

  // For checking duplicates in DB per field
  const dbUniqueFieldValues: Record<string, Set<string>> = {};
  uniqueFields.forEach((field) => {
    dbUniqueFieldValues[field] = new Set(
      existingRecords.map((record) => record[field]?.toString().trim())
    );
  });

  // Prepare valid statuses in lowercase
  const lowerValidStatus = validStatus.map((s) => s.toLowerCase());

  rows.forEach((row, idx) => {
    let rowErrors = 0;

    // Check required fields are present
    requiredFields.forEach((field) => {
      if (!row[field] || row[field].toString().trim() === "") {
        rowErrors++;
      }
    });

    // Check each unique field individually for duplicates
    uniqueFields.forEach((field) => {
      const value = row[field]?.toString().trim();
      if (value) {
        // Check in file
        if (fileUniqueFieldValues[field].has(value)) {
          rowErrors++;
        } else {
          fileUniqueFieldValues[field].add(value);
        }

        // Check in DB
        if (dbUniqueFieldValues[field].has(value)) {
          rowErrors++;
        }
      } else {
        // Unique field missing
        rowErrors++;
      }
    });

    // Status validation
    if (!row.status || !lowerValidStatus.includes(String(row.status).toLowerCase())) {
      rowErrors++;
    }

    if (rowErrors) {
      validationErrors++;
    } else {
      validRows.push(transformRow(row));
    }
  });

  return {
    cleanedData: validRows,
    validationErrors,
  };
};
