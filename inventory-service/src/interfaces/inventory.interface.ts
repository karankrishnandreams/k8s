import mongoose, { Types, Schema } from "mongoose";

export interface IInventory {
  item: Types.ObjectId;
  purchaseNumber: string;
  wareHouse: Types.ObjectId;
  condition:Types.ObjectId;
  inventoryno: string;
  pp?: Types.ObjectId;
  po?: Types.ObjectId;
  serialNumber?: string;
  sequenceNumber?: number;
  itemDescription?: string;
  status: 'Available' | 'Reserved' | 'Sold';
  receivedStatus: "In Transit" | "Received" | "Canceled";
  cost:Number;
  originalCost:Number;
  conditionDate : Date;
  location:String;
  reservedAt?: Date;
  soId: Types.ObjectId;
  invno: string;
  inventoryComments:string;
  internalComments:string;
  createdAt?: Date;
  updatedAt?: Date;
}