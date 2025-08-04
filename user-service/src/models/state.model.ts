import { IState } from "@interfaces/state.interface";
import { Schema } from "mongoose";

// Location Schema Definition
const StateSchema: Schema<IState> = new Schema<IState>(
  {
    name: {
      type: String,
    },
    state_id: {
      type: Number,
    },
    countryCode: {
      type: String
    },
    stateCode: {
      type: String
    },
    parent: {
      type: Number
    },
    latitude: {
      type: String
    },
    longitude: {
      type: String
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

export default StateSchema;