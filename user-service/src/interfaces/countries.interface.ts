import { Document, Types } from 'mongoose';

export interface ICountries extends Document {
  name: string;
  country_id: number;
  countryShortCode: string;
  countryShortCode1: string;
  countryPhoneCode: string;
  currency: string;
  timezones: Record<string, any>;
  latitude: string;
  longitude: string;
  // Instance methods
  softDelete(): Promise<void>; // Declaration of the softDelete method
}
