import { Document, Types } from "mongoose";

export interface IStockQty {
  warehouseId: Types.ObjectId;
  quantity: number;
}

export interface ISKU extends Document {
  skuCode: string;
  productName: string;
  category: Types.ObjectId;
  warehouse: Types.ObjectId;
  stockQty: number;
  reorderLevel?: number;
  status: "Active" | "Inactive";
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;

}
