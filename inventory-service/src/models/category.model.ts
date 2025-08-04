import mongoose, { Schema, Document } from "mongoose";
import { ICategory } from "@interfaces/category.interface";
import moment from "moment";

const CategorySchema = new Schema<ICategory>({
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  categorySlug: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: "Active",
    required: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: () => moment().toDate()
  },
  updatedAt: {
    type: Date,
    default: () => moment().toDate()
  }
});

// Automatically update updatedAt before saving
CategorySchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// Soft delete method
CategorySchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default CategorySchema;
