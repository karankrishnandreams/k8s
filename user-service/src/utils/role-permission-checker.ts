import createHttpError from "http-errors";
import { Request } from "express";
import { IUser } from "@interfaces/user.interface";
import { IRole } from "@interfaces/roles.interface";
import userSchema from "@models/user.model";
import roleSchema from "@models/roles.model";
import { getDbConnection } from "@config/database";
import { Model } from "mongoose";

const DB_NAME: any = process.env.DB_NAME;


type UserRole = {
  key_value: string;
  role_id: string | null;
};

const isAccessAllowed = (module: any, method: string): boolean => {
  const perms = module.permission;

  switch (method) {
    case "GET":
      return perms.read;
    case "POST":
      return perms.create;
    case "PUT":
      return perms.write;
    // case "PATCH":
    //   return perms.update;
    case "DELETE":
      return perms.delete;
    default:
      return false;
  }
};

const getUserModel = (dbName: string): Model<IUser> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.User ||
    connection.model<IUser>("User", userSchema)
  );
};

const getRoleModel = (dbName: string): Model<IRole> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Role ||
    connection.model<IRole>("Role", roleSchema)
  );
};

export const validateRolePermission = async (
  dbName: string,
  roleKEY: string,
  decoded: { id: string; role: UserRole[] },
  method: string,
  path: string
) => {

  const User = getUserModel(dbName);
  const user = await User.findOne({ _id: decoded.id });
  if (!user) {
    return {
      success: false,
      status: 401,
      message: "User not found"
    }
  }

  const role = user.role[0]?.role_id;
  const Role = getRoleModel(dbName);
  const roleData = await Role.findOne({ _id: role });
  if (!roleData || roleData.modules?.length === 0) {
    return {
      success: false,
      status: 401,
      message: "Role not found"
    }
  }

  const permissions: any = roleData.modules;
  const hasPermission = permissions.filter(
    (p: any) => p.key_value === roleKEY
  );

  if (hasPermission.length === 0) {
    return {
      success: false,
      status: 401,
      message: "You are not authorized to access this resource"
    }
  }

  if (!isAccessAllowed(hasPermission[0], method)) {

    return {
      success: false,
      status: 401,
      message: "You are not authorized to access this resource"
    }

  }

  return {
    success: true,
    status: 200,
    message: "Access granted to " + method + " " + path
  }
};
