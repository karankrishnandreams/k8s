import mongoose, { Schema } from "mongoose";
import { IInvoice } from "@interfaces/invoice.interface";
import moment from "moment";

const priceDefault = { type: Number, default: 0.0 };

const InvoiceItemSchema = new Schema(
  {
    id: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, required: true, ref: "customers" },
    clientSalesId: { type: Schema.Types.ObjectId, required: true, ref: "sales" },
    termsId: { type: Schema.Types.ObjectId, required: true, ref: "terms" },
    currencyId: { type: Schema.Types.ObjectId, required: true, ref: "currencies" },
    invoiceDistripution: { type: String, required: false },
    type: { type: String, required: true },
    fromSale: { type: Number, required: true },
    amount: { type: Number, required: true },
    dept: { type: Number, required: true },
    rep: { type: Schema.Types.ObjectId, required: true, ref: "users" },
    date: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    due: { type: Date, required: true },
    voided: { type: Date, required: false },
    earlyInvoice: { type: Boolean, required: true },

    paid: priceDefault,
    paidinfull: priceDefault,
    baseAmount: priceDefault,
    basePaid: priceDefault,
    baseDue: priceDefault,

    itemId: { type: [InvoiceItemSchema], required: true, default: [] },

    subTotal: priceDefault,
    tax: priceDefault,
    total: priceDefault,
    CAD: priceDefault,

    deletedAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => moment().toDate() },
    updatedAt: { type: Date, default: () => moment().toDate() },
  }
);

// Middleware to auto-update `updatedAt`
InvoiceSchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// Soft delete method
InvoiceSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default InvoiceSchema;
