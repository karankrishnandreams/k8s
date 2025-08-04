import mongoose, { Schema, Document } from "mongoose";
import { ITerm } from "../interfaces/term.interface";

export interface ITermDocument extends ITerm, Document {
  deletedAt?: Date | null;
}

const TermSchema = new Schema<ITermDocument>(
  {
    name: { type: String, default:"" },
    description: { type: String,default:'' },
    days: { type: Number ,default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default TermSchema;

