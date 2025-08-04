import { Schema } from "mongoose";
import { IRole } from "@interfaces/roles.interface";

// Reusable permission schema for modules and sub-modules
const PermissionAccessSchema = new Schema(
  {
    allow_all:{type: Boolean, default: false},
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    import: { type: Boolean, default: false },
    export: { type: Boolean, default: false },
  },
  { _id: false }
);

// Sub-module schema with its own permissions
const SubPermissionSchema = new Schema(
  {
    name: { type: String },
    key_value: { type: String },
    allow_access: { type: Boolean, default: false },
    permission: { type: PermissionAccessSchema, default: () => ({}) },
  },
  { _id: false }
);

// Main module schema
export const PermissionSchema = new Schema({
  name: { type: String },
  key_value: { type: String },
  allow_access: { type: Boolean, default: false },
  permission: { type: PermissionAccessSchema, default: () => ({}) },
  sub_modules: [SubPermissionSchema],
});

// Role schema
const RoleSchema = new Schema<IRole>({
  role_name: { type: String, unique: true },
  role_description: { type: String },
  key_value: { type: String },
  modules: [PermissionSchema],
  isdefaultRole: { type: Boolean, default: false },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
});

export default RoleSchema;
