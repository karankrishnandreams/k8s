import { ITransaction } from "@interfaces/transaction.interface";
import moment from "moment";
import { Schema, Model } from "mongoose";

const transactionSchema = new Schema<ITransaction>(
  {
    customerId: { type: String, required: false },
    invoiceId: { type: String, required: false, unique: false },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: "companies",
      required: true,
    },
    invoice_label: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ["charge", "refund", "payout", "trial", "manual"],
      required: true,
    },
    status: {
      type: String,
      enum: ["succeeded", "failed", "pending"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, required: false, uppercase: true },
    paymentIntentId: { type: String, required: false, index: true },
    failureReason: { type: String, default: null },
    transactionDetails: { type: Schema.Types.Mixed, required: false },
    coupon_id: { type: String, default: null },
    coupon_percent_off: { type: Number, default: null },
    coupon_amount_off: { type: Number, default: null },
    coupon_duration: { type: String, default: null },
    coupon_valid: { type: Boolean, default: null },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// ✅ Type-safe pre-hook
transactionSchema.pre<ITransaction>("validate", async function (next) {
  if (!this.invoice_label) {
    try {
      const model = this.constructor as Model<ITransaction>;
      const lastTransaction = await model.findOne().sort({ createdAt: -1 });

      let newInvoiceNumber = 1;
      if (lastTransaction?.invoice_label) {
        const lastNum = parseInt(
          lastTransaction.invoice_label.split("-")[1],
          10
        );
        if (!isNaN(lastNum)) newInvoiceNumber = lastNum + 1;
      }

      this.invoice_label = `INV-${newInvoiceNumber}`;
      next();
    } catch (err: any) {
      next(err);
    }
  } else {
    next();
  }
});

transactionSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default transactionSchema;
