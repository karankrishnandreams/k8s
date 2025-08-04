import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICounterPackage extends Document {
  id: string; // e.g. "package_id"
  seq: number;
}

export const CounterPackageSchema: Schema<ICounterPackage> =
  new Schema<ICounterPackage>({
    id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  });

export const CounterPackage: Model<ICounterPackage> =
  mongoose.model<ICounterPackage>("CounterPackage", CounterPackageSchema);
