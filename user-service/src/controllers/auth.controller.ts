import { Request, Response, NextFunction, response } from "express";
import {
  generateToken,
  generateRefreshToken,
  getS3Parallel,
  generateScanLoginToken,
} from "../utils/auth.utils";
import { RefreshTokenPayload, TokenPayload } from "../types/jwt";
import logger from "@utils/logger";
import { getDbConnection } from "../config/database";
import UserSchema from "../models/user.model";
import { IUser } from "../interfaces/user.interface";
import { Model } from "mongoose";
import { getFullName } from "@utils/common.utils";
import { ERROR_MESSAGE } from "@utils/message.constant";
import bcrypt from "bcryptjs";
import { maskEmail } from "@utils/hooks/utils";
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import createHttpError from "http-errors";
import EmailTemplateSchema from "@models/emailtemplate.model";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";

import RoleSchema from "@models/roles.model";
import { IRole } from "@interfaces/roles.interface";
import { ISubscription } from "@interfaces/subscription.interface";
import subscriptionSchema from "@models/subscription.model";
import { decrypt, encrypt } from "@utils/crypto.utils";
import companySchema from "@models/company.model";
import { ICompany } from "@interfaces/company.interface";
import jwt from "jsonwebtoken";
import { validateRolePermission } from "@utils/role-permission-checker";
import { findRoleById, updateRoleWithMissingModules } from "./role.controller";
const fs = require("fs");
const path = require("path");
import crypto from "crypto";
import CryptoJS from "crypto-js";
import moment from "moment";
const SECRET_KEY: any = process.env.CRYPTO_SECRET_KEY; // Use .env in production

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

const getSubscriptionModel = (dbName: string): Model<ISubscription> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Subscription ||
    connection.model<ISubscription>("Subscription", subscriptionSchema)
  );
};

const getRoleModel = (dbName: string): Model<IRole> => {
  const connection = getDbConnection(dbName);
  return connection.models.Role || connection.model<IRole>("Role", RoleSchema);
};

const getCompanyModel = (dbName: string): Model<ICompany> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Company ||
    connection.model<ICompany>("Company", companySchema)
  );
};

const db_Name: any = process.env.DB_NAME;

export const companyAdminLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    // tenant id
    //@ts-ignore
    const company_id = req.company_id;

    //@ts-ignore
    const account_url = req.account_url;

    const dbName: any = (req.headers["x-db-name"] as string) || null;

    const User = getUserModel(dbName);

    const user: any = await User.findOne({ email }).select("+password");

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    if (user.deletedAt) {
      throw createHttpError(400, "The user is deleted");
    }

    // const hasRequiredRole = user?.role?.some(
    //   (r: { key_value: string }) => r.key_value === "company_admin"
    // );

    // if (!hasRequiredRole) {
    //   res
    //     .status(403)
    //     .json({ error: "You do not have permission to perform this action" });
    //   return;
    // }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw createHttpError(401, "Password is incorrect");
    }
    //for login
    const Subscriptions: any = getSubscriptionModel(db_Name);

    const today = moment().toDate();
    const companies = getCompanyModel(db_Name);
    const company: any = await companies.findOne({
      account_url: account_url,
      deletedAt: null,
      status: "Active",
    });

    if (!company) {
      throw createHttpError(404, "Company not found");
    }

    // ✅ SUBSCRIPTION CHECK STARTS HERE
    const activeSubscription = await Subscriptions.findOne({
      company_obj_id: company._id,
      status: "active",
    });

    const encryptedUser = await encrypt({
      user_id: company._id,
      email: company.email,
      name: company.name,
      productId: activeSubscription?.stripe_product,
      priceId: activeSubscription?.pricing_id,
      coupon_id: activeSubscription?.coupon_id,
      companyId: company.company_id,
      companyObjId: company._id,
      packageObjId: company.package_id,
      accountURL: company?.account_url,
    });
    if (!activeSubscription) {
      // 🔔 Send Email Notification for Unsubscribed User

      const EmailTemplate = getEmailTemplateModel(dbName);
      const template = await EmailTemplate.findOne({
        slug: "email-unsubscribed-template", // Use correct slug
        isActive: true,
      }).select("htmlBody -_id");

      if (template) {
        const configEmail: CustomAxiosRequestConfig = {
          method: "post",
          url: "/email/public/mail/send",
          data: {
            to: user.email,
            subject: "You're not subscribed yet!",
            htmlBody: template.htmlBody,
            message:
              "It looks like you're not subscribed. Please choose a plan to get started.",
            emailData: {
              user_name: user.userName,
              company_name: user.companyName || "your company",
              subscription_link:
                db_Name === "fusion_main_qa"
                  ? `https://${company.account_url}.qa-fusion.dreamstechnologies.com/package/${encryptedUser}`
                  : `https://${company.account_url}.fusion.dreamstechnologies.com/package/${encryptedUser}`,
              current_year: new Date().getFullYear(),
            },
          },
        };
        await kongAxios(configEmail);
      }
      throw createHttpError(404, "You're not subscribed yet!");
    } else if (
      activeSubscription.nextBillingDate &&
      new Date(activeSubscription.nextBillingDate) < today
    ) {
      // 🔔 Send Email Notification for Expired Subscription

      const EmailTemplate = getEmailTemplateModel(db_Name);
      const template = await EmailTemplate.findOne({
        slug: "e-mail-subscription-template", // Use correct slug
        isActive: true,
      }).select("htmlBody -_id");

      if (template) {
        const configEmail: CustomAxiosRequestConfig = {
          method: "post",
          url: "/email/public/mail/send",
          data: {
            to: user.email,
            subject: "Your subscription has expired",
            htmlBody: template.htmlBody,
            message:
              "Your subscription has expired. Please update your package to regain access.",
            emailData: {
              user_name: user.userName,
              website: "https://fusion.dreamstechnologies.com",
              update_pass_url:
                db_Name === "fusion_main_qa"
                  ? `https://${company.account_url}.qa-fusion.dreamstechnologies.com/package/${encryptedUser}`
                  : `https://${company.account_url}.fusion.dreamstechnologies.com/package/${encryptedUser}`,
            },
          },
        };

        await kongAxios(configEmail);
      }

      throw createHttpError(404, "You're Subscription is expired");
    }

    if (company?.otpVerification === true) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

      user.otp = otp;
      user.otpExpiresAt = otpExpiresAt;
      await user.save();
      logger.info(`[LOGIN] OTP saved for: ${email}`);

      const EmailTemplate = getEmailTemplateModel(db_Name);
      const otpTemplate = await EmailTemplate.findOne({
        slug: "email-otp",
        isActive: true,
      }).select("htmlBody -_id");

      if (!otpTemplate) {
        logger.error("[LOGIN] OTP email template not found");
        throw createHttpError(404, ERROR_MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
      }

      const htmlBody = otpTemplate.htmlBody
        .replace(/{{otp}}/g, otp)
        .replace(/{{user_name}}/g, user.userName);

      const emailConfig = {
        method: "post",
        url: "/email/public/mail/send",
        data: {
          to: email,
          subject: "Your company admin login OTP Code",
          htmlBody,
          message: "Please use this OTP to login your company admin!",
          emailData: { user_name: user.userName, otp },
        },
      };

      await kongAxios(emailConfig);
      logger.info(`[LOGIN] OTP email sent to: ${email}`);

      res.status(200).json({
        message: "OTP sent to your email",
        data: { otpVerification: true },
      });
    } else {
      // Fetch role permissions by role_id
      let rolesPermission = null;
      if (user.role && user.role[0] && user.role[0].role_id) {
        rolesPermission = await findRoleById(user.role[0].role_id, dbName);
      }

      const tokenPayload: TokenPayload = {
        id: user._id.toString(),
        email: maskEmail(user?.email),
        mobileNumber: user?.mobileNumber,
        countryCode: user?.countryCode,
        isEmailVerified: user?.isEmailVerified,
        role: user.role,
        iss: "fusion_consumer",
        company_id,
        userName: user.userName,
        accountURL: company?.account_url,
        emailSetting: user?.emailSetting,
        emailPassword: user?.emailPassword,
        emailType: user?.emailType,
        globalCc: user?.globalCc,
      };

      const refreshTokenPayload: RefreshTokenPayload = {
        id: user._id.toString(),
        email: user?.email,
        mobileNumber: user?.mobileNumber,
        countryCode: user?.countryCode,
        isEmailVerified: user?.isEmailVerified,
        role: user.role,
        iss: "fusion_consumer",
        userName: user.userName,
        accountURL: company?.account_url,
        emailSetting: user?.emailSetting,
        emailPassword: user?.emailPassword,
        emailType: user?.emailType,
        globalCc: user?.globalCc,
      };
      let signedUrl: string | null = null;

      if (
        user.profile_image !== undefined &&
        user.profile_image !== null &&
        user.profile_image !== ""
      ) {
        signedUrl = await getS3Parallel(user.profile_image);
      }

      const accessToken = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(refreshTokenPayload);
          // for now stopped as we get modules by plan
      // await updateRoleWithMissingModules(dbName, user.role[0].role_id);
      logger.info(`Company admin login ${dbName}: ${user.email}`);
      res.status(200).json({
        user: {
          _id: user._id.toString(),
          email: user?.email,
          userName: user.userName,
          mobileNumber: user?.mobileNumber,
          countryCode: user?.countryCode,
          isEmailVerified: user?.isEmailVerified,
          role: user.role,
          otpVerification: false,
          profile_image: signedUrl,
          tenant_company_id: user?.tenant_company_id,
          company_id: company.company_id,
          roles: rolesPermission,
          currencyCVR: company?.currencyCVR,
          isWarehouseAdmin: user?.isWarehouseAdmin || false,
          warehouseId: user?.warehouseId || null,
          emailSetting: user?.emailSetting,
          emailPassword: user?.emailPassword,
          emailType: user?.emailType,
          globalCc: user?.globalCc,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      });
    }
  } catch (error: any) {
    logger.error("Company admin login error:", error);
    if (error?.isAxiosError && error?.response) {
      const status = error.response.status || 502;
      const message =
        error.response.data?.error?.message || // typical structure
        error.response.data?.message || // fallback
        "External service error during company creation";

      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Already structured error
    }
    next(error);
  }
};

export const companyRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    //@ts-ignore
    const { refreshTokenData } = req.body;

    type UserRole = {
      key_value: string;
      role_id: string | null;
    };

    const decoded = jwt.verify(
      refreshTokenData,
      process.env.REFRESH_TOKEN_SECRET || "secret"
    ) as unknown as {
      role: UserRole[];
      [key: string]: any;
    };

    const { id } = decoded;

    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const User = getUserModel(dbName);

    let user: any;

    // Find user by verification code, assuming your system stores a pending code on the user
    user = await User.findOne({ _id: id });

    if (!user) {
      throw createHttpError(401, "Invalid refresh token: user not found");
    }
    let rolesPermission: any = null;
    if (user.role && user.role[0] && user.role[0].role_id) {
      rolesPermission = await findRoleById(user.role[0].role_id, dbName);
    }
    const tokenPayload: TokenPayload = {
      id: user._id.toString(),
      email: user.email,
      mobileNumber: user.mobileNumber,
      countryCode: user.countryCode,
      isEmailVerified: user.isEmailVerified,
      role: user.role, // keep full role object for consistency
      iss: "fusion_consumer",
      userName: user.userName,
      accountURL: decoded.accountURL,
      emailSetting: user.emailSetting,
      emailPassword: user.emailPassword,
      emailType: user.emailType,
      globalCc: user.globalCc,
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      id: user._id.toString(),
      email: user?.email,
      mobileNumber: user?.mobileNumber,
      countryCode: user?.countryCode,
      isEmailVerified: user?.isEmailVerified,
      role: user.role,
      iss: "fusion_consumer",
      accountURL: decoded.accountURL,
      emailSetting: user.emailSetting,
      emailPassword: user.emailPassword,
      emailType: user.emailType,
      globalCc: user.globalCc,
    };

    // type check

    const accessToken = generateToken(tokenPayload);

    const refreshToken = generateRefreshToken(refreshTokenPayload);

    res.status(200).json({
      // ...tokenPayload,
      accessToken,
      refreshToken,
    });
    return;
  } catch (err) {
    console.error("OTP verification error:", err);
    next(err);
  }
};

//login

export const superAdminLoginRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    logger.info(`[LOGIN] Request for email: ${email}, DB: ${dbName}`);
    const User = getUserModel(dbName);
    const user: any = await User.findOne({ email }).select("+password");
    if (!user) {
      logger.warn(`[LOGIN] User not found: ${email}`);
      throw createHttpError(404, "User not found");
    }

    if (user.deletedAt) {
      throw createHttpError(400, "The user is deleted");
    }
    if (user.role[0].key_value !== "super_admin") {
      throw createHttpError(
        403,
        "You do not have permission to perform this action"
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      logger.warn(`[LOGIN] Invalid password attempt for: ${email}`);
      throw createHttpError(400, "Invalid password");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();
    logger.info(`[LOGIN] OTP saved for: ${email}`);

    const EmailTemplate = getEmailTemplateModel(dbName);
    const otpTemplate = await EmailTemplate.findOne({
      slug: "email-otp",
      isActive: true,
    }).select("htmlBody -_id");

    if (!otpTemplate) {
      logger.error("[LOGIN] OTP email template not found");
      throw createHttpError(404, ERROR_MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
    }

    const htmlBody = otpTemplate.htmlBody
      .replace(/{{otp}}/g, otp)
      .replace(/{{user_name}}/g, user.userName);

    const emailConfig = {
      method: "post",
      url: "/email/public/mail/send",
      data: {
        to: email,
        subject: "Your super admin login OTP Code",
        htmlBody,
        message: "Please use this OTP to login your super admin!",
        emailData: { user_name: user.userName, otp },
      },
    };

    await kongAxios(emailConfig);
    logger.info(`[LOGIN] OTP email sent to: ${email}`);

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err: any) {
    logger.error(`[LOGIN] Error: ${err.message}`, { stack: err.stack });
    if (err?.isAxiosError && err?.response) {
      const status = err.response.status || 502;
      const message =
        err.response.data?.error?.message || // typical structure
        err.response.data?.message || // fallback
        "External service error during company creation";

      return next(createHttpError(status, message));
    }

    if (err?.status && err?.message) {
      return next(err); // Already structured error
    }
    next(err);
  }
};

export const superAdminVerifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp } = req.body;
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    logger.info(
      `[VERIFY] OTP verification request for: ${email}, DB: ${dbName}`
    );

    const User = getUserModel(dbName);
    const user: any = await User.findOne({ email });

    if (!user) {
      logger.warn(`[VERIFY] User not found: ${email}`);
      throw createHttpError(404, "User not found");
    }

    if (user.deletedAt) {
      throw createHttpError(400, "The user is deleted");
    }

    const now = moment().toDate();
    if (user.otp !== otp || !user.otpExpiresAt || user.otpExpiresAt < now) {
      logger.warn(`[VERIFY] Invalid or expired OTP for: ${email}`);
      throw createHttpError(400, "Invalid or expired OTP");
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();
    logger.info(`[VERIFY] OTP verified and cleared for: ${email}`);

    const roles = Array.isArray(user.role)
      ? user.role
      : [{ key_value: user.role || "unknown" }];

    const tokenPayload: TokenPayload = {
      id: user._id.toString(),
      userName: user.userName,
      email: maskEmail(user.email),
      mobileNumber: user.mobileNumber,
      countryCode: user.countryCode,
      isEmailVerified: user.isEmailVerified,
      role: roles,
      iss: "fusion_consumer",
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    // for now stopped as we get modules by plan
    // await updateRoleWithMissingModules(dbName, user.role[0].role_id);
    logger.info(`[VERIFY] Token generated for: ${email}`);

    res.status(200).json({
      ...tokenPayload,
      accessToken,
      refreshToken,
      status: true,
      user_details: user,
    });
  } catch (err: any) {
    logger.error(`[VERIFY] Error: ${err.message}`, { stack: err.stack });
    next(err);
  }
};

export const resendSuperAdminOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    logger.info(`[RESEND] OTP resend request for: ${email}, DB: ${dbName}`);

    const User = getUserModel(dbName);
    const user: any = await User.findOne({ email });

    if (!user) {
      logger.warn(`[RESEND] User not found: ${email}`);
      throw createHttpError(404, "User not found");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();
    logger.info(`[RESEND] OTP regenerated for: ${email}`);

    const EmailTemplate = getEmailTemplateModel(dbName);
    const otpTemplate = await EmailTemplate.findOne({
      slug: "email-otp",
      isActive: true,
    }).select("htmlBody -_id");

    if (!otpTemplate) {
      logger.error("[RESEND] OTP email template not found");
      throw createHttpError(404, ERROR_MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
    }

    const htmlBody = otpTemplate.htmlBody
      .replace(/{{otp}}/g, otp)
      .replace(/{{user_name}}/g, user.userName);

    const emailConfig = {
      method: "post",
      url: "/email/public/mail/send",
      data: {
        to: email,
        subject: "Your OTP Code (Resend)",
        htmlBody,
        message: "Here is your resent OTP for super admin login.",
        emailData: {
          user_name: user.userName,
          otp,
        },
      },
    };

    await kongAxios(emailConfig);
    logger.info(`[RESEND] OTP email sent again to: ${email}`);

    res.status(200).json({ message: "OTP resent successfully to your email." });
  } catch (err: any) {
    logger.error(`[RESEND] Error: ${err.message}`, { stack: err.stack });
    if (err?.isAxiosError && err?.response) {
      const status = err.response.status || 502;
      const message =
        err.response.data?.error?.message || // typical structure
        err.response.data?.message || // fallback
        "External service error during company creation";

      return next(createHttpError(status, message));
    }

    if (err?.status && err?.message) {
      return next(err); // Already structured error
    }
    next(err);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    const User = getUserModel(dbName);

    const user: any = await User.findOne({ email });
    if (!user) res.status(404).json({ message: "User not found" });

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = expiry;
    await user.save();

    // Encrypt user _id, token, and expiry
    const encryptedToken = encrypt({
      _id: user._id.toString(),
      token: resetToken,
      expires: expiry,
    });

    const frontendUrl =
      process.env.FRONTEND_URL || "fusion.dreamstechnologies.com";
    const resetLink = `https://${frontendUrl}/admin/reset-password/${encryptedToken}`;

    // Load email template
    const EmailTemplate = getEmailTemplateModel(db_Name);
    const template = await EmailTemplate.findOne({
      slug: "forgot-password",
      isActive: true,
    });
    if (!template) throw createHttpError(404, "Email template not found");

    // // Logo handling
    // const logoFilePath = path.join(__dirname, "../utils/images/logo.png");
    // let logo_img = "";
    // try {
    //   const logoBase64 = fs.readFileSync(logoFilePath, "utf8");
    //   logo_img = `data:image/svg+xml;utf8,${encodeURIComponent(logoBase64)}`;
    // } catch (e) {
    //   logger.warn("Logo SVG not found or failed to read.");
    // }

    const htmlBody = template.htmlBody
      .replace(/{{reset_url}}/g, resetLink)
      .replace(/{{logo_img}}/g, "");

    // Send Email
    await kongAxios({
      method: "post",
      url: "/email/public/mail/send",
      data: {
        to: email,
        subject: "Reset Your Password",
        htmlBody,
        message: "Reset your password using the link below.",
        emailData: {
          user_name: user?.userName || "your company",
          reset_url: resetLink,
        },
      },
    });

    res.status(201).json({ message: "Reset password link sent." });
  } catch (err) {
    logger.error("Forgot password failed", err);
    next(err);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { _id, token, newPassword } = req.body;
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    const User = getUserModel(dbName);

    // Use moment for date comparison
    const user: any = await User.findOne({
      _id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: moment().toDate() }, // not expired
    });

    if (!user) {
      res.status(400).json({ message: "Reset link is invalid or has expired." })
      return;
    }

    user.password = newPassword; // Assume pre-save hook handles hashing
    user.resetPasswordToken = undefined; // Invalidate the token
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(201).json({ message: "Password reset successful." });
  } catch (err) {
    logger.error("Password reset failed", err);
    next(err);
  }
};

export const companyAdminVerifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // tenant id
    //@ts-ignore
    const company_id = req.company_id;
    const account_url = (req as any).account_url;
    const { email, otp } = req.body;
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    logger.info(
      `[VERIFY] OTP verification request for: ${email}, DB: ${dbName}`
    );

    const User = getUserModel(dbName);
    const user: any = await User.findOne({ email });

    if (!user) {
      logger.warn(`[VERIFY] User not found: ${email}`);
      throw createHttpError(404, "User not found");
    }

    if (user.deletedAt) {
      throw createHttpError(400, "The user is deleted");
    }

    const now = moment().toDate();
    if (user.otp !== otp || !user.otpExpiresAt || user.otpExpiresAt < now) {
      logger.warn(`[VERIFY] Invalid or expired OTP for: ${email}`);
      throw createHttpError(400, "Invalid or expired OTP");
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();
    logger.info(`[VERIFY] OTP verified and cleared for: ${email}`);

    const roles = Array.isArray(user.role)
      ? user.role
      : [{ key_value: user.role || "unknown" }];

    // Fetch role permissions by role_id
    let rolesPermission = null;
    if (user.role && user.role[0] && user.role[0].role_id) {
      rolesPermission = await findRoleById(user.role[0].role_id, dbName);
    }

    const tokenPayload: TokenPayload = {
      id: user._id.toString(),
      email: maskEmail(user.email),
      mobileNumber: user.mobileNumber,
      countryCode: user.countryCode,
      isEmailVerified: user.isEmailVerified,
      role: user.role, // <-- add role here
      iss: "fusion_consumer",
      company_id,
      userName: user.userName,
      accountURL: account_url,
      emailSetting: user.emailSetting,
      emailPassword: user.emailPassword,
      emailType: user.emailType,
      globalCc: user.globalCc,
    };

    const accessToken = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    let signedUrl: string | null = null;

    if (
      user.profile_image !== undefined &&
      user.profile_image !== null &&
      user.profile_image !== ""
    ) {
      signedUrl = await getS3Parallel(user.profile_image);
    }

    logger.info(`[VERIFY] Token generated for: ${email}`);
    await updateRoleWithMissingModules(dbName, user.role[0].role_id);
    const companies = getCompanyModel(db_Name);

    const company: any = await companies.findOne({
      company_id,
    });

    res.status(200).json({
      ...tokenPayload,
      accessToken,
      refreshToken,
      status: true,
      user_details: {
        _id: user._id.toString(),
        email: user?.email,
        userName: user.userName,
        mobileNumber: user?.mobileNumber,
        countryCode: user?.countryCode,
        isEmailVerified: user?.isEmailVerified,
        role: user.role,
        otpVerification: false,
        profile_image: signedUrl,
        tenant_company_id: user?.tenant_company_id,
        company_id: company_id,
        roles: rolesPermission,
        currencyCVR: company?.currencyCVR,
        isWarehouseAdmin: user?.isWarehouseAdmin || false,
        warehouseId: user?.warehouseId || null,
        emailSetting: user.emailSetting,
        emailPassword: user.emailPassword,
        emailType: user.emailType,
        globalCc: user.globalCc,
      },
      profile_image: signedUrl,
    });
  } catch (err: any) {
    logger.error(`[VERIFY] Error: ${err.message}`, { stack: err.stack });
    next(err);
  }
};

export const resendCompanyAdminOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    logger.info(`[RESEND] OTP resend request for: ${email}, DB: ${dbName}`);

    const User = getUserModel(dbName);
    const user: any = await User.findOne({ email });

    if (!user) {
      logger.warn(`[RESEND] User not found: ${email}`);
      throw createHttpError(400, "User not found");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();
    logger.info(`[RESEND] OTP regenerated for: ${email}`);

    const EmailTemplate = getEmailTemplateModel(dbName);
    const otpTemplate = await EmailTemplate.findOne({
      slug: "email-otp",
      isActive: true,
    }).select("htmlBody -_id");

    if (!otpTemplate) {
      logger.error("[RESEND] OTP email template not found");
      throw createHttpError(404, ERROR_MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
    }

    const htmlBody = otpTemplate.htmlBody
      .replace(/{{otp}}/g, otp)
      .replace(/{{user_name}}/g, user.userName);

    const emailConfig = {
      method: "post",
      url: "/email/public/mail/send",
      data: {
        to: email,
        subject: "Your OTP Code (Resend)",
        htmlBody,
        message: "Here is your resent OTP for company admin login.",
        emailData: {
          user_name: user.userName,
          otp,
        },
      },
    };

    await kongAxios(emailConfig);
    logger.info(`[RESEND] OTP email sent again to: ${email}`);

    res.status(200).json({ message: "OTP resent successfully to your email." });
  } catch (err: any) {
    logger.error(`[RESEND] Error: ${err.message}`, { stack: err.stack });
    if (err?.isAxiosError && err?.response) {
      const status = err.response.status || 502;
      const message =
        err.response.data?.error?.message || // typical structure
        err.response.data?.message || // fallback
        "External service error during company creation";

      return next(createHttpError(status, message));
    }

    if (err?.status && err?.message) {
      return next(err); // Already structured error
    }
  }
};

export const companyForgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    const User = getUserModel(dbName);

    //@ts-ignore
    const account_url = req.account_url;

    const user: any = await User.findOne({ email });
    if (!user) throw createHttpError(404, "User not found");

    const companies = getCompanyModel(db_Name);
    const company: any = await companies.findOne({
      account_url: account_url,
      deletedAt: null,
      status: "Active",
    });

    // Generate secure token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = expiry;
    await user.save();

    // Encrypt user _id, token, and expiry
    const encryptedToken = encrypt({
      _id: user._id.toString(),
      token: resetToken,
      expires: expiry,
    });

    const frontendUrl =
      process.env.FRONTEND_URL || "fusion.dreamstechnologies.com";
    const resetLink = `https://${company.account_url}.${frontendUrl}/company/reset-password/${encryptedToken}`;

    // Load email template
    const EmailTemplate = getEmailTemplateModel(db_Name);
    const template = await EmailTemplate.findOne({
      slug: "forgot-password",
      isActive: true,
    });
    if (!template) throw createHttpError(404, "Email template not found");

    const htmlBody = template.htmlBody
      .replace(/{{reset_url}}/g, resetLink)
      .replace(/{{logo_img}}/g, "");

    // Send Email
    await kongAxios({
      method: "post",
      url: "/email/public/mail/send",
      data: {
        to: email,
        subject: "Reset Your Password",
        htmlBody,
        message: "Reset your password using the link below.",
        emailData: {
          user_name: company?.name || "your company",
          reset_url: resetLink,
        },
      },
    });

    res.status(201).json({ message: "Reset password link sent." });
  } catch (err) {
    logger.error("Forgot password failed", err);
    next(err);
  }
};

export const companyResetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { _id, token, newPassword } = req.body;
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    const User = getUserModel(dbName);

    const user: any = await User.findOne({
      _id,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: moment().toDate() }, // not expired
    });

    if (!user) {
      res.status(400).json({ message: "Reset link is invalid or has expired." })
      return;
    }

    user.password = newPassword; // Assume pre-save hook handles hashing
    user.resetPasswordToken = undefined; // Invalidate the token
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(201).json({ message: "Password reset successful." });
  } catch (err) {
    logger.error("Password reset failed", err);
    next(err);
  }
};

