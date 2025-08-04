import { IWarehouse } from "@interfaces/warehouse.interface";
import { Schema } from "mongoose";

const WarehouseSchema = new Schema<IWarehouse>(
  {
    name: {
      type: String,
      required: [true, "Warehouse name is required"],
      maxlength: 100,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      max:500
    },
    contactPerson: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Contact person is required"],
      // match: [/^[A-Za-z\s]+$/, "Contact person must contain only letters and spaces"],
    },
    phoneNumber: {
      type: String,
      validate: {
        validator: (v: string) => /^(\+)?\d{0,15}$/.test(v),
        message: "Invalid phone number",
      },
      default: null,
    },

    email: {
      type: String,
      validate: {
        validator: (v: string) =>
          !v || /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v),
        message: "Please enter a valid email",
      },
      default: null,
    },
    address: {
      type: String,
      required: [true, "Address line 1 is required"],
      maxlength: 200,
    },

    country: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please select a country"],
    },
    state: {
      type: Schema.Types.ObjectId,
      ref: "state",
      required: [true, "Please enter or select a state"],
    },
    city: {
      type: Schema.Types.ObjectId,
      ref: "city",
      required: [true, "City is required"],
      match: [/^[A-Za-z\s]+$/, "City must contain only letters and spaces"],
      maxlength: 50,
    },
    zipcode: {
      type: String,
      required: [true, "Zipcode is required"],
      match: [/^[A-Za-z0-9]+$/, "Zipcode must be alphanumeric"],
      maxlength: 10,
    },
    status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: "Active",
    required: true
  },
  },
  { timestamps: true }
);

export default WarehouseSchema;