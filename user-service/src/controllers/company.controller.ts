import { NextFunction, Request, Response } from "express";
import { Model } from "mongoose";
import mongoose from "mongoose";
import { getDbConnection } from "@config/database";
import {
  readJSONFile,
  sanitizedCompany,
  uploadParallel,
  getS3Parallel,
} from "@utils/auth.utils";
import logger from "@utils/logger";
import { ICompany } from "@interfaces/company.interface";
import companySchema from "@models/company.model";
import { IUser } from "@interfaces/user.interface";
import UserSchema from "@models/user.model";
import { defaultRole, EMAIL_SUBJECT, Status } from "@utils/constant";
import path from "path";
import { IRole } from "@interfaces/roles.interface";
import RoleSchema from "@models/roles.model";

type MulterFile = Express.Multer.File;
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";
import EmailTemplateSchema from "@models/emailtemplate.model";
import createHttpError from "http-errors";
import { encrypt } from "@utils/crypto.utils";
import { paginate, paginateAggregate } from "@utils/paginate";
import moment from "moment";
import { ERROR_MESSAGE, INFO_MESSAGE } from "@utils/message.constant";
import CompanyCounter, { ICounter } from "@models/companyCounter.model";
import { ITransaction } from "@interfaces/transaction.interface";
import transactionSchema from "@models/transaction.model";
import subscriptionSchema from "@models/subscription.model";
import { ISubscription } from "@interfaces/subscription.interface";
import {
  generateExcelDownload,
  generatePdfDownload,
} from "@utils/export.utils";
import { scheduleSubscriptionReminders } from "./job.controller";
import stripe from "@utils/stripe";
import { RequestHandler } from "express";

const getCompanyModel = (dbName: string): Model<ICompany> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Company ||
    connection.model<ICompany>("Company", companySchema)
  );
};

const getUserModel = (dbName: string): Model<IUser> => {
  const connection = getDbConnection(dbName);
  return connection.models.User || connection.model<IUser>("User", UserSchema);
};

const getTransactionModel = (dbName: string): Model<ITransaction> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Transaction ||
    connection.model<ITransaction>("Transaction", transactionSchema)
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

const getCompanyCounterModel = (dbName: string): Model<ICounter> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Counters ||
    connection.model<ICounter>("Counters", CompanyCounter)
  );
};

const getEmailTemplateModel = (dbName: string): Model<IEmailTemplate> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.EmailTemplate ||
    connection.model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema)
  );
};

const DB_NAME: any = process.env.DB_NAME;

