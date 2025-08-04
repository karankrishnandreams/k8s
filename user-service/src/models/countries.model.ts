import { ICountries } from "@interfaces/countries.interface";
import { Schema } from "mongoose";

// Location Schema Definition
const CountrySchema: Schema<ICountries> = new Schema<ICountries>(
  {
    country_id: {
      type: Number,
    },
    name: {
      type: String,
    },
    countryShortCode: {
        type: String
    },
    countryShortCode1: {
        type: String
    },
    countryPhoneCode: {
        type: String
    },
    currency: {
        type: String
    },
    timezones: {
        type: Array
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

export default CountrySchema;