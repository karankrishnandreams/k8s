import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import logger from "../utils/logger";
import { getDbConnection } from "../config/database";
import UserSchema from "../models/user.model";
import { IUser } from "../interfaces/user.interface";
import { Model } from "mongoose";
import { INFO_MESSAGE } from "@utils/message.constant";
import { getS3Parallel, readJSONFile, uploadParallel } from "@utils/auth.utils";
import { defaultRole } from "@utils/constant";
import { paginate } from "@utils/paginate";
import {
  generatePdfDownload,
  generateExcelDownload,
} from "@utils/export.utils";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";
import EmailTemplateSchema from "@models/emailtemplate.model";
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import { ICompany } from "@interfaces/company.interface";
import companySchema from "@models/company.model";
import { handleAxiosError } from "@utils/handleAxiosError";
import { IRole } from "@interfaces/roles.interface";
import RoleSchema from "@models/roles.model";
import path from "path";
import moment from "moment";

const DB_NAME: any = process.env.DB_NAME;

// Helper to get tenant-aware User model
const getUserModel = (dbName: string): Model<IUser> => {
  const connection = getDbConnection(dbName);
  return connection.models.User || connection.model<IUser>("User", UserSchema);
};

const getEmailTemplateModel = (dbName: string): Model<IEmailTemplate> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.EmailTemplate ||
    connection.model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema)
  );
};

const getCompanyModel = (dbName: string): Model<ICompany> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Company ||
    connection.model<ICompany>("Company", companySchema)
  );
};

const getRoleModel = (dbName: string): Model<IRole> => {
  const connection = getDbConnection(dbName);
  return connection.models.Role || connection.model<IRole>("Role", RoleSchema);
};

/**
 * @desc    Create a new user
 * @route   POST /api/users
 * @access  Public or Private
 */
export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //@ts-ignore
    const account_url = req.account_url;
    //@ts-ignore
    const company_name = req.company_name;
    //@ts-ignore
    const company_id = req.company_id;

    logger.info(INFO_MESSAGE.USER_CREATE_FUNCTION_STARTED);

    const files = req.files as {
      [profile_image: string]: Express.Multer.File[];
    };

    const body = JSON.parse(req.body.data);
    const {
      username,
      email,
      role,
      password,
      mobileNumber,
      description,
      status = "active",
      isWarehouseAdmin,
      warehouseId,
    } = body;
    // ✅ Check for required warehouseId
    if (isWarehouseAdmin && (!warehouseId || typeof warehouseId !== "string")) {
      throw createHttpError(
        400,
        "warehouseId is required when isWarehouseAdmin is true"
      );
    }

    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const User = getUserModel(dbName);
    const Company = getCompanyModel(dbName);
    const AdminCompany = getCompanyModel(DB_NAME);

    const company: any = await Company.findOne({ company_id });
    const adminCompanyData: any = await AdminCompany.findOne({ company_id });

    if (!company) throw createHttpError(404, "Company not found");
    if (!adminCompanyData)
      throw createHttpError(404, "Admin Company not found");

    // ✅ User limit checks
    if (company.trusted && company.totalUserCount >= company.maxUserCount) {
      throw createHttpError(400, "User limit exceeded for this company");
    }

    if (
      adminCompanyData.trusted &&
      adminCompanyData.totalUserCount >= adminCompanyData.maxUserCount
    ) {
      throw createHttpError(400, "User limit exceeded for this company");
    }

    // ✅ Upload profile image if present
    let profileImageUrl;
    const profileImageFile = files?.profile_image?.[0];
    if (profileImageFile?.buffer) {
      profileImageUrl = await uploadParallel(
        profileImageFile,
        `${process.env.BUCKET_FOLDER}/company_admin/users/profile_images`,
        res
      );
    }

    // ✅ Warehouse Admin Role Assignment
    let roleToAssign = role;

    if (isWarehouseAdmin) {
      const Role = getRoleModel(dbName);

      let warehouseAdminRole = await Role.findOne({
        key_value: "warehouse_admin",
      });

      if (!warehouseAdminRole) {
        const rolesConfigPath = path.join(
          __dirname,
          "..",
          "config",
          "roles.json"
        );
        const permissions = await readJSONFile(rolesConfigPath);

        const allowedModules = ["Item", "Purchasepos"];
        const filteredPermissions = permissions
          .filter((module: any) => allowedModules.includes(module.name))
          .map((module: any) => ({
            name: module.name,
            key_value: module.key_value,
            permission: Object.fromEntries(
              Object.keys(module.permissions || {}).map((key) => [key, true])
            ),
            sub_modules: [],
          }));

        warehouseAdminRole = await new Role({
          role_name: defaultRole.warehouseAdmin,
          key_value: defaultRole.warehouseAdmin,
          modules: filteredPermissions,
          isdefaultRole: true,
        }).save();
      }

      roleToAssign = [
        {
          key_value: warehouseAdminRole.key_value,
          role_id: warehouseAdminRole._id,
        },
      ];
    }

    const result = await User.aggregate([
      {
        $facet: {
          emailExists: [{ $match: { email } }, { $limit: 1 }],
          mobileExists: [{ $match: { mobileNumber } }, { $limit: 1 }],
        },
      },
    ]);

    const emailExists = result[0].emailExists.length > 0;
    const mobileExists = result[0].mobileExists.length > 0;

    if (emailExists && mobileExists) {
      return res
        .status(400)
        .json({ message: "Email and Mobile number already exist" });
    } else if (emailExists) {
      return res.status(400).json({ message: "Email already exists" });
    } else if (mobileExists) {
      return res.status(400).json({ message: "Mobile number already exists" });
    }

    // ✅ Create new user
    const user = await User.create({
      userName: username,
      email,
      mobileNumber,
      role: roleToAssign,
      password,
      description,
      status,
      profile_image: profileImageUrl,
      isWarehouseAdmin,
      warehouseId,
    });

    logger.info(`User created in ${dbName}: ${user.email}`);
    logger.info(INFO_MESSAGE.USER_CREATE_FUNCTION_COMPLETED);

    // ✅ Send welcome email
    const EmailTemplate = getEmailTemplateModel(DB_NAME);
    const template = await EmailTemplate.findOne({
      slug: "user-register-template",
      isActive: true,
    }).select("htmlBody -_id");

    if (template) {
      const configEmail: CustomAxiosRequestConfig = {
        method: "post",
        url: "/email/public/mail/send",
        data: {
          to: email,
          subject: "Your Account is now Created",
          htmlBody: template.htmlBody,
          message: "Account activated",
          emailData: {
            company_name,
            user_name: username,
            password,
            login_url:
              DB_NAME === "fusion_main_qa"
                ? `https://${account_url}.qa-fusion.dreamstechnologies.com/company/signin/`
                : `https://${account_url}.fusion.dreamstechnologies.com/company/signin`,
          },
        },
      };

      await kongAxios(configEmail);
    }

    // ✅ Update company user counts
    if (company.trusted) {
      await Company.updateOne({ company_id }, { $inc: { totalUserCount: 1 } });
      await AdminCompany.updateOne(
        { company_id },
        { $inc: { totalUserCount: 1 } }
      );
    }

    // ✅ Sanitize response
    const sanitizeUser = (user: any) => ({
      id: user._id,
      userName: user.userName,
      email: user.email,
      mobileNumber: user.mobileNumber,
      profile_image: user.profile_image,
      role: user.role?.map((r: any) => ({
        key_value: r.key_value,
        role_id: r.role_id,
      })),
      status: user.status,
      biography: user.biography,
      address_line_1: user.address_line_1,
      address_line_2: user.address_line_2,
      postal_code: user.postal_code,
    });

    res.status(201).json({
      data: sanitizeUser(user),
      message: "User Created Successfully",
    });
  } catch (error: any) {
    logger.error(INFO_MESSAGE.USER_CREATE_FUNCTION_FAILED, error);
    if (error?.isAxiosError && error?.response) {
      const status = error.response.status || 502;
      const message =
        error.response.data?.error?.message ||
        error.response.data?.message ||
        "External service error during company creation";
      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Structured error
    }

    next(error);
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
export const getUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || "default";
    const User = getUserModel(dbName);
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    if (
      user.profile_image !== undefined &&
      user.profile_image !== null &&
      user.profile_image !== ""
    ) {
      user.profile_image = await getS3Parallel(user.profile_image);
    }

    res.json({ data: user, message: "User data retrived successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private/Admin or User-Owned
 */
export const updateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as {
      [profile_image: string]: Express.Multer.File[];
    };

    const {
      username,
      email,
      mobileNumber,
      role,
      password, // consider ignoring this unless handled securely
      description,
      status,
    } = req.body;

    const dbName = (req.headers["x-db-name"] as string) || "default";
    const User = getUserModel(dbName);

    // Upload profile image if provided
    let profileImageUrl: string | undefined;
    const profileImageFile = files?.profile_image?.[0];

    // Profile image upload
    if (profileImageFile?.buffer) {
      profileImageUrl = await uploadParallel(
        profileImageFile,
        `${process.env.BUCKET_FOLDER}/company_admin/users/profile_images`,
        res
      );
    }

    // Build update object only with defined values
    const updateData: Partial<IUser> = {};

    if (username) updateData.userName = username;
    if (email) updateData.email = email;
    if (mobileNumber) updateData.mobileNumber = mobileNumber;
    if (role) updateData.role = role;
    if (password) updateData.password = password; // ensure secure handling
    if (description) updateData.description = description;
    if (status) updateData.status = status;
    if (profileImageUrl) updateData.profile_image = profileImageUrl;

    const existingUser = await User.findOne({
      _id: { $ne: req.params.id },
      email: email,
      mobileNumber: mobileNumber,
    });

    if (existingUser) {
      res.status(400).json({
        message: "Email and mobile number already used by another user.",
      });
      return;
    }

    // MongoDB update
    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    logger.info(`User updated in ${dbName}: ${user.email}`);
    res
      .status(200)
      .json({ data: user, message: "User data updated successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    //@ts-ignore
    const company_id = req.company_id;
    const dbName = (req.headers["x-db-name"] as string) || "default";
    const User = getUserModel(dbName);

    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    const token: any = req.headers["authorization"];
    const origin: any = req.headers["origin"] || req.headers["referer"];

    const configTodo: CustomAxiosRequestConfig = {
      method: "get",
      url: `/application/todo/user/exist/${userId}`,
      token,
      headers: {
        Origin: origin,
      },
    };

    const todoRes = await kongAxios(configTodo);

    if (todoRes.data && todoRes.data.data.length > 0) {
      throw createHttpError(
        404,
        "Cannot delete this user because they are linked to existing tickets."
      );
    }

    const configNote: CustomAxiosRequestConfig = {
      method: "get",
      url: `/application/note/user/exist/${userId}`,
      token,
      headers: {
        Origin: origin,
      },
    };
    const noteRes = await kongAxios(configNote);

    if (noteRes.data && todoRes.data.data.length > 0) {
      throw createHttpError(
        404,
        "Cannot delete this user because they are linked to existing notes."
      );
    }

    const configWarehouse: CustomAxiosRequestConfig = {
      method: "get",
      url: `/people/warehouse/user/exist/${userId}`,
      token,
      headers: {
        Origin: origin,
      },
    };
    const warehouseRes = await kongAxios(configWarehouse);

    if (warehouseRes.data && todoRes.data.data.length > 0) {
      throw createHttpError(
        404,
        "Cannot delete this user because they are linked to existing warehouse."
      );
    }

    // Check if user has a protected role
    const roleValue = user.role[0]?.key_value || "";
    const protectedRoles = [
      defaultRole.superAdmin,
      defaultRole.companyAdmin,
      defaultRole.ownerRole,
    ];

    if (protectedRoles.includes(roleValue)) {
      throw createHttpError(403, "You cannot delete this user");
    }

    await User.updateOne({ _id: userId }, { deletedAt: moment().toDate() });

    const Company = getCompanyModel(dbName);
    const company: any = await Company.findOne({ company_id: company_id });
    if (!company) {
      throw createHttpError(404, "Company not found");
    }

    if (company.trusted === true && company.totalUserCount <= 0) {
      throw createHttpError(
        403,
        "Cannot delete user, user limit exceeded for this company"
      );
    } else {
      await Company.updateOne(
        { company_id: company_id },
        {
          totalUserCount: company.totalUserCount - 1,
        }
      );
    }

    const adminCompany = getCompanyModel(DB_NAME);

    const adminCompanyData: any = await adminCompany.findOne({
      company_id: company_id,
    });
    if (!adminCompanyData) {
      throw createHttpError(404, "Admin Company not found");
    }

    if (
      adminCompanyData.trusted === true &&
      adminCompanyData.totalUserCount <= 0
    ) {
      throw createHttpError(
        403,
        "Cannot delete user, user limit exceeded for this company"
      );
    } else {
      await adminCompany.updateOne(
        { company_id: company_id },
        {
          totalUserCount: adminCompanyData.totalUserCount - 1,
        }
      );
    }

    logger.info(`Soft-deleted user in [${dbName}]: ${user.email}`);
    res
      .status(200)
      .send({ data: user, message: "User data deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || DB_NAME;
    const User = getUserModel(dbName);

    let {
      page = "1",
      limit = "10",
      search = "",
      status = "",
      role = "",
      disablePagination = "false",
    } = req.query;
    const userid = req.user?._id || req.user?.id;

    // Normalize types
    page = page.toString();
    limit = limit.toString();
    disablePagination = disablePagination.toString().toLowerCase();

    const filter: any = {
      deletedAt: null,
      isDefaultUser: false,
      _id: { $ne: userid },
    };

    // Search by name or email
    if (search && search.toString().trim() !== "") {
      const regex = new RegExp(search.toString().trim(), "i");
      filter.$or = [
        { userName: { $regex: regex } },
        { email: { $regex: regex } },
        { mobileNumber: { $regex: regex } },
        { "role.key_value": { $regex: regex } },
        { status: { $regex: regex } },
      ];
    }

    // Status filter
    const validStatuses = ["active", "inactive"];
    if (typeof status === "string" && status.trim()) {
      const normalizedStatus = status.trim().toLowerCase();

      if (validStatuses.includes(normalizedStatus)) {
        filter.status =
          normalizedStatus.charAt(0).toUpperCase() + normalizedStatus.slice(1);
      } else if (normalizedStatus === "All") {
        filter.status = { $in: ["Active", "Inactive"] };
      }
    } else {
      filter.status = { $in: ["Active", "Inactive"] };
    }

    // Role filter
    if (role) {
      filter["role.role_id"] = role;
    }

    // Fields to return
    const projection: any = {
      profile_image: 1,
      userName: 1,
      mobileNumber: 1,
      email: 1,
      "role.key_value": 1,
      "role.role_id": 1,
      status: 1,
      description: 1,
      createdAt: 1,
    };

    // If pagination disabled, return full data
    if (disablePagination === "true") {
      const allData = await User.find(filter, projection)
        .sort({ createdAt: -1 })
        .lean();

      const usersWithSignedUrls = await Promise.all(
        allData.map(async (user: any) => {
          let signedUrl = null;
          if (user.profile_image) {
            try {
              signedUrl = await getS3Parallel(user.profile_image);
            } catch (err) {
              logger.warn(`Signed URL failed for user ${user._id}`, err);
            }
          }
          return {
            ...user,
            profile_image: signedUrl,
          };
        })
      );

      const total = usersWithSignedUrls.length;
      const active_count = usersWithSignedUrls.filter(
        (u) => u.status === "Active"
      ).length;
      const inactive_count = total - active_count;

      res.status(200).json({
        message: "All Users retrieved successfully",
        data: usersWithSignedUrls,
        stats: {
          total_users: total,
          active_count,
          inactive_count,
        },
        type: "array",
      });
    }

    // Paginated version
    const result = await paginate(
      User,
      filter,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy: "createdAt",
        order: "desc",
      },
      projection
    );

    const usersWithSignedUrls = await Promise.all(
      result.data.map(async (user: any) => {
        let signedUrl = null;
        if (user.profile_image) {
          try {
            signedUrl = await getS3Parallel(user.profile_image);
          } catch (err) {
            logger.warn(`Signed URL failed for user ${user._id}`, err);
          }
        }
        return {
          ...user,
          profile_image: signedUrl,
        };
      })
    );

    res.status(200).json({
      message: "Users retrieved successfully",
      data: usersWithSignedUrls,
      pagination: result.pagination,
      type: "array",
    });
  } catch (error: any) {
    logger.error("List Users function failed", error);
    next(error);
  }
};

export const exportUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || DB_NAME;
    const User = getUserModel(dbName);

    const format = req.params.export.toString().toLowerCase() || "excel";

    const filter = { deletedAt: null, isDefaultUser: false };

    const projection: any = {
      userName: 1,
      mobileNumber: 1,
      email: 1,
      status: 1,
      role: 1, // Include role field for transformation
      _id: 0,
    };

    let users = await User.find(filter, projection)
      .sort({ createdAt: -1 })
      .lean();

    if (!users.length) {
      throw createHttpError(404, "No user data found");
    }

    // Extract only key_value from role array
    users = users.map((user: any) => {
      const roleKeyValues = Array.isArray(user.role)
        ? user.role.map((r: any) => r?.key_value).filter(Boolean)
        : [];
      return {
        ...user,
        roles: roleKeyValues.join(", "), // Flatten to string if needed
      };
    });

    // Optionally remove original `role` field from export
    const transformedUsers = users.map(({ role, ...rest }) => rest);

    if (format === "pdf") {
      await generatePdfDownload(res, transformedUsers, "Users");
    } else {
      await generateExcelDownload(res, transformedUsers, "Users");
    }
  } catch (error: any) {
    logger.error("Export Users function failed", error);
    next(error);
  }
};

export const statusUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || DB_NAME;
    const User = getUserModel(dbName);

    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    const updatedUser: any = await User.findByIdAndUpdate(
      { _id: userId },
      { status: req.body.status }
    );

    logger.info(`user data in [${dbName}]: ${updatedUser.email}`);
    res
      .status(201)
      .send({ data: updatedUser, message: "User data updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const getUserforSocket = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.body.dbName;
    const User = getUserModel(dbName);
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      throw createHttpError(200, "User not found");
    }

    if (
      user.profile_image !== undefined &&
      user.profile_image !== null &&
      user.profile_image !== ""
    ) {
      user.profile_image = await getS3Parallel(user.profile_image);
    }

    res.json({ data: user, message: "User data retrived successfully" });
  } catch (error) {
    next(error);
  }
};

export const getUsersforSocket = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.body.dbName;
    const userIdsRaw = req.body.ids;
    const searchText = (req.body.search || "").trim();

    if (!dbName || (!userIdsRaw && !searchText)) {
      throw createHttpError(400, "Missing dbName or search criteria");
    }

    const User = getUserModel(dbName);
    let users: any[] = [];

    // ✅ Search by IDs
    if (userIdsRaw) {
      const userIds: string[] = Array.isArray(userIdsRaw)
        ? userIdsRaw
        : typeof userIdsRaw === "string"
          ? userIdsRaw.split(",").map((id) => id.trim())
          : [];

      if (userIds.length > 0) {
        users = await User.find({ _id: { $in: userIds } }).select("-password");
      }
    }

    // ✅ Search by name (case-insensitive)
    if (searchText) {
      const searchUsers = await User.find({
        userName: { $regex: searchText, $options: "i" },
      }).select("-password");

      users.push(...searchUsers);
    }

    // ✅ Remove duplicates (by _id)
    const userMap = new Map();
    users.forEach((user) => userMap.set(String(user._id), user));
    users = Array.from(userMap.values());

    if (users.length === 0) {
      res.status(200).json({
        status: 200,
        message: "No users found",
        data: [],
      });
      return;
    }

    // ✅ Replace S3 keys with URLs
    users = await Promise.all(
      users.map(async (user: any) => {
        if (user.profile_image) {
          user.profile_image = await getS3Parallel(user.profile_image);
        }
        return user;
      })
    );

    res.status(200).json({
      message: "Users retrieved successfully",
      data: users,
    });
  } catch (error) {
    next(handleAxiosError(error));
  }
};

export const getUserByName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || "default";
    const inputName = req.params.name?.trim();

    if (!inputName) {
      res.status(400).json({ message: "Name parameter is required" });
      return;
    }

    const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, "");

    const regex = new RegExp(normalize(inputName), "i");
    const User = getUserModel(dbName);

    const existingUser = await User.aggregate([
      {
        $addFields: {
          normalizedFullName: {
            $replaceAll: {
              input: { $toLower: "$fullName" },
              find: " ",
              replacement: "",
            },
          },
          normalizedUserName: {
            $replaceAll: {
              input: { $toLower: "$userName" },
              find: " ",
              replacement: "",
            },
          },
          normalizedFirstName: {
            $replaceAll: {
              input: { $toLower: "$firstName" },
              find: " ",
              replacement: "",
            },
          },
        },
      },
      {
        $match: {
          $or: [
            { normalizedFullName: { $regex: regex } },
            { normalizedUserName: { $regex: regex } },
            { normalizedFirstName: { $regex: regex } },
          ],
        },
      },
      { $limit: 1 },
    ]);

    res.json({
      data: existingUser[0] || null,
      message: "User data retrieved successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const updateUserSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || DB_NAME;
    if (!dbName) throw createHttpError(400, "Database connection missing");
    const userId = req.user._id || req.params.id;
    const User = getUserModel(dbName);
    const user: any = await User.findById(userId);

    if (!user) throw createHttpError(404, "User not found");

    // Prepare update payload
    const payload: any = {};

    // Handle email settings (adjust based on your actual user schema)
    if (req.query.updateEmail === "true") {
      if (req.body.emailSetting && req.body.emailSetting !== "undefined") {
        payload.emailSetting = req.body.emailSetting;
      }
      if (req.body.emailPassword && req.body.emailPassword !== "undefined") {
        payload.emailPassword = req.body.emailPassword;
      }
      if (req.body.emailType && req.body.emailType !== "undefined") {
        payload.emailType = req.body.emailType;
      }
      if (req.body.globalCc && req.body.globalCc !== "undefined") {
        payload.globalCc = req.body.globalCc;
      }
    }

    if (req.query.updateEmailSignature === "true") {
      let signatureHtml = req.body.emailsignature;

      if (
        signatureHtml &&
        signatureHtml !== undefined &&
        typeof signatureHtml === "string"
      ) {
        const base64ImageRegex =
          /<img[^>]+src="data:image\/(png|jpeg|jpg|webp);base64,([^"]+)"/g;
        const matches = [...signatureHtml.matchAll(base64ImageRegex)];

        let updatedSignatureHtml = signatureHtml;

        for (let count = 0; count < matches.length; count++) {
          const match = matches[count];
          const ext = match[1]; // image extension
          const base64 = match[2];
          const buffer = Buffer.from(base64, "base64");

          const file: Express.Multer.File = {
            fieldname: `signatureImage${count}`,
            originalname: `signature-${Date.now()}-${count}.${ext}`,
            encoding: "7bit",
            mimetype: `image/${ext}`,
            buffer,
            size: buffer.length,
            destination: "",
            filename: "",
            path: "",
            stream: undefined as any,
          };

          const uploadedUrl = await uploadParallel(
            file,
            `${process.env.BUCKET_FOLDER}/super_admin/users/profile_images`,
            res
          );

          const fullMatch = match[0];
          const updatedImgTag = fullMatch.replace(
            /src="[^"]+"/,
            `src="${uploadedUrl}"`
          );
          updatedSignatureHtml = updatedSignatureHtml.replace(
            fullMatch,
            updatedImgTag
          );
        }
        payload.emailsignature = updatedSignatureHtml;
      } else {
        payload.emailsignature = req.body.emailsignature;
      }
    }

    if (req.query.updateGlobalCc === "true") {
      payload.globalCc = req.body.globalCc;
    }

    if (req.query.updateGlobalPhoneNo === "true") {
      payload.globalPhoneNo = req.body.globalPhoneNo;
    }

    if (Object.keys(payload).length === 0) {
      res.status(400).json({ message: "No valid settings to update." });
      return;
    }

    user.set(payload);
    await user.save();
    res
      .status(201)
      .json({ message: "User settings updated successfully", user });
  } catch (err) {
    next(err);
  }
};

export const getUserSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || DB_NAME;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const userId = req.params.id;
    const User = getUserModel(dbName);

    const user: any = await User.findById(userId);

    if (!user) throw createHttpError(404, "User not found");

    // Process email signature to replace S3 paths with signed URLs
    if (user.emailsignature) {
      const imagePathRegex = /<img[^>]+src="([^"]+)"/g;
      let updatedSignature = user.emailsignature;
      const matches = [...user.emailsignature.matchAll(imagePathRegex)];

      for (const match of matches) {
        const originalSrc = match[1];

        if (
          !originalSrc.startsWith("http") &&
          !originalSrc.startsWith("data:")
        ) {
          try {
            const signedUrl = await getS3Parallel(originalSrc);
            updatedSignature = updatedSignature.replace(
              new RegExp(
                originalSrc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "g"
              ),
              signedUrl
            );
          } catch (err) {
            console.warn(`❌ Failed to get signed URL for ${originalSrc}`, err);
          }
        } else {
          console.log(
            `⏩ Skipping image: ${originalSrc} (already a full URL or base64)`
          );
        }
      }
      user.emailsignature = updatedSignature;
    }

    res.status(200).json({
      message: "User settings retrieved successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};
