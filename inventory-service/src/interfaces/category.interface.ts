import mongoose, { Types,Schema } from "mongoose";

export interface ICategory {
  category: string;
  categorySlug: string;
  status: 'Active'| 'Inactive';
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
