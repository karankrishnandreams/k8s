import { Schema, model, Types } from "mongoose";
import { IPurchase } from "../interfaces/purchase.interface";

// 👇 Subdocument schema for purchase items
const purchaseItemSchema = new Schema(
  {
    item: { type: Schema.Types.ObjectId, ref: "Item", required: true },
    // manufacturer: {
    //   type: Schema.Types.ObjectId,
    //   ref: "Manufacturer",
    //   required: true,
    // },
    quantity: { type: Number, required: true },
    lineNo: { type: Number, required: true },

    purchaseCostCAD: { type: Number },
    purchaseCostUSD: { type: Number },
    extendedCostCAD: { type: Number },
    extendedCostUSD: { type: Number },

    serialNumber: { type: String, default: "" },
    condition: {
      type: Schema.Types.ObjectId,
      ref: "Condition",
      required: true,
    },
    // status: { type: String },
    wareHouse: {
      type: Schema.Types.ObjectId,
      ref: "Warehouse",
      required: false,
    },
    location: { type: String },
    // countryOfOrigin: { type: String },
    // associatedNumber: { type: String },

    // clei: { type: Boolean },
    // bulk: { type: Boolean },
    // nonInventory: { type: Boolean },

    // weight: { type: Number },
    // originalUnitCost: { type: Number },
    // unitCost: { type: Number },

    // taxable: { type: Boolean },
    // taxAuthorityTaxable: { type: Boolean },
    // taxAuthority: { type: String },
    // taxAuthorityTaxRate: { type: Number },

    // local1: { type: String },
    // local1TaxRate: { type: Number },
    // local2: { type: String },
    // local2TaxRate: { type: Number },
    // local3: { type: String },
    // local3TaxRate: { type: Number },
    // local4: { type: String },
    // local4TaxRate: { type: Number },
    // tax5: { type: String },
    // tax5TaxRate: { type: Number },
    // tax6: { type: String },
    // tax6TaxRate: { type: Number },

    // description: { type: String },
    // extDescription: { type: String },
    // internalComment: { type: String },
  },
  { _id: false }
);

// 👇 Main Purchase schema
const purchaseSchema = new Schema<IPurchase>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    companyId: { type: String  },
    ppId: { type: Schema.Types.ObjectId, ref: "Purchases", required: false },
    date: { type: Date, default: Date.now },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    vendorSO: { type: String },
    currency: { type: Schema.Types.ObjectId, ref: "Currency", required: true },
    rep: { type: Schema.Types.ObjectId, ref: "User" },
    address: { type: String, default: "" },
    terms: { type: Schema.Types.ObjectId, ref: "Terms", required: true },
    country: { type: Schema.Types.ObjectId, ref: "countries", required: true },
    state: { type: Schema.Types.ObjectId, ref: "state", required: true },
    city: { type: Schema.Types.ObjectId, ref: "city", required: true },
    // wareHouse: {
    //   type: Schema.Types.ObjectId,
    //   ref: "warehouses",
    //   required: false,
    // },
    // condition: {
    //   type: Schema.Types.ObjectId,
    //   ref: "Condition",
    //   required: true,
    // },
    shipDate: { type: Date },
    isConverted: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      enum: [
        "Open",
        "Approved",
        "Rejected",
        "Cancelled",
        "Completed",
        "Voided",
        "Available",
      ],
      required: true,
      default: "Open",
    },
    recievedStatus: {
      type: String,
      enum: ["In Transit", "Partially Received", "Received"],
      default: "In Transit",
    },
    purchaseType: {
      type: String,
      enum: ["pp", "po"],
      default: "pp",
    },
    extendedCost: { type: Number, default: 0 },
    freight: { type: Number, default: 0 },
    totalForeignamount: { type: Number, default: 0 },
    extraCost: { type: Number, default: 0 },
    subTotal: { type: Number, default: 0 },
    tax: { type: Schema.Types.ObjectId, ref: "Tax" },
    total: { type: Number, default: 0 },
    items: [purchaseItemSchema],
    deletedAt: { type: Date, default: null },
    po: { type: String },
    pp: { type: String },
    isActive: { type: Boolean, default: true },
    // ✅ Added missing fields:
    description: { type: String, default: "" },
    extDescription: { type: String, default: "" },
    internalComment: { type: String, default: "" },
    commentToVendor: { type: String, default: "" },
    taxPrice : {type: Number, default: 0},
    totalQty: { type: Number, default: 0 },
    receivedQty: { type: Number, default: 0 },
    balanceQty: { type: Number, default: 0 },

    // hideLineItemPricing: { type: Boolean, default: false },
    // sourcePP: { type: String },
    // sourceSO: { type: String },
    // billDistribution: { type: String },
    // poType: { type: String },
    // erasureMethod: { type: String },
    // workflowTemplate: { type: String },
    // serviceFee: { type: String },
    // purchaseCostTemplate: { type: String },
    // supplierMargin: { type: Number },
    // prePaid: { type: Number },
    // reference: { type: String },
  },
  {
    timestamps: true,
  }
);

export default purchaseSchema;
