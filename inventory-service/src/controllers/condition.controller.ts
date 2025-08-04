import { Request, Response, NextFunction } from "express";
import condition from "../models/condition.model";
import logger from "../utils/logger";
import { getDbConnection } from "@config/database";
import conditionSchema from "../models/condition.model";
import { Model } from "mongoose";
import { paginate } from "@utils/paginate";
import { ICondition } from "@interfaces/condition.interface";

export const getconditionModel = (dbName: string): Model<ICondition> => {
  const connection = getDbConnection(dbName);
  return connection.model<ICondition>("condition", conditionSchema as any);
};

export const createcondition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const condition = getconditionModel(dbName);
    const { name } = req.body;

    // 🔍 Check if condition already exists (case-insensitive) and not soft-deleted
    const existing = await condition.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      deletedAt: null,
    });

    if (existing) {
      logger.warn(`Condition name already exists: ${name}`);
      res.status(409).json({
        status: 409,
        message: "Condition name already exists",
      });
      return;
    }
    const conditions = await condition.create(req.body);
    logger.info(`condition created: ${condition.name}`);
    res.status(201).json({
      status: 201,
      message: "condition created successfully",
      data: conditions,
    });
  } catch (err: any) {
    logger.error(`Failed to create condition: ${err.message}`);
    next(err);
  }
};

export const listconditions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const condition = getconditionModel(dbName);

    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "10");
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = (req.query.order as string) === "asc" ? "asc" : "desc";
    const search = (req.query.search as string) || "";
    const status = req.query.status as string;
    // Ensure disablePagination is a boolean
    const disablePagination = req.query.disablePagination;
    // Build filter
    const filter: any = {};
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (disablePagination) {
      const data = await condition
        .find({ deletedAt: null })
        .sort({ [sortBy]: order === "asc" ? 1 : -1 });
      logger.info(`Fetched all filtered conditions for DB: ${dbName}`);
      res.status(200).json({
        status: 200,
        message: "Conditions fetched successfully",
        data,
      });
      return;
    }
    const result = await paginate(condition, filter, {
      page,
      limit,
      sortBy,
      order,
    });

    logger.info(`Fetched paginated conditions for DB: ${dbName}`);
    res.status(200).json({
      status: 200,
      message: "conditions fetched successfully",
      ...result,
    });
  } catch (err: any) {
    logger.error(`Failed to fetch paginated conditions: ${err.message}`);
    next(err);
  }
};

export const getconditionById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const condition = getconditionModel(dbName);

    const conditions = await condition.findById(req.params.id);
    if (!conditions) {
      logger.warn(`condition not found: ID ${req.params.id}`);
      res.status(404).json({
        status: 404,
        message: "condition not found",
      });
    }
    logger.info(`Fetched condition: ${condition?.name}`);
    res.status(200).json({
      status: 200,
      message: "Fetched condition successfully",
      data: conditions,
    });
  } catch (err: any) {
    logger.error(`Failed to get condition: ${err.message}`);
    next(err);
  }
};