export const createCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const files = req.files as {
      [profile_image: string]: Express.Multer.File[];
    };
    const body = JSON.parse(req.body.data);
    const packageObjId = body.package_id;
    const otpVerification = body.otpVerification;
    const Company = getCompanyModel(dbName);

    if (body.trusted && !body.maxUserCount) {
      res.status(400).json({
        status: 400,
        message: "User count is required for trusted companies.",
      });
      return;
    }

    // Check if account_url already exists
    const existingCompany = await Company.findOne({
      $or: [
        { account_url: body.account_url },
        { phoneNumber: body.phoneNumber },
        { email: body.email },
        { name: body.name },
      ],
      deletedAt: null,
    });

    if (existingCompany) {
      let message = "";

      if (existingCompany.account_url === body.account_url) {
        message = `Account URL "${body.account_url}" is already in use.`;
      } else if (existingCompany.phoneNumber === body.phoneNumber) {
        message = `Phone number "${body.phoneNumber}" is already in use.`;
      } else if (existingCompany.email === body.email) {
        message = `Email "${body.email}" is already in use.`;
      } else if (existingCompany.name === body.name) {
        message = `Company name "${body.name}" is already in use.`;
      } else {
        message = "Company already exists.";
      }

      res.status(400).send({ status: 400, message });
      return;
    }

    const token: any = req.headers["authorization"];
    const configPackage: CustomAxiosRequestConfig = {
      method: "get",
      url: `/subscription/packages/list/${packageObjId}`,
      token,
    };

    const packageRes = await kongAxios(configPackage);

    const packageData = packageRes?.data;

    // Optional logging
    const User = getUserModel(dbName);
    const Role = getRoleModel(dbName);

    const companyCounter = getCompanyCounterModel(dbName);

    const counter = await companyCounter.findByIdAndUpdate(
      { _id: "company_id" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const company_id = counter.seq.toString();

    // const companyName = sanitizedCompany(body.name);
    const tenantDbName = `${company_id}${process.env.DB_SUFFIX}`;

    const CompanyDB = getCompanyModel(tenantDbName);
    const UserDB = getUserModel(tenantDbName);
    const RoleDB = getRoleModel(tenantDbName);

    const profileImageFile = files?.profile_image?.[0];

    // const rolesConfigPath = path.join(__dirname, "..", "config", "roles.json");
    // const permissions = await readJSONFile(rolesConfigPath);

    // // Check incoming packageData for plan_modules
    // const allowedModules = Array.isArray(packageData?.data?.plan_modules)
    //   ? packageData.data.plan_modules
    //   : [];

    // if (!allowedModules.length) {
    //   console.warn("⚠️ No modules listed in plan_modules, resulting permissions will be empty.");
    // }

    // // 🔥 Only include modules listed in plan_modules
    // const updatedPermissions = permissions
    //   .filter((module: any) => allowedModules.includes(module.module))
    //   .map((module: any) => {
    //     const updatedModule = {
    //       ...module,
    //       allow_access: true,
    //       permission: {
    //         read: true,
    //         write: true,
    //         create: true,
    //         delete: true,
    //         import: true,
    //         export: true
    //       }
    //     };

    //     if (Array.isArray(module.sub_modules)) {
    //       updatedModule.sub_modules = module.sub_modules.map((sub: any) => ({
    //         ...sub,
    //         allow_access: true,
    //         permission: {
    //           read: true,
    //           write: true,
    //           create: true,
    //           delete: true,
    //           import: true,
    //           export: true
    //         }
    //       }));
    //     }

    //     return updatedModule;
    //   });

    const rolesConfigPath = path.join(__dirname, "..", "config", "roles.json");
    const permissions = await readJSONFile(rolesConfigPath);

    const allowedDomains = Array.isArray(packageData?.data?.plan_modules)
      ? packageData.data.plan_modules
      : [];

    const updatedPermissions = permissions
      .filter((module: any) => allowedDomains.includes(module.domain))
      .map((module: any) => {
        const updatedModule = {
          ...module,
          permission: {
            read: true,
            write: true,
            create: true,
            delete: true,
            import: true,
            export: true,
          },
        };

        if (Array.isArray(module.sub_modules)) {
          updatedModule.sub_modules = module.sub_modules.map((sub: any) => ({
            ...sub,
            permission: {
              read: true,
              write: true,
              create: true,
              delete: true,
              import: true,
              export: true,
            },
          }));
        }

        return updatedModule;
      });

    // Upload profile image if provided
    let profileImageUrl = body.profile_image;
    if (profileImageFile?.buffer) {
      profileImageUrl = await uploadParallel(
        profileImageFile,
        `${process.env.BUCKET_FOLDER}/super_admin/users/profile_images`,
        res
      );
    }

    // Create tenant-specific company record
    const tenantCompany = new CompanyDB({
      name: body.name,
      company_id: company_id,
      email: body.email,
      account_url: body.account_url,
      phoneNumber: body.phoneNumber,
      website: body.website,
      address: body.address,
      // planName: body.planName,
      // planType: body.planType,
      status: Status.Active,
      profileImage: profileImageUrl,
      package_id: body.package_id,
      trialPlan: packageData?.access_trial ? true : false,
      otpVerification,
      maxUserCount: body.maxUserCount ? body.maxUserCount : 0,
      trusted: body.trusted,
    });

    // Create central company record
    const centralCompany = new Company({
      company_id: company_id,
      name: body.name,
      email: body.email,
      account_url: body.account_url,
      // plan: body.plan,
      // planName: body.planName,
      status: Status.Active,
      profileImage: profileImageUrl,
      tenant_company_id: tenantCompany._id,
      package_id: body.package_id,
      address: body.address,
      phoneNumber: body.phoneNumber,
      website: body.website,
      trialPlan: packageData?.access_trial ? true : false,
      otpVerification,
      maxUserCount: body.maxUserCount ? body.maxUserCount : 0,
      trusted: body.trusted,
    });

    // // Check or create super admin role in central DB
    // let companyAdminRole = await Role.findOne({
    //   role_name: defaultRole.companyAdmin,
    // });
    // if (!companyAdminRole) {
    //   companyAdminRole = new Role({
    //     role_name: defaultRole.companyAdmin,
    //     key_value: defaultRole.companyAdmin,
    //     modules: updatedPermissions,
    //     isdefaultRole: true,
    //   });
    //   await companyAdminRole.save();
    // }

    // Create super admin role in tenant DB
    const tenantRole = new RoleDB({
      role_name: defaultRole.companyAdmin,
      key_value: defaultRole.companyAdmin,
      modules: updatedPermissions,
      isdefaultRole: true,
    });
    const tenantRoleSaved = await tenantRole.save();

    // Central user
    const centralUser = new User({
      userName: body.name,
      profile_image: profileImageUrl,
      email: body.email,
      account_url: body.account_url,
      password: body.password,
      role: [
        {
          key_value: defaultRole.companyAdmin,
          // role_id: companyAdminRole._id,
        },
      ],
      status: Status.Active,
      deletedAt: null,
      tenant_company_id: centralCompany._id,
      isDefaultUser: true,
    });

    // Tenant-specific user
    const tenantUser = new UserDB({
      userName: body.name,
      profile_image: profileImageUrl,
      email: body.email,
      account_url: body.account_url,
      password: body.password,
      role: [
        {
          key_value: defaultRole.companyAdmin,
          role_id: tenantRoleSaved._id,
        },
      ],
      status: Status.Active,
      deletedAt: null,
      tenant_company_id: centralCompany._id,
      isDefaultUser: true,
    });

    // const CompanySubscription = getCompanySubscriptionModel(dbName);

    // // Create subscription entry in central DB
    // const companySubscription = new CompanySubscription({
    //   company_id: centralCompany._id,
    //   planName: body.planName,
    //   planType: body.planType,
    //   status: Status.Active,
    //   startDate: moment().toDate(),
    // });

    // ✅ Only if package type is "trial"
    if (packageData?.data?.access_trial) {
      const trialStartDate = moment().toDate();
      const trialEndDate = new Date(
        trialStartDate.getTime() +
          (packageData.trial_days || 14) * 24 * 60 * 60 * 1000
      );
      const Transactions = getTransactionModel(dbName);
      // ➕ Insert Trial Transaction
      const transaction = new Transactions({
        customerId: null,
        companyId: centralCompany._id,
        type: "trial",
        status: "succeeded",
        amount: 0,
        currency: null,
        invoice_label: "", // Will auto-generate via schema hook
      });

      await transaction.save();

      const Subscriptions = getSubscriptionModel(dbName);

      const trialSubscription = new Subscriptions({
        subscription_id: `trial-${require("crypto").randomBytes(6).toString("hex")}`,
        customer_id: `trial-${require("crypto").randomBytes(6).toString("hex")}`,
        package_id: packageData?.data?._id || null,
        company_obj_id: centralCompany._id,
        company_id: parseInt(centralCompany.company_id, 10),
        stripe_product: packageData?.data?.stripe_product || null,
        pricing_id: packageData?.data?.pricing_id || null,
        price: packageData?.data?.price || 0,
        unit_amount: packageData?.data?.unit_amount || 0,
        unit_amount_decimal: packageData?.data?.unit_amount_decimal || 0,
        plan_currency: packageData?.data?.plan_currency || null,
        plan_type: packageData?.data?.plan_type || null,
        mode: "trial",
        status: "active",
        subscriptionDate: trialStartDate,
        nextBillingDate: trialEndDate,
        canceledAt: null,
        canceledInit: false,
        payment_gateway: "trial",
      });

      await trialSubscription.save();
      tenantCompany.subscriptionStartDate = trialStartDate;
      tenantCompany.subscriptionEndDate = trialEndDate;
      tenantCompany.trialPackage = true;
      centralCompany.subscriptionStartDate = trialStartDate;
      centralCompany.trialPackage = true;
      centralCompany.subscriptionEndDate = trialEndDate;

      // ➕ Send Trial Activation Email
      const EmailTemplate = getEmailTemplateModel(dbName);
      const template = await EmailTemplate.findOne({
        slug: "trial-activation-notification",
        isActive: true,
      }).select("htmlBody -_id");

      // https://mahindra-org.qa-fusion.dreamstechnologies.com/package/U2FsdGVkX1%2BGyaWzkhXOzv5lVtheNRHot4h3%2FdvhIvMlVX1DQZDcLeACpCYSKye%2B1sFQtfMiFBdgE4pizbWaApJQ3zRZDzNZ11Z6nHZe6lWjpZR4ZUuFcR0N%2BY58mmbNHyQY%2BAsTdCcW%2B2S6THjTqmLSJdgwRQtvEJPmoqk8kvRkLUlBG5iYmKRlFLAYKa8qp3hbkcptF3bxs6a9f%2BRdOKe8ZodJ4Jck4vU5u3LBa77uVFnoYj8oRu2zCfCaSXk6%2Be6mB5Yi4GK7n%2FRBd9rvl3aqPmnae3QbKRptKe0gDvR5z%2FmeD%2FHWMQd198pmP54N

      if (template) {
        const configEmail: CustomAxiosRequestConfig = {
          method: "post",
          url: "/email/mail/send",
          token,
          data: {
            to: body.email,
            subject: "Your trial account is now active",
            htmlBody: template.htmlBody,
            message: "Trial activated",
            emailData: {
              name: body.name,
              startDate: trialStartDate.toDateString(),
              endDate: trialEndDate.toDateString(),
              password: body.password,
              login:
                DB_NAME === "fusion_main_qa"
                  ? `https://${centralCompany.account_url}.qa-fusion.dreamstechnologies.com//company/signin/`
                  : `https://${centralCompany.account_url}.fusion.dreamstechnologies.com/company/signin`,
            },
          },
        };
        await kongAxios(configEmail);

        await scheduleSubscriptionReminders({
          dbName: DB_NAME,
          companyId: centralCompany.company_id,
          companyObjId: centralCompany._id.toString(),
          endDate: trialEndDate.toISOString(),
          companyEmail: centralCompany.email,
        });
      }
    } else if (body.trusted && packageData?.data?.access_trial === false) {
      const subscriptionStartDate = moment.utc(); // current UTC time

      const intervalCount = packageData.data.interval_count || 1;
      const planType = packageData.data.plan_type; // e.g., "month" or "year"

      // Calculate subscription end date
      const subscriptionEndDate = subscriptionStartDate
        .clone()
        .add(intervalCount, planType);
      // Save moment date as JS Date objects for MongoDB compatibility
      tenantCompany.subscriptionStartDate = subscriptionStartDate.toDate();
      tenantCompany.subscriptionEndDate = subscriptionEndDate.toDate();
      centralCompany.subscriptionStartDate = subscriptionStartDate.toDate();
      centralCompany.subscriptionEndDate = subscriptionEndDate.toDate();

      const Transactions = getTransactionModel(dbName);

      const transaction = new Transactions({
        customerId: null,
        companyId: centralCompany._id,
        type: "manual",
        status: "succeeded",
        amount: packageData?.data?.price || 0,
        currency: null,
        invoice_label: "", // Will auto-generate via schema hook
      });

      await transaction.save();

      const Subscriptions = getSubscriptionModel(dbName);

      const trialSubscription = new Subscriptions({
        subscription_id: `manual-${require("crypto").randomBytes(6).toString("hex")}`,
        customer_id: `manual-${require("crypto").randomBytes(6).toString("hex")}`,
        package_id: packageData?.data?._id || null,
        company_obj_id: centralCompany._id,
        company_id: parseInt(centralCompany.company_id, 10),
        stripe_product: packageData?.data?.stripe_product || null,
        pricing_id: packageData?.data?.pricing_id || null,
        price: packageData?.data?.price || 0,
        unit_amount: packageData?.data?.unit_amount || 0,
        unit_amount_decimal: packageData?.data?.unit_amount_decimal || 0,
        plan_currency: packageData?.data?.plan_currency || null,
        plan_type: packageData?.data?.plan_type || null,
        mode: "manual",
        status: "active",
        subscriptionDate: subscriptionStartDate.toDate(),
        nextBillingDate: subscriptionEndDate.toDate(),
        canceledAt: null,
        canceledInit: false,
        payment_gateway: "manual",
      });

      await trialSubscription.save();
      // ➕ Send Trial Activation Email
      const EmailTemplate = getEmailTemplateModel(dbName);
      const template = await EmailTemplate.findOne({
        slug: "subscription-activation-notification",
        isActive: true,
      }).select("htmlBody -_id");

      if (template) {
        const configEmail: CustomAxiosRequestConfig = {
          method: "post",
          url: "/email/mail/send",
          token,
          data: {
            to: body.email,
            subject: "Your Account is now active",
            htmlBody: template.htmlBody,
            message: "Trial activated",
            emailData: {
              user_name: body.name,
              start_date: subscriptionStartDate.format("YYYY-MM-DD"),
              end_date: subscriptionEndDate.format("YYYY-MM-DD"),
              password: body.password,
              login:
                DB_NAME === "fusion_main_qa"
                  ? `https://${centralCompany.account_url}.qa-fusion.dreamstechnologies.com//company/signin/`
                  : `https://${centralCompany.account_url}.fusion.dreamstechnologies.com/company/signin`,
            },
          },
        };
        await kongAxios(configEmail);
      }
      // ➕ Schedule subscription reminder jobs
      await scheduleSubscriptionReminders({
        dbName: DB_NAME,
        companyId: centralCompany.company_id,
        companyObjId: centralCompany._id.toString(),
        endDate: subscriptionEndDate.toISOString(), // Unix timestamp
        companyEmail: centralCompany.email,
      });
    } else {
      const EmailTemplate = getEmailTemplateModel(dbName);
      const template = await EmailTemplate.findOne({
        slug: "e-mail-subscription-template",
        isActive: true,
      }).select("htmlBody -_id");

      if (!template) {
        throw createHttpError(404, ERROR_MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
      }

      const encryptedUser = await encrypt({
        user_id: centralUser._id,
        email: centralCompany.email,
        name: centralCompany.name,
        productId: packageData?.stripe_product,
        priceId: packageData?.pricing_id,
        coupon_id: packageData?.coupon_id,
        companyId: centralCompany.company_id,
        companyObjId: centralCompany._id,
        packageObjId: packageObjId,
        accountURL: centralCompany.account_url,
        companyEmail: centralCompany.email,
      });

      // login: DB_NAME === 'fusion_main_qa' ? `https://${centralCompany.account_url}.qa-fusion.dreamstechnologies.com//company/signin/` :  `https://${centralCompany.account_url}.fusion.dreamstechnologies.com/company/signin`,

      const configEmail: CustomAxiosRequestConfig = {
        method: "post",
        url: "/email/mail/send",
        token,
        data: {
          to: body.email,
          subject: EMAIL_SUBJECT.REGISTER,
          htmlBody: template.htmlBody,
          message: EMAIL_SUBJECT.REGISTER,
          emailData: {
            user_name: body.name,
            update_pass_url:
              DB_NAME === "fusion_main_qa"
                ? `https://${centralCompany.account_url}.qa-fusion.dreamstechnologies.com/package/${encryptedUser}`
                : `https://${centralCompany.account_url}.fusion.dreamstechnologies.com/package/${encryptedUser}`,
          },
        },
      };

      await kongAxios(configEmail);
    }
    // Save all concurrently
    const [companyData] = await Promise.all([
      centralCompany.save(),
      tenantCompany.save(),
      centralUser.save(),
      tenantUser.save(),
    ]);

    res.status(201).json({
      message: INFO_MESSAGE.COMPANY_CREATED_SUCCESSFULLY,
      companyData,
    });
  } catch (error: any) {
    logger.error(`${ERROR_MESSAGE.ERROR_WHILE_CREATE_COMPANY}:`, error);

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

export const updateCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const body = JSON.parse(req.body.data);
    const id = req.params.id;

    if (body.planName || body.planType) {
      throw createHttpError(400, ERROR_MESSAGE.COMPANY_RESTRICTED);
    }

    const CompanyAdmin = getCompanyModel(DB_NAME);
    const UserAdmin = getUserModel(DB_NAME);

    const company: any = await CompanyAdmin.findById(id);
    if (!company) throw createHttpError(404, ERROR_MESSAGE.COMPANY_NOT_FOUND);

    const tenantDbName = `${company.company_id}${process.env.DB_SUFFIX}`;
    const Company = getCompanyModel(tenantDbName);
    const User = getUserModel(tenantDbName);

    const profileImageFile = files?.profile_image?.[0];
    if (profileImageFile?.buffer) {
      company.profileImage = await uploadParallel(
        profileImageFile,
        `${process.env.BUCKET_FOLDER}/super_admin/users/profile_images`,
        res
      );

      // ✅ Update profile image in tenant company
      const tenantCompany = await Company.findOne({
        company_id: company.company_id,
      });
      if (tenantCompany) {
        tenantCompany.profileImage = company.profileImage;
        await tenantCompany.save();
      }
    }

    company.set({
      name: body.name,
      email: body.email,
      website: body.website,
      phoneNumber: body.phoneNumber,
      address: body.address,
      status: body.status,
      otpVerification: body.otpVerification,
    });

    let subscriptionStartDate: Date | null = null;
    let subscriptionEndDate: Date | null = null;

    if (body.manualPayment) {
      const packageObjId = body.package_id;
      const token: any = req.headers["authorization"];
      const configPackage: CustomAxiosRequestConfig = {
        method: "get",
        url: `/subscription/packages/list/${packageObjId}`,
        token,
      };

      const packageRes = await kongAxios(configPackage);
      const packageData = packageRes?.data;
      //role as per package flow
      const tenantRole = getRoleModel(tenantDbName);

      const rolesConfigPath = path.join(
        __dirname,
        "..",
        "config",
        "roles.json"
      );
      const permissions = await readJSONFile(rolesConfigPath);

      const allowedDomains = Array.isArray(packageData?.data?.plan_modules)
        ? packageData.data.plan_modules
        : [];

      const updatedPermissions = permissions
        .filter((module: any) => allowedDomains.includes(module.domain))
        .map((module: any) => {
          const updatedModule = {
            ...module,
            permission: {
              read: true,
              write: true,
              create: true,
              delete: true,
              import: true,
              export: true,
            },
          };

          if (Array.isArray(module.sub_modules)) {
            updatedModule.sub_modules = module.sub_modules.map((sub: any) => ({
              ...sub,
              permission: {
                read: true,
                write: true,
                create: true,
                delete: true,
                import: true,
                export: true,
              },
            }));
          }

          return updatedModule;
        });

      // const tenantRoles = await tenantRole.find(); // Fetch all roles

      // for (const role of tenantRoles) {
      //   const currentModules = role.modules || [];

      //   // Step 1: Add/update modules from updatedPermissions
      //   const syncedModules = updatedPermissions.map((updatedMod: any) => {
      //     const existingMod = currentModules.find((mod: any) => mod.domain === updatedMod.domain);

      //     // If module exists, sync sub-modules
      //     if (existingMod) {
      //       const syncedSubModules = updatedMod.sub_modules?.map((updatedSub: any) => {
      //         const existingSub = existingMod.sub_modules?.find((sub: any) => sub.key === updatedSub.key);
      //         return {
      //           ...updatedSub,
      //           permission: updatedSub.permission // Always use permission from package
      //         };
      //       }) || [];

      //       return {
      //         ...updatedMod,
      //         sub_modules: syncedSubModules
      //       };
      //     }

      //     // If module doesn't exist, add as is
      //     return updatedMod;
      //   });

      //   // Step 2: Filter out modules that are no longer in updatedPermissions
      //   const filteredModules = syncedModules.filter((mod: any) =>
      //     updatedPermissions.some((perm: any) => perm.domain === mod.domain)
      //   );

      //   // Step 3: Save updated modules back to role
      //   role.modules = filteredModules;
      //   await role.save();
      // }

      const tenantRoles = await tenantRole.find(); // Fetch all roles

      for (const role of tenantRoles) {
        const isCompanyAdmin = role.key_value === "company_admin";

        const syncedModules = updatedPermissions.map((updatedMod: any) => {
          const modulePermission = isCompanyAdmin
            ? {
                read: true,
                write: true,
                create: true,
                delete: true,
                import: true,
                export: true,
              }
            : updatedMod.permission || {};

          const syncedSubModules = (updatedMod.sub_modules || []).map(
            (updatedSub: any) => {
              const subPermission = isCompanyAdmin
                ? {
                    read: true,
                    write: true,
                    create: true,
                    delete: true,
                    import: true,
                    export: true,
                  }
                : updatedSub.permission || {};

              return {
                ...updatedSub,
                permission: subPermission,
              };
            }
          );

          return {
            ...updatedMod,
            permission: modulePermission,
            sub_modules: syncedSubModules,
          };
        });

        role.modules = syncedModules;
        role.markModified("modules");
        await role.save();
      }

      // role as per package flow
      subscriptionStartDate = moment().toDate();
      const intervalCount = packageData.interval_count || 1;
      const planType = packageData.plan_type; // "month" or "year"

      subscriptionEndDate = moment
        .utc(subscriptionStartDate)
        .add(intervalCount, planType)
        .toDate();

      // Update on both admin and tenant
      company.subscriptionStartDate = subscriptionStartDate;
      company.subscriptionEndDate = subscriptionEndDate;

      const adminCompany = await CompanyAdmin.findOne({
        tenant_company_id: id,
      });
      if (adminCompany) {
        adminCompany.set({
          subscriptionStartDate,
          subscriptionEndDate,
        });
        if (body.password) {
          adminCompany.password = body.password;
        }
        await adminCompany.save();
      }

      const Transactions = getTransactionModel(dbName);
      await new Transactions({
        customerId: null,
        companyId: company._id,
        type: "manual",
        status: "succeeded",
        amount: 0,
        currency: null,
        invoice_label: "",
      }).save();

      const Subscriptions = getSubscriptionModel(dbName);
      await new Subscriptions({
        subscription_id: `manual-${require("crypto").randomBytes(6).toString("hex")}`,
        customer_id: `manual-${require("crypto").randomBytes(6).toString("hex")}`,
        package_id: packageData?._id || null,
        company_obj_id: company._id,
        company_id: parseInt(company.company_id, 10),
        stripe_product: packageData?.stripe_product || null,
        pricing_id: packageData?.pricing_id || null,
        price: packageData?.price || 0,
        unit_amount: packageData?.unit_amount || 0,
        unit_amount_decimal: packageData?.unit_amount_decimal || 0,
        plan_currency: packageData?.plan_currency || null,
        plan_type: packageData?.plan_type || null,
        mode: "manual",
        status: "active",
        subscriptionDate: subscriptionStartDate,
        nextBillingDate: subscriptionEndDate,
        canceledAt: null,
        canceledInit: false,
        payment_gateway: "manual",
      }).save();

      const EmailTemplate = getEmailTemplateModel(dbName);
      const template = await EmailTemplate.findOne({
        slug: "subscription-activation-notification",
        isActive: true,
      }).select("htmlBody -_id");

      if (template) {
        const configEmail: CustomAxiosRequestConfig = {
          method: "post",
          url: "/email/mail/send",
          token,
          data: {
            to: body.email,
            subject: "Your Account is now active",
            htmlBody: template.htmlBody,
            message: "Trial activated",
            emailData: {
              user_name: body.name,
              start_date: subscriptionStartDate.toDateString(),
              end_date: subscriptionEndDate.toDateString(),
              password: body.password,
              login:
                DB_NAME === "fusion_main_qa"
                  ? `https://${company.account_url}.fusion.qa-dreamstechnologies.com/company/signin`
                  : `https://${company.account_url}.fusion.dreamstechnologies.com/company/signin`,
            },
          },
        };
        await kongAxios(configEmail);
      }

      await scheduleSubscriptionReminders({
        dbName: DB_NAME,
        companyId: company.company_id,
        companyObjId: company._id.toString(),
        endDate: subscriptionEndDate.toISOString(),
        companyEmail: company.email,
      });
    }

    // ✅ Update Admin DB's Company
    const adminCompany = await Company.findOne({ tenant_company_id: id });
    if (adminCompany) {
      adminCompany.set({
        name: body.name,
        email: body.email,
        website: body.website,
        phoneNumber: body.phoneNumber,
        address: body.address,
        profileImage: company.profileImage,
        otpVerification: body.otpVerification,
      });
      await adminCompany.save();
    }

    await company.save();

    // ✅ Update user in Admin DB
    const user = await UserAdmin.findOne({ tenant_company_id: id });
    if (user) {
      user.set({
        userName: body.name,
        profile_image: company.profileImage,
      });
      if (body.password) {
        user.password = body.password;
      }
      await user.save();
    }

    // ✅ Update user in tenant DB
    const adminUser = await User.findOne({ tenant_company_id: id });
    if (adminUser) {
      adminUser.set({
        userName: body.name,
        profile_image: company.profileImage,
      });
      await adminUser.save();
    }

    // ✅ Send deactivation email if status is Inactive
    if (body.status === "Inactive") {
      const EmailTemplate = getEmailTemplateModel(dbName);
      const template = await EmailTemplate.findOne({
        slug: "company-status-update",
        isActive: true,
      }).select("htmlBody -_id");

      if (template) {
        const configEmail: CustomAxiosRequestConfig = {
          method: "post",
          url: "/email/mail/send",
          data: {
            to: body.email,
            subject: "Your account is now being deactivated",
            htmlBody: template.htmlBody,
            message: "Account deactivated",
            emailData: {
              companyName: body.name,
            },
          },
        };
        await kongAxios(configEmail);
      }
    }

    if (body.status) {
      await handleStripeSubscriptionStatus(
        tenantDbName,
        company._id.toString(),
        body.status
      );
    }

    res.status(201).json({
      message: INFO_MESSAGE.COMPANY_UPDATED_SUCCESSFULLY,
      company,
    });
  } catch (err: any) {
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

export const deleteCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const companyId = req.params.id;

    if (!companyId) {
      throw createHttpError(400, INFO_MESSAGE.COMPANY_ID_REQUIRED);
    }

    const CompanyAdmin = getCompanyModel(DB_NAME);
    const UserAdmin = getUserModel(DB_NAME);

    const company = await CompanyAdmin.findById(companyId);
    if (!company) {
      throw createHttpError(404, ERROR_MESSAGE.COMPANY_NOT_FOUND);
    }

    const tenantDbName = `${company.company_id}${process.env.DB_SUFFIX}`;
    const Company = getCompanyModel(tenantDbName);
    const User = getUserModel(tenantDbName);
    const Subscription = getSubscriptionModel(tenantDbName);

    const deleteTimestamp = moment().toDate();

    // 🔁 Cancel Stripe subscription if active
    const activeSub = await Subscription.findOne({
      company_obj_id: company._id,
      status: "active",
    });

    if (activeSub && activeSub.subscription_id?.startsWith("sub_")) {
      await stripe.subscriptions.update(activeSub.subscription_id, {
        cancel_at_period_end: false,
      });
      await stripe.subscriptions.cancel(activeSub.subscription_id);

      activeSub.status = "canceled";
      activeSub.canceledAt = deleteTimestamp;
      activeSub.canceledInit = true;
      await activeSub.save();
    }

    // ✅ Soft delete tenant company
    company.deletedAt = deleteTimestamp;
    await company.save();

    // ✅ Soft delete users in tenant DB
    await UserAdmin.updateMany(
      { tenant_company_id: companyId },
      { deletedAt: deleteTimestamp }
    );

    // ✅ Soft delete company in tenant DB
    const adminCompany = await Company.findOne({
      tenant_company_id: companyId,
    });
    if (adminCompany) {
      adminCompany.deletedAt = deleteTimestamp;
      await adminCompany.save();
    }

    // ✅ Soft delete tenant users
    await User.updateMany(
      { tenant_company_id: companyId },
      { deletedAt: deleteTimestamp }
    );
    // await softDeleteCompanyWithSubscription(companyId,DB_NAME)

    res.status(201).json({ message: INFO_MESSAGE.COMPANY_SOFT_DELETED });
  } catch (err: any) {
    console.error(err);
    next(err);
  }
};

export const listCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    // Extract query params with defaults
    let {
      page = "1",
      limit = "10",
      sortBy = "createdAt",
      order = "desc",
      search,
      status,
      plan,
      disablePagination = "false",
    } = req.query;

    // Normalize some params for safer use
    page = page.toString();
    limit = limit.toString();
    sortBy = sortBy.toString().toLowerCase();
    order = order.toString().toLowerCase();
    disablePagination = disablePagination.toString().toLowerCase();

    const companyModel = getCompanyModel(dbName);
    const filter: any = { deletedAt: null };

    // ✅ Handle status
    if (status !== undefined && status !== "all") {
      filter.status = status;
    }

    // ✅ Handle plan
    if (plan !== undefined && plan !== "all") {
      const objectId = mongoose.Types.ObjectId;

      if (typeof plan === "string" && mongoose.isValidObjectId(plan)) {
        filter.package_id = new objectId(plan);
      } else if (plan) {
        console.warn("Invalid plan ObjectId:", plan);
      }
    }

    // Plan filter based on package_id field
    if (typeof plan === "string" && mongoose.isValidObjectId(plan)) {
      filter.package_id = new mongoose.Types.ObjectId(plan);
    } else if (plan) {
      console.warn("Invalid plan ObjectId:", plan);
    }

    // Search filter (only when pagination is enabled)
    if (search && disablePagination !== "true") {
      const searchStr = search.toString().trim();
      const regex = new RegExp(searchStr, "i");

      const searchDate = moment(searchStr, ["DD MMM YYYY", "YYYY-MM-DD"], true);
      const isBoolean =
        searchStr.toLowerCase() === "true" ||
        searchStr.toLowerCase() === "false";

      filter.$or = [
        { name: regex },
        { email: regex },
        { website: regex },
        { account_url: regex },
        { "plan.plan_name": regex },
      ];

      // If search string matches status "Active"/"Inactive"
      if (isBoolean) {
        filter.$or.push({
          status: searchStr.toLowerCase() === "active" ? "Active" : "Inactive",
        });
      }

      // If search string is a valid date, search createdAt in that day range
      if (searchDate.isValid()) {
        const start = searchDate.startOf("day").toDate();
        const end = searchDate.endOf("day").toDate();
        filter.$or.push({ createdAt: { $gte: start, $lte: end } });
      }
    }

    // Convert special sortBy values to date filters
    const now = moment();
    let finalSortBy: string = "createdAt";
    let finalOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";

    if (sortBy === "last_7_days" || sortBy === "last7days") {
      filter.createdAt = {
        $gte: now.clone().subtract(7, "days").startOf("day").toDate(),
      };
    } else if (sortBy === "last_month") {
      filter.createdAt = {
        $gte: now.clone().subtract(1, "month").startOf("day").toDate(),
      };
    } else if (sortBy === "recently_added") {
      filter.createdAt = {
        $gte: now.clone().subtract(7, "days").startOf("day").toDate(),
      };
    } else if (sortBy === "ascending") {
      finalOrder = "asc";
    } else if (sortBy === "descending" || sortBy === "recentlyadded") {
      finalOrder = "desc";
    }

    // Otherwise default sortBy is createdAt

    // Build aggregation pipeline
    const pipeline: any[] = [
      {
        $lookup: {
          from: "packages",
          localField: "package_id",
          foreignField: "_id",
          as: "plan",
        },
      },
      { $match: filter },
      { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
    ];

    // If pagination is disabled, return all matching docs
    if (disablePagination === "true") {
      const allData = await companyModel.aggregate(pipeline).exec();

      const companiesWithSignedUrls = await Promise.all(
        allData.map(async (company: any) => {
          let signedUrl = null;
          if (company.profileImage) {
            try {
              signedUrl = await getS3Parallel(company.profileImage);
            } catch (err) {
              logger.warn(
                `Failed to generate signed URL for company ${company._id}`,
                err
              );
            }
          }
          return {
            ...company,
            profileImage: signedUrl,
          };
        })
      );

      res.status(200).json({
        message: "All Companies retrieved successfully",
        data: companiesWithSignedUrls,
        type: "array",
      });
      return;
    }

    // Use pagination helper for paginated results
    const result = await paginateAggregate(companyModel, pipeline, {
      page: Number(page),
      limit: Number(limit),
      sortBy: finalSortBy,
      order: finalOrder,
    });

    // Attach signed URLs for profileImage
    const companiesWithSignedUrls = await Promise.all(
      result.data.map(async (company: any) => {
        let signedUrl = null;
        if (company.profileImage) {
          try {
            signedUrl = await getS3Parallel(company.profileImage);
          } catch (err) {
            logger.warn(
              `Failed to generate signed URL for company ${company._id}`,
              err
            );
          }
        }
        return {
          ...company,
          profileImage: signedUrl,
        };
      })
    );

    // // Get stats: total companies and counts by status
    // const statsPipeline = [
    //   {
    //     $match: { deletedAt: null },
    //   },
    //   {
    //     $facet: {
    //       totalCount: [{ $count: "total" }],
    //       statusCounts: [
    //         {
    //           $group: {
    //             _id: "$status",
    //             count: { $sum: 1 },
    //           },
    //         },
    //       ],
    //     },
    //   },
    // ];

    const statsPipeline = [
      {
        $match: { deletedAt: null },
      },
      {
        $facet: {
          totalCount: [{ $count: "total" }],
          statusCounts: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
              },
            },
          ],
          activeWithSubscription: [
            {
              $match: {
                status: "Active",
                subscriptionStartDate: { $ne: null },
              },
            },
            { $count: "count" },
          ],
        },
      },
    ];
    const statsResult = await companyModel.aggregate(statsPipeline);

    const results = statsResult[0];

    const totalCount = results?.totalCount?.[0]?.total || 0;
    const statusCounts = results?.statusCounts || [];
    const activeWithSubCount = results?.activeWithSubscription?.[0]?.count || 0;

    let inactive_count = 0;

    for (const item of statusCounts) {
      if (item._id === "Inactive") {
        inactive_count = item.count;
      }
    }

    res.status(200).json({
      message: "Companies retrieved successfully",
      data: companiesWithSignedUrls,
      pagination: result.pagination,
      stats: {
        total_companies: totalCount,
        active_count: activeWithSubCount, // ✅ Only those with subscriptionStartDate
        inactive_count,
      },
      type: "array",
    });
  } catch (err) {
    logger.error("List Companies function failed", err);
    next(err);
  }
};

