import { Schema, Document } from "mongoose";

export interface ITransaction extends Document {
  customerId: string;
  invoiceId: string;
  companyId: Schema.Types.ObjectId;
  invoice_label?: string;
  type: "charge" | "refund" | "payout" | "manual";
  status: "succeeded" | "failed" | "pending";
  amount: number;
  currency: string;
  paymentIntentId: string;
  failureReason?: string;
  transactionDetails: any;
  coupon_id?: string;
  coupon_percent_off?: number;
  coupon_amount_off?: number;
  coupon_duration?: string;
  coupon_valid?: boolean;
  deletedAt?: Date;
  softDelete(): Promise<void>;
}
