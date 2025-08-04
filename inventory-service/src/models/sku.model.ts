import { Schema } from "mongoose";
import { ISKU } from "@interfaces/sku.interface";

const SKUSchema: Schema<ISKU> = new Schema<ISKU>(
  {
    skuCode: {
      type: String,
      trim: true,
    },
    productName: {
      type: String,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
    },
    warehouse:
      {
        type: Schema.Types.ObjectId,default:null
      },
    
    stockQty: {type:Number,default:0},
    reorderLevel: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    description: {
      type: String,
      trim: true,
    },
        deletedAt: { type: Date, default: null },

  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "skus",
  }
);

export default SKUSchema;
