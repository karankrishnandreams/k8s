import { Schema } from "mongoose";
import { ICompany } from "../interfaces/company.interface"; // Adjust path as needed
import moment from "moment";

const companySchema: Schema<ICompany> = new Schema<ICompany>({
  company_id: {
    type: String,
    required: false,
  },
  tenant_company_id: {
    type: String,
    required: false,
  },
  name: { 
    type: String,
    required: false,
  },
  email: {
    type: String,
    required: false,
    unique: true,
  },
  account_url: {
    type: String,
    required: false,
  },
  phoneNumber: {
    type: String,
    required: false,
  },
  website: {
    type: String,
    default: null,
  },
  password: {
    type: String,
    required: false,
  },
  address: {
    type: String,
    default: null,
  },
  // planName: {
  //   type: Schema.Types.ObjectId,
  //   ref: "Plan",
  //   required: false,
  // },
  // planType: {
  //   type: Schema.Types.ObjectId,
  //   ref: "PlanType",
  //   required: false,
  // },
  status: {
    type: String,
    enum: ["Active", "Inactive"],
    required: false,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: () => moment().toDate(),
  },
  updatedAt: {
    type: Date,
    default: () => moment().toDate(),
  },
  profileImage: {
    type: String,
    default: null,
  },
  package_id:{
    type:Schema.Types.ObjectId,
    default:null
  }
});

// Automatically update updatedAt before saving
companySchema.pre("save", function (next) {
  this.updatedAt = moment().toDate();
  next();
});

// 🟩 Soft delete method
companySchema.methods.softDelete = async function () {
  this.deletedAt = moment().toDate();
  await this.save();
};

export default companySchema;