export const getCompanyById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const { id } = req.params;

    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw createHttpError(400, "Invalid company ID");
    }

    const companyModel = getCompanyModel(dbName);

    const company = await companyModel.find({
      _id: new mongoose.Types.ObjectId(id),
      deletedAt: null,
    });

    if (!company) {
      throw createHttpError(404, "Company not found");
    }

    res.status(200).json({
      message: "Company retrieved successfully",
      data: company,
      type: "object",
    });
  } catch (err) {
    logger.error("Get Company by ID failed", err);
    next(err);
  }
};

export const companyMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const companyModel = getCompanyModel(dbName);
    const baseFilter = { deletedAt: null };

    const statsPipeline = [
      { $match: baseFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ];

    const statusCounts = await companyModel.aggregate(statsPipeline);

    let total_companies = 0;
    let active_count = 0;
    let inactive_count = 0;

    for (const item of statusCounts) {
      total_companies += item.count;
      if (item._id === true || item._id === "Active") {
        active_count = item.count;
      } else if (item._id === false || item._id === "Inactive") {
        inactive_count = item.count;
      }
    }

    res.status(200).json({
      status: 200,
      message: "Company metrics retrieved successfully",
      metrics: {
        total_companies,
        active_count,
        inactive_count,
      },
    });
  } catch (err) {
    logger.error("Company metrics function failed", err);
    return next(err);
  }
};

