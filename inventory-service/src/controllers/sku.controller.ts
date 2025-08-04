import { Request, Response, NextFunction } from "express";
import { ISKU } from "@interfaces/sku.interface";
import { getDbConnection } from "@config/database";
import SKUSchema from "@models/sku.model";
import mongoose, { Model } from "mongoose";
import { paginate, paginateAggregate } from "@utils/paginate";
import logger from "@utils/logger";
import XLSX from "xlsx";
import csvParser from "csv-parser";
import streamifier from "streamifier";

export const getSKUModel = (dbName: string): Model<ISKU> => {
  const connection = getDbConnection(dbName);
  return connection.models.SKU || connection.model<ISKU>("SKU", SKUSchema);
};

export const createSKU = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const SKU = getSKUModel(dbName);
    const {
      skuCode,
      productName,
      category,
      warehouse,
      stockQty,
      reorderLevel,
      status,
      description,
    } = req.body;

    const existing = await SKU.findOne({ skuCode });
    if (existing) {
      logger.info(`Duplicate SKU attempt: ${skuCode}`);
      res.status(409).json({ message: "SKU already exists" });
    }

    const record = new SKU({
      skuCode,
      productName,
      category,
      warehouse,
      stockQty,
      reorderLevel,
      status,
      description,
    });
    await record.save();

    logger.info("SKU created successfully", { id: record._id });
    res
      .status(201)
      .json({ status: 201, message: "SKU created successfully", data: record });
  } catch (error) {
    logger.error("Error in createSKU", { error });
    next(error);
  }
};

export const getSKUById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const SKU = getSKUModel(dbName);

    const record = await SKU.findById(req.params.id);
    if (!record) {
      logger.warn("SKU not found", { id: req.params.id });
      res.status(404).json({ message: "SKU not found" });
    }

    logger.info("SKU fetched", { id: req.params.id });
    res
      .status(200)
      .json({ status: 200, message: "Fetched successfully", data: record });
  } catch (error) {
    logger.error("Error in getSKUById", { error });
    next(error);
  }
};

export const updateSKU = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const SKU = getSKUModel(dbName);

    const updated = await SKU.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!updated) {
      logger.warn("SKU not found for update", { id: req.params.id });
      res.status(404).json({ message: "SKU not found" });
    }

    logger.info("SKU updated", { id: req.params.id });
    res
      .status(201)
      .json({ status: 201, message: "Updated successfully", data: updated });
  } catch (error) {
    logger.error("Error in updateSKU", { error });
    next(error);
  }
};

export const deleteSKU = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const SKU = getSKUModel(dbName);

    const deleted = await SKU.findByIdAndDelete(req.params.id);
    if (!deleted) {
      logger.warn("SKU not found for deletion", { id: req.params.id });
      res.status(404).json({ message: "SKU not found" });
    }

    logger.info("SKU deleted", { id: req.params.id });
    res
      .status(201)
      .json({ status: 201, message: "Deleted successfully", data: deleted });
  } catch (error) {
    logger.error("Error in deleteSKU", { error });
    next(error);
  }
};

export const updateSKUStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const SKU = getSKUModel(dbName);
    const { status } = req.body;

    const updated = await SKU.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!updated) {
      logger.warn("SKU not found for status update", { id: req.params.id });
      res.status(404).json({ message: "SKU not found" });
    }

    logger.info("SKU status updated", { id: req.params.id, status });
    res
      .status(201)
      .json({ status: 201, message: "Status updated", data: updated });
  } catch (error) {
    logger.error("Error in updateSKUStatus", { error });
    next(error);
  }
};

export const listSKUs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const SKU = getSKUModel(dbName);

    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "10");
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) === "asc" ? "asc" : "desc";
    const search = (req.query.search as string) || "";
    const status = req.query.status as string;

    const match: any = {};
    if (status) match.status = status;

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "warehouses",
          localField: "warehouse",
          foreignField: "_id",
          as: "warehouseInfo",
        },
      },
      { $unwind: { path: "$warehouseInfo", preserveNullAndEmptyArrays: true } },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { skuCode: { $regex: search, $options: "i" } },
            { productName: { $regex: search, $options: "i" } },
            { "categoryInfo.category": { $regex: search, $options: "i" } }, // if field is "category"
            // { "categoryInfo.name": { $regex: search, $options: "i" } }, // use this if field is "name"
          ],
        },
      });
    }

    pipeline.push({
      $project: {
        skuCode: 1,
        productName: 1,
        stockQty: 1,
        reorderLevel: 1,
        status: 1,
        description: 1,
        createdAt: 1,
        category:1,
        warehouse:1,
        updatedAt: 1,
        categoryName: "$categoryInfo.category",
        warehouseName: "$warehouseInfo.name",
      },
    });

    const result = await paginateAggregate(SKU, pipeline, {
      page,
      limit,
      sortBy,
      order,
    });

    res.status(200).json({
      status: 200,
      message: "SKUs fetched successfully",
      ...result,
    });
  } catch (error) {
    logger.error("Error in listSKUs", { error });
    next(error);
  }
};



const parseCSV = (buffer: Buffer): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    streamifier
      .createReadStream(buffer)
      .pipe(csvParser())
      .on("data", (data: any) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
};

export const importSKUs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: string = req.headers["x-db-name"] as string;
    const SKUModel = getSKUModel(dbName);

    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    const mimeType = req.file.mimetype;
    let rows: Partial<ISKU>[] = [];

    // 1. Parse Excel or CSV
    if (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      req.file.originalname.endsWith(".xlsx")
    ) {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet) as Partial<ISKU>[];
    } else if (
      mimeType === "text/csv" ||
      req.file.originalname.endsWith(".csv")
    ) {
      rows = await parseCSV(req.file.buffer);
    } else {
      res.status(400).json({ message: "Unsupported file format" });
    }

    if (!rows.length) {
      res.status(400).json({ message: "Uploaded file is empty" });
    }

    // 2. Check duplicate skuCodes in file
    const fileSkuCodes = rows.map((row) => row.skuCode?.trim()).filter(Boolean);
    const duplicatesInFile = fileSkuCodes.filter(
      (code, idx, arr) => arr.indexOf(code) !== idx
    );
    if (duplicatesInFile.length > 0) {
      res.status(422).json({
        message: "Duplicate SKU Codes found in uploaded file",
        duplicates: [...new Set(duplicatesInFile)],
      });
    }

    // 3. Check DB duplicates
    const existingSKUs = await SKUModel.find(
      { skuCode: { $in: fileSkuCodes } },
      "skuCode"
    ).lean();
    if (existingSKUs.length > 0) {
      res.status(409).json({
        message: "Some SKU Codes already exist in the database",
        duplicates: existingSKUs.map((sku) => sku.skuCode),
      });
    }

    // 4. Validate required fields
    const requiredFields = [
      "skuCode",
      "productName",
      "category",
      "warehouse",
      "stockQty",
      "status",
    ];
    const validationErrors: any[] = [];

    rows.forEach((row, idx) => {
      const rowErrors: string[] = [];

      requiredFields.forEach((field) => {
        if (!row[field as keyof ISKU]) {
          rowErrors.push(`${field} is required`);
        }
      });

      if (
        row.status &&
        !["active", "inactive"].includes(String(row.status).toLowerCase())
      ) {
        rowErrors.push("Invalid status");
      }

      if (rowErrors.length > 0) {
        validationErrors.push({ row: idx + 2, errors: rowErrors });
      }
    });

    if (validationErrors.length > 0) {
      res.status(422).json({
        message: "Validation errors found in uploaded data",
        errors: validationErrors,
      });
    }

    // 5. Clean + transform rows
    const cleanedData: any[] = rows.map((row: any) => {
      const warehouseIds: any =
        typeof row.warehouse === "string"
          ? row.warehouse
              .split(",")
              .map((id: string) =>
                mongoose.Types.ObjectId.createFromHexString(id.trim())
              )
          : (row.warehouse as any[]).map((id: string) =>
              mongoose.Types.ObjectId.createFromHexString(id)
            );

      const parsedStockQty =
        typeof row.stockQty === "string"
          ? JSON.parse(row.stockQty)
          : row.stockQty;

      const formattedStockQty = (parsedStockQty || []).map((entry: any) => ({
        warehouseId: mongoose.Types.ObjectId.createFromHexString(
          entry.warehouseId
        ),
        quantity: Number(entry.quantity),
      }));

      return {
        skuCode: row.skuCode!.trim(),
        productName: row.productName!.trim(),
        category: new mongoose.Types.ObjectId(row.category),
        warehouse: warehouseIds,
        stockQty: formattedStockQty,
        reorderLevel: Number(row.reorderLevel || 0),
        status:
          row.status?.toString().toLowerCase() === "active"
            ? "Active"
            : "Inactive",
        description: row.description || "",
      };
    });

    // 6. Save to DB
    await SKUModel.insertMany(cleanedData);

    res.status(201).json({
      message: "SKUs imported successfully",
      count: cleanedData.length,
    });
  } catch (error) {
    next(error);
  }
};
