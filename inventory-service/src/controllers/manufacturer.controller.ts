import { Request, Response, NextFunction } from "express";
import { IManufacturer } from "@interfaces/manufacturer.interface";
import { getDbConnection } from "@config/database";
import ManufacturerSchema from "@models/manufacturer.model";
import { Model } from "mongoose";
import { paginate } from "@utils/paginate";
import moment from "moment";
import {
  generateExcelDownload,
  generatePdfDownload,
} from "@utils/export.utils";
import logger from "@utils/logger";
import { handleFileImport } from "@utils/import.utils";
import createHttpError from "http-errors";

export const getManufacturerModel = (dbName: string): Model<IManufacturer> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Manufacturer ||
    connection.model<IManufacturer>("Manufacturer", ManufacturerSchema)
  );
};

const db_Name = process.env.DB_NAME;

export const createManufacturer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Manufacturer = getManufacturerModel(dbName);

    const { manufacturer, full_name, status } = req.body;

    if (!full_name || !manufacturer) {
       res.status(400).json({ message: "Full name and manufacturer are required" });
       return;
    }

    // Prevent exact match in full_name
    const existingFullName = await Manufacturer.findOne({
      full_name: { $regex: new RegExp(`^${full_name}$`, "i") },
      deletedAt: null,
    });
    if (existingFullName) {
       res.status(409).json({ message: "Full name already exists" });
      return;
    }

    // Prevent exact match in manufacturer
    const existingManufacturer = await Manufacturer.findOne({
      manufacturer: { $regex: new RegExp(`^${manufacturer}$`, "i") },
      deletedAt: null,
    });
    if (existingManufacturer) {
       res.status(409).json({ message: "Manufacturer already exists" });
       return;
    }

    // Prevent full_name == existing manufacturer
    const crossMatch1 = await Manufacturer.findOne({
      manufacturer: { $regex: new RegExp(`^${full_name}$`, "i") },
      deletedAt: null,
    });
    if (crossMatch1) {
       res.status(409).json({ message: "Full name already used as a manufacturer" });
       return;
    }

    // Prevent manufacturer == existing full_name
    const crossMatch2 = await Manufacturer.findOne({
      full_name: { $regex: new RegExp(`^${manufacturer}$`, "i") },
      deletedAt: null,
    });
    if (crossMatch2) {
       res.status(409).json({ message: "Manufacturer already used as a full name" });
       return;
    }

    const record = new Manufacturer({ manufacturer, full_name, status });
    await record.save();

    res.status(201).json({
      status: 201,
      message: "Manufacturer created successfully",
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

export const getManufacturerById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Manufacturer: any = getManufacturerModel(dbName);

    const record = await Manufacturer.findOne({
      _id: req.params.id,
      deletedAt: null,
    });
    if (!record) res.status(404).json({ message: "Manufacturer not found" });

    res
      .status(200)
      .json({ status: 200, message: "Fetched successfully", data: record });
  } catch (error) {
    next(error);
  }
};

export const updateManufacturer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Manufacturer = getManufacturerModel(dbName);

    const existing = await Manufacturer.findOne({
      _id: req.params.id,
      deletedAt: null,
    });
    if (!existing) res.status(404).json({ message: "Manufacturer not found" });

    const updated = await Manufacturer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.status(201).json({
      status: 201,
      message: "Updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteManufacturer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Manufacturer = getManufacturerModel(dbName);
    const { id } = req.params;

    const existing = await Manufacturer.findOne({ _id: id, deletedAt: null });
    if (!existing) {
      res.status(404).json({ message: "Manufacturer not found" });
    }

    const deletedManufacturer = await Manufacturer.findByIdAndUpdate(
      id,
      { deletedAt: moment().toDate() },
      { new: true }
    );

    res.status(201).json({
      status: 201,
      message: "Manufacturer deleted (soft)",
      data: deletedManufacturer,
    });
  } catch (error) {
    next(error);
  }
};

export const updateManufacturerStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Manufacturer = getManufacturerModel(dbName);

    const { status } = req.body;
    if (!["active", "inactive"].includes(status)) {
      res.status(400).json({ message: "Invalid status value" });
    }

    const updated = await Manufacturer.findOneAndUpdate(
      { _id: req.params.id, deletedAt: null },
      { status },
      { new: true }
    );

    if (!updated) res.status(404).json({ message: "Manufacturer not found" });

    res
      .status(201)
      .json({ status: 201, message: "Status updated", data: updated });
  } catch (error) {
    next(error);
  }
};

