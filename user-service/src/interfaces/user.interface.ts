import mongoose, { Document, Types } from "mongoose";

export interface IUser extends Document {
  userName: string;
  email: string;
  profile_image: string;
  countryCode: string;
  mobileNumber: string;
  password: string;
  account_url: string;
  role: {
    _id: false;
    key_value: string;
    role_id: Types.ObjectId;
  }[];
  isEmailVerified?: boolean;
  isDefaultGlobalAdmin?: boolean;
  isActive?: boolean;
  otpVerification?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  country?: Types.ObjectId;
  state?: Types.ObjectId;
  city?: Types.ObjectId;
  biography?: string;
  postal_code?: string;
  dateOfBirth?: Date;
  dateOfJoining?: Date;
  status: string;
  issuperAdmin: boolean;
  tenant_company_id: string;
  otp: string;
  otpExpiresAt: Date;
  description: string;
  isDefaultUser: boolean;
  resetPasswordToken: string,
  resetPasswordExpires: Date,
  warehouseId?: Types.ObjectId | null;
  isWarehouseAdmin?: boolean;
  globalCc: string;
  globalPhoneNo: string;
  emailsignature: string;
  emailSetting?: string | null;
  emailPassword?: string | null;
  emailType: "gmail" | "outlook";

  // Add the method
  comparePassword(candidatePassword: string): Promise<boolean>;
  softDelete: () => Promise<void>;
}
