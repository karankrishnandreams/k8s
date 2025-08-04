import { getDbConnection } from '../config/database';
import { ClinicCounterSchema } from '../models/clinicCounter.model'; // Assuming you have the schema exported

// Get ClinicCounter model for a specific database
export const getClinicCounterModel = (dbName: string) => {
  const connection = getDbConnection(dbName);

  // Create model if not already created, passing the schema
  return connection.models.ClinicCounter || connection.model('ClinicCounter', ClinicCounterSchema);
};
