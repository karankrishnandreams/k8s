import { Schema } from "mongoose";

const RepositorySchema = new Schema(
  {
    amsNo: { type: String, required: true },
    entity: { type: String, required: true },
    branch: { type: String, required: true },
    agent: { type: String, required: true },
    reportType: {
      type: String,
      enum: ["Receiving Log", "Direction log", "Audit Report", "COD", "Others"],
      required: true,
    },
    uploadedDate: { type: Date, required: true },
    comments: { type: String },
    filePath: { type: String },
    originalFileName: { type: String },
  },
  { timestamps: true }
);

export default RepositorySchema;
