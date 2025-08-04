import { Request, Response, NextFunction } from "express";

import customerModel from "@models/customer.model";
import { getS3Parallel, uploadParallel } from "@utils/auth.utils";
import { generateCode } from "@utils/counter.utils";
import { ICustomer } from "@interfaces/customer.interface";
import { getDbConnection } from "@config/database";
import { Model } from "mongoose";
import CustomerSchema from "@models/customer.model";
import { paginate, paginateAggregate } from "@utils/paginate";
import logger from "@utils/logger";
import kongAxios from "@services/kong.service";
import {
  generateExcelDownload,
  generatePdfDownload,
} from "@utils/export.utils";
import createHttpError from "http-errors";
import moment from "moment";

export const getCustomerModel = (dbName: string): Model<ICustomer> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Customer ||
    connection.model<ICustomer>("Customer", CustomerSchema)
  );
};

const db_Name = process.env.DB_NAME;

export const createClientVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, companyName, email } = req.body;

    if (!type || !companyName || !email) {
      throw createHttpError(400, "Required fields missing");
    }

    // Generate numeric code
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const code = await generateCode(type, dbName);
    const Customer = getCustomerModel(dbName);

    // Check duplicates
    const exists = await Customer.findOne({
      $or: [{ email }, { code }],
      deletedAt: null,
    });
    if (exists) {
      throw createHttpError(409, "Email or Code already exists");
    }

    // Handle image upload
    let customer_image = undefined;
    const files = req.files as {
      [customer_image: string]: Express.Multer.File[];
    };
    const file = files?.customer_image?.[0];
    if (file && file.buffer) {
      customer_image = await uploadParallel(
        file,
        `${process.env.BUCKET_FOLDER}/customers/images`,
        res
      );
    }
    req.body.currency = req.body.currency ? req.body.currency : null;

    // Create and save customer
    const clientVendor = new Customer({
      ...req.body,
      code,
      createdUser: req.user.id,
      customer_image,
    });

    await clientVendor.save();
    logger.info(`${type} created successfully`, {
      id: clientVendor._id,
      email,
    });

    res.status(201).json({
      status: 201,
      message: `${type} created successfully`,
      data: clientVendor,
    });
  } catch (error) {
    next(error);
  }
};

export const getClientVendorById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Customer = getCustomerModel(dbName);
    const id = req.params.id;

    const clientVendor = await Customer.findOne({ _id: id, deletedAt: null });
    if (!clientVendor) {
      throw createHttpError(404, "Client/Vendor not found");
    }
    const city = clientVendor?.city;
    const state = clientVendor?.state;
    const country = clientVendor?.country;

    const nameConfig = {
      method: "post",
      url: "/user/public/locations/names/by-ids", // adjust as per Kong route
      data: {
        cityIds: city ? [city] : [],
        stateIds: state ? [state] : [],
        countryIds: country ? [country] : [],
      },
    };

    const locationRes = await kongAxios(nameConfig);
    const locationData = locationRes.data?.data || {};
    const plainClientVendor = clientVendor?.toObject?.() || {};
    const loggedInUser = req.user;
    (plainClientVendor as any).fullName =
      plainClientVendor.firstName + " " + plainClientVendor.lastName;
    if (loggedInUser.role[0]?.key_value !== "company_admin") {
      if (clientVendor?.secureCV) {
        if (clientVendor?.createdUser?.toString() !== loggedInUser.id) {
          (plainClientVendor as any).fullName = clientVendor.code;
        }
      }
      if(plainClientVendor?.secureCV){
        (plainClientVendor as any).code = null;
      }
    }

    res.status(200).json({
      status: 200,
      message: "Fetched successfully",
      data: {
        ...plainClientVendor,
        cityName: locationData.cityNames?.[clientVendor?.city ?? ""] || "",
        stateName: locationData.stateNames?.[clientVendor?.state ?? ""] || "",
        countryName:
          locationData.countryNames?.[clientVendor?.country ?? ""] || "",
      },
    });

    res.status(200).json({
      status: 200,
      message: "Fetched successfully",
      data: clientVendor,
    });
  } catch (error: any) {
    if (error?.isAxiosError && error?.response) {
      const status = error.response.status || 502;
      const message =
        error.response.data?.error?.message || // typical structure
        error.response.data?.message || // fallback
        "External service error during getClientVendor";

      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Already structured error
    }

    next(error);
  }
};

export const updateClientVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const type = req.body.type;
    const Customer = getCustomerModel(dbName);
    const { id } = req.params;

    const existing = await Customer.findOne({ _id: id, deletedAt: null });
    if (!existing) {
      logger.warn("Client/Vendor not found", { id });
      throw createHttpError(404, "Client/Vendor not found");
    }
    logger.info("Fetched Client/Vendor by ID", { id });

    // Access image from req.files
    let customer_image = existing?.customer_image;
    const files = req.files as {
      [customer_image: string]: Express.Multer.File[];
    };
    const file = files?.customer_image?.[0];

    if (file && file.buffer) {
      customer_image = await uploadParallel(
        file,
        `${process.env.BUCKET_FOLDER}/customers/images`,
        res
      );
    }

    req.body.currency = req.body.currency ? req.body.currency : null;

    const customer = await Customer.findById(id);

    if (customer?.type !== type) {
      const code = await generateCode(type, dbName);
      req.body.code = code;
    }

    const updated = await Customer.findByIdAndUpdate(
      id,
      {
        ...req.body,
        customer_image,
      },
      { new: true }
    );
    logger.info("Client/Vendor updated successfully", { id });

    res.status(201).json({
      status: 201,
      message: "Updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteClientVendor = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Customer = getCustomerModel(dbName);
    const { id } = req.params;

    const existing = await Customer.findOne({ _id: id, deletedAt: null });
    if (!existing) {
      throw createHttpError(404, "Client/Vendor not found");
    }

    existing.deletedAt = moment().toDate();
    await existing.save();
    logger.info("Client/Vendor deleted (soft)", { id });

    res.status(201).json({ status: 201, message: "Deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// export const listClientVendors = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
//     const Customer = getCustomerModel(dbName);

//     const {
//       page = "1",
//       limit = "10",
//       search = "",
//       status,
//       sortBy = "createdAt",
//       order = "desc",
//     } = req.query as {
//       page?: string;
//       limit?: string;
//       search?: string;
//       status?: string;
//       sortBy?: string;
//       order?: string;
//     };

//     const type = req.params.type;

//     const pipeline: any[] = [];

//     const matchStage: any = { deletedAt: null };
//     if (type && type.toLowerCase() !== "all") {
//       matchStage.type = type;
//     }
//     if (status) matchStage.status = status;
//     pipeline.push({ $match: matchStage });

//     pipeline.push({
//       $addFields: {
//         fullName: { $concat: ["$firstName", " ", "$lastName"] },
//       },
//     });

//     if (search) {
//       pipeline.push({
//         $match: {
//           $or: [
//             { companyName: { $regex: search, $options: "i" } },
//             { email: { $regex: search, $options: "i" } },
//             { phone: { $regex: search, $options: "i" } },
//             { fullName: { $regex: search, $options: "i" } },
//             { code: { $regex: search, $options: "i" } },
//           ],
//         },
//       });
//     }

//     const { data, pagination } = await paginateAggregate(Customer, pipeline, {
//       page: parseInt(page),
//       limit: parseInt(limit),
//       sortBy,
//       order: order === "asc" ? "asc" : "desc",
//     });

//     // 🔹 Collect unique country IDs
//     const uniqueCountryIds = [
//       ...new Set(data.map((item: any) => item.country).filter(Boolean)),
//     ];

//     // 🔹 Call Kong route to get country names
//     let countryNameMap: Record<string, string> = {};

//     if (uniqueCountryIds.length) {
//       const nameConfig = {
//         method: "post",
//         url: "/user/public/locations/country/name", // adjust as per Kong route
//         data: { ids: uniqueCountryIds },
//       };

//       try {
//         const response = await kongAxios(nameConfig);
//         const countries = response.data?.data || [];

//         countryNameMap = countries.reduce((acc: any, curr: any) => {
//           acc[curr._id] = curr.name;
//           return acc;
//         }, {});
//       } catch (err) {
//         console.warn("Failed to fetch country names", err);
//       }
//     }

//     // 🔹 Add signed image + country name
//     const transformedData = await Promise.all(
//       data.map(async (item: any) => {
//         let signedImage = null;
//         if (item.customer_image) {
//           try {
//             signedImage = await getS3Parallel(item.customer_image);
//           } catch (err) {
//             logger.warn(`Failed to sign image for customer ${item._id}`, err);
//           }
//         }

//         return {
//           ...item,
//           image: signedImage,
//           countryName: countryNameMap[item.country] || null,
//         };
//       })
//     );

//     res.status(200).json({
//       status: 200,
//       message: "Fetched successfully",
//       data: transformedData,
//       pagination,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

export const listClientVendors = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Customer = getCustomerModel(dbName);

    const {
      page = "1",
      limit = "10",
      search = "",
      status,
      sortBy = "createdAt",
      order = "desc",
    } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
      sortBy?: string;
      order?: string;
    };

    const type = req.params.type;
    const pipeline: any[] = [];

    const matchStage: any = { deletedAt: null };
    if (type && type.toLowerCase() !== "all") {
      matchStage.type = type;
    }
    if (status) matchStage.status = status;
    pipeline.push({ $match: matchStage });

    pipeline.push({
      $addFields: {
        fullName: { $concat: ["$firstName", " ", "$lastName"] },
      },
    });

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { companyName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } },
            { fullName: { $regex: search, $options: "i" } },
            { code: { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    const { data, pagination } = await paginateAggregate(Customer, pipeline, {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      order: order === "asc" ? "asc" : "desc",
    });
    
    // 🔹 Extract unique location IDs
    const cityIds = [
      ...new Set(data.map((item: any) => item.city).filter(Boolean)),
    ];
    const stateIds = [
      ...new Set(data.map((item: any) => item.state).filter(Boolean)),
    ];
    const countryIds = [
      ...new Set(data.map((item: any) => item.country).filter(Boolean)),
    ];
    const currencyIds = [
      ...new Set(data.map((item: any) => item.currency).filter(Boolean)),
    ];

    let cityNameMap: Record<string, string> = {};
    let stateNameMap: Record<string, string> = {};
    let countryNameMap: Record<string, string> = {};
    let currencyNameMap: Record<string, string> = {};

    if (cityIds.length || stateIds.length || countryIds.length) {
      try {
        const nameConfig = {
          method: "post",
          url: "/user/public/locations/names/by-ids",
          data: {
            cityIds,
            stateIds,
            countryIds,
            currencyIds,
          },
        };
        const response = await kongAxios(nameConfig);
        const locationData = response.data?.data || {};        

        cityNameMap = locationData.cityNames || {};
        stateNameMap = locationData.stateNames || {};
        countryNameMap = locationData.countryNames || {};
        currencyNameMap = locationData.currencies || {};
      } catch (err) {
        console.warn("Failed to fetch location names", err);
      }
    }
    const loggedInUser = req.user;
    // 🔹 Add signed image + location names
    const transformedData = await Promise.all(
      data.map(async (item: any) => {
        let signedImage = null;
        if (item.customer_image) {
          try {
            signedImage = await getS3Parallel(item.customer_image);
          } catch (err) {
            logger.warn(`Failed to sign image for customer ${item._id}`, err);
          }
        }

        item.fullName = item.firstName + " " + item.lastName;
       
        if (loggedInUser.role[0]?.key_value !== "company_admin") {
          if (item.secureCV) {
            if (item.createdUser?.toString() !== loggedInUser.id) {
              item.fullName = item.code;
            }
          }
          if(item.secureCV){
            (item as any).code = null;
          }
        }
       

        return {
          ...item,
          image: signedImage,
          cityName: cityNameMap[item.city] || "",
          stateName: stateNameMap[item.state] || "",
          countryName: countryNameMap[item.country] || "",
          currencyName: currencyNameMap[item.currency] || "",
        };
      })
    );

    res.status(200).json({
      status: 200,
      message: "Fetched successfully",
      data: transformedData,
      pagination,
    });
  } catch (error: any) {
    if (error?.isAxiosError && error?.response) {
      const status = error.response.status || 502;
      const message =
        error.response.data?.error?.message || // typical structure
        error.response.data?.message || // fallback
        "External service error during listClientVendors";

      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Already structured error
    }
    next(error);
  }
};

export const exportClientVendors = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Customer = getCustomerModel(dbName);

    const exportType = req.params.export;
    const type = req.params.type; // 'client' or 'vendor'
    const pipeline: any[] = [];

    // Match stage with deletedAt and type filter
    const matchStage: any = { deletedAt: null };
    if (type && type.toLowerCase() !== "all") {
      matchStage.type = type;
    }
    pipeline.push({ $match: matchStage });

    // Optional: Add fullName if needed
    pipeline.push({
      $addFields: {
        fullName: { $concat: ["$firstName", " ", "$lastName"] },
      },
    });

    // Fetch all data without pagination
    const { data } = await paginateAggregate(Customer, pipeline);

    // Extract unique country IDs
    const uniqueCountryIds = [
      ...new Set(data.map((item: any) => item.country).filter(Boolean)),
    ];

    // Get country names via Kong
    let countryNameMap: Record<string, string> = {};
    if (uniqueCountryIds.length) {
      try {
        const response = await kongAxios({
          method: "post",
          url: "/user/public/locations/country/name",
          data: { ids: uniqueCountryIds },
        });
        const countries = response.data?.data || [];
        countryNameMap = countries.reduce((acc: any, curr: any) => {
          acc[curr._id] = curr.name;
          return acc;
        }, {});
      } catch (err) {
        console.warn("Failed to fetch country names", err);
      }
    }

    // Transform data with image and country name
    const transformedData = await Promise.all(
      data.map(async (item: any) => {
        return {
          fullName: item.fullName,
          phone: item.phone,
          email: item.email,
          type: item.type,
          companyName: item.companyName,
          countryName: countryNameMap[item.country] || null,
          code: item.code,
          address: item.address,
          status: item.status,
        };
      })
    );

    // Handle export
    if (exportType === "excel") {
      return await generateExcelDownload(res, transformedData, `${type}_list`);
    } else if (exportType === "pdf") {
      return await generatePdfDownload(res, transformedData, `${type}_list`);
    }

    // Regular JSON response fallback (optional)
    res.status(200).json({
      status: 200,
      message: "Fetched successfully",
      data: transformedData,
    });
  } catch (error: any) {
    if (error?.isAxiosError && error?.response) {
      const status = error.response.status || 502;
      const message =
        error.response.data?.error?.message || // typical structure
        error.response.data?.message || // fallback
        "External service error during export Client Vendors";

      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Already structured error
    }
    next(error);
  }
};