export const exportAllCompanies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const fileType = req.params.export === "pdf" ? "pdf" : "excel";

    const companyModel = getCompanyModel(dbName);

    const matchCondition: any = { deletedAt: null };

    const data = await companyModel.aggregate([
      {
        $lookup: {
          from: "packages",
          localField: "package_id",
          foreignField: "_id",
          as: "plan",
        },
      },
      { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
      { $match: matchCondition },
      {
        $project: {
          name: 1,
          email: 1,
          account_url: 1,
          status: 1,
          createdAt: {
            $dateToString: { format: "%m/%d/%Y", date: "$createdAt" },
          },
          plan_name: "plan.plan_name",
          plan_type: "plan.plan_type",
          price: "plan.price",
        },
      },
    ]);
    if (!data.length) {
      throw createHttpError(404, "No company(ies) found");
    }

    if (fileType === "pdf") {
      return await generatePdfDownload(res, data, "All companies");
    } else {
      return await generateExcelDownload(res, data, "All companies");
    }
  } catch (err) {
    logger.error("Export all companies failed", err);
    next(err);
  }
};

export const exportSingleCompany = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const fileType = req.params.export === "pdf" ? "pdf" : "excel";
    const id = req.params.id as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw createHttpError(400, "Invalid company ID");
    }

    const companyModel = getCompanyModel(dbName);

    const data = await companyModel.aggregate([
      {
        $lookup: {
          from: "packages",
          localField: "package_id",
          foreignField: "_id",
          as: "plan",
        },
      },
      { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          _id: mongoose.Types.ObjectId.createFromHexString(id),
          deletedAt: null,
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          phoneNumber: 1,
          website: 1,
          account_url: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          profileImage: 1,
          tenant_company_id: 1,
          "plan.plan_name": 1,
          "plan.plan_type": 1,
          "plan.price": 1,
        },
      },
    ]);

    if (!data.length) {
      throw createHttpError(404, "Company not found");
    }

    if (fileType === "pdf") {
      return await generatePdfDownload(res, data, "Company");
    } else {
      return await generateExcelDownload(res, data, "Company");
    }
  } catch (err) {
    logger.error("Export single company failed", err);
    next(err);
  }
};

