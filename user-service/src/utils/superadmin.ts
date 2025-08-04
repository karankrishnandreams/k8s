// Load environment variables and path aliases
import "../bootstarp.seed";

import { connectToDatabase, getDbConnection } from "@config/database";
import { IUser } from "@interfaces/user.interface";
import UserSchema from "@models/user.model";
import { Model } from "mongoose";
import { IRole } from "@interfaces/roles.interface";
import RoleSchema from "@models/roles.model";
import path from "path";
import { readJSONFile } from "./auth.utils";
import logger from "./logger";
import { ERROR_MESSAGE, INFO_MESSAGE } from "./message.constant";
import slugify from "slugify";

// Helper to get tenant-aware User model
const getUserModel = (dbName: string): Model<IUser> => {
  const connection = getDbConnection(dbName);
  return connection.models.User || connection.model<IUser>("User", UserSchema);
};

const getRoleModel = (dbName: string): Model<IRole> => {
  const connection = getDbConnection(dbName);
  return connection.models.Role || connection.model<IRole>("Role", RoleSchema);
};

const configFilePath: any = path.join(__dirname, "..", "config", "roles.json");

const createSuperAdmin = async () => {
  const {
    FIRSTNAME,
    LASTNAME,
    EMAIL,
    PASSWORD,
    ROLE,
    DB_NAME, // Assume DB_NAME is passed via env to determine which DB to use
  } = process.env;

  if (!FIRSTNAME || !LASTNAME || !EMAIL || !PASSWORD || !ROLE || !DB_NAME) {
    logger.error(ERROR_MESSAGE.SUPERADMIN_ENV_MISSING);
    process.exit(1);
  }

  await connectToDatabase();

  const User = getUserModel(DB_NAME);
  const Role = getRoleModel(DB_NAME);

  try {
    const existingUser = await User.findOne({ email: EMAIL });
    if (existingUser) {
      logger.error(ERROR_MESSAGE.SUPERADMIN_ALREADY_EXIST);
      process.exit(1);
    }
    const permission = await readJSONFile(configFilePath);

    const role = new Role({
      role_name: ROLE,
      key_value: slugify(ROLE, {
        lower: true,
        strict: true,
        replacement: "_",
      }).toUpperCase(),
      permission,
      isdefaultRole: true,
    });

    const roleData = await role.save();
    const name=`${FIRSTNAME} ${LASTNAME}`;  
    const superAdmin = new User({
      userName: name,
      email: EMAIL,
      password: PASSWORD,
      role: [
        {
          role_id: roleData?._id,
          key_value: roleData?.key_value,
        },
      ],
      issuperAdmin: true,
    });

    await superAdmin.save();

    logger.info(INFO_MESSAGE.SUPERADMIN_CREATED_SUCCESSFULLY);
  } catch (err) {
    console.error(`${ERROR_MESSAGE.SUPERADMIN_CREATE_ERROR}:`, err);
    process.exit(1);
  }
};

createSuperAdmin();
