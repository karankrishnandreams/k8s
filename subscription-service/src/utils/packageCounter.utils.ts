import { getDbConnection } from "@config/database";
import { CounterPackageSchema } from "@models/CounterPackage.model";

export const getPackageCounterModel = (dbName: string) => {
  const connection = getDbConnection(dbName);

  // Create model if not already created, passing the schema
  return (
    connection.models.CounterPackage ||
    connection.model("CounterPackage", CounterPackageSchema)
  );
};
