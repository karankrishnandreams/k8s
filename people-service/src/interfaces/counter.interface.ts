import mongoose, { Schema, Document } from "mongoose";

export interface ICounter extends Document {
  type: string;
  seq: number;
}
