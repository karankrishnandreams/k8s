import { getDbConnection } from "@config/database";
import { ICompany } from "@interfaces/company.interface";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";
import { IUser } from "@interfaces/user.interface";
import companySchema from "@models/company.model";
import EmailTemplateSchema from "@models/emailtemplate.model";
import UserSchema from "@models/user.model";
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import { getS3Parallel, uploadParallel } from "@utils/auth.utils";
import logger from "@utils/logger";
import { ERROR_MESSAGE, INFO_MESSAGE } from "@utils/message.constant";
import { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import mongoose, { Model } from "mongoose";

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

const getEmailTemplateModel = (dbName: string): Model<IEmailTemplate> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.EmailTemplate ||
    connection.model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema)
  );
};

const DB_NAME: any = process.env.DB_NAME;

export const getCompanyProfileById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: "Invalid company ID" });
    }

    const companyModel = getCompanyModel(DB_NAME);

    const company = await companyModel
      .findOne({
        _id: new mongoose.Types.ObjectId(id),
        deletedAt: null,
      })
      .lean(); // use .lean() for plain JS object (for mutation)

    if (!company) {
      res.status(404).json({ message: "Company not found" });
      return;
    }

    // Add signed S3 URL if profile image exists
    if (company.profileImage) {
      try {
        const signedUrl = await getS3Parallel(company.profileImage);
        company.profileImage = signedUrl;
      } catch (err) {
        logger.warn(`Failed to sign image for company ${company._id}`, err);
      }
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

export const companyProfileUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const files = req.files as { [profile_image: string]: Express.Multer.File[] };
    const body = JSON.parse(req.body.data);

    const id = req.params.id;

    if (body.planName || body.planType) {
      throw createHttpError(400, ERROR_MESSAGE.COMPANY_RESTRICTED);
    }

    const CompanyAdmin = getCompanyModel(DB_NAME);
    const UserAdmin = getUserModel(DB_NAME);
    const Company = getCompanyModel(dbName);
    const User = getUserModel(dbName);

    const company: any = await CompanyAdmin.findById(id);
    if (!company) throw createHttpError(404, ERROR_MESSAGE.COMPANY_NOT_FOUND);

    // Upload profile image if present
    const profileImageFile = files?.profile_image?.[0];

    if (profileImageFile?.buffer) {
      if (profileImageFile) {
        company.profileImage = await uploadParallel(
          profileImageFile,
          `${process.env.BUCKET_FOLDER}/super_admin/users/profile_images`,
          res
        );
      } else {
        company.profileImage = null;
      }
    }

    // Set only provided fields
    const fieldsToUpdate = [
      "name", "email", "website", "phoneNumber", "address", "status", "otpVerification", "password"
    ];
    fieldsToUpdate.forEach(field => {
      if (body[field] !== undefined) company[field] = body[field];
    });

    await company.save()

    // Update admin DB company
    const adminCompany: any = await Company.findOne({ tenant_company_id: id });
    if (adminCompany) {
      const adminFields = [
        "name", "email", "firstName", "lastName", "website",
        "phoneNumber", "address", "otpVerification", "password"
      ];
      adminFields.forEach(field => {
        if (body[field] !== undefined) adminCompany[field] = body[field];
      });
      if (company.profileImage) adminCompany.profileImage = company.profileImage;
      await adminCompany.save();
    }

    await company.save();

    // Update user in tenant DB
    const user = await UserAdmin.findOne({ tenant_company_id: id });
    if (user) {
      if (body.userName !== undefined) user.userName = body.userName;
      if (company.profileImage) user.profile_image = company.profileImage;
      if (body.password !== undefined) user.password = body.password;
      await user.save();
    }

    // Update user in tenant DB
    const adminUser = await User.findOne({ tenant_company_id: id });
    if (adminUser) {
      if (body.userName !== undefined) adminUser.userName = body.userName;
      if (company.profileImage) adminUser.profile_image = company.profileImage;
      if (body.password !== undefined) adminUser.password = body.password;
      await adminUser.save();
    }

    // Send email if status is "Inactive"
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

    res.status(201).json({
      message: INFO_MESSAGE.COMPANY_UPDATED_SUCCESSFULLY,
      company,
    });
  } catch (err: any) {
    console.error(err);
    if (err?.isAxiosError && err?.response) {
      const status = err.response.status || 502;
      const message =
        err.response.data?.error?.message ||
        err.response.data?.message ||
        "External service error during company update";
      next(createHttpError(status, message));
    }

    if (err?.status && err?.message) {
      next(err);
    }

    next(err);
  }
};
