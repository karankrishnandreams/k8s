import mongoose, { Schema, Document } from "mongoose";
import { INotes } from "@interfaces/notes.interface";
import moment from "moment";

const NotesSchema = new Schema<INotes>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
 userId: {
    type: Schema.Types.ObjectId,
    required:false,
    ref: "User"
  },
  tag: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ["High", "Medium", "Low", "Critical"],
    required: true
  },
  due_date: { 
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Completed', 'Pending', 'Onhold', 'Inprogress', 'Blocked', 'Todo'],
    default: "Todo",
    required: true
  },
  description: {
    type: String,
    default: null,
  },
  is_important: {
    type: Number,
    default: 0,
  },
  is_read: {
    type: Number,
    default: 0,
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null
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
NotesSchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// Soft delete method
NotesSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default NotesSchema;
