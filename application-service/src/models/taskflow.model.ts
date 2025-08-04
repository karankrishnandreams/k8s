import mongoose, { Schema, Document } from "mongoose";
import { ITaskflow } from "@interfaces/taskflow.interface";
import moment from "moment";

const taskflowSchema = new Schema<ITaskflow>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  description: {
    type: String,
    default: null,
    maxlength:255 
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
taskflowSchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// Soft delete method
taskflowSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save(); 
};

export default taskflowSchema;
