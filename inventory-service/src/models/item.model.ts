import { Schema } from "mongoose";
import { IItem } from "@interfaces/item.interface";
import moment from "moment";

const ItemSchema: Schema<IItem> = new Schema<IItem>(
  {
    itemName: { type: String, required: true },
    manufacturer: { type: Schema.Types.ObjectId, ref: "Manufacturer", required: true },
    clei: { type: Boolean, default: false },
    type: { type: String, required: false, default: null },
    description: { type: String },
    extDescription: { type: String },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    image: [{ type: String }],
    warehouse: { type: Schema.Types.ObjectId, ref: "Warehouse", required: false, default: null },
    country: { type: Schema.Types.ObjectId, ref: "country", required: false, default: null },
    nonInventory: { type: Boolean, default: false },
    heci: { type: String },
    itemGLCode: { type: String, required: false, default: null },
    weight: { type: Number },
    primaryLocation: { type: String },
    taxGoodCategory: { type: String },
    status: { type: String, default: "Active" },

    createdAt: { type: Date, default: () => moment().toDate() },
    updatedAt: { type: Date, default: () => moment().toDate() },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: false,
  }
);

// Auto-update updatedAt
ItemSchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// Soft delete
ItemSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default ItemSchema;
