import { Document, Types } from "mongoose";

export interface ITax extends Document {
  state: Types.ObjectId ;
  city:Types.ObjectId;
  name: string;
  tax: number;
  taxAccount: string;
  country: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
