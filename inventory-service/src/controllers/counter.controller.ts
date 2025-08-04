import { getDbConnection } from "@config/database";
import { ICounter } from "@interfaces/counter.interface";
import CounterSchema from "@models/counter.model";
import logger from "@utils/logger";
import { paginate } from "@utils/paginate";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { Model } from "mongoose";


const getCounterModel = (dbName: string): Model<ICounter> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Counter ||
    connection.model<ICounter>("counters", CounterSchema)
  );
};

export const updateCounterConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const Counter = getCounterModel(dbName);

    const { type, seq, digits } = req.body;

    if (!type) {
      logger.warn("Counter update failed: type is required");
      throw createHttpError(400, "Counter type is required.");
    }

    logger.info(`Received update request for counter type "${type}"`);

    // Fetch existing counter
    const existingCounter = await Counter.findOne({ type });
    console.log('existingCounter: ', existingCounter);

    if (!existingCounter) {
      const newCounter = await Counter.create({
        type,
        seq: typeof seq === "number" ? seq : 0,
        digits: typeof digits === "number" ? digits : 0,
      });

      logger.info(`Created new counter for type "${type}":`, newCounter.toObject());

      res.status(201).json({
        status: 201,
        message: `Counter for type "${type}" created successfully.`,
        data: newCounter,
      });
      return;
    }

    const updateFields: Partial<{ seq: number; digits: number }> = {};
    console.log('seq', seq);
    if (typeof seq === "number") {
      if (seq > existingCounter.seq) {
        updateFields.seq = seq;
      } else {
        logger.warn(
          `Attempt to decrease 'seq' for type "${type}": new=${seq}, existing=${existingCounter.seq}`
        );
        throw createHttpError(
          400,
          `New seq (${seq}) must be greater than current (${existingCounter.seq}).`
        );
      }
    }

    if (typeof digits === "number") {
      const existingDigits = existingCounter.get("digits") ?? 0;
      if (digits > existingDigits) {
        updateFields.digits = digits;
      } else {
        logger.warn(
          `Attempt to decrease 'digits' for type "${type}": new=${digits}, existing=${existingDigits}`
        );
        throw createHttpError(
          400,
          `New digits (${digits}) must be greater than current (${existingDigits}).`
        );
      }
    }

    const updated = await Counter.findOneAndUpdate(
      { type },
      { $set: updateFields },
      { new: true }
    );

    logger.info(`Counter for type "${type}" updated successfully:`, updateFields);

    res.status(201).json({
      status: 201,
      message: `Counter for type "${type}" updated successfully.`,
      data: updated,
    });
  } catch (error) {
    logger.error("Error updating counter:", error);
    next(error);
  }
};


export const listCounterConfigs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const Counter = getCounterModel(dbName);

    const {
      page = 1,
      limit = 10,
      search = "",
      disablePagination = false,
    } = req.query;

    const query: any = {};
    if (search) {
      query.type = { $regex: search as string, $options: "i" };
    }

    const sort: { [key: string]: 1 | -1 } = { type: 1 };

    if (disablePagination === "true") {
      const data = await Counter.find(query).sort(sort).lean();
      logger.info(`Fetched all counter configs (no pagination): ${data.length}`);
      res.status(200).json({
        status: 200,
        message: "Counter list fetched successfully",
        data,
      });
    } else {
      const paginated = await paginate(Counter, query, {
        page: Number(page),
        limit: Number(limit)
      });

      logger.info(`Fetched paginated counter configs (page ${page}): ${paginated.data.length}`);
      res.status(200).json({
        status: 200,
        message: "Counter list fetched successfully",
        ...paginated,
      });
    }
  } catch (error) {
    logger.error("Error fetching counter configs:", error);
    next(error);
  }
};
