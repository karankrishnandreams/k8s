import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICustomer extends Document {
  type: "client" | "vendor";
  code: string;
  companyName: string;
  firstName?: string;
  lastName?:string;
  preTitle?: string;
  // vendorCode?: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  currency?: Types.ObjectId;
  status: "active" | "inactive";
  secureCV: boolean;
  r2Approved: boolean
  r2ApprovedDate: Date;
  iso9001: boolean
  iso9001Date: Date;
  iso14001: boolean
  iso14001Date: Date;
  iso45001: boolean
  iso45001Date: Date;
  customer_image?: string;
  deletedAt?: Date;
  createdUser?: Types.ObjectId;
}