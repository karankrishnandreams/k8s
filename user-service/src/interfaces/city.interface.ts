import { Document, Types } from 'mongoose';

export interface ICity extends Document {
  name: string;
  city_id: number;
  stateCode: string;
  country_id: string;
  country_code: string;
  parent: number;
  isActive: boolean;
  latitude: string;
  longitude: string;
  // Instance methods
  softDelete(): Promise<void>; // Declaration of the softDelete method
}
