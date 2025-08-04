import { Document, Types } from "mongoose";

export interface IItem extends Document {
  itemName: string;
  manufacturer: Types.ObjectId;
  clei?: boolean;
  type?: string;
  description?: string;
  extDescription?: string;
  category: Types.ObjectId;
  image?: string[]; // file URLs
  warehouse?: Types.ObjectId;
  country?: Types.ObjectId;
  nonInventory?: boolean;
  heci?: string;
  itemGLCode?: string;
  weight?: number;
  primaryLocation?: string;
  taxGoodCategory?: string;
  status?: string;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}
