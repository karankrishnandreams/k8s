import { Schema, model, Model } from "mongoose";
import { availableModules, IPackage } from "../interfaces/package.interface";
import { CounterPackage } from "./CounterPackage.model";
import moment from "moment";

// Enums
const planTypeEnum = {
  day: "day",
  month: "month",
  year: "year",
} as const;

const discountTypeEnum = {
  fixed: "fixed",
  percentage: "percentage",
  null: null
} as const;

const PackageSchema = new Schema<IPackage>(
  {
    package_id: { type: Number, required: false },
    stripe_product: { type: String, trim: true },
    pricing_id: { type: String, trim: true },
    plan_name: { type: String, lowercase: true, trim: true },
    plan_type: {
      type: String,
      enum: Object.values(planTypeEnum),
    },
    interval_count: { type: Number, default: 1 },
    plan_position: { type: Number, default: 1 },
    plan_currency: { type: String, lowercase: true, default: "usd" },
    price: { type: Number },
    totalAmount: { type: Number },
    unit_amount: { type: Number },
    unit_amount_decimal: { type: Number },
    discount_type: { type: String, enum: Object.values(discountTypeEnum) },
    discount: { type: Number },
    plan_modules: {
      type: [String],
      enum: availableModules,
      default: [],
    },
    access_trial: { type: Boolean, default: false },
    trial_days: { type: Number, default: null },
    is_recommended: { type: Boolean, default: false },
    coupon_id: { type: String, default: null, trim: true },
    description: { type: String, trim: true },
    status: { type: Boolean, default: true },
    plan_image: { type: String, default: null, trim: true },
    is_free: { type: String, default: "no", trim: true },
    stripe_json: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Soft delete method
PackageSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

// PackageSchema.pre("save", async function (next) {
//   if (this.isNew) { // need to check
//     try {
//       const counter = await CounterPackage.findOneAndUpdate(
//         { id: "package_id" },
//         { $inc: { seq: 1 } },
//         { new: true, upsert: true }
//       );
//       this.package_id = counter.seq;
//       next();
//     } catch (error: any) {
//       next(error);
//     }
//   } else {
//     next();
//   }
// });

export default PackageSchema;
