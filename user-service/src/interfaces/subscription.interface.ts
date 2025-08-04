import { Document, Types } from "mongoose";

export interface ISubscription extends Document {
  subscription_id: string;
  customer_id: string;
  package_id: Types.ObjectId | null;
  company_obj_id?: Types.ObjectId | null;
  company_id?: number | null;

  stripe_product?: string | null;
  pricing_id: string;
  price: number;
  unit_amount: number;
  unit_amount_decimal: number;
  plan_currency: string;
  coupon_id:string;

  plan_type: "day" | "month" | "year";
  mode?: "subscription" | "trial" | "manual";
  status?:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "unpaid"
    | "incomplete"
    | "incomplete_expired";

  subscriptionDate?: Date | null;
  nextBillingDate?: Date | null;
  canceledAt?: Date | null;
  canceledInit?: boolean;

  payment_gateway?: "stripe";
  deletedAt?: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
  payment_method?: string;

  softDelete: () => Promise<void>;
}