export const listManufacturers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Manufacturer = getManufacturerModel(dbName);

    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "10");
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) === "asc" ? "asc" : "desc";
    const search = (req.query.search as string) || "";
    const status = req.query.status as string;

    // Building filter
    const filter: any = { deletedAt: null };

    if (search) {
      filter.$or = [
        { manufacturer: { $regex: search, $options: "i" } },
        { full_name: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    const result = await paginate(Manufacturer, filter, {
      page,
      limit,
      sortBy,
      order,
    });

    res.status(200).json({
      status: 200,
      message: "Manufacturers fetched successfully",
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

export const exportManufacturers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Manufacturer = getManufacturerModel(dbName);

    const format = req.params.export?.toLowerCase() || "excel"; // default to excel
    const filter: any = { deletedAt: null };

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      const search = req.query.search.toString();
      filter.$or = [
        { manufacturer: { $regex: search, $options: "i" } },
        { full_name: { $regex: search, $options: "i" } },
      ];
    }

    const manufacturers = await Manufacturer.find(filter, {
      manufacturer: 1,
      full_name: 1,
      status: 1,
      createdAt: 1,
    })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = manufacturers.map((item) => ({
      Manufacturer: item.manufacturer,
      Full_Name: item.full_name,
      Status: item.status,
      Created_At: moment(item.createdAt).format("YYYY-MM-DD"),
    }));

    if (format === "pdf") {
      await generatePdfDownload(res, formatted, "Manufacturers");
    } else {
      await generateExcelDownload(res, formatted, "Manufacturers");
    }
  } catch (error: any) {
    logger.error("Export Manufacturers failed", error);
    res.status(500).json({
      message: "Failed to export manufacturers",
      error: error.message,
    });
  }
};

export const importManufacturers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: string = req.headers["x-db-name"] as string;
    const ManufacturersModel = getManufacturerModel(dbName);

    if (!req.file) {
      throw createHttpError(404, "No file uploaded");
    }

    // Fetch existing categories for uniqueness validation
    const existingManufacturers = await ManufacturersModel.find(
      { deletedAt: null },
      "manufacturer full_name"
    ).lean();

    // Convert existing DB records to array of objects for per-field uniqueness checking
    const existingRecords = existingManufacturers.map((man) => ({
      manufacturer: man.manufacturer?.toString().trim(),
      full_name: man.full_name?.toString().trim(),
    }));

    const { cleanedData, validationErrors } = await handleFileImport({
      file: req.file,
      uniqueFields: ["manufacturer", "full_name"], // Each field checked individually
      requiredFields: ["manufacturer", "full_name", "status"],
      validStatus: ["active", "inactive"],
      existingRecords, // passed as array of objects now (not composite keys)
      transformRow: (row) => ({
        manufacturer: row.manufacturer.trim(),
        full_name: row.full_name.trim(),
        status:
          row.status?.toString().toLowerCase() === "active"
            ? "active"
            : "inactive",
        createdAt: moment().toDate(),
        updatedAt: moment().toDate(),
      }),
    });

    if (cleanedData && cleanedData.length > 0) {
      await ManufacturersModel.insertMany(cleanedData);
    }

    res.status(201).json({
      message:
        cleanedData && cleanedData.length > 0
          ? "Import completed with partial success"
          : "All records failed validation",
      insertedCount: cleanedData?.length ?? 0,
      notInsertedCount: validationErrors,
    });
  } catch (error) {
    next(error);
  }
};

export const sampleManufacturersImport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sampleData = [
      {
        manufacturer: "sample manufacturer 1",
        full_name: "sample full_name 1",
        status: "active",
      },
      {
        manufacturer: "sample manufacturer 2",
        full_name: "sample full_name 2",
        status: "active",
      },
      {
        manufacturer: "sample manufacturer 3",
        full_name: "sample full_name 3",
        status: "inactive",
      },
    ];

    await generateExcelDownload(res, sampleData, "Manufacturers");
  } catch (error) {
    next(error);
  }
};
