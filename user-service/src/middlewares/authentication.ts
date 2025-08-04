import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import logger from "../utils/logger";
import { getDbConnection } from "@config/database";
import { ICompany } from "@interfaces/company.interface";
import companySchema from "@models/company.model";
import { sanitizedWorkspace } from "@utils/common.utils";
import { Model } from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { IUser } from "@interfaces/user.interface";
import userSchema from "@models/user.model";
import { IRole } from "@interfaces/roles.interface";
import roleSchema from "@models/roles.model";
import { validateRolePermission } from "@utils/role-permission-checker";
import kongAxios from "@services/kong.service";

const envArg = process.argv.find((arg) => arg.startsWith("--env="));
if (envArg) {
  const envName = envArg ? envArg.split("=")[1] : "development";
  if (envName === "localrun") {
    const envPath = path.resolve(__dirname, `../../.env.${envName}`);

    dotenv.config({ path: envPath });
  }
} else {
  dotenv.config();
}

// import { UserPayload } from "../types/common";

// function isUserPayload(decoded: any): decoded is UserPayload {
//   if (
//     !decoded ||
//     typeof decoded !== "object" ||
//     typeof decoded.id !== "string" ||
//     !Array.isArray(decoded.role)
//   ) {
//     return false;
//   }

//   return decoded.role.every(
//     (r: any) => r && typeof r === "object" && typeof r.key_value === "string"
//   );
// }

const DB_NAME: any = process.env.DB_NAME;

const getCompanyModel = (dbName: string): Model<ICompany> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Company ||
    connection.model<ICompany>("Company", companySchema)
  );
};

const getUserModel = (dbName: string): Model<IUser> => {
  const connection = getDbConnection(dbName);
  return connection.models.User || connection.model<IUser>("User", userSchema);
};

const getRoleModel = (dbName: string): Model<IRole> => {
  const connection = getDbConnection(dbName);
  return connection.models.Role || connection.model<IRole>("Role", roleSchema);
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

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw createHttpError(401, "Authentication token missing");
    }

    const token = authHeader.split(" ")[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "secret");

    // if (!isUserPayload(decoded)) {
    //   throw createHttpError(401, "Invalid token payload");
    // }

    req.user = decoded;

    const hasAdminRole = decoded.role.some((r: any) =>
      ["super_admin"].includes(r.key_value)
    );

    if (hasAdminRole) {
      req.headers["x-db-name"] = DB_NAME;
    }

    next();
  } catch (error: any) {
    logger.error(`Authentication error: ${error.message}`);
    next(createHttpError(401, "Invalid or expired token"));
  }
};

export const authenticateWithSubdomainCheck = (
  isJWT: boolean = true,
  roleKEY: string = ""
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyDomain: any = await clinicDomainUrlList(DB_NAME);
      const origin = req.headers.origin || req.headers.referer;

      // Check if Origin or Referer is missing
      if (!origin) {
        throw createHttpError(400, "Origin or Referer header is required");
      }

      // Parse the domain from the origin/referer
      let domain: any;
      try {
        const url = new URL(origin);
        domain = url.hostname;
        // Validate domain structure
        if (
          !domain ||
          domain.startsWith(".") ||
          domain.endsWith(".") ||
          domain.includes("..")
        ) {
          throw new Error("Invalid domain format");
        }
      } catch (e) {
        throw createHttpError(400, "Invalid Origin/Referer URL format");
      }

      // Check if subdomain is required (only allow specific subdomains if needed)
      const domainParts = domain.split(".");
      // Check if it's a localhost domain
      const isLocalhost = domain.endsWith("localhost");

      const isMainDomain =
        (isLocalhost && domainParts.length === 1) || // plain "localhost"
        (!isLocalhost &&
          (domainParts.length === 2 ||
            (domainParts.length > 2 && domainParts[0] === "www")));

      // If you want to require a subdomain (not main domain), uncomment this:
      if (isMainDomain) {
        throw createHttpError(403, "Subdomain is required");
      }

      // 3. Find matching accountUrl
      const matchedAccountURL = companyDomain.find(
        (com: { account_url: string }) => {
          const account_url = com.account_url;

          // For single-word account_urls (e.g., "test-ws")
          if (!account_url.includes(".")) {
            return domain.split(".")[0] === account_url;
          }

          // For full domain account_urls (e.g., "smarteremr.com")
          return (
            domain.endsWith(`.${account_url}`) &&
            domain.split(".").length > account_url.split(".").length
          );
        }
      );

      if (!matchedAccountURL) {
        throw createHttpError(403, "Access restricted to this subdomain");
      }
      // 4. Set clinic_id and dynamic database name
      //@ts-ignore
      req.companyObjId = matchedAccountURL._id;
      //@ts-ignore
      req.company_id = matchedAccountURL.company_id;
      //@ts-ignore
      req.account_url = matchedAccountURL.account_url;
      //@ts-ignore
      req.company_name = matchedAccountURL.name;
      req.headers["x-db-name"] =
        `${matchedAccountURL.company_id}${process.env.DB_SUFFIX}`;

      // Alternatively, if you have specific allowed subdomains:
      // const allowedSubdomains = ['app', 'api', 'admin']; // example
      // const subdomain = domainParts.length > 2 ? domainParts[0] : '';
      // if (!allowedSubdomains.includes(subdomain)) {
      //   throw createHttpError(403, 'Invalid subdomain');
      // }
      if (isJWT) {
        // Now check JWT after domain and subdomain check
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          throw createHttpError(401, "Authentication token missing");
        }

        const token = authHeader.split(" ")[1];

        type UserRole = {
          key_value: string;
          role_id: string | null;
        };

        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "secret"
        ) as unknown as {
          role: UserRole[];
          [key: string]: any;
        };
        req.user = decoded;
        req.user.company_id = matchedAccountURL.company_id;
        if (req.user?.accountURL !== matchedAccountURL.account_url) {
          throw createHttpError(403, "Authentication failed");
        }

      }

      next();
    } catch (error: any) {
      // Check if the error has a message
      const errorMessage = error?.message || "Invalid or expired token"; // Default error message if no message available
      const errorStatusCode = error?.statusCode || 401;
      logger.error(`Authentication error: ${errorMessage}`);
      next(createHttpError(errorStatusCode, errorMessage));
    }
  };
};

export const clinicDomainUrlList = async (dbName: string): Promise<any> => {
  try {
    const Company = getCompanyModel(dbName);

    // Find all non-deleted Companies and only return the account url field
    const company = await Company.find(
      { deletedAt: null }, // Filter out soft-deleted clinics
      { account_url: 1, company_id: 1 }
    ).lean();

    return company;
  } catch (error) {
    logger.error(error);
  }
};
