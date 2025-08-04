import { ICity } from "@interfaces/city.interface";
import { Schema } from "mongoose";

// Location Schema Definition
const CitySchema: Schema<ICity> = new Schema<ICity>(
  {
    city_id: {
      type: Number,
    },
    name: {
      type: String,
    },
    country_code: {
      type: String
    },
    country_id: {
      type: String
    },
    stateCode: {
      type: String
    },
    parent: {
      type: Number
    },
    isActive: {
      type: Boolean,
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
    toJSON: {
      virtuals: true
    },
    toObject: { virtuals: true },
    collection: 'city',
  },
);

export default CitySchema;