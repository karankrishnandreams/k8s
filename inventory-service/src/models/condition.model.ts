import mongoose, { Schema, Document } from "mongoose";
import { ICondition } from "../interfaces/condition.interface";


const conditionSchema = new Schema<ICondition>(
  {
    name: { type: String, default:"" },
    description: { type: String,default:'' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default conditionSchema ;

