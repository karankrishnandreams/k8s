import mongoose, { Types } from "mongoose";

export interface ICompany {
  company_id: string;
  name: string;
  email: string;
  account_url: string;
  phoneNumber: string;
  website?: string | null;
  password: string; // hashed password
  address?: string | null;
  // planName: Types.ObjectId;
  // planType: Types.ObjectId;
  status: "Active" | "Inactive";
  emailType: "gmail" | "outlook";
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  profileImage?: string | null;
  emailSetting?: string | null;
  emailPassword?: string | null;
  tenant_company_id: SVGStringList;
  package_id: mongoose.Types.ObjectId;
  otpVerification: boolean;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  trialPackage: boolean;
  totalUserCount: number;
  maxUserCount: number;
  trusted: boolean;
  currencyCVR: string;
  globalCc: string;
  globalPhoneNo: string;
  emailsignature: string;
}