export const companyProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const url = req.params.url;

    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const Company = getCompanyModel(dbName);

    const company: any = await Company.findOne({ account_url: url });

    if (!company) {
      throw createHttpError(404, "Company not found");
    }

    if (
      !company.profileImage ||
      company.profileImage === null ||
      company.profileImage === undefined ||
      company.profileImage === ""
    ) {
      throw createHttpError(200, "Company profile image not found");
    }

    const signedUrl = await getS3Parallel(company.profileImage);
    if (!signedUrl) {
      throw createHttpError(404, "Company Profile image not found");
    }

    res.status(200).json({
      profileImage: signedUrl,
      message: "Company Profile Found successful.",
    });
  } catch (err) {
    logger.error("Company Profile failed", err);
    next(err);
  }
};

export const superRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    //@ts-ignore
    const { refreshTokenData } = req.body;

    type UserRole = {
      key_value: string;
      role_id: string | null;
    };

    const decoded = jwt.verify(
      refreshTokenData,
      process.env.REFRESH_TOKEN_SECRET || "secret"
    ) as unknown as {
      role: UserRole[];
      [key: string]: any;
    };

    const { id } = decoded;

    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const User = getUserModel(dbName);

    let user: any;

    // Find user by verification code, assuming your system stores a pending code on the user
    user = await User.findOne({ _id: id });

    if (!user) {
      throw createHttpError(401, "Invalid refresh token: user not found");
    }

    const tokenPayload: TokenPayload = {
      id: user._id.toString(),
      email: user.email,
      mobileNumber: user.mobileNumber,
      countryCode: user.countryCode,
      isEmailVerified: user.isEmailVerified,
      role: (user.role || []).map((r: any) => r.key_value), // ✅ simplified role
      iss: "fusion_consumer",
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      id: user._id.toString(),
      email: user?.email,
      mobileNumber: user?.mobileNumber,
      countryCode: user?.countryCode,
      isEmailVerified: user?.isEmailVerified,
      role: user.role,
      iss: "fusion_consumer",
    };

    // type check

    const accessToken = generateToken(tokenPayload);

    const refreshToken = generateRefreshToken(refreshTokenPayload);

    res.status(200).json({
      // ...tokenPayload,
      accessToken,
      refreshToken,
    });
    return;
  } catch (err) {
    console.error("OTP verification error:", err);
    next(err);
  }
};

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
    case "PATCH":
      return perms.update;
    case "DELETE":
      return perms.delete;
    default:
      return false;
  }
};

export const checkRolePermission = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.body.dbName;
    const roleKEY = req.body.roleKEY;
    const decoded = req.body.decoded;
    const method = req.body.method;
    const path = req.body.path;
    let result = await validateRolePermission(
      dbName,
      roleKEY,
      decoded,
      method,
      path
    );
    if (result.success) {
      res.status(200).json({
        message: result.message,
        success: result.success,
        status: result.status,
      });
    } else {
      res.status(200).json({
        message: result.message,
        success: result.success,
        status: result.status,
      });
    }
  } catch (error) {
    next(error);
  }
};


