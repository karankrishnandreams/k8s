import { NextFunction, Request, Response } from "express";
import { Model } from "mongoose";
import { getDbConnection } from "@config/database";
import logger from "@utils/logger";
import TaxSchema from "@models/tax.model";
import createHttpError from "http-errors";
import { ERROR_MESSAGE } from "@utils/message.constant";
import { ITax } from "@interfaces/tax.interface";
import moment from "moment";
import kongAxios from "@services/kong.service";

const getTaxModel = (dbName: string): Model<ITax> => {
  const connection = getDbConnection(dbName);
  return connection.models.Note || connection.model<ITax>("Tax", TaxSchema);
};

const db_Name = process.env.DB_NAME;

export const createTax = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const body = req.body;

    const TaxModel = getTaxModel(dbName);

    const tax = new TaxModel({
      state: body.state,
      name: body.name,
      tax: body.tax,
      taxAccount: body.taxAccount,
      country: body.country,
      city: body.city, 
    });

    const savedTax = await tax.save();

    res.status(201).json({
      message: "Tax created successfully",
      data: savedTax,
    });
  } catch (error) {
    res.status(500).json({ message: "Error while creating tax", error });
  }
};

export const updateTax = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const taxId = req.params.id;
    const body = req.body;

    const TaxModel = getTaxModel(dbName);
    const tax = await TaxModel.findById(taxId);

    if (!tax) {
      res
        .status(200)
        .json({ status: 200, message: ERROR_MESSAGE.TAX_NOT_FOUND,data: []  });
      return;
    }

    tax.state = body.state;
    tax.name = body.name;
    tax.tax = body.tax;
    tax.taxAccount = body.taxAccount;
    tax.country = body.country;
    tax.city = body.city;

    const updatedTax = await tax.save();

    res.status(201).json({
      message: "Tax updated successfully",
      data: updatedTax,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTax = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const taxId = req.params.id;

    const TaxModel = getTaxModel(dbName);
    const tax = await TaxModel.findById(taxId);

    if (!tax) {
      res
        .status(200)
        .json({ status: 200, message: ERROR_MESSAGE.TAX_NOT_FOUND ,data: [] });
      return;
    }

    await tax.deleteOne();

    res.status(201).json({ message: "Tax deleted successfully" });
  } catch (err: any) {
    next(err);
  }
};

export const getTaxById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const taxId = req.params.id;

    const TaxModel = getTaxModel(dbName);

    const tax = await TaxModel.findById(taxId);

    if (!tax) {
      res
        .status(200)
        .json({ status: 200, message: ERROR_MESSAGE.TAX_NOT_FOUND, data: [] });
      return;
    }

    res.status(200).json({
      message: "Tax retrieved successfully",
      data: tax,
      type: "object",
    });
  } catch (err) {
    next(err);
  }
};

export const listTax = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const {
      search,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      disablePagination = false,
      limit = 10,
    } = req.query;

    const TaxModel = getTaxModel(dbName);

    // Build filter
    const filter: any = {};

    filter.deletedAt = null;
    // Search filter
    if (search) {
      const regex = new RegExp(search.toString().trim(), "i");
      filter.$or = [{ name: regex }, { taxAccount: regex }];
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
      sort.tax = 1;
    } else if (sortBy === "descending") {
      sort.tax = -1;
    }

    const pipeline: any = [
      { $match: filter },
      { $sort: sort },
      { $skip: skip },
      { $limit: Number(limit) },
    ];

    if (disablePagination == "true") {
      const allData = await TaxModel.find({});

      res.status(200).json({
        message: "All Tax retrieved successfully",
        data: allData,
        type: "array",
      });
      return;
    }

    // Query with population for assignee details
    const tax = await TaxModel.aggregate(pipeline);
    const total = await TaxModel.countDocuments(filter);

    const countryIds = [
      ...new Set(tax.map((item: any) => item.country).filter(Boolean)),
    ];

    let countryNameMap: Record<string, string> = {};

    if (countryIds.length) {
      try {
        const nameConfig = {
          method: "post",
          url: "/user/public/locations/names/by-ids",
          data: {
            countryIds,
          },
        };
        const response = await kongAxios(nameConfig);
        const locationData = response.data?.data || {};
        countryNameMap = locationData.countryNames || {};
      } catch (err) {
        console.warn("Failed to fetch location names", err);
      }
    }

    // 🔹 Add signed image + location names
    const transformedData = await Promise.all(
      tax.map(async (item: any) => {
        return {
          ...item,
          countryName: countryNameMap[item.country] || "",
        };
      })
    );

    res.status(200).json({
      message: "Tax retrieved successfully",
      data: transformedData,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getTaxByState = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const stateId = req.params.id;

    const TaxModel = getTaxModel(dbName);

    const tax = await TaxModel.findOne({ state: stateId });

    if (!tax) {
      res
        .status(200)
        .json({ status: 200, message: ERROR_MESSAGE.TAX_NOT_FOUND ,data: [] });
      return;
    }

    res.status(200).json({
      message: "Tax retrieved successfully",
      data: tax,
      type: "object",
    });
  } catch (err) {
    next(err);
  }
};
