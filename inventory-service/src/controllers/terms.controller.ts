import { Request, Response, NextFunction } from "express";
import Term from "../models/term.model";
import logger from "../utils/logger";
import { ITerm } from "@interfaces/term.interface";
import { getDbConnection } from "@config/database";
import TermSchema from "../models/term.model";
import { Model } from "mongoose";
import { paginate } from "@utils/paginate";

export const getTermModel = (dbName: string): Model<ITerm> => {
  const connection = getDbConnection(dbName);
  return connection.model<ITerm>("Term", TermSchema as any);
};

export const createTerm = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Term = getTermModel(dbName);
    const { name } = req.body;

    // 🔍 Check if term name already exists (case-insensitive) and not soft-deleted
    const existing = await Term.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      deletedAt: null,
    });

    if (existing) {
      logger.warn(`Term name already exists: ${name}`);
      res.status(409).json({
        status: 409,
        message: "Term name already exists",
      });
      return;
    }
    const term = await Term.create(req.body);
    logger.info(`Term created: ${term.name}`);
    res.status(201).json({
      status: 201,
      message: "Term created successfully",
      data: term,
    });
  } catch (err: any) {
    logger.error(`Failed to create term: ${err.message}`);
    next(err);
  }
};

export const listTerms = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const Term = getTermModel(dbName);

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
      filter.name = { $regex: search, $options: "i" };
    }
    if (disablePagination) {
      const data = await Term.find({ deletedAt: null }).sort({
        [sortBy]: order === "asc" ? 1 : -1,
      });
      logger.info(`Fetched all filtered Term for DB: ${dbName}`);
      res.status(200).json({
        status: 200,
        message: "Terms fetched successfully",
        data,
      });
      return;
    }
    const result = await paginate(Term, filter, {
      page,
      limit,
      sortBy,
      order,
    });

    logger.info(`Fetched paginated terms for DB: ${dbName}`);
    res.status(200).json({
      status: 200,
      message: "Terms fetched successfully",
      ...result,
    });
  } catch (err: any) {
    logger.error(`Failed to fetch paginated terms: ${err.message}`);
    next(err);
  }
};

export const getTermById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Term = getTermModel(dbName);

    const term = await Term.findById(req.params.id);
    if (!term) {
      logger.warn(`Term not found: ID ${req.params.id}`);
      res.status(404).json({
        status: 404,
        message: "Term not found",
      });
    }
    logger.info(`Fetched term: ${term?.name}`);
    res.status(200).json({
      status: 200,
      message: "Fetched term successfully",
      data: term,
    });
  } catch (err: any) {
    logger.error(`Failed to get term: ${err.message}`);
    next(err);
  }
};
