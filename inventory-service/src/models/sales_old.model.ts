import mongoose, { Schema, Document } from "mongoose";
import { ISales, ISalesItem } from "@interfaces/sales_old.interface";
import moment from "moment";

// default number price fields
const priceDefault = { type: Number, default: 0.0 };

const SalesItemSchema = new Schema<ISalesItem>({
  sn: { type: String, require: false },
  itemId: { type: Schema.Types.ObjectId, required: true },
  manufacturerId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  CLEI: { type: Boolean, default: false },
  bulk: { type: Boolean, default: false },
  nonInventory: { type: Boolean, default: false },
  listPriceCAD: priceDefault,
  unitPriceCAD: priceDefault,
  extendedPriceCAD: priceDefault,
  estUnitCostCAD: priceDefault,
  extCostCAD: priceDefault,
  listPrice: priceDefault,
  unitPrice: priceDefault,
  extendedPrice: priceDefault,
  estUnitCost: priceDefault,
  extCost: priceDefault,

  taxable: { type: Boolean, default: false },
  taxAuthority: { type: Boolean, default: false },
  taxRate: priceDefault,

  local1: {
    type: {
      goodscategory: { type: Schema.Types.ObjectId, required: true },
      taxRate: priceDefault,
    },
    default: null,
  },
  local2: {
    type: {
      goodscategory: { type: Schema.Types.ObjectId, required: true },
      taxRate: priceDefault,
    },
    default: null,
  },
  local3: {
    type: {
      goodscategory: { type: Schema.Types.ObjectId, required: true },
      taxRate: priceDefault,
    },
    default: null,
  },
  local4: {
    type: {
      goodscategory: { type: Schema.Types.ObjectId, required: true },
      taxRate: priceDefault,
    },
    default: null,
  },
  tax5: {
    type: {
      goodscategory: { type: Schema.Types.ObjectId, required: true },
      taxRate: priceDefault,
    },
    default: null,
  },
  tax6: {
    type: {
      goodscategory: { type: Schema.Types.ObjectId, required: true },
      taxRate: priceDefault,
    },
    default: null,
  },

  conditionId: { type: Schema.Types.ObjectId, required: true },
  reference: { type: String, required: false },
  warehouseId: { type: Schema.Types.ObjectId, required: true },
  location: { type: String, required: true },
  salesDistribution: { type: Schema.Types.ObjectId, required: true },
  serialNumber: { type: String, required: false },
  harmonizedSystem: { type: String, required: false },
  selectedInventoryId: { type: String, required: false },
  associatedItem: { type: String, required: true },
  description: { type: String, required: true },
  extendedDescription: { type: String, default: null },
  inventory: { type: String, required: false },

  cost: priceDefault,
  grossMargin: priceDefault,
  commissionCost: priceDefault,
  commissionPercentage: priceDefault,
  repSellerMargin: priceDefault,
  buyerMargin: priceDefault,
  supplierMargin: priceDefault,

  internalComments: { type: String, required: true },
  commentsToCustomer: { type: String, required: true },

  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => moment().toDate() },
  updatedAt: { type: Date, default: () => moment().toDate() },
});

// Auto-update updatedAt in subdocument
SalesItemSchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// Subdocument soft delete
SalesItemSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

// Parent schema
const SalesSchema = new Schema<ISales>({
  saleDate: { type: Date, required: true },
  clientId: { type: Schema.Types.ObjectId, required: true, ref: "vendors" },
  termsId: { type: Schema.Types.ObjectId, required: true, ref: "terms" },
  conditionId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "conditions",
  },
  repId: { type: Schema.Types.ObjectId, required: true, ref: "users" },
  hidePricing: { type: Boolean, required: true },
  currencyId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "currencies",
  },
  ledgerCVCode: { type: String, required: false },
  promiseDate: { type: Date, required: true },
  companyMask: { type: String, required: true },
  probabilityFactor: { type: Number, required: false },
  valid: { type: Number, required: false },
  voided: { type: String, required: false },
  description: { type: String, required: true },
  status: { type: String, enum: ["Open"], required: true, default: "Open" },
  invoicedDate: { type: Date, required: false },
  unitSerialNo: { type: String, required: false },
  storeFront: { type: String, required: false },
  invoiceDistribution: { type: String, required: true },
  isSaleOrder: {type: Boolean, default: true},

  totalPrice: priceDefault,
  fright: priceDefault,
  subTotal: priceDefault,
  insallation: priceDefault,
  miscCharge: priceDefault,
  deposits: priceDefault,
  CAD: priceDefault,
  tax: priceDefault,
  total: priceDefault,
  grossMargin: priceDefault,
  grossMarginPercentage: {type:Number, required:false},

  items: { type: [SalesItemSchema], default: [] },

  deletedAt: { type: Date, default: null },
  createdAt: { type: Date, default: () => moment().toDate() },
  updatedAt: { type: Date, default: () => moment().toDate() },
});

// Auto-update updatedAt
SalesSchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// Soft delete
SalesSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default SalesSchema;
