import { IEmailTemplate } from '@interfaces/emailtemplate.interface';
import moment from 'moment';
import { Schema } from 'mongoose';
import slugify from 'slugify';

const EmailTemplateSchema: Schema<IEmailTemplate> = new Schema<IEmailTemplate>(
  {
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
      maxlength: [100, 'Specialization cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    htmlBody: {
      type: String,
      required: [true, 'HTML body is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Pre-save hook to generate slug automatically
EmailTemplateSchema.pre('save', function (next) {
  if (this.isModified('specialization') || !this.slug) {
    this.slug = slugify(this.specialization, {
      lower: true, // Convert to lowercase
      strict: true, // Remove special characters
      trim: true,
    });
  }
  next();
});

// Soft delete method
EmailTemplateSchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  this.isActive = false;
  await this.save();
};

export default EmailTemplateSchema;
