import { Schema } from "mongoose";
import { IRfs } from "@interfaces/rfs.interface";

const RfsSchema: Schema<IRfs> = new Schema<IRfs>(
  {
    rfsNumber: { type: String, required: true }, // ✅ NEW FIELD
    entity: { type: String, required: true },
    user: { type: String, required: true },
    branch: { type: String},
    service: { type: String, required: true },
    pickupType: { type: String, required: true },
    address: { type: String},
    preferredPickupDate: { type: String, required: true },
    additionalComments: { type: String },
    status: {
      type: String,
      enum: ["Open", "Void", "Closed"],
      default: "Open", // ✅ default new status
    },
    suppliers: {
      readyToPickup: { type: Boolean, default: false },
      boxesQty: { type: Number, default: 0 },
      skidQty: { type: Number, default: 0 },
      gaylordQty: { type: Number, default: 0 },
      otherNotes: { type: String },
    },
    attachedFile: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "rfs",
  }
);

export default RfsSchema;
