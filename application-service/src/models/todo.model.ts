import mongoose, { Schema, Document } from "mongoose";
import { ITodo } from "@interfaces/todo.interface";
import moment from "moment";

const CommentSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now, // Auto-set createdAt when comment is added
    },
  },
  { _id: false } // to avoid creating a separate _id for each comment if unnecessary
);

const TodoSchema: Schema<ITodo> = new Schema<ITodo>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  assignee: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  ],
  taskflow: {
    type: Schema.Types.ObjectId,
    required: false,
  },
  priority: {
    type: String,
    enum: ["High", "Medium", "Low", "Critical"],
    required: true,
  },
  due_date: {
    type: Date,
    required: true,
  },
  timeline: {
    start: {
      type: Date,
      required: false,
      default: null,
    },
    end: {
      type: Date,
      required: false,
      default: null,
    },
  },
  status: {
    type: String,
    enum: ["Completed", "Inprogress", "Blocked", "Todo"],
    default: "Todo",
    required: true,
  },
  description: {
    type: String,
    default: null,
    maxlength: 500,
  },
  is_important: {
    type: Number,
    default: 0,
  },
  comments: {
    type: [CommentSchema],
    default: undefined,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: () => moment().toDate(),
  },
  updatedAt: {
    type: Date,
    default: () => moment().toDate(),
  },
});

// Automatically update updatedAt before saving
TodoSchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// Soft delete method
TodoSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default TodoSchema;
