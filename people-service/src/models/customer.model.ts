import { ICustomer } from "@interfaces/customer.interface";
import mongoose, { Schema, Document } from "mongoose";

const CustomerSchema = new Schema<ICustomer>(
  {
    type: { type: String, enum: ["client", "vendor"] },
    code: { type: String, unique: true },
    companyName: { type: String },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    preTitle: { type: String, default: null },
    // vendorCode: { type: String, default: null },
    currency: { type: Schema.Types.ObjectId, ref: "currencies", required: false, default: null },
    email: { type: String, unique: true },
    phone: { type: String, default: null },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },
    status: { type: String, enum: ["active", "inactive"] },
    customer_image: { type: String, default: null },
    secureCV: { type: Boolean, default: false },
    r2Approved: { type: Boolean, default: false },
    r2ApprovedDate: { type: Date, default: null },
    iso9001: { type: Boolean, default: false },
    iso9001Date: { type: Date, default: null },
    iso14001: { type: Boolean, default: false },
    iso14001Date: { type: Date, default: null },
    iso45001: { type: Boolean, default: false },
    iso45001Date: { type: Date, default: null },
    createdUser: { type: Schema.Types.ObjectId, ref: "users", required: true },  
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default CustomerSchema;
