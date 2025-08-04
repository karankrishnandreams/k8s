import { ISubscription } from "@interfaces/companysubscriptions.interface";
import { Schema } from "mongoose";

const companySubscriptionSchema = new Schema<ISubscription>(
  {
    company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    planName: { type: String, required: true },
    planType: { type: String, required: true },
    status: { type: String, enum: ['Active', 'Inactive', 'Cancelled'], default: 'Active' },
    startDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ✅ Soft delete method
companySubscriptionSchema.methods.softDelete = async function () {
  this.deletedAt = new Date();
  await this.save();
};

export default companySubscriptionSchema;

