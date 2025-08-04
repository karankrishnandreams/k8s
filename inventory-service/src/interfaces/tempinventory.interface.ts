import mongoose, { Types,Schema } from "mongoose";

export interface ITempInventory {
  item: Types.ObjectId;
  purchaseNumber: string;
  wareHouse: Types.ObjectId;
  condition:Types.ObjectId;
  pp?: Types.ObjectId;
  serialNumber?: string;
  cost:Number;
  originalCost:Number;
  conditionDate : Date;
  location:String;
  inventoryComments:string;
  itemDescription?:string;
  internalComments:string;
  createdAt?: Date;
  updatedAt?: Date;
}