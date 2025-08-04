import { Request, Response, NextFunction } from "express";

import { getS3Parallel, uploadParallel } from "@utils/auth.utils";
import { ICustomer } from "@interfaces/customer.interface";
import { getDbConnection } from "@config/database";
import mongoose, { Model } from "mongoose";
import { paginate, paginateAggregate } from "@utils/paginate";
import logger from "@utils/logger";
import kongAxios from "@services/kong.service";
import {
  generateExcelDownload,
  generatePdfDownload,
} from "@utils/export.utils";
import { validateWarehouseImportRow } from "../validations.ts/warehouse.validation";
import { IWarehouse } from "@interfaces/warehouse.interface";
import WarehouseSchema from "@models/warehouse.model";
import createHttpError from "http-errors";
import { handleFileImport } from "@utils/import.utils";
import * as xlsx from "xlsx";

export const getWarehouseModel = (dbName: string): Model<IWarehouse> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Warehose ||
    connection.model<IWarehouse>("Warehouse", WarehouseSchema)
  );
};

const getWarehouseExist = async (
  id: string,
  token: string,
  Origin: string
): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: `/inventory/item/check-warehouse-assigned/${id}`,
      headers: {
        Origin: Origin,
        Authorization: token,
      },
    };

    const response = await kongAxios(config);

    if (response.status == 200) {
      return response.data.assigned || false;
    }
  } catch (error) {
    return false;
  }
};

const db_Name = process.env.DB_NAME;

export const createWarehouse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const body = req.body;

    const WarehouseModel = getWarehouseModel(dbName);

    const warehouse = new WarehouseModel({
      name: body.name,
      description: body.description,
      contactPerson: body.contactPerson,
      email: body.email,
      phoneNumber: body.phoneNumber,
      workPhone: body.workPhone,
      address: body.address,
      status: body.status,
      country: body.country,
      state: body.state,
      city: body.city,
      zipcode: body.zipcode,
    });

    const savedWarehouse = await warehouse.save();

    res.status(201).json({
      message: "Warehouse created successfully",
      data: savedWarehouse,
    });
  } catch (error) {
    next(error);
  }
};

// Update Warehouse
export const updateWarehouse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const WarehouseModel = getWarehouseModel(dbName);
    const { id } = req.params;

    const existing = await WarehouseModel.findOne({ _id: id, deletedAt: null });
    if (!existing) {
      throw createHttpError(404, "Warehouse not found");
    }

    // Update fields
    existing.name = req.body.name;
    existing.description = req.body.description;
    existing.contactPerson = req.body.contactPerson;
    existing.email = req.body.email;
    existing.phoneNumber = req.body.phoneNumber;
    existing.address = req.body.address;
    existing.country = req.body.country;
    existing.state = req.body.state;
    existing.status = req.body.status;
    existing.city = req.body.city;
    existing.zipcode = req.body.zipcode;

    const updatedWarehouse = await existing.save();

    res.status(201).json({
      message: "Warehouse updated successfully",
      data: updatedWarehouse,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Warehouse
export const deleteWarehouse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const token: any = req.headers["authorization"];
    const Origin: any = req.headers["origin"] || req.headers["referer"];
    const WarehouseModel = getWarehouseModel(dbName);
    const { id } = req.params;

    const existing = await WarehouseModel.findOne({ _id: id });

    if (!existing) {
      res.status(404).json({ message: "Warehouse not found" });
    }
    const existingWarehouse = await getWarehouseExist(id, token, Origin);

    if (existingWarehouse) {
      res
        .status(400)
        .json({
          message: "Warehouse is assigned to items and cannot be deleted",
        });
      return;
    }

    await WarehouseModel.deleteOne({ _id: id }); // 🔍 Proper delete method

    res.status(201).json({ message: "Warehouse deleted successfully" });
    return;
  } catch (error) {
    next(error);
  }
};

// View Warehouse
export const getWarehouseById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const WarehouseModel = getWarehouseModel(dbName);
    const { id } = req.params;

    const warehouse = await WarehouseModel.findOne({
      _id: id,
      deletedAt: null,
    });
    if (!warehouse) {
      throw createHttpError(404, "Warehouse not found");
    }

    res.status(200).json({
      message: "Warehouse fetched successfully",
      data: warehouse,
    });
  } catch (error) {
    next(error);
  }
};

// Update Warehouse Status Only
export const updateWarehouseStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const WarehouseModel = getWarehouseModel(dbName);
    const { id } = req.params;
    let { status } = req.body;

    // Normalize status to 'Active' or 'Inactive'
    if (typeof status === "string") {
      const normalized = status.trim().toLowerCase();
      if (normalized === "active") status = "Active";
      else if (normalized === "inactive") status = "Inactive";
    }

    if (!["Active", "Inactive"].includes(status)) {
      throw createHttpError(
        400,
        "Invalid status value. Must be 'Active' or 'Inactive'."
      );
    }

    const existing = await WarehouseModel.findOne({ _id: id, deletedAt: null });
    if (!existing) {
      throw createHttpError(404, "Warehouse not found");
    }

    existing.status = status;
    await existing.save();

    res.status(201).json({
      message: "Warehouse status updated successfully",
      data: existing,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error while updating warehouse status", error });
  }
};

export const listWarehouses = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const WarehouseModel = getWarehouseModel(dbName);

    const {
      status,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const filter: any = {};

    if (status != "All") filter.status = status;

    if (search) {
      const regex = new RegExp(search.toString().trim(), "i");
      filter.$or = [
        { name: regex },
        { description: regex },
        { email: regex },
        { "contactPersonDetails.userName": regex },
        { "contactPersonDetails.firstName": regex },
        { "contactPersonDetails.lastName": regex },
      ];
    }

    const sort: any = {};
    sort[sortBy as string] = order === "asc" ? 1 : -1;

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline: any[] = [
      {
        $lookup: {
          from: "users",
          let: { contactPersonId: "$contactPerson" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$contactPersonId"] },
              },
            },
            {
              $project: {
                _id: 1,
                userName: 1,
                firstName: 1,
                lastName: 1,
                profile_image: 1,
              },
            },
          ],
          as: "contactPersonDetails",
        },
      },
      {
        $unwind: {
          path: "$contactPersonDetails",
          preserveNullAndEmptyArrays: true, // Still allows null if no user found
        },
      },

      { $match: filter },
      { $sort: sort },
      { $skip: skip },
      { $limit: Number(limit) },
    ];

    const [warehouses, total] = await Promise.all([
      WarehouseModel.aggregate(pipeline),
      WarehouseModel.countDocuments(filter),
    ]);

    for (const warehouse of warehouses) {
      if (
        warehouse.contactPersonDetails &&
        warehouse.contactPersonDetails.profile_image
      ) {
        try {
          warehouse.contactPersonDetails.profile_image = await getS3Parallel(
            warehouse.contactPersonDetails.profile_image
          );
        } catch (err) {
          logger.warn(`Failed to generate signed URL for user`, err);
        }
      }
    }

    // 🔹 Extract unique location IDs
    const cityIds = [
      ...new Set(warehouses.map((item: any) => item.city).filter(Boolean)),
    ];
    const stateIds = [
      ...new Set(warehouses.map((item: any) => item.state).filter(Boolean)),
    ];
    const countryIds = [
      ...new Set(warehouses.map((item: any) => item.country).filter(Boolean)),
    ];

    let cityNameMap: Record<string, string> = {};
    let stateNameMap: Record<string, string> = {};
    let countryNameMap: Record<string, string> = {};

    if (cityIds.length || stateIds.length || countryIds.length) {
      try {
        const nameConfig = {
          method: "post",
          url: "/user/public/locations/names/by-ids",
          data: {
            cityIds,
            stateIds,
            countryIds,
          },
        };
        const response = await kongAxios(nameConfig);
        const locationData = response.data?.data || {};

        cityNameMap = locationData.cityNames || {};
        stateNameMap = locationData.stateNames || {};
        countryNameMap = locationData.countryNames || {};
      } catch (err) {
        console.warn("Failed to fetch location names", err);
      }
    }

    // 🔹 Add signed image + location names
    const transformedData = await Promise.all(
      warehouses.map(async (item: any) => {
        return {
          ...item,
          cityName: cityNameMap[item.city] || "",
          stateName: stateNameMap[item.state] || "",
          countryName: countryNameMap[item.country] || "",
        };
      })
    );

    res.status(200).json({
      message: "Warehouses retrieved successfully",
      data: transformedData,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    if (error?.isAxiosError && error?.response) {
      const status = error.response.status || 502;
      const message =
        error.response.data?.error?.message || // typical structure
        error.response.data?.message || // fallback
        "External service error during warehouse retrieval";

      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Already structured error
    }
    next(error);
  }
};

