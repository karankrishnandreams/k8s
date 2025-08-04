import { NextFunction, Request, Response } from "express";
import { IPermission, IRole } from "../interfaces/roles.interface";
import mongoose, { Model } from "mongoose";
import { getDbConnection } from "@config/database";
import RoleSchema from "@models/roles.model";
import path from "path";
import { readJSONFile } from "@utils/auth.utils";
import { paginate } from "@utils/paginate";
import createHttpError from "http-errors";
import logger from "@utils/logger";
import {
  generateExcelDownload,
  generatePdfDownload,
} from "@utils/export.utils";
import { IUser } from "@interfaces/user.interface";
import UserSchema from "@models/user.model";
import { error } from "console";
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import companySchema from "@models/company.model";
import { ICompany } from "@interfaces/company.interface";
import moment from "moment";

const configFilePath: any = path.join(__dirname, "..", "config", "roles.json");

const getRoleModel = (dbName: string): Model<IRole> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Roles || connection.model<IRole>("roles", RoleSchema)
  );
};
const getUserModel = (dbName: string): Model<IUser> => {
  const connection = getDbConnection(dbName);
  return connection.models.User || connection.model<IUser>("User", UserSchema);
};

const getCompanyModel = (dbName: string): Model<ICompany> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Company ||
    connection.model<ICompany>("Company", companySchema)
  );
};



const db_Name = process.env.DB_NAME;

// export const createRole = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const { role_name, status, isPermissionAssigned = false } = req.body;
//     const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

//     const key_value = role_name.toLowerCase().replace(/[\s-]+/g, "_");

//     const Role = getRoleModel(dbName);
//     const existingRole = await Role.findOne({
//       deletedAt: null,
//       $or: [
//         { role_name: { $regex: `^${role_name}$`, $options: "i" } },
//         { key_value: { $regex: `^${key_value}$`, $options: "i" } },
//       ],
//     });

//     if (existingRole) {
//       res.status(400).json({
//         error: "Failed to create role",
//         message: "Role already exist",
//       });
//       return;
//       // throw createHttpError(400, "Role already exists");
//     }

//     // permission JSON must include modules with permission & sub_modules
//     const permission = await readJSONFile(configFilePath);

//     const newRole = await Role.create({
//       role_name,
//       key_value,
//       status,
//       isPermissionAssigned,
//       modules: permission,
//     });

//     res
//       .status(201)
//       .json({ message: "Role created successfully", data: newRole });
//   } catch (error: any) {
//     res
//       .status(500)
//       .json({ message: "Failed to create role", error: error.message });
//   }
// };

export const createRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      role_name,
      status,
      isPermissionAssigned = false,
    } = req.body;
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const key_value = role_name.toLowerCase().replace(/[\s-]+/g, "_");
    const Role = getRoleModel(dbName);
    const companyModel = getCompanyModel(dbName);
    const data=await companyModel.findOne({ deletedAt: null });
    const packageObjId = data?.package_id;
    const existingRole = await Role.findOne({
      deletedAt: null,
      $or: [
        { role_name: { $regex: `^${role_name}$`, $options: "i" } },
        { key_value: { $regex: `^${key_value}$`, $options: "i" } },
      ],
    });

    if (existingRole) {
      res.status(400).json({
        error: "Failed to create role",
        message: "Role already exists",
      });
      return;
    }

    // 1. Fetch package modules
    const configPackage: any = {
      method: "get",
      url: `/subscription/public/packages/view/${packageObjId}`,
    };
    const packageRes = await kongAxios(configPackage);
    const packageData = packageRes?.data;

    const allowedDomains = Array.isArray(packageData?.data?.plan_modules)
      ? packageData.data.plan_modules
      : [];
    // 2. Load full roles config
    const rolesConfigPath = path.join(__dirname, "..", "config", "roles.json");
    const fullPermissions = await readJSONFile(rolesConfigPath);

    // 3. Filter and apply permissions
    const updatedPermissions = fullPermissions
      .filter((module: any) => allowedDomains.includes(module.domain))
      .map((module: any) => {
        const updatedModule = {
          ...module,
          permission: {
            read: false,
            write: false,
            create: false,
            delete: false,
            import: false,
            export: false,
          },
        };

        if (Array.isArray(module.sub_modules)) {
          updatedModule.sub_modules = module.sub_modules.map((sub: any) => ({
            ...sub,
            permission: {
              read: false,
              write: false,
              create: false,
              delete: false,
              import: false,
              export: false,
            },
          }));
        }

        return updatedModule;
      });

    const newRole = await Role.create({
      role_name,
      key_value,
      status,
      isPermissionAssigned,
      modules: updatedPermissions,
    });

    res
      .status(201)
      .json({ message: "Role created successfully", data: newRole });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Failed to create role", error: error.message });
  }
};

export const listRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Role = getRoleModel(dbName);

    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      isPermissionAssigned = false,
    } = req.query;

    // Build dynamic filter
    const filter: any = { deletedAt: null, isdefaultRole: false };

    if (isPermissionAssigned) {
      filter.isPermissionAssigned = isPermissionAssigned;
    }

    if (search) {
      filter.role_name = { $regex: search, $options: "i" }; // case-insensitive partial match
    }

    if (status) {
      filter.status = status; // exact match
    }

    // Define projection (select only necessary fields)
    const projection = {
      role_name: 1,
      status: 1,
      createdAt: 1,
      modules: 1,
      isPermissionAssigned: 1,
    };

    // Call pagination helper
    const result = await paginate(
      Role,
      filter,
      {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: "createdAt",
        order: "desc",
      },
      projection
    );

    res.status(200).json({
      status: 200,
      ...result,
    });
  } catch (error: any) {
    next(error);
  }
};

export const getRoleById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Role = getRoleModel(dbName);

    const role = await Role.findById(id);
    if (!role) {
      throw createHttpError(404, "Role not found");
    }

    res.status(200).json({ status: 200, data: role });
  } catch (error: any) {
    next(error);
  }
};

export const updateRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { role_id, role_name, modules, status } = req.body;

    if (!role_id) {
      res.status(400).json({
        error: "Failed to update role",
        message: "role_id is required",
      });
      return;
    }

    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Role = getRoleModel(dbName);

    const role = await Role.findById(role_id);
    if (!role) {
      res.status(404).json({
        error: "Failed to update role",
        message: "Role not found",
      });
      return;
    }

    // Check for duplicate role_name (excluding current role)
    if (role_name) {
      const existing = await Role.findOne({
        deletedAt: null,
        _id: { $ne: role_id },
        role_name: { $regex: `^${role_name}$`, $options: "i" },
      });

      if (existing) {
        res.status(409).json({
          error: "Failed to update role",
          message: "Role name already exist",
        });
        return;
      }

      role.role_name = role_name;
      role.key_value = role_name.toLowerCase().replace(/[\s-]+/g, "_");
    }

    // Update status if provided
    if (status && ["active", "inactive"].includes(status)) {
      role.status = status;
    }

    // Update modules and permissions
    if (Array.isArray(modules)) {
      role.modules = modules;
      role.isPermissionAssigned = true; // Reset flag if modules are updated
    }

    role.updatedAt = moment().toDate();
    await role.save();

    res.status(201).json({
      status: 201,
      message: "Role updated successfully",
      data: role,
    });
  } catch (error: any) {
    console.error("Error updating role:", error);
    res.status(500).json({
      message: "Failed to update role",
      error: error.message,
    });
  }
};

export const deleteRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Role = getRoleModel(dbName);
    const user = getUserModel(dbName);
    const condition = {
      role: {
        $elemMatch: {
          role_id: new mongoose.Types.ObjectId(id),
        },
      },
      status: "Active",
      deletedAt: null,
    };

    const activeRole = await user.findOne(condition);

    if (activeRole) {
      res.status(409).json({
        status: 409,
        message: "Cannot delete assigned roles",
      });
      return;
    }
    const deleted = await Role.findByIdAndUpdate(
      id,
      { deletedAt: moment().toDate() },
      { new: true }
    );

    if (!deleted) {
      throw createHttpError(404, "Role not found");
    }

    res.status(201).json({
      status: 201,
      message: "Role deleted (soft) successfully",
      data: deleted,
    });
  } catch (error: any) {
    next(error);
  }
};

export const createDefaultRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const permission = await readJSONFile(configFilePath);
    const Role = getRoleModel(dbName);

    const globalAdminRole = {
      role_name: "global_admin",
      key_value: "global_admin",
      modules: permission,
      isdefaultRole: true,
    };

    const clientRole = {
      role_name: "client",
      key_value: "client",
      modules: permission,
      isdefaultRole: true,
    };

    // Directly create both roles
    const createdRoles = await Role.insertMany([globalAdminRole, clientRole]);

    res.status(201).json({
      message: "Default roles created successfully",
      data: createdRoles,
    });
  } catch (error: any) {
    next(error);
  }
};

