import mongoose, { Schema, Document } from "mongoose";
import { Icurrency } from "../interfaces/currency.interface";


const currencySchema = new Schema<Icurrency>(
  {
    currency: { type: String, default:"" },
    value: { type: String,default:'' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default currencySchema ;