export const clientVendorUpdateStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Customer = getCustomerModel(dbName);
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["active", "inactive"].includes(status)) {
      throw createHttpError(
        400,
        "Invalid status value. Must be 'active' or 'inactive'."
      );
    }

    // Check if client/vendor exists
    const existing = await Customer.findOne({ _id: id, deletedAt: null });
    if (!existing) {
      logger.warn("Client/Vendor not found", { id });
      throw createHttpError(404, "Client/Vendor not found");
    }

    logger.info("Updating Client/Vendor status", { id, status });

    // Update status only
    const updated = await Customer.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    logger.info("Client/Vendor status updated successfully", { id });

    res.status(201).json({
      status: 201,
      message: "Status updated successfully",
      data: updated,
    });
  } catch (error) {
    logger.error("Failed to update client/vendor status", error);
    return next(error);
  }
};

export const getVendorById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Customer = getCustomerModel(dbName);
    const id = req.params.id;

    const clientVendor = await Customer.findOne({ _id: id, deletedAt: null });
    if (!clientVendor) {
      throw createHttpError(404, "Client/Vendor not found");
    }
    const city = clientVendor?.city;
    const state = clientVendor?.state;
    const country = clientVendor?.country;

    const nameConfig = {
      method: "post",
      url: "/user/public/locations/names/by-ids", // adjust as per Kong route
      data: {
        cityIds: city ? [city] : [],
        stateIds: state ? [state] : [],
        countryIds: country ? [country] : [],
      },
    };

    const locationRes = await kongAxios(nameConfig);
    const locationData = locationRes.data?.data || {};
    const plainClientVendor = clientVendor?.toObject?.() || {};

    res.status(200).json({
      status: 200,
      message: "Fetched successfully",
      data: {
        ...plainClientVendor,
        cityName: locationData.cityNames?.[clientVendor?.city ?? ""] || "",
        stateName: locationData.stateNames?.[clientVendor?.state ?? ""] || "",
        countryName:
          locationData.countryNames?.[clientVendor?.country ?? ""] || "",
      },
    });

    res.status(200).json({
      status: 200,
      message: "Fetched successfully",
      data: clientVendor,
    });
  } catch (error: any) {
    if (error?.isAxiosError && error?.response) {
      const status = error.response.status || 502;
      const message =
        error.response.data?.error?.message || // typical structure
        error.response.data?.message || // fallback
        "External service error during getClientVendor";

      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Already structured error
    }

    next(error);
  }
};

export const vendorSearch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Customer = getCustomerModel(dbName);
    const { name } = req.params;

    const clientVendor = await Customer.findOne({
      companyName: name,
      deletedAt: null,
    });
    if (!clientVendor) {
      res.status(200).json({
        status: 200,
        error: true,
        message: "Vendor not found",
        data: [],
      });
    } else {
      res.status(200).json({
        status: 200,
        error: false,
        message: "Vendor found",
        data: clientVendor,
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 500,
      error: true,
      message: "Internal server error",
      data: [],
    });
  }
};