export const scanLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, companyId } = req.body;

    const dbName = req.body.companyId + process.env.DB_SUFFIX;

    const User = getUserModel(dbName);

    const user: any = await User.findOne({ email }).select("+password");

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    if (user.deletedAt) {
      throw createHttpError(400, "The user is deleted");
    }

    // const hasRequiredRole = user?.role?.some(
    //   (r: { key_value: string }) => r.key_value === "company_admin"
    // );

    // if (!hasRequiredRole) {
    //   res
    //     .status(403)
    //     .json({ error: "You do not have permission to perform this action" });
    //   return;
    // }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw createHttpError(401, "Password is incorrect");
    }
    //for login
    const Subscriptions: any = getSubscriptionModel(db_Name);

    const today = moment().toDate();
    const companies = getCompanyModel(db_Name);

    const company: any = await companies.findOne({
      company_id: companyId,
      deletedAt: null,
      status: "Active",
    });

    if (!company) {
      throw createHttpError(404, "Company not found");
    }

    // ✅ SUBSCRIPTION CHECK STARTS HERE
    const activeSubscription = await Subscriptions.findOne({
      company_obj_id: company._id,
      status: "active",
    });

    const encryptedUser = await encrypt({
      user_id: company._id,
      email: company.email,
      name: company.name,
      productId: activeSubscription?.stripe_product,
      priceId: activeSubscription?.pricing_id,
      coupon_id: activeSubscription?.coupon_id,
      companyId: company.company_id,
      companyObjId: company._id,
      packageObjId: company.package_id,
      accountURL: company?.account_url,
    });

    if (!activeSubscription) {
      // 🔔 Send Email Notification for Unsubscribed User

      const EmailTemplate = getEmailTemplateModel(db_Name);

      const template = await EmailTemplate.findOne({
        slug: "email-unsubscribed-template", // Use correct slug
        isActive: true,
      }).select("htmlBody -_id");

      if (template) {
        const configEmail: CustomAxiosRequestConfig = {
          method: "post",
          url: "/email/public/mail/send",
          data: {
            to: user.email,
            subject: "You're not subscribed yet!",
            htmlBody: template.htmlBody,
            message:
              "It looks like you're not subscribed. Please choose a plan to get started.",
            emailData: {
              user_name: user.userName,
              company_name: user.companyName || "your company",
              subscription_link:
                db_Name === "fusion_main_qa"
                  ? `https://${company.account_url}.qa-fusion.dreamstechnologies.com/package/${encryptedUser}`
                  : `https://${company.account_url}.fusion.dreamstechnologies.com/package/${encryptedUser}`,
              current_year: new Date().getFullYear(),
            },
          },
        };
        await kongAxios(configEmail);
      }
      throw createHttpError(404, "You're not subscribed yet!");
    } else if (
      activeSubscription.nextBillingDate &&
      new Date(activeSubscription.nextBillingDate) < today
    ) {
      // 🔔 Send Email Notification for Expired Subscription
      const EmailTemplate = getEmailTemplateModel(db_Name);
      const template = await EmailTemplate.findOne({
        slug: "e-mail-subscription-template", // Use correct slug
        isActive: true,
      }).select("htmlBody -_id");
      if (template) {
        const configEmail: CustomAxiosRequestConfig = {
          method: "post",
          url: "/email/public/mail/send",
          data: {
            to: user.email,
            subject: "Your subscription has expired",
            htmlBody: template.htmlBody,
            message:
              "Your subscription has expired. Please update your package to regain access.",
            emailData: {
              user_name: user.userName,
              website: "https://fusion.dreamstechnologies.com",
              update_pass_url:
                db_Name === "fusion_main_qa"
                  ? `https://${company.account_url}.qa-fusion.dreamstechnologies.com/package/${encryptedUser}`
                  : `https://${company.account_url}.fusion.dreamstechnologies.com/package/${encryptedUser}`,
            },
          },
        };

        await kongAxios(configEmail);
      }
      throw createHttpError(404, "You're Subscription is expired");
    }

    // Fetch role permissions by role_id
    let rolesPermission = null;
    if (user.role && user.role[0] && user.role[0].role_id) {
      rolesPermission = await findRoleById(user.role[0].role_id, dbName);
    }

    const tokenPayload: TokenPayload = {
      id: user._id.toString(),
      email: maskEmail(user?.email),
      mobileNumber: user?.mobileNumber,
      countryCode: user?.countryCode,
      isEmailVerified: user?.isEmailVerified,
      role: user.role,
      iss: "fusion_consumer",
      company_id: company.company_id,
      userName: user.userName,
      accountURL: company?.account_url,
    };

    // Use 3-minute expiry token for scanLogin
    const accessToken = generateScanLoginToken(tokenPayload);
    // No refresh token for scanLogin
    let signedUrl: string | null = null;
    if (
      user.profile_image !== undefined &&
      user.profile_image !== null &&
      user.profile_image !== ""
    ) {
      signedUrl = await getS3Parallel(user.profile_image);
    }
        // for now stopped as we get modules by plan
// await updateRoleWithMissingModules(dbName, user.role[0].role_id);
    logger.info(`Company admin scanLogin ${dbName}: ${user.email}`);
    res.status(201).json({
      user: {
        _id: user._id.toString(),
        email: user?.email,
        userName: user.userName,
        mobileNumber: user?.mobileNumber,
        countryCode: user?.countryCode,
        isEmailVerified: user?.isEmailVerified,
        role: user.role,
        otpVerification: false,
        profile_image: signedUrl,
        tenant_company_id: user?.tenant_company_id,
        company_id: company.company_id,
        // roles: rolesPermission,
        currencyCVR: company?.currencyCVR,
      },
      tokens: {
        accessToken,
      },
      expiresIn: 1800, // 30 minutes in seconds
    });
  } catch (error: any) {
    logger.error("Company admin scanLogin error:", error);
    if (error?.isAxiosError && error?.response) {
      const status = error.response.status || 502;
      const message =
        error.response.data?.error?.message || // typical structure
        error.response.data?.message || // fallback
        "External service error during company creation";

      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Already structured error
    }
    next(error);
  }
};
