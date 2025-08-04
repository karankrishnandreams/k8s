import mongoose, { ConnectOptions } from "mongoose";
import logger from "../utils/logger";
import dotenv from "dotenv";

dotenv.config();

// Default database name
const DEFAULT_DB_NAME = process.env.DB_NAME;

// Connection configuration
const defaultOptions: ConnectOptions = {
  dbName: DEFAULT_DB_NAME,
  maxPoolSize: 20,
  minPoolSize: 5,
  socketTimeoutMS: 30000,
  connectTimeoutMS: 5000,
  retryWrites: true,
  retryReads: true,
};

let defaultConnection: mongoose.Connection;
const switchedConnections: Map<string, mongoose.Connection> = new Map();

/**
 * Initialize the default database connection
 */
const connectToDatabase = async (): Promise<mongoose.Connection> => {
  const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27018";

  if (defaultConnection) {
    return defaultConnection;
  }

  try {
    defaultConnection = await mongoose.createConnection(
      MONGODB_URI,
      defaultOptions
    );

    logger.info(`Connected to MongoDB - Default DB: ${DEFAULT_DB_NAME}`);

    defaultConnection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    defaultConnection.on("disconnected", () => {
      logger.warn("MongoDB default connection disconnected");
    });

    return defaultConnection;
  } catch (error) {
    logger.error("MongoDB default connection failed:", error);
    process.exit(1);
  }
};

/**
 * Get a database connection
 * @param dbName Database name (defaults to DEFAULT_DB_NAME if null/undefined)
 */
const getDbConnection = (dbName?: string | null): mongoose.Connection => {
  if (!defaultConnection) {
    throw new Error(
      "Default database connection not initialized. Call connectToDatabase() first."
    );
  }

  // If dbName is null/undefined/empty, return default connection
  if (!dbName) {
    return defaultConnection;
  }

  // Return default connection if requested
  if (dbName === DEFAULT_DB_NAME) {
    return defaultConnection;
  }

  // Check if we already have a switched connection for this DB
  if (switchedConnections.has(dbName)) {
    return switchedConnections.get(dbName)!;
  }

  // Create and cache a new switched connection
  const switchedConnection = defaultConnection.useDb(dbName, {
    useCache: true,
  });

  switchedConnections.set(dbName, switchedConnection);
  logger.debug(`Created switched connection to database: ${dbName}`);

  return switchedConnection;
};

export { connectToDatabase, getDbConnection, DEFAULT_DB_NAME };
