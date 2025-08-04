import { Document, Types } from 'mongoose';

export interface IState extends Document {
  name: string;
  state_id: number;
  countryCode: string;
  stateCode: string;
  parent: number;
  latitude: string;
  longitude: string;
  // Instance methods
  softDelete(): Promise<void>; // Declaration of the softDelete method
}
