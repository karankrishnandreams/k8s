import mongoose, { Types } from "mongoose";

export interface ICompany {
  company_id: string;
  name: string;
  firstName: string;
  lastName?: string;
  email: string;
  account_url: string;
  phoneNumber: string;
  website?: string | null;
  password: string; // hashed password
  address?: string | null;
  // planName: Types.ObjectId;
  // planType: Types.ObjectId;
  status: "Active" | "Inactive";
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  profileImage?: string | null;
  tenant_company_id: SVGStringList;
  package_id:mongoose.Types.ObjectId;
  otpVerification: boolean;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  trialPackage: boolean;
  totalUserCount: number;
  maxUserCount: number;
  trusted: boolean;
}
