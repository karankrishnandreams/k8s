import { Document } from "mongoose";

export const availableModules = [
  "ITAD Module",
  "AMS Module",
  "Inventory Module",
  "Ticketing",
  "Accounting Module",
  "Communication Module",
  "Reports",
  "Compliance Management",
  "HR Management"
] as const;
type PlanModule = (typeof availableModules)[number];

export interface IPackage extends Document {
  package_id: number;
  stripe_product?: string;
  pricing_id?: string;
  plan_name?: string;
  plan_type: "day" | "month" | "year";
  interval_count?: number;
  plan_position?: number;
  plan_currency?: string;
  price?: number;
  totalAmount?:number;
  unit_amount?: number;
  unit_amount_decimal?: number;
  discount_type?: "fixed" | "percentage" | null;
  discount?: number;
  plan_modules: PlanModule[];
  access_trial?: boolean;
  trial_days?: number | null;
  is_recommended?: boolean;
  coupon_id?: string | null;
  description?: string;
  status?: boolean;
  plan_image?: string | null;
  is_free?: string;
  stripe_json?: string;
  deletedAt?: Date | null;

  // Methods
  softDelete(): Promise<void>;
}
