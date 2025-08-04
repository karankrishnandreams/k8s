import { getDbConnection } from "@config/database";
import { ICounter } from "@interfaces/counter.interface";
import CounterSchema from "@models/counter.model";
import createHttpError from "http-errors";
import { Model } from "mongoose";

// Get Counter model from specific DB
const getCounterModel = (dbName: string): Model<ICounter> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Counter || connection.model<ICounter>("counters", CounterSchema)
  );
};

// Generate numeric code per type/client/vendor
export const generateCode = async (
  type: "client" | "vendor",
  dbName: string
): Promise<string> => {
  try {
    const Counter = getCounterModel(dbName); // get correct counter model per DB

    const counter = await Counter.findOneAndUpdate(
      { type },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    if (!counter) throw createHttpError(400, "Failed to generate code");

    // choose prefix
    const prefix = type === "client" ? "CLI" : "VEN";

    // format number part to always be at least 3 digits (e.g., 001, 023, 120)
    const numberPart = counter.seq.toString().padStart(3, "0");

    return `${prefix}${numberPart}`;
  } catch (err) {
    console.error("❌ generateCode error:", err);
    throw err;
  }
};
