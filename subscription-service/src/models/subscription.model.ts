import { ISubscription } from "@interfaces/subscription.interface";
import moment from "moment";
import { Schema, Types, model } from "mongoose";

const subscriptionSchema = new Schema<ISubscription>(
  {
    subscription_id: { type: String, required: false },
    customer_id: { type: String, required: false },
    package_id: { type: Types.ObjectId, default: null },
    // Reference to the company (multi-tenant support)
    company_obj_id: { type: Types.ObjectId, ref: "companies", default: null },
    company_id: { type: Number, default: null },

    // Stripe product/pricing
    stripe_product: { type: String, default: null },
    pricing_id: { type: String, required: false },
    price: { type: Number, required: false },
    unit_amount: { type: Number, required: false },
    unit_amount_decimal: { type: Number, required: false },
    plan_currency: { type: String, required: false },

    // Plan duration type
    plan_type: {
      type: String,
      enum: ["day", "month", "year"],
      required: false,
    },

    // Subscription or custom link-based (optional)
    mode: {
      type: String,
      enum: ["subscription", "trial", "manual"],
      default: "subscription",
    },

    // Stripe subscription status
    status: {
      type: String,
      enum: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "unpaid",
        "incomplete",
        "incomplete_expired",
      ],
      default: "incomplete",
    },

    subscriptionDate: { type: Date, default: null },
    nextBillingDate: { type: Date, default: null },
    canceledAt: { type: Date, default: null },
    canceledInit: { type: Boolean, default: false },

    payment_gateway: {
      type: String,
      enum: ["stripe", "trial"],
      default: "stripe",
    },

    deletedAt: { type: Date, default: null },
    payment_method: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

// ✅ Soft delete method
subscriptionSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default subscriptionSchema;
