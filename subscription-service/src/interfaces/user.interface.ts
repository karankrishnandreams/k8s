import mongoose, { Document, Types } from 'mongoose';

export interface IUser extends Document {
  userName: string;
  firstName: string;
  lastName?: string;
  email: string;
  profile_image: string;
  countryCode: string;
  mobileNumber: string;
  password: string;
  workSpace: string;
  role: {
    _id: false;
    key_value: string;
    clinic_id: Types.ObjectId;
    role_id: Types.ObjectId;
  }[];
  isEmailVerified?: boolean;
  isDefaultGlobalAdmin?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  country?: Types.ObjectId;
  state?: Types.ObjectId;
  city?: Types.ObjectId;
  biography?: string;
  address_line_1?: string;
  address_line_2?: string;
  postal_code?: string;
  dateOfBirth?: Date;
  dateOfJoining?: Date;
  status: string;
  issuperAdmin: boolean;
  // Add the method
  comparePassword(candidatePassword: string): Promise<boolean>;
  softDelete: () => Promise<void>;
}