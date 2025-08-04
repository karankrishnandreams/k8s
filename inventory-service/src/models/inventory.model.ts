import mongoose, { Schema, Document } from "mongoose";
import { IInventory } from "@interfaces/inventory.interface";
import moment from "moment";

const InventorySchema = new Schema<IInventory>({
  item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
  wareHouse: { type: Schema.Types.ObjectId, ref: "Warehouse", required: false },
  condition: { type: Schema.Types.ObjectId, ref: "conditions", required: false },
  purchaseNumber: { type: String, required: true },
  pp: { type: Schema.Types.ObjectId, ref: "PurchasePlan", required: false },
  po: { type: Schema.Types.ObjectId, ref: "PurchaseOrder", required: false },
  serialNumber: { type: String, required: false },
  inventoryno: { type: String, required: true },
  sequenceNumber: { type: Number, required: false },
  invno: { type: String, required: false },
  itemDescription: { type: String, required: false },
  inventoryComments: { type: String, required: false },
  internalComments: { type: String, required: false },
  cost: { type: Number, required: false },
  originalCost: { type: Number, required: false },
  location: { type: String, required: false },
  status: {
    type: String,
    enum: ["Available","Reserved","Sold"],
    required: true,
    default: "Available"
  },
  receivedStatus: {
    type: String,
    enum: ["In Transit", "Received","Canceled"],
    required: false
  },
  reservedAt: {
    type: Date,
  },
  conditionDate: {
    type: Date,
  },
  soId: { type: Schema.Types.ObjectId, ref: "SalesOrder", required: false },
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
InventorySchema.pre("save", function (next) {
  this.updatedAt = moment().toDate()
;
  next();
});

// Soft delete method (optional, if you want to add deletedAt)
InventorySchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate()
;
  await this.save();
};

export default InventorySchema;