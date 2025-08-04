import { Schema } from 'mongoose';
import { IUser } from '../interfaces/user.interface';
import bcrypt from 'bcryptjs';
import moment from 'moment';

// 🟩 Main User Schema
const UserSchema: Schema<IUser> = new Schema<IUser>(
  {
    userName: {type: String, default: ''},
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' }, 
    profile_image: { type: String, default: '' },
    email: {
      type: String,
      required: [false, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        message: 'Invalid email format',
      },
    },
    workSpace: { type: String },
    countryCode: { type: String },
    mobileNumber: { type: String },
    password: { type: String, select: false, default: '' },
    role: [
      {
        key_value: { type: String },
        role_id: { type: Schema.Types.ObjectId, default: null },
      },
    ],
    isEmailVerified: { type: Boolean, default: false },
    dateOfBirth: { type: Date },
    dateOfJoining: { type: Date },
    issuperAdmin: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isDefaultGlobalAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    country: { type: Schema.Types.ObjectId, ref: 'country' },
    state: { type: Schema.Types.ObjectId, ref: 'state' },
    city: { type: Schema.Types.ObjectId, ref: 'city' },
    biography: { type: String, default: '' },
    address_line_1: { type: String, default: '' },
    address_line_2: { type: String, default: '' },
    postal_code: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// 🟩 Password hashing
UserSchema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();

  const currentPassword = this.password || '';
  if (currentPassword.startsWith('$2b$') || currentPassword.startsWith('$2a$')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// 🟩 Password comparison
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// 🟩 Soft delete method
UserSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default UserSchema;