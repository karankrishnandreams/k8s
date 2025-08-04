import mongoose from "mongoose";

export interface IInvoice {
  invoiceNumber: string;
  clientId: mongoose.Types.ObjectId;
  clientPurchaseId: mongoose.Types.ObjectId;
  clientSalesId: mongoose.Types.ObjectId;
  termsId: mongoose.Types.ObjectId;
  currencyId: mongoose.Types.ObjectId;
  invoiceDistripution: string;
  type: string;
  fromSale: number;
  amount: number;
  dept: number;
  rep: mongoose.Types.ObjectId;
  date: Date;
  dueDate: Date;
  due: Date;
  voided?: Date;
  earlyInvoice: boolean;

  paid: number;
  paidinfull: number;
  baseAmount: number;
  basePaid: number;
  baseDue: number;

  itemId: Array<{
    id: string;
    amount: number;
  }>;

  subTotal: number;
  tax: number;
  total: number;
  CAD: number;

  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}