export const exportWarehouse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const Warehouse = getWarehouseModel(dbName);

    const exportType = req.params.export;

    // Aggregation pipeline to get contactPersonDetails
    const pipeline: any[] = [
      {
        $lookup: {
          from: "users",
          let: { contactPersonId: "$contactPerson" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$contactPersonId"] },
              },
            },
            {
              $project: {
                _id: 1,
                userName: 1,
                firstName: 1,
                lastName: 1,
                profile_image: 1,
              },
            },
          ],
          as: "contactPersonDetails",
        },
      },
      {
        $unwind: {
          path: "$contactPersonDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
    ];

    // Fetch all data without pagination
    const data = await Warehouse.aggregate(pipeline);

    if (data.length == 0) {
      throw createHttpError(404, "No records in warehouse");
    }
    // Extract unique location IDs
    const cityIds = [
      ...new Set(data.map((item: any) => item.city).filter(Boolean)),
    ];
    const stateIds = [
      ...new Set(data.map((item: any) => item.state).filter(Boolean)),
    ];
    const countryIds = [
      ...new Set(data.map((item: any) => item.country).filter(Boolean)),
    ];

    let cityNameMap: Record<string, string> = {};
    let stateNameMap: Record<string, string> = {};
    let countryNameMap: Record<string, string> = {};

    if (cityIds.length || stateIds.length || countryIds.length) {
      try {
        const nameConfig = {
          method: "post",
          url: "/user/public/locations/names/by-ids",
          data: {
            cityIds,
            stateIds,
            countryIds,
          },
        };
        const response = await kongAxios(nameConfig);
        const locationData = response.data?.data || {};

        cityNameMap = locationData.cityNames || {};
        stateNameMap = locationData.stateNames || {};
        countryNameMap = locationData.countryNames || {};
      } catch (err) {
        console.warn("Failed to fetch location names", err);
      }
    }

    // Add resolved city/state/country names
    const transformedData = await Promise.all(
      data.map(async (item: any) => {
        const { contactPersonDetails, ...rest } = item; // destructure and remove 'contactPersonDetails'

        return {
          ...rest,
          city: cityNameMap[item.city] || "",
          state: stateNameMap[item.state] || "",
          country: countryNameMap[item.country] || "",
          contactPerson: contactPersonDetails
            ? contactPersonDetails.userName
            : "",
        };
      })
    );
    // Handle export
    if (exportType === "excel") {
      return await generateExcelDownload(
        res,
        transformedData,
        `warehouse_list`
      );
    } else if (exportType === "pdf") {
      return await generatePdfDownload(res, transformedData, `warehouse_list`);
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
        "External service error during warehouse retrieval";

      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Already structured error
    }
    next(error);
  }
};

export const getUserExistInWarehouse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const userId = req.params.id;

    const WarehouseModel = getWarehouseModel(dbName); // Assuming you have this function

    const pipeline = [
      {
        $match: {
          contactPerson: new mongoose.Types.ObjectId(userId),
        },
      },
    ];

    const warehouse = await WarehouseModel.aggregate(pipeline);

    res.status(200).json({
      data: warehouse,
    });
  } catch (err) {
    next(err);
  }
};

// View Warehouse
export const warHouseById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const WarehouseModel = getWarehouseModel(dbName);
    const { id } = req.params;

    if (!id) {
      throw createHttpError(400, "Warehouse id is required");
    }

    const warehouse = await WarehouseModel.findOne({
      _id: id,
    });

    if (!warehouse) {
      res.status(200).json({
        message: "Warehouse not found",
        data: [],
      });
    } else {
      res.status(200).json({
        message: "Warehouse fetched successfully",
        data: warehouse,
      });
    }
  } catch (error) {
    next(error);
  }
};