export const webhookUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const CompanyAdmin = getCompanyModel(DB_NAME);

    const company: any = await CompanyAdmin.findById(req.body.id);
    if (!company) throw new Error(ERROR_MESSAGE.COMPANY_NOT_FOUND);

    const tenantDbName = `${company.company_id}${process.env.DB_SUFFIX}`;

    const Company = getCompanyModel(tenantDbName);

    // Update fields in tenant DB
    company.set({
      subscriptionStartDate: req.body.subscriptionStartDate,
      subscriptionEndDate: req.body.subscriptionEndDate,
    });
    const companyData = await company.save();

    // Update corresponding company in fusion_main (admin DB)
    const adminCompany = await Company.findOne({
      tenant_company_id: req.body.id,
    });
    if (adminCompany) {
      adminCompany.set({
        subscriptionStartDate: req.body.subscriptionStartDate,
        subscriptionEndDate: req.body.subscriptionEndDate,
      });
      await adminCompany.save();
    }
    res
      .status(201)
      .json({ message: INFO_MESSAGE.COMPANY_UPDATED_SUCCESSFULLY, company });
  } catch (err: any) {
    next(err);
  }
};

export const statusUpate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const CompanyAdmin = getCompanyModel(DB_NAME);

    const company: any = await CompanyAdmin.findById(req.params.id);
    if (!company) throw new Error(ERROR_MESSAGE.COMPANY_NOT_FOUND);

    const tenantDbName = `${company.company_id}${process.env.DB_SUFFIX}`;

    const Company = getCompanyModel(tenantDbName);

    // Update fields in tenant DB
    company.set({
      status: req.body.status,
    });

    await company.save();

    // Update corresponding company in fusion_main (admin DB)
    const adminCompany = await Company.findOne({
      tenant_company_id: req.params.id,
    });
    if (adminCompany) {
      adminCompany.set({
        status: req.body.status,
      });
      adminCompany.save();
    }
    const UserAdmin = getUserModel(DB_NAME);
    const User = getUserModel(tenantDbName);

    const user = await UserAdmin.findOne({ tenant_company_id: req.params.id });
    if (user) {
      user.set({
        status: req.body.status,
      });
      await user.save();
    }

    // Update user in admin DB
    const adminUser = await User.findOne({ tenant_company_id: req.params.id });
    if (adminUser) {
      adminUser.set({
        status: req.body.status,
      });
      await adminUser.save();
    }

    if (req.body.status) {
      await handleStripeSubscriptionStatus(
        tenantDbName,
        company._id.toString(),
        req.body.status
      );
    }

    res
      .status(201)
      .json({ message: INFO_MESSAGE.COMPANY_UPDATED_SUCCESSFULLY, company });
  } catch (err: any) {
    next(err);
  }
};

