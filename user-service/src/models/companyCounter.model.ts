// models/companyCounter.ts
import { Schema, model } from "mongoose";

export interface ICounter {
  _id: string;
  seq: number;
}

const companyCounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true }, // For example: 'company_id'
  seq: { type: Number, default: 0 },
});


export default companyCounterSchema;
