import { Document, Types } from "mongoose";

export interface IWarehouse extends Document {
  name: string;
  description: string;
  contactPerson: Types.ObjectId;
  phoneNumber?: string;
  email?: string;
  address: string;
  country: Types.ObjectId;
  state: Types.ObjectId;
  city: Types.ObjectId;
  zipcode: string; 
  status: "Active" | "Inactive";
  createdAt?: Date;
  updatedAt?: Date;
}