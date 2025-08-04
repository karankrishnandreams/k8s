import { Schema } from "mongoose";
import { IManufacturer } from "@interfaces/manufacturer.interface";

const ManufacturerSchema: Schema<IManufacturer> = new Schema<IManufacturer>(
  {
    manufacturer: {
      type: String,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "manufacturers",
  }
);

export default ManufacturerSchema;
