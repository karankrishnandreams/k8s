import { NextFunction, Request, Response } from "express";
import { Model, Types } from "mongoose";
import mongoose from "mongoose";
import { getDbConnection } from "@config/database";
import logger from "@utils/logger";
import CategorySchema from "@models/category.model";
import createHttpError from "http-errors";
import { ERROR_MESSAGE } from "@utils/message.constant";
import { ICategory } from "@interfaces/category.interface";
import moment from "moment";
import {
  generateExcelDownload,
  generatePdfDownload,
} from "@utils/export.utils";
import { handleFileImport } from "@utils/import.utils";

const getCategoryModel = (dbName: string): Model<ICategory> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Note ||
    connection.model<ICategory>("Category", CategorySchema)
  );
};

const db_Name = process.env.DB_NAME;

export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const body = req.body;

    const CategoryModel = getCategoryModel(dbName);

    const category = new CategoryModel({
      category: body.category,
      categorySlug: body.categorySlug,
      status: body.status,
    });

    const savedCategory = await category.save();

    res.status(201).json({
      message: "Category created successfully",
      data: savedCategory,
    });
  } catch (error) {
    res.status(500).json({ message: "Error while creating category", error });
  }
};

export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const categoryId = req.params.id;
    const body = req.body;

    const CategoryModel = getCategoryModel(dbName);
    const category = await CategoryModel.findById(categoryId);

    if (!category) {
      throw createHttpError(404, ERROR_MESSAGE.CATEGORY_NOT_FOUND);
    }

    category.category = body.category;
    category.categorySlug = body.categorySlug;
    category.status = body.status;

    const updatedCategory = await category.save();

    res.status(201).json({
      message: "Category updated successfully",
      data: updatedCategory,
    });
  } catch (error) {    
    res.status(500).json({ message: "Error while updating category", error });
    return;
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const categoryId = req.params.id;

    const CategoryModel = getCategoryModel(dbName);
    const category = await CategoryModel.findById(categoryId);

    if (!category) {
      throw createHttpError(404, ERROR_MESSAGE.CATEGORY_NOT_FOUND);
    }

    category.deletedAt = moment().toDate();
    await category.save();

    res.status(201).json({ message: "Category deleted successfully" });
  } catch (err: any) {
    res
      .status(500)
      .json({ message: "Error while deleting category", error: err.message });
  }
};

export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const categoryId = req.params.id;

    const CategoryModel = getCategoryModel(dbName);

    const category = await CategoryModel.findById(categoryId);

    if (!category) {
      throw createHttpError(404, ERROR_MESSAGE.CATEGORY_NOT_FOUND);
    }

    res.status(200).json({
      message: "Category retrieved successfully",
      data: category,
      type: "object",
    });
  } catch (err) {
    next(err);
  }
};

export const listCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const {
      search,
      status = "All",
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      disablePagination = false,
      limit = 10,
    } = req.query;

    const CategoryModel = getCategoryModel(dbName);

    // Build filter
    const filter: any = {};

    filter.deletedAt = null;
    // Search filter
    if (search) {
      const regex = new RegExp(search.toString().trim(), "i");
      filter.$or = [
        { category: regex },
        { categorySlug: regex },
        { status: regex },
      ];
    }

    // Sorting
    const sort: any = {};
    sort[sortBy as string] = order === "asc" ? 1 : -1;

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const now = moment();

    if (sortBy === "last_7_days" || sortBy === "last7days") {
      const startDate = now.clone().subtract(7, "days").startOf("day").toDate();
      const endDate = now.endOf("day").toDate();
      filter.createdAt = { $gte: startDate, $lte: endDate };
    } else if (sortBy === "last_month" || sortBy === "lastmonth") {
      const startDate = now
        .clone()
        .subtract(1, "month")
        .startOf("month")
        .toDate();
      const endDate = now.clone().subtract(1, "month").endOf("month").toDate();
      filter.createdAt = { $gte: startDate, $lte: endDate };
    } else if (sortBy === "last_year" || sortBy === "lastyear") {
      const startDate = now
        .clone()
        .subtract(1, "year")
        .startOf("year")
        .toDate();
      const endDate = now.clone().subtract(1, "year").endOf("year").toDate();
      filter.createdAt = { $gte: startDate, $lte: endDate };
    } else if (sortBy === "recently_added") {
      // const startDate = now.clone().subtract(1, "hour").toDate();
      // const endDate = now.toDate();
      // filter.createdAt = { $gte: startDate, $lte: endDate };
      sort.createdAt = -1;
    } else if (sortBy === "ascending") {
      sort.category = 1;
    } else if (sortBy === "descending") {
      sort.category = -1;
    }

    if (status === "Active" || status === "Inactive") filter.status = status;

    const pipeline: any = [
      { $match: filter },
      { $sort: sort },
      { $skip: skip },
      { $limit: Number(limit) },
    ];

    if (disablePagination == "true") {
      const allData = await CategoryModel.find({});

      res.status(200).json({
        message: "All Category retrieved successfully",
        data: allData,
        type: "array",
      });
      return;
    }

    // Query with population for assignee details
    const category = await CategoryModel.aggregate(pipeline);
    const total = await CategoryModel.countDocuments(filter);

    res.status(200).json({
      message: "Category retrieved successfully",
      data: category,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Error while listing notes", error });
  }
};

