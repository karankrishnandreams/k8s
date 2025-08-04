import mongoose, { Schema, Document } from "mongoose";
import { ITempInventory } from "@interfaces/tempinventory.interface";
import moment from "moment";

const TempInventorySchema = new Schema<ITempInventory>({
  item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
  wareHouse: { type: Schema.Types.ObjectId, ref: "Warehouse", required: true },
  purchaseNumber: { type: String, required: true },
  pp: { type: Schema.Types.ObjectId, ref: "PurchasePlan", required: false },
  condition: { type: Schema.Types.ObjectId, ref: "conditions", required: false },
  serialNumber: { type: String, required: false },
  cost : {type:Number, required:false},
  originalCost : {type:Number, required:false},
  conditionDate : {type:Date, required:false},
  location : {type:String, required:false},
  inventoryComments : {type:String, required:false},
  itemDescription : {type:String, required:false},
  internalComments : {type:String, required:false},
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
TempInventorySchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// Soft delete method (optional, if you want to add deletedAt)
TempInventorySchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default TempInventorySchema;