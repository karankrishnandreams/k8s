import mongoose, { Types, Schema } from "mongoose";

export interface ITodo {
  title: string;
  assignee: Types.ObjectId[]; // Should be an array because in your schema 'assignee' is an array
  taskflow?: Types.ObjectId | null;
  priority: "High" | "Medium" | "Low" | "Critical";
  due_date?: Date | null;
  timeline?: {
    start?: Date | null;
    end?: Date | null;
  };
  status: "Completed" | "Pending" | "Onhold" | "Inprogress" | "Blocked" | "Todo";
  description?: string | null;
  is_important: number | 0 | 1;
  comments?: {
    userId: Types.ObjectId;
    comment: string;
    createdAt?: Date; // Added createdAt to each comment
  }[] | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
