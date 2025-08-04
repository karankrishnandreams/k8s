import mongoose, { Types,Schema } from "mongoose";

export interface INotes {
  title: string;
  tag: string;
  userId: Types.ObjectId;
  priority: "High" | "Medium" | "Low" | "Critical";
  due_date?: Date | null;
  status: 'Completed'| 'Pending' | 'Onhold' | 'Inprogress'| 'Blocked'| 'Todo';
  description?: string | null;
  is_important: number | 0 | 1;
  is_read: number | 0 | 1;
  updatedBy?: Types.ObjectId | null;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date; 
}
