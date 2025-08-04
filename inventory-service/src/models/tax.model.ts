import mongoose, { Schema } from "mongoose";
import { ITax } from "@interfaces/tax.interface";
import moment from "moment";

const TaxSchema: Schema<ITax> = new Schema<ITax>({
  state: {
    type: mongoose.Schema.Types.ObjectId ,
    trim: true,
    required: false,
  },
  city: {
    type: mongoose.Schema.Types.ObjectId ,
    trim: true,
    required: false,
  },
  name: {
    type: String,
    trim: true,
    required: false,
  },
  tax: {
    type: Number,
    required: false,
  },
  country: {
    type: Schema.Types.ObjectId,
    required: false,
  },
  taxAccount: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Date,
    default: () => moment().toDate(),
  },
  updatedAt: {
    type: Date,
    default: () => moment().toDate(),
  },
});

export default TaxSchema;
