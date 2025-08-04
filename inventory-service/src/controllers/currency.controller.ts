import { Request, Response, NextFunction } from "express";
import currency from "../models/currency.model";
import logger from "../utils/logger";
import { getDbConnection } from "@config/database";
import currencySchema from "../models/currency.model";
import { Model } from "mongoose";
import { paginate } from "@utils/paginate";
import { Icurrency } from "@interfaces/currency.interface";

export const getcurrencyModel = (dbName: string): Model<Icurrency> => {
  const connection = getDbConnection(dbName);
  return connection.model<Icurrency>("currency", currencySchema as any);
};

export const createcurrency = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const currencies = getcurrencyModel(dbName);
    const { currency, value } = req.body;

    const filter = {
      currency,
      deletedAt: null,
    };

    const updatedCurrency = await currencies.findOneAndUpdate(
      filter,
      { $set: { value } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    logger.info(`Currency created or updated successfully`);

    res.status(201).json({
      status: 201,
      message: "Currency created or updated successfully",
      data: updatedCurrency,
    });
  } catch (err: any) {
    logger.error(`Failed to create/update currency: ${err.message}`);
    next(err);
  }
};
  

export const listcurrencies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const currency = getcurrencyModel(dbName);

    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "10");
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) === "asc" ? "asc" : "desc";
    const search = (req.query.search as string) || "";
    const status = req.query.status as string;
    const disablePagination = req.query.disablePagination;

    // Build filter
    const filter: any = {};
    if (search) {
      filter.currency = { $regex: search, $options: "i" };
    }
    if (disablePagination) {
      const data = await currency
        .find({ deletedAt: null })
        .sort({ [sortBy]: order === "asc" ? 1 : -1 });
      logger.info(`Fetched all filtered currency for DB: ${dbName}`);
      res.status(200).json({
        status: 200,
        message: "currency fetched successfully",
        data,
      });
      return;
    }
    const result = await paginate(currency, filter, {
      page,
      limit,
      sortBy,
      order,
    });

    logger.info(`Fetched paginated currencys for DB: ${dbName}`);
    res.status(200).json({
      status: 200,
      message: "currencies fetched successfully",
      ...result,
    });
  } catch (err: any) {
    logger.error(`Failed to fetch paginated currencys: ${err.message}`);
    next(err);
  }
};

export const getcurrencyById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const currency = getcurrencyModel(dbName);

    const currencies = await currency.findById(req.params.id);
    if (!currencies) {
      logger.warn(`currency not found: ID ${req.params.id}`);
      res.status(404).json({
        status: 404,
        message: "currency not found",
      });
    }
    logger.info(`Fetched currency: ${currency?.name}`);
    res.status(200).json({
      status: 200,
      message: "Fetched currency successfully",
      data: currencies,
    });
  } catch (err: any) {
    logger.error(`Failed to get currency: ${err.message}`);
    next(err);
  }
};