// Function to create slug from name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove special chars except hyphen
    .replace(/\s+/g, "-") // replace spaces with hyphen
    .replace(/-+/g, "-"); // remove multiple hyphens
};

export const getSlug = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const name = req.params.name;
    const id = req.params.id; // Optional in route

    if (!name) {
      res.status(400).json({ message: "Name parameter is required" });
      return;
    }

    const CategoryModel = getCategoryModel(dbName);
    const slug = generateSlug(name);

    // Build query condition
    const query: any = { categorySlug: slug };

    // If ID provided and valid, exclude this document from uniqueness check
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      query._id = { $ne: id };
    }

    const existingCategory = await CategoryModel.findOne(query);

    if (existingCategory) {
      res.status(409).json({
        message: "Slug already exists. Please choose a different name.",
      });
      return;
    }

    res.status(200).json({
      message: "Slug generated successfully",
      slug,
    });
    return;
  } catch (error) {
    res.status(500).json({ message: "Error while generating slug", error });
    return;
  }
};

export const exportCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Category = getCategoryModel(dbName);

    const exportType = req.params.export;

    // Fetch all data without pagination
    const data = await Category.find({ deletedAt: null }).lean();

    if (data.length == 0) {
      throw createHttpError(404, "No records in category");
    }
    // Handle export
    if (exportType === "excel") {
      return await generateExcelDownload(res, data, `Category_list`);
    } else if (exportType === "pdf") {
      return await generatePdfDownload(res, data, `Category_list`);
    }

    // Regular JSON response fallback (optional)
    res.status(200).json({
      status: 200,
      message: "Fetched successfully",
      data: data,
    });
  } catch (error) {
    next(error);
  }
};

export const categoryUpdateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Category = getCategoryModel(dbName);
    const { id } = req.params;
    let { status } = req.body;

    if (typeof status === "string") {
      const normalized = status.trim().toLowerCase();
      if (normalized === "active") status = "Active";
      else if (normalized === "inactive") status = "Inactive";
    }

    if (!["Active", "Inactive"].includes(status)) {
      res.status(400).json({
        message: "Invalid status value. Must be 'Active' or 'Inactive'.",
      });
      return;
    }

    // Check if category exists
    const existing = await Category.findOne({ _id: id, deletedAt: null });
    if (!existing) {
      res.status(404).json({ message: "category not found" });
    }

    // Update status only
    const updated = await Category.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    res.status(201).json({
      status: 201,
      message: "Status updated successfully",
      data: updated,
    });
  } catch (error) {
    logger.error("Failed to update category status", error);
    return next(error);
  }
};

export const importCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: string = req.headers["x-db-name"] as string;
    const CategoryModel = getCategoryModel(dbName);

    if (!req.file) {
      throw createHttpError(404, "No file uploaded");
    }

    // Fetch existing categories for uniqueness validation
    const existingCategories = await CategoryModel.find(
      {},
      "category categorySlug"
    ).lean();

    // Convert existing DB records to array of objects for per-field uniqueness checking
    const existingRecords = existingCategories.map((cat) => ({
      category: cat.category?.toString().trim(),
      categorySlug: cat.categorySlug?.toString().trim(),
    }));

    const { cleanedData, validationErrors } = await handleFileImport({
      file: req.file,
      uniqueFields: ["category", "categorySlug"], // Each field checked individually
      requiredFields: ["category", "categorySlug", "status"],
      validStatus: ["Active", "Inactive"],
      existingRecords, // passed as array of objects now (not composite keys)
      transformRow: (row) => ({
        category: row.category.trim(),
        categorySlug: row.categorySlug.trim(),
        status:
          row.status?.toString().toLowerCase() === "active"
            ? "Active"
            : "Inactive",
        createdAt: moment().toDate(),
        updatedAt: moment().toDate(),
      }),
    });

    // if (cleanedData && cleanedData.length > 0) {
    //   await CategoryModel.insertMany(cleanedData);
    // }

    // res.status(201).json({
    //   message:
    //     (cleanedData && cleanedData.length > 0)
    //       ? "Import completed with partial success"
    //       : "All records failed validation",
    //   insertedCount: cleanedData?.length ?? 0,
    //   notInsertedCount: validationErrors,
    // });

    if (cleanedData && cleanedData.length > 0) {
      await CategoryModel.insertMany(cleanedData);
      res.status(201).json({
        message: "Import completed with partial success",
        insertedCount: cleanedData.length,
        notInsertedCount: validationErrors,
      });
      return;
    }

    // If no valid data to insert
    res.status(400).json({
      message: "All records failed validation",
      insertedCount: 0,
      notInsertedCount: validationErrors,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const sampleCategoryImport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sampleData = [
      {
        category: "test",
        categorySlug: "test",
        status: "Active",
      },
      {
        category: "test1",
        categorySlug: "test-1",
        status: "Active",
      },
      {
        category: "sample category",
        categorySlug: "sample-category",
        status: "Inactive",
      },
    ];

    await generateExcelDownload(res, sampleData, "Category");
    // res.status(200).json({ message: "Sample data fetched successfully", data: "sampleData" });
  } catch (error) {
    next(error);
  }
};