export const statusUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const User = getRoleModel(dbName);

    const roleId = req.params.id;
    const role = await User.findById(roleId);

    if (!role) {
      throw createHttpError(404, "Role not found");
    }

    const user = getUserModel(dbName);
    const activeRole = await user.findOne({
      "role.role_id": roleId,
      status: "active",
      deletedAt: null,
    });

    if (activeRole) {
      createHttpError({
        status: 409,
        message: "Cannot delete assigned roles",
      });
    }

    const updatedRole: any = await User.findByIdAndUpdate(
      { _id: roleId },
      { status: req.body.status }
    );

    logger.info(`role data in [${dbName}]: ${updatedRole.role_name}`);
    res
      .status(201)
      .send({ data: updatedRole, message: "Role data updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const exportRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Role = getRoleModel(dbName);

    const format = (req.params.export || "excel").toLowerCase();
    const { search = "", status = "", module } = req.query;

    const filter: any = { deletedAt: null ,isdefaultRole:false};

    const roles = await Role.find(filter).sort({ createdAt: -1 }).lean();

    const cleanedRoles = roles.map((role) => {
      const { _id, __v, deletedAt, ...rest } = role;

      // If modules is array of objects, flatten to names or ids
      const modules = Array.isArray(rest.modules)
        ? rest.modules
            .map((mod: any) => {
              if (typeof mod === "object" && mod !== null) {
                if (
                  typeof mod.permission === "object" &&
                  mod.permission !== null
                ) {
                  return Object.values(mod.permission).some(Boolean)
                    ? mod.name
                    : "";
                }
                return "";
              }
              return mod;
            })
            .filter(Boolean) // remove empty strings and falsy values
            .join(", ")
        : rest.modules;

      return {
        role_name: rest.role_name,
        status: rest.status,
        modules,
      };
    });

    if (format === "pdf") {
      await generatePdfDownload(res, cleanedRoles, "Roles");
    } else {
      await generateExcelDownload(res, cleanedRoles, "Roles");
    }
  } catch (error: any) {
    logger.error("Export Roles failed", error);
    next(error);
  }
};

// export const addModulesToRole = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): Promise<void> => {
//   try {
//     const dbName: any = (req.headers["x-db-name"] as string)||"49_tenant_dev" ;
//     const Role = getRoleModel(dbName);

//     const roleId  = req.params.id; // role ID from route param

//     const role = await Role.findOne({ _id: roleId, deletedAt: null });
//     if (!role) {
//        res.status(404).json({ message: "Role not found" });
//        return
//     }

//     const isCompanyAdmin = role.key_value === "company_admin";

//     // Load master list of modules
//     const allModules: any[] = await readJSONFile(configFilePath);

//     // Extract existing module key_values from DB
//     const existingModuleKeys = new Set(
//       (role.modules || []).map((mod) => mod.key_value)
//     );

//     // Identify missing modules
//     const missingModules = allModules.filter(
//       (mod) => !existingModuleKeys.has(mod.key_value)
//     );

//     // Process missing modules
//     const modulesToAdd = missingModules.map((mod) => {
//       const allPermissionsTrue = Object.fromEntries(
//         Object.keys(mod.permission || {}).map((key) => [key, true])
//       );

//       const newModule = {
//         ...mod,
//         permissions: isCompanyAdmin ? allPermissionsTrue : mod.permission,
//         sub_modules: mod.sub_modules?.map((sub: { allow_access: any; }) => ({
//           ...sub,
//           allow_access: isCompanyAdmin ? true : sub.allow_access || false,
//         })) || [],
//       };

//       return newModule;
//     });

//     if (modulesToAdd.length > 0) {
//       role.modules = [...(role.modules || []), ...modulesToAdd];
//       await role.save();
//     }

//     res.status(200).json({
//       message: modulesToAdd.length
//         ? "Missing modules added to role"
//         : "No missing modules found",
//       updatedModulesCount: modulesToAdd.length,
//       data: role.modules,
//     });
//   } catch (error: any) {
//     logger.error("Export Roles failed", error);
//     next(error);
//     };
//   }

export const updateRoleWithMissingModules = async (
  dbName: string,
  roleId: string
) => {
  const Role = getRoleModel(dbName);

  const role = await Role.findOne({ _id: roleId, deletedAt: null });
  if (!role) {
    return null;
  }
  // ware house admin role check
  if (role.key_value === "warehouse_admin") {
    return role;
  }

  const isCompanyAdmin = role.key_value === "company_admin";

  const allModules: any[] = await readJSONFile(configFilePath);

  const existingModuleKeys = new Set(
    (role.modules || []).map((mod) => mod.key_value)
  );

  const missingModules = allModules.filter(
    (mod) => !existingModuleKeys.has(mod.key_value)
  );

  const buildPermission = (permObj: any = {}, fillTrue = false) => {
    const keys = [
      "allow_all",
      "read",
      "write",
      "create",
      "delete",
      "import",
      "export",
    ];
    return Object.fromEntries(
      keys.map((key) => [key, fillTrue ? true : (permObj[key] ?? false)])
    );
  };

  const modulesToAdd = missingModules.map((mod) => ({
    ...mod,
    allow_access: isCompanyAdmin ? true : mod.allow_access || false,
    permission: buildPermission(mod.permission, isCompanyAdmin),
    sub_modules: (mod.sub_modules || []).map((sub: any) => ({
      ...sub,
      allow_access: isCompanyAdmin ? true : sub.allow_access || false,
      permission: buildPermission(sub.permission, isCompanyAdmin),
    })),
  }));

  if (modulesToAdd.length > 0) {
    role.modules = [...(role.modules || []), ...modulesToAdd];
    await role.save();
  }

  return role;
};

//for token

export const findRoleById = async (id: string, dbNameHeader?: string) => {
  const dbName: any = dbNameHeader || db_Name;
  const Role = getRoleModel(dbName);

  const role = await Role.findById(id).select("role_name key_value modules");
  if (!role) {
    throw createHttpError(404, "Role not found");
  }

  return role;
};