export const twoFAUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const Company = getCompanyModel(dbName);

    const company: any = await Company.findById(req.params.id);
    if (!company) throw new Error(ERROR_MESSAGE.COMPANY_NOT_FOUND);

    const CompanyAdmin = getCompanyModel(DB_NAME);
    const condition: any = {};
    if (req.query.type === "TwoFA") {
      condition.otpVerification = req.body.otpVerification;
    } else if (req.query.type === "CurrencyCVR") {
      condition.currencyCVR = req.body.currencyCVR;
    }
    // Update fields in tenant DB
    company.set({
      ...condition,
    });

    await company.save();

    // Update corresponding company in fusion_main (admin DB)
    const adminCompany = await CompanyAdmin.findOne({
      tenant_company_id: req.params.id,
    });
    if (adminCompany) {
      adminCompany.set({
        ...condition,
      });
      adminCompany.save();
    }
    res
      .status(201)
      .json({ message: "Two step authentication updated", company });
  } catch (err: any) {
    next(err);
  }
};

export const handleStripeSubscriptionStatus = async (
  dbName: string,
  companyObjId: string,
  status: string
) => {
  const Subscription = getSubscriptionModel(dbName);
  const activeSub = await Subscription.findOne({
    company_obj_id: companyObjId,
    status: "active",
  });

  if (!activeSub?.subscription_id?.startsWith("sub_")) return; // Ignore non-Stripe/manual

  if (status === "Inactive") {
    // Pause
    await stripe.subscriptions.update(activeSub.subscription_id, {
      pause_collection: { behavior: "void" },
    });
  } else if (status === "Active") {
    // Resume
    await stripe.subscriptions.update(activeSub.subscription_id, {
      pause_collection: null,
    });
  }
};

export const getCompanyDomainUrls = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Company = getCompanyModel(dbName);

    const data = await Company.find(
      { deletedAt: null },
      {
        account_url: 1,
        company_id: 1,
        emailPassword: 1,
        emailSetting: 1,
        emailType: 1,
      }
    ).lean();

    res.status(200).json({
      message: "Company domains fetched",
      data,
    });
  } catch (error) {
    logger.error("Error fetching clinic domains", error);
    next(error);
  }
};

export const updateCompanySettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    //@ts-ignore
    const companyId = req.company_id || req.params.id;
    const Company = getCompanyModel(dbName);
    const company: any = await Company.findOne({ company_id: companyId });

    if (!company) throw new Error(ERROR_MESSAGE.COMPANY_NOT_FOUND);

    // Prepare update payload
    const payload: any = {};

    // Handle email settings
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

      if (signatureHtml && signatureHtml !== "undefined") {
        const base64ImageRegex =
          /<img[^>]+src="data:image\/(png|jpeg|jpg|webp);base64,([^"]+)"/g;
        let match;
        let count = 0;
        let updatedSignatureHtml = signatureHtml;

        const matches = [...signatureHtml.matchAll(base64ImageRegex)];
        for (const match of matches) {
          const ext = match[1]; // 'png', 'jpeg', etc.
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

          count++;
        }

        payload.emailsignature = updatedSignatureHtml;
      } else {
        console.log(
          "⚠️ Signature not provided or invalid. Skipping email signature update."
        );
      }
    }

    // Handle global CC
    if (req.query.updateGlobalCc === "true") {
      payload.globalCc = req.body.globalCc;
    }

    // Handle global phone number
    if (req.query.updateGlobalPhoneNo === "true") {
      payload.globalPhoneNo = req.body.globalPhoneNo;
    }

    // Nothing to update?
    if (Object.keys(payload).length === 0) {
      res.status(400).json({ message: "No valid settings to update." });
      return;
    }

    // Update tenant DB
    company.set(payload);
    await company.save();

    // Update admin DB (fusion_main)
    const CompanyAdmin = getCompanyModel(DB_NAME); // admin DB
    const adminCompany = await CompanyAdmin.findOne({ company_id: companyId });

    if (adminCompany) {
      adminCompany.set(payload);
      await adminCompany.save();
    }

    res
      .status(200)
      .json({ message: "Company settings updated successfully", company });
  } catch (err: any) {
    next(err);
  }
};

