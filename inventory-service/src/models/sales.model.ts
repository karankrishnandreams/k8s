import { Schema } from 'mongoose';
import { ISales, ISalesItem } from '../interfaces/sales.interface';
import moment from 'moment';

const priceDefault = { type: Number, default: 0.0 };

const SaleItemSchema = new Schema<ISalesItem>(
  {
    item: { type: Schema.Types.ObjectId, required: true, ref: 'item' },
    manufacturerId: { type: Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true },
    saleCostCAD: { type: Number, default: 0 },
    saleCostUSD: { type: Number, default: 0 },
    saleExtendedCostCAD: { type: Number, default: 0 },
    saleExtendedCostUSD: { type: Number, default: 0 },
    serialNumber: { type: String, default: '' },
    condition: { type: Schema.Types.ObjectId, required: false, ref: 'condition' },
    lineNumber: { type: Number, required: true,default: 0 },

    // 🟨 Additional fields from old schema
    sn: { type: String },
    CLEI: { type: Boolean, default: false },
    bulk: { type: Boolean, default: false },
    nonInventory: { type: Boolean, default: false },
    status: { type: String, default: 'Open' },

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
    taxAuthority: { type: String, default: "" },
    taxAuthorityPrice: { type: String, default: "" },
    taxRate: priceDefault,

    local1: {
      type: {
        goodscategory: { type: String, required: false },
        taxRate: priceDefault,
      },
      default: null,
    },
    local2: {
      type: {
        goodscategory: { type: String, required: false },
        taxRate: priceDefault,
      },
      default: null,
    },
    local3: {
      type: {
        goodscategory: { type: String, required: false },
        taxRate: priceDefault,
      },
      default: null,
    },
    local4: {
      type: {
        goodscategory: { type: String, required: false },
        taxRate: priceDefault,
      },
      default: null,
    },
    tax5: {
      type: {
        goodscategory: { type: String, required: false },
        taxRate: priceDefault,
      },
      default: null,
    },
    tax6: {
      type: {
        goodscategory: { type: String, required: false },
        taxRate: priceDefault,
      },
      default: null,
    },

    reference: { type: String , required: false},
    warehouseId: { type: Schema.Types.ObjectId, required: false },
    location: { type: String, required: false },
    salesDistribution: { type: String, required: false },
    harmonizedSystem: { type: String, required: false },
    selectedInventoryId: { type: String, required: false },
    associatedItem: { type: String, required: false },
    description: { type: String, required: false },
    extendedDescription: { type: String, default: null },
    inventory: { type: String, required: false },

    cost: priceDefault,
    grossMargin: priceDefault,
    commissionCost: priceDefault,
    commissionPercentage: priceDefault,
    repSellerMargin: priceDefault,
    buyerMargin: priceDefault,
    supplierMargin: priceDefault,

    internalComments: { type: String, required: false },
    commentsToCustomer: { type: String, required: false },
  },
  { _id: false }
);


const SalesSchema = new Schema<ISales>(
  {    
    so: { type: String, default: '' },
    sp: { type: String, default: '' },
    date: { type: Date, required: true },
    saleDate: { type: Date },
    client: { type: Schema.Types.ObjectId, ref: 'customers' },
    terms: { type: Schema.Types.ObjectId, required: true, ref: 'terms' },
    // condition: { type: Schema.Types.ObjectId, ref: 'conditions' },
    rep: { type: Schema.Types.ObjectId, ref: 'user' },
    hidePricing: { type: Boolean, default: false },
    currency: { type: Schema.Types.ObjectId, required: true, ref: 'currency' },
    ledgerCVCode: { type: String, default: '' },
    promiseDate: { type: Date, required: false },
    companyMask: { type: String, default: '' },
    probabilityFactor: { type: Number, default: 0 },
    valid: { type: Number, default: 0 },
    description: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Open', 'Closed', 'Voided', 'Partial','Reserved','Invoiced'],
      required: true,
      default: 'Open',
    },
    invoicedDate: { type: Date, required: false },
    voided: { type: Date, required: false },
    unitSerialNo: { type: String, required: false },
    storeFront: { type: String, required: false },
    invoiceDistribution: { type: String, required: false },

    totalPrice: priceDefault,
    totalForeignamount: { type: Number, default: 0 },
    freight: { type: Number, default: 0 },
    insallation: priceDefault,
    miscCharge: priceDefault,
    deposits: priceDefault,
    taxPrice: priceDefault,
    total: { type: Number, default: 0 },
    grossMargin: priceDefault,
    grossMarginPercentage: { type: Number, default: 0.0 },
    subTotal: { type: Number, default: 0 },
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'user' },
    spId: { type: Schema.Types.ObjectId, ref: 'sp' },
    companyId: { type: Number, required: true, ref: 'company' },
    items: { type: [SaleItemSchema], default: [] },
    saleType: {
      type: String,
      enum: ["sp", "so"],
      default: "sp",
    },
    isConverted: { type: Boolean, default: false },
    // isSaleOrder: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdAt: {
      type: Date,
      default: () => moment().toDate(),
    },
    updatedAt: {
      type: Date,
      default: () => moment().toDate(),
    },
    deletedAt: { type: Date, default: null },
    
 
    // vendor: { type: Schema.Types.ObjectId, required: false, ref: 'vendor' },
    // vendorSO: { type: String, default: '' },
    extDescription: { type: String, default: '' },
    internalComment: { type: String, default: '' },
    commentToVendor: { type: String, default: '' },
    shipDate: { type: Date },
    address: { type: String, default: '' },
    // country: { type: Schema.Types.ObjectId, required: false, ref: 'country' },
    // state: { type: Schema.Types.ObjectId, required: false, ref: 'state' },
    // city: { type: Schema.Types.ObjectId, required: false, ref: 'city' },
    // wareHouse: { type: Schema.Types.ObjectId, required: false, ref: 'warehouse' },
    tax: { type: Schema.Types.ObjectId, required: true, ref: 'tax' },
    extendedCost: { type: Number, default: 0 },
    extraCost: { type: Number, default: 0 },
    CAD: priceDefault,
  }
);

// Timestamp hook
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
