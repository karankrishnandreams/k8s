import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import logger from "../utils/logger";
import { getDbConnection } from "@config/database";
import { Model } from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { ICompany } from "@interfaces/company.interface";
import companySchema from "@models/company.model";
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

const DB_NAME: any = process.env.DB_NAME;

const getCompanyModel = (dbName: string): Model<ICompany> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Company ||
    connection.model<ICompany>("Company", companySchema)
  );
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

export const authenticateWithSubdomainCheck = (isJWT: boolean = true) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyDomain: any = await companyDomainUrlList(DB_NAME);
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
        //@ts-ignore
        req.user = decoded;
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

export const companyDomainUrlList = async (dbName: string): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: "/user/public/company/companyurls",
      headers: {
        "x-db-name": dbName,
      },
    };

    const response = await kongAxios(config);

    const companyList = response.data?.data || [];

    return companyList;
  } catch (error) {
    logger.error("Failed to fetch clinic domain URLs via service", error);
    return [];
  }
};