export const importWarehouse = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    const token: any = req.headers["authorization"];
    const origin: any = req.headers["origin"] || req.headers["referer"];
    const warehouse = getWarehouseModel(dbName);

    const file = req.file as Express.Multer.File;
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet);

    const created: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    for (const [index, row] of rows.entries()) {
      const { errors: rowErrors, validRow } = validateWarehouseImportRow(row);

      if (rowErrors.length) {
        errors.push({ row: index + 1, errors: rowErrors });
        continue;
      }

      // Check if warehouse already exists
      const existingItem = await warehouse
        .findOne({ name: validRow.name.trim() })
        .collation({ locale: "en", strength: 2 });

      if (existingItem) {
        skipped.push({
          row: index + 1,
          name: validRow.name,
          reason: "Warehouse already exists",
        });
        continue;
      }

      // Fetch location IDs
      let locationData = null;
      try {
        const locResponse = await kongAxios({
          method: "get",
          url: "/user/public/locations/locations/get-ids",
          params: {
            countryName: row.country,
            stateName: row.state,
            cityName: row.city,
          },
        });
        locationData = locResponse.data?.data;

        if (
          !locationData?.country ||
          !locationData?.state ||
          !locationData?.city
        ) {
          errors.push({
            row: index + 1,
            name: validRow.name,
            errors: ["Invalid country, state, or city name"],
          });
          continue;
        }
        validRow.country = locationData.country._id;
        validRow.state = locationData.state._id;
        validRow.city = locationData.city._id;
      } catch (err) {
        errors.push({
          row: index + 1,
          name: validRow.name,
          errors: ["Failed to fetch location IDs"],
        });
        continue;
      }

      // Fetch contact person
      let userData = null;
      try {
        const userResponse = await kongAxios({
          method: "get",
          url: `/user/company/user/detail-by-name/${row.contactPerson}`,
          headers: {
            Origin: origin,
            Authorization: token,
          },
        });
        userData = userResponse.data?.data;

        if (!userData) {
          errors.push({
            row: index + 1,
            name: validRow.name,
            errors: ["Contact person not found"],
          });
          continue;
        }
        validRow.contactPerson = userData._id;
      } catch (err) {
        errors.push({
          row: index + 1,
          name: validRow.name,
          errors: ["Failed to fetch contact person details"],
        });
        continue;
      }

      // Create new warehouse entry
      try {
        const warehouseData = {
          name: validRow.name,
          description: validRow.description,
          contactPerson: validRow.contactPerson,
          email: validRow.email,
          phoneNumber: validRow.phoneNumber,
          address: validRow.address,
          status: validRow.status,
          country: validRow.country,
          state: validRow.state,
          city: validRow.city,
          zipcode: validRow.zipcode,
        };

        const newWarehouse = await warehouse.create(warehouseData);

        created.push({
          row: index + 1,
          name: validRow.name,
          id: newWarehouse._id,
        });
      } catch (err) {
        errors.push({
          row: index + 1,
          name: validRow.name,
          errors: ["Failed to save warehouse record"],
        });
      }
    }

    res.status(200).json({
      message:
        created.length > 0
          ? "Import completed with partial success"
          : "All records failed or were skipped",
      createdCount: created.length,
      skippedCount: skipped.length,
      errorCount: errors.length,
      created,
      skipped,
      errors,
    });
  } catch (error) {
    next(error);
  }
};

export const sampleWarehouseImport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sampleData = [
      {
        name: "Classic",
        description: "test 001",
        contactPerson: "user 1",
        email: "test@gmail.com",
        phoneNumber: "1234567890",
        address: "test address",
        status: "Active",
        country: "India",
        state: "Tamilnadu",
        city: "Coimbatore",
        zipcode: "645857",
      },
      {
        name: "Classic 2",
        description: "test 002",
        contactPerson: "user 2",
        email: "test2@gmail.com",
        phoneNumber: "1234567890",
        address: "test address",
        status: "Active",
        country: "India",
        state: "Tamilnadu",
        city: "Coimbatore",
        zipcode: "645857",
      },
      {
        name: "Classic 3",
        description: "test 003",
        contactPerson: "user 3",
        email: "test3@gmail.com",
        phoneNumber: "1234567890",
        address: "test address",
        status: "Active",
        country: "India",
        state: "Tamilnadu",
        city: "Coimbatore",
        zipcode: "645857",
      },
    ];

    await generateExcelDownload(res, sampleData, "Warehouse");
    // res.status(200).json({ message: "Sample data fetched successfully", data: "sampleData" });
  } catch (error) {
    next(error);
  }
};

// View Warehouse
export const warehouseSearch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const WarehouseModel = getWarehouseModel(dbName);
    const { name } = req.params;

    if (!name) {
      throw createHttpError(400, "Warehouse name is required");
    }

    const warehouse = await WarehouseModel.findOne({
      name: name.trim(),
      deletedAt: null,
    }).collation({ locale: "en", strength: 2 }); // 👈 case-insensitive exact match

    if (!warehouse) {
      res.status(200).json({
        message: "Warehouse fetched successfully",
        data: warehouse,
      });
    } else {
      res.status(200).json({
        message: "Warehouse fetched successfully",
        data: warehouse,
      });
    }
  } catch (error) {
    next(error);
  }
};

export const warehouseNames = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const WarehouseModel = getWarehouseModel(dbName);
    const { names } = req.body;

    if (!Array.isArray(names) || names.length === 0) {
      throw createHttpError(400, "Warehouse names are required");
    }

    // Perform case-insensitive match for each name
    const warehouses = await WarehouseModel.find({
      name: { $in: names.map((n) => n.trim()) },
      deletedAt: null,
    }).collation({ locale: "en", strength: 2 });

    res.status(200).json({
      message: "Warehouses fetched successfully",
      data: warehouses,
    });
  } catch (error) {
    next(error);
  }
};