export const getCompanySettings = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || DB_NAME;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }
    const { id } = req.params;

    const companyModel = getCompanyModel(dbName);

    const company: any = await companyModel.findOne({
      company_id: id,
      deletedAt: null,
    });

    if (!company) {
      throw createHttpError(404, "Company not found");
    }

    // ✨ Process email signature to replace S3 paths with signed URLs
    if (company.emailsignature) {
      const imagePathRegex = /<img[^>]+src="([^"]+)"/g;
      let updatedSignature = company.emailsignature;
      const matches = [...company.emailsignature.matchAll(imagePathRegex)];

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

      company.emailsignature = updatedSignature;
    }
    res.status(200).json({
      message: "Company settings retrieved successfully",
      data: company,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllRoles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || DB_NAME;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const rolesConfigPath = path.join(__dirname, "..", "config", "roles.json");
    const permissions = await readJSONFile(rolesConfigPath);
    permissions.forEach((obj: { permissions: any }) => {
      delete obj.permissions;
    });

    logger.info("Role List get successfully");
    res.status(201).json({
      status: 201,
      message: "Role List get successfully",
      data: permissions,
      type: "object",
    });
  } catch (err) {
    logger.error("Role List get failed", err);
    return next(err);
  }
};


// GET only company names for Entity dropdown in RFS
export const listCompanyNames: RequestHandler = async (req, res, next) => {
  try {
    // Get dynamic DB name from header or fallback
    const dbName = (req.headers["x-db-name"] as string) || process.env.DB_NAME || DB_NAME;

    const Company = getCompanyModel(dbName);

    const list = await Company.find({ deletedAt: null }, { name: 1 }).sort({ createdAt: -1 });

    res.status(200).json({
      message: "Company names fetched successfully",
      data: list.map((c) => ({ name: c.name })), // Optional transformation
    });

    
  } catch (err) {
    next(err);
  }
};



// export const softDeleteCompanyWithSubscription = async (
//   companyId: string,
//   dbName: string
// ): Promise<void> => {
//   const Company = getCompanyModel(dbName);
//   const Subscription = getSubscriptionModel(dbName);

//   // Step 1: Find the company
//   const company = await Company.findById(companyId);
//   if (!company) {
//     throw createHttpError(404, "Company not found");
//   }

//   // Step 2: Find the subscription
//   const subscription = await Subscription.findOne({
//     company_obj_id: company._id,
//     deletedAt: null,
//   });

//   if (subscription) {
//     // Step 3: Cancel the Stripe subscription
//     if (subscription.subscription_id) {
//       try {
//         await stripe.subscriptions.cancel(subscription.subscription_id);
//       } catch (err) {
//         console.warn("⚠️ Stripe subscription cancel failed:", err);
//       }
//     }

//     // Step 4: Delete the Stripe customer
//     if (subscription.customer_id) {
//       try {
//         await stripe.customers.del(subscription.customer_id);
//       } catch (err) {
//         console.warn("⚠️ Stripe customer delete failed:", err);
//       }
//     }

//     // Step 5: Soft delete the subscription
//     await Subscription.findByIdAndUpdate(
//       subscription._id,
//       { deletedAt: moment().toDate() },
//       { new: true }
//     );
//   }

//   // // Step 6: Soft delete the company
//   // await Company.findByIdAndUpdate(
//   //   company._id,
//   //   { deletedAt: moment().toDate() },
//   //   { new: true }
//   // );
// };
