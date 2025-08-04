import { Request, Response, NextFunction } from "express";
import mongoose, { Model } from "mongoose";
import { getDbConnection } from "@config/database";
import createHttpError from "http-errors";
import logger from "@utils/logger";
import SalesSchema from "@models/sales.model"; // your schema
import { ISales } from "@interfaces/sales.interface";
import { groupDataBySheetName } from "@utils/auth.utils";
import xlsx from "xlsx";
import moment from "moment";
import {
  generateExcelDownload,
  generatePdfDownload,
} from "@utils/export.utils";
import { ITerm } from "@interfaces/term.interface";
import TermSchema from "@models/term.model";
import ConditionSchema from "../models/condition.model";
import CurrencySchema from "../models/currency.model";
import TaxSchema from "../models/tax.model";
import ItemSchema from "@models/item.model";
import { IManufacturer } from "@interfaces/manufacturer.interface";
import { ICondition } from "@interfaces/condition.interface";
import { Icurrency } from "@interfaces/currency.interface";
import { ITax } from "@interfaces/tax.interface";
import { IItem } from "@interfaces/item.interface";
import ManufacturerSchema from "@models/manufacturer.model";
import kongAxios from "@services/kong.service";
import { validatePurchaseProposalImportRow } from "@validations/purchase-proposal.validation";
import ExcelJS from "exceljs";

const db_Name: string = process.env.DB_NAME || "";

const getSalesModel = (dbName: string): Model<ISales> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Sales || connection.model<ISales>("Sales", SalesSchema)
  );
};

const getTermsModel = (dbName: string): Model<ITerm> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Terms ||
    connection.model<ITerm>("Terms", TermSchema as any)
  );
};

const getConditionModel = (dbName: string): Model<ICondition> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Condition ||
    connection.model<ICondition>("Condition", ConditionSchema)
  );
};

const getCurrencyModel = (dbName: string): Model<Icurrency> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Currency ||
    connection.model<Icurrency>("Currency", CurrencySchema)
  );
};

const getTaxModel = (dbName: string): Model<ITax> => {
  const connection = getDbConnection(dbName);
  return connection.models.Tax || connection.model<ITax>("Tax", TaxSchema);
};

const getItemModel = (dbName: string): Model<IItem> => {
  const connection = getDbConnection(dbName);
  return connection.models.Item || connection.model<IItem>("Item", ItemSchema);
};

const getManufacturerModel = (dbName: string): Model<IManufacturer> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Manufacturer ||
    connection.model<IManufacturer>("Manufacturer", ManufacturerSchema)
  );
};

const getVendor = async (
  dbName: string,
  id: string,
  token: string,
  origin: string
): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: `/people/public/customer/vender/${id}`,
      token: token,
      headers: {
        "x-db-name": dbName,
        origin: origin,
      },
    };

    const response = await kongAxios(config);

    const vendor = response.data?.data || [];

    return [vendor];
  } catch (error) {
    return [];
  }
};

const getUser = async (
  dbName: string,
  id: string,
  token: string,
  origin: string
): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: `/user/company/user/detail/${id}`,
      headers: {
        Origin: origin,
        Authorization: token,
      },
    };

    const response = await kongAxios(config);

    const rep = response.data?.data || [];

    return {
      success: true,
      message: "User data retrived successfully",
      data: rep,
    };
  } catch (error) {
    return {
      success: false,
      message: "User not found",
      data: [],
    };
  }
};

const getWarehouseModel = async (
  dbName: string,
  id: string,
  token: string,
  origin: string
): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: `/people/warehouse/view/${id}`,
      headers: {
        Origin: origin,
        Authorization: token,
      },
    };

    const response = await kongAxios(config);

    const warehouse = response.data?.data || [];

    return {
      success: true,
      message: "Warehouse fetched successfully",
      data: warehouse,
    };
  } catch (error) {
    return {
      success: false,
      message: "Warehouse not found",
      data: [],
    };
  }
};

const getVendorByName = async (
  dbName: string,
  name: string,
  token: string,
  origin: string
): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: `/people/public/customer/vender/search/${name}`,
      token: token,
      headers: {
        origin: origin,
        Authorization: token,
      },
    };
    const response = await kongAxios(config);

    if (response.data.error) {
      return [];
    } else {
      const vendor = response.data?.data || [];

      return [vendor];
    }
  } catch (error) {
    return [];
  }
};

const getWarehouseSearch = async (
  name: string,
  token: string,
  Origin: string
): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: `/people/warehouse/warehouse/search/${name}`,
      token: token,
      headers: {
        Origin: Origin,
        Authorization: token,
      },
    };

    const response = await kongAxios(config);

    const companyList = response.data?.data || [];

    return companyList;
  } catch (error) {
    return [];
  }
};

// Create
export const createSale = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] || db_Name;
    const Sales = getSalesModel(dbName);
    const queryParams = req.query.type as string;
    const token: string = req.headers["authorization"] as string;
    const origin: string = (req.headers["origin"] ||
      req.headers["referer"]) as string;
    const body = req.body;

    if (!queryParams || !["sp", "so"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return;
    }

    const [getCondition, getCurrency, getTerms] = await Promise.all([
      getConditionModel(dbName).findOne({ _id: body.conditionId }),
      getCurrencyModel(dbName).findOne({ _id: body.currencyId }),
      getTermsModel(dbName).findOne({ _id: body.termsId }),
    ]);

    if (!getCondition) {
      res.status(400).json({ success: false, message: "Condition not found" });
      return;
    }
    if (!getCurrency) {
      res.status(400).json({ success: false, message: "Currency not found" });
      return;
    }
    if (!getTerms) {
      res.status(400).json({ success: false, message: "Terms not found" });
      return;
    }
    const vendor = await getVendor(dbName, body.clientId, token, origin);

    if (!vendor.length) {
      res
        .status(400)
        .json({ success: false, message: "Vendor not found", data: [] });
      return;
    }

    const user = await getUser(dbName, body.repId, token, origin);
    if (!user.success) {
      res
        .status(400)
        .json({ success: false, message: "User not found", data: [] });
      return;
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "At least one item is required" });
      return;
    }

    for (const [index, item] of body.items.entries()) {
      const [itemDoc, manufacturerDoc, conditionDoc] = await Promise.all([
        getItemModel(dbName).findOne({
          _id: item.itemId,
          status: "Active",
          deletedAt: null,
        }),
        getManufacturerModel(dbName).findOne({
          _id: item.manufacturerId,
          status: "active",
          deletedAt: null,
        }),
        getConditionModel(dbName).findOne({
          _id: item.conditionId,
          deletedAt: null,
        }),
      ]);

      const warehouseDoc = await getWarehouseModel(
        dbName,
        item.warehouseId,
        token,
        origin
      );

      if (!itemDoc) {
        res.status(400).json({
          success: false,
          message: `Item not found at index ${index}`,
        });
        return;
      }
      if (!manufacturerDoc) {
        res.status(400).json({
          success: false,
          message: `Manufacturer not found at index ${index}`,
        });
        return;
      }
      if (!conditionDoc) {
        res.status(400).json({
          success: false,
          message: `Condition not found at index ${index}`,
        });
        return;
      }
      if (!warehouseDoc.success) {
        res.status(400).json({
          success: false,
          message: `Warehouse not found at index ${index}`,
        });
        return;
      }
    }
    if (queryParams === "sp") {
      body.isSaleOrder = false;
    }

    const newSale = new Sales(body);
    const saved = await newSale.save();

    res.status(201).json({
      message: "Sale created successfully",
      data: saved,
    });
  } catch (error) {
    res.status(500).json({ message: "Error while creating sale", error });
  }
};

// Update
export const updateSale = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] || db_Name;
    const saleId = req.params.id;
    const Sales = getSalesModel(dbName);
    const queryParams = req.query.type as string;
    const token: string = req.headers["authorization"] as string;
    const origin: string = (req.headers["origin"] ||
      req.headers["referer"]) as string;
    const body = req.body;

    if (!queryParams || !["sp", "so"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return;
    }

    const sale = await Sales.findById(saleId);
    if (!sale) {
      res.status(404).json({ success: false, message: "Sale not found" });
      return;
    }

    const [getCondition, getCurrency, getTerms] = await Promise.all([
      getConditionModel(dbName).findOne({ _id: body.conditionId }),
      getCurrencyModel(dbName).findOne({ _id: body.currencyId }),
      getTermsModel(dbName).findOne({ _id: body.termsId }),
    ]);

    if (!getCondition) {
      res.status(400).json({ success: false, message: "Condition not found" });
      return;
    }
    if (!getCurrency) {
      res.status(400).json({ success: false, message: "Currency not found" });
      return;
    }
    if (!getTerms) {
      res.status(400).json({ success: false, message: "Terms not found" });
      return;
    }

    const vendor = await getVendor(dbName, body.clientId, token, origin);
    if (!vendor.length) {
      res
        .status(400)
        .json({ success: false, message: "Vendor not found", data: [] });
      return;
    }

    const user = await getUser(dbName, body.repId, token, origin);
    if (!user.success) {
      res
        .status(400)
        .json({ success: false, message: "User not found", data: [] });
      return;
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "At least one item is required" });
      return;
    }

    for (const [index, item] of body.items.entries()) {
      const [itemDoc, manufacturerDoc, conditionDoc] = await Promise.all([
        getItemModel(dbName).findOne({
          _id: item.itemId,
          status: "Active",
          deletedAt: null,
        }),
        getManufacturerModel(dbName).findOne({
          _id: item.manufacturerId,
          status: "active",
          deletedAt: null,
        }),
        getConditionModel(dbName).findOne({
          _id: item.conditionId,
          deletedAt: null,
        }),
      ]);

      const warehouseDoc = await getWarehouseModel(
        dbName,
        item.warehouseId,
        token,
        origin
      );

      if (!itemDoc) {
        res.status(400).json({
          success: false,
          message: `Item not found at index ${index}`,
        });
        return;
      }
      if (!manufacturerDoc) {
        res.status(400).json({
          success: false,
          message: `Manufacturer not found at index ${index}`,
        });
        return;
      }
      if (!conditionDoc) {
        res.status(400).json({
          success: false,
          message: `Condition not found at index ${index}`,
        });
        return;
      }
      if (!warehouseDoc.success) {
        res.status(400).json({
          success: false,
          message: `Warehouse not found at index ${index}`,
        });
        return;
      }
    }

    if (queryParams === "sp") {
      body.isSaleOrder = false;
    }

    Object.assign(sale, body);
    const updated = await sale.save();

    res.status(200).json({
      message: "Sale updated successfully",
      data: updated,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Error while updating sale", error });
  }
};

// Delete (soft delete)
export const deleteSale = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] || db_Name;
    const saleId = req.params.id;
    const Sales = getSalesModel(dbName);
    const sale = await Sales.findById(saleId);

    if (!sale) {
      throw createHttpError(404, "Sale not found");
    }

    sale.deletedAt = moment().toDate();
    await sale.save();

    res.status(200).json({ message: "Sale deleted successfully" });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Error while deleting sale", error });
  }
};

// Get by ID
export const getSaleById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] || db_Name;
    const saleId = req.params.id;
    const Sales = getSalesModel(dbName);

    const pipeline: any = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(saleId),
          deletedAt: null,
        },
      },

      // top-level lookups
      {
        $lookup: {
          from: "customers",
          localField: "clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "warehouses",
          localField: "warehouseId",
          foreignField: "_id",
          as: "warehouse",
        },
      },
      { $unwind: { path: "$warehouse", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "conditions",
          localField: "conditionId",
          foreignField: "_id",
          as: "condition",
        },
      },
      { $unwind: { path: "$condition", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "terms",
          localField: "termsId",
          foreignField: "_id",
          as: "terms",
        },
      },
      { $unwind: { path: "$terms", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "users",
          localField: "repId",
          foreignField: "_id",
          as: "rep",
        },
      },
      { $unwind: { path: "$rep", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "currencies",
          localField: "currencyId",
          foreignField: "_id",
          as: "currency",
        },
      },
      { $unwind: { path: "$currency", preserveNullAndEmptyArrays: true } },

      // nested lookups for items array
      {
        $lookup: {
          from: "manufacturers",
          localField: "items.manufacturerId",
          foreignField: "_id",
          as: "manufacturerDetails",
        },
      },
      {
        $lookup: {
          from: "items",
          localField: "items.itemId",
          foreignField: "_id",
          as: "itemDetails",
        },
      },
      {
        $lookup: {
          from: "conditions",
          localField: "items.conditionId",
          foreignField: "_id",
          as: "itemConditionDetails",
        },
      },
      {
        $lookup: {
          from: "warehouses",
          localField: "items.warehouseId",
          foreignField: "_id",
          as: "itemWarehouseDetails",
        },
      },
    ];

    const data = await Sales.aggregate(pipeline);

    if (!data || data.length === 0) {
      throw createHttpError(404, "Sale not found");
    }

    res.status(200).json({
      message: "Sale retrieved successfully",
      data: data[0], // return the first matched document
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

// List with pagination & filters
export const listSales = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] || db_Name;
    const {
      search,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      limit = 10,
      disablePagination = false,
    } = req.query;

    const Sales = getSalesModel(dbName);
    const filter: any = { deletedAt: null };

    if (search) {
      const regex = new RegExp(search.toString().trim(), "i");
      filter.$or = [{ description: regex }, { ledgerCVCode: regex }];
    }

    // Date filters
    const now = moment();
    if (sortBy === "last_7_days") {
      filter.createdAt = { $gte: now.clone().subtract(7, "days").toDate() };
    } else if (sortBy === "last_month") {
      filter.createdAt = {
        $gte: now.clone().subtract(1, "month").startOf("month").toDate(),
        $lte: now.clone().subtract(1, "month").endOf("month").toDate(),
      };
    }

    // Sorting
    const sort: any = {};
    if (["last_7_days", "last_month"].includes(sortBy as string)) {
      sort.createdAt = order === "asc" ? 1 : -1;
    } else {
      sort[sortBy as string] = order === "asc" ? 1 : -1;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline = [
      { $match: filter },

      // Client
      {
        $lookup: {
          from: "customers",
          localField: "clientId",
          foreignField: "_id",
          as: "clientDetails",
        },
      },
      { $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          other: "$$ROOT",
          "clientDetails._id": 1,
          "clientDetails.companyName": 1,
          "clientDetails.email": 1,
          "clientDetails.phone": 1,
          "clientDetails.customer_image": 1,
          "clientDetails.status": 1,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$other",
              {
                clientDetails: {
                  _id: "$clientDetails._id",
                  companyName: "$clientDetails.companyName",
                  email: "$clientDetails.email",
                  phone: "$clientDetails.phone",
                  customer_image: "$clientDetails.customer_image",
                  status: "$clientDetails.status",
                },
              },
            ],
          },
        },
      },

      // Terms
      {
        $lookup: {
          from: "terms",
          localField: "termsId",
          foreignField: "_id",
          as: "termsDetails",
        },
      },
      { $unwind: { path: "$termsDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          other: "$$ROOT",
          "termsDetails._id": 1,
          "termsDetails.name": 1,
          "termsDetails.days": 1,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$other",
              {
                termsDetails: {
                  _id: "$termsDetails._id",
                  name: "$termsDetails.name",
                  days: "$termsDetails.days",
                },
              },
            ],
          },
        },
      },

      // Condition
      {
        $lookup: {
          from: "conditions",
          localField: "conditionId",
          foreignField: "_id",
          as: "conditionDetails",
        },
      },
      {
        $unwind: {
          path: "$conditionDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          other: "$$ROOT",
          "conditionDetails._id": 1,
          "conditionDetails.name": 1,
          "conditionDetails.description": 1,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$other",
              {
                conditionDetails: {
                  _id: "$conditionDetails._id",
                  name: "$conditionDetails.name",
                  description: "$conditionDetails.description",
                },
              },
            ],
          },
        },
      },

      // Rep
      {
        $lookup: {
          from: "users",
          localField: "repId",
          foreignField: "_id",
          as: "repDetails",
        },
      },
      { $unwind: { path: "$repDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          other: "$$ROOT",
          "repDetails._id": 1,
          "repDetails.userName": 1,
          "repDetails.mobileNumber": 1,
          "repDetails.email": 1,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$other",
              {
                repDetails: {
                  _id: "$repDetails._id",
                  fullName: "$repDetails.userName",
                  mobileNumber: "$repDetails.mobileNumber",
                  email: "$repDetails.email",
                },
              },
            ],
          },
        },
      },

      // Currency
      {
        $lookup: {
          from: "currencies",
          localField: "currencyId",
          foreignField: "_id",
          as: "currencyDetails",
        },
      },
      {
        $unwind: { path: "$currencyDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          other: "$$ROOT",
          "currencyDetails._id": 1,
          "currencyDetails.countryCode": 1,
          "currencyDetails.currency": 1,
          "currencyDetails.value": 1,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$other",
              {
                currencyDetails: {
                  _id: "$currencyDetails._id",
                  countryCode: "$currencyDetails.countryCode",
                  currency: "$currencyDetails.currency",
                  value: "$currencyDetails.value",
                },
              },
            ],
          },
        },
      },

      // ITEMS: unwind items
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },

      // manufacturer inside items
      {
        $lookup: {
          from: "manufacturers",
          localField: "items.manufacturerId",
          foreignField: "_id",
          as: "items.manufacturerDetails",
        },
      },
      {
        $unwind: {
          path: "$items.manufacturerDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          other: "$$ROOT",
          "items.manufacturerDetails._id": 1,
          "items.manufacturerDetails.manufacturer": 1,
          "items.manufacturerDetails.full_name": 1,
          // Add other manufacturer fields as needed
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$other",
              {
                items: {
                  $mergeObjects: [
                    "$other.items",
                    {
                      manufacturerDetails: {
                        _id: "$items.manufacturerDetails._id",
                        name: "$items.manufacturerDetails.manufacturer",
                        fullName: "$items.manufacturerDetails.full_name",
                        // Add other manufacturer fields as needed
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },

      // item inside items
      {
        $lookup: {
          from: "items",
          localField: "items.itemId",
          foreignField: "_id",
          as: "items.itemDetails",
        },
      },
      {
        $unwind: {
          path: "$items.itemDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          other: "$$ROOT",
          "items.itemDetails._id": 1,
          "items.itemDetails.itemName": 1,
          "items.itemDetails.itemGLCode": 1,
          "items.itemDetails.description": 1,
          "items.itemDetails.extDescription": 1,
          // Add other item fields as needed
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$other",
              {
                items: {
                  $mergeObjects: [
                    "$other.items",
                    {
                      itemDetails: {
                        _id: "$items.itemDetails._id",
                        name: "$items.itemDetails.itemName",
                        itemGLCode: "$items.itemDetails.itemGLCode",
                        description: "$items.itemDetails.description",
                        extDescription: "$items.itemDetails.extDescription",
                        // Add other item fields as needed
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },

      // condition inside items
      {
        $lookup: {
          from: "conditions",
          localField: "items.conditionId",
          foreignField: "_id",
          as: "items.itemConditionDetails",
        },
      },
      {
        $unwind: {
          path: "$items.itemConditionDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          other: "$$ROOT",
          "items.itemConditionDetails._id": 1,
          "items.itemConditionDetails.name": 1,
          "items.itemConditionDetails.description": 1,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$other",
              {
                items: {
                  $mergeObjects: [
                    "$other.items",
                    {
                      itemConditionDetails: {
                        _id: "$items.itemConditionDetails._id",
                        name: "$items.itemConditionDetails.name",
                        description: "$items.itemConditionDetails.description",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },

      // warehouse inside items
      {
        $lookup: {
          from: "warehouses",
          localField: "items.warehouseId",
          foreignField: "_id",
          as: "items.itemWarehouseDetails",
        },
      },
      {
        $unwind: {
          path: "$items.itemWarehouseDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          other: "$$ROOT",
          "items.itemWarehouseDetails._id": 1,
          "items.itemWarehouseDetails.name": 1,
          "items.itemWarehouseDetails.description": 1,
          "items.itemWarehouseDetails.phoneNumber": 1,
          "items.itemWarehouseDetails.address1": 1,
          // Add other warehouse fields as needed
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$other",
              {
                items: {
                  $mergeObjects: [
                    "$other.items",
                    {
                      itemWarehouseDetails: {
                        _id: "$items.itemWarehouseDetails._id",
                        name: "$items.itemWarehouseDetails.name",
                        description: "$items.itemWarehouseDetails.description",
                        phoneNumber: "$items.itemWarehouseDetails.phoneNumber",
                        address1: "$items.itemWarehouseDetails.address1",
                        // Add other warehouse fields as needed
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },

      // group back items array
      {
        $group: {
          _id: "$_id",
          saleDate: { $first: "$saleDate" },
          clientId: { $first: "$clientId" },
          termsId: { $first: "$termsId" },
          conditionId: { $first: "$conditionId" },
          repId: { $first: "$repId" },
          hidePricing: { $first: "$hidePricing" },
          currencyId: { $first: "$currencyId" },
          ledgerCVCode: { $first: "$ledgerCVCode" },
          promiseDate: { $first: "$promiseDate" },
          companyMask: { $first: "$companyMask" },
          description: { $first: "$description" },
          status: { $first: "$status" },
          invoicedDate: { $first: "$invoicedDate" },
          unitSerialNo: { $first: "$unitSerialNo" },
          storeFront: { $first: "$storeFront" },
          invoiceDistribution: { $first: "$invoiceDistribution" },
          totalPrice: { $first: "$totalPrice" },
          fright: { $first: "$fright" },
          insallation: { $first: "$insallation" },
          miscCharge: { $first: "$miscCharge" },
          deposits: { $first: "$deposits" },
          tax: { $first: "$tax" },
          total: { $first: "$total" },
          grossMargin: { $first: "$grossMargin" },
          deletedAt: { $first: "$deletedAt" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$updatedAt" },
          clientDetails: { $first: "$clientDetails" },
          termsDetails: { $first: "$termsDetails" },
          conditionDetails: { $first: "$conditionDetails" },
          repDetails: { $first: "$repDetails" },
          currencyDetails: { $first: "$currencyDetails" },
          items: { $push: "$items" },
        },
      },

      { $sort: sort },
      ...(disablePagination !== "true"
        ? [{ $skip: skip }, { $limit: Number(limit) }]
        : []),

      // Final project
      {
        $project: {
          _id: 1,
          saleDate: 1,
          clientId: 1,
          termsId: 1,
          conditionId: 1,
          repId: 1,
          hidePricing: 1,
          currencyId: 1,
          ledgerCVCode: 1,
          promiseDate: 1,
          companyMask: 1,
          description: 1,
          status: 1,
          invoicedDate: 1,
          unitSerialNo: 1,
          storeFront: 1,
          invoiceDistribution: 1,
          totalPrice: 1,
          fright: 1,
          insallation: 1,
          miscCharge: 1,
          deposits: 1,
          tax: 1,
          total: 1,
          grossMargin: 1,
          deletedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          clientDetails: 1,
          termsDetails: 1,
          conditionDetails: 1,
          repDetails: 1,
          currencyDetails: 1,
          items: 1,
        },
      },
    ];

    const data = await Sales.aggregate(pipeline);
    const total = await Sales.countDocuments(filter);

    res.status(200).json({
      message: "Sales retrieved successfully",
      data,
      pagination:
        disablePagination !== "true"
          ? {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
          }
          : undefined,
    });
  } catch (error) {
    logger.error(error);
    next(createHttpError(500, "Error while listing sales"));
  }
};

// Export (Excel/PDF)
export const exportSales = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] || db_Name;
    const exportType = req.params.export;
    const Sales = getSalesModel(dbName);

    const data = await Sales.find({ deletedAt: null }).lean();

    if (data.length == 0) {
      throw createHttpError(404, "No records in sales");
    }

    if (exportType === "excel") {
      return await generateExcelDownload(res, data, "Sales_list");
    } else if (exportType === "pdf") {
      return await generatePdfDownload(res, data, "Sales_list");
    }

    res.status(200).json({ message: "Fetched successfully", data });
  } catch (error) {
    next(error);
  }
};

export const importSale = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name || "";
    const token = req.headers["authorization"] as string;
    const origin = (req.headers["origin"] || req.headers["referer"]) as string;
    const file = req.file as Express.Multer.File;
    const queryParam = req.query.p as string;

    if (!file) {
      res
        .status(400)
        .json({ message: "No file uploaded (field name: 'file')." });
      return
    }

    if (!["pp", "po"].includes(queryParam)) {
      res
        .status(400)
        .json({
          message:
            "Invalid or missing query parameter 'p' (must be 'pp' or 'po').",
        });
      return
    }

    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetNames = workbook.SheetNames;
    const groupedData = groupDataBySheetName(workbook, sheetNames);

    const SaleModel = getSalesModel(dbName);
    const TermsModel = getTermsModel(dbName);
    const ConditionModel = getConditionModel(dbName);
    const CurrencyModel = getCurrencyModel(dbName);
    const TaxModel = getTaxModel(dbName);
    const ItemModel = getItemModel(dbName);
    const ManufacturerModel = getManufacturerModel(dbName);

    const fetchRep = async (name: string) => {
      try {
        const res = await kongAxios({
          method: "get",
          url: `/user/company/user/detail-by-name/${name}`,
          headers: { Origin: origin, Authorization: token },
        });
        const rep = res.data?.data;
        return rep ? { id: rep._id, name: rep.userName } : null;
      } catch {
        return null;
      }
    };

    const created: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];
    const bulkInsert: any[] = [];

    for (const [index, proposal] of groupedData.entries()) {
      const { validRow, errors: validationErrors } =
        validatePurchaseProposalImportRow(proposal);
      if (!validRow) {
        errors.push({ row: index + 1, errors: validationErrors });
        continue;
      }

      const [vendor, terms, condition, currency, tax, rep] = await Promise.all([
        getVendorByName(dbName, proposal.vendor, token, origin),
        TermsModel.findOne({ name: proposal.terms, deletedAt: null }).collation(
          { locale: "en", strength: 2 }
        ),
        ConditionModel.findOne({
          name: proposal.condition,
          deletedAt: null,
        }).collation({ locale: "en", strength: 2 }),
        CurrencyModel.findOne({ currency: proposal.currency }).collation({
          locale: "en",
          strength: 2,
        }),
        TaxModel.findOne({ name: proposal.tax }),
        fetchRep(proposal.rep),
      ]);

      if (!vendor?.length) {
        skipped.push({
          row: index + 1,
          reason: "Vendor not found",
          vendor: proposal.vendor,
        });
        continue;
      }
      if (!terms) {
        skipped.push({
          row: index + 1,
          reason: "Terms not found",
          terms: proposal.terms,
        });
        continue;
      }
      if (!condition) {
        skipped.push({
          row: index + 1,
          reason: "Condition not found",
          condition: proposal.condition,
        });
        continue;
      }
      if (!currency) {
        skipped.push({
          row: index + 1,
          reason: "Currency not found",
          currency: proposal.currency,
        });
        continue;
      }
      if (!tax) {
        skipped.push({
          row: index + 1,
          reason: "Tax not found",
          tax: proposal.tax,
        });
        continue;
      }
      if (!rep) {
        skipped.push({
          row: index + 1,
          reason: "Rep not found",
          rep: proposal.rep,
        });
        continue;
      }

      let items: any[] = [];
      let invalidItems: any[] = [];

      for (const item of proposal.items || []) {
        const [itemDoc, manufacturer, itemCondition, warehouseData] =
          await Promise.all([
            ItemModel.findOne({
              itemName: item.item,
              deletedAt: null,
            }).collation({ locale: "en", strength: 2 }),
            ManufacturerModel.findOne({
              manufacturer: item.manufacturer,
              deletedAt: null,
            }).collation({ locale: "en", strength: 2 }),
            ConditionModel.findOne({
              name: item.condition,
              deletedAt: null,
            }).collation({ locale: "en", strength: 2 }),
            getWarehouseSearch(item.wareHouse, token, origin),
          ]);

        const warehouseId = Array.isArray(warehouseData)
          ? warehouseData[0]?._id
          : warehouseData?._id;

        const itemErrors = [];
        if (!itemDoc) itemErrors.push("Item not found");
        if (!manufacturer) itemErrors.push("Manufacturer not found");
        if (!itemCondition) itemErrors.push("Condition not found");
        if (!warehouseId) itemErrors.push("Warehouse not found/created");

        if (itemErrors.length) {
          invalidItems.push({
            row: index + 1,
            item: item.item,
            reason: itemErrors,
          });
          continue;
        }

        items.push({
          ...item,
          item: itemDoc ? itemDoc._id : undefined,
          manufacturer: manufacturer ? manufacturer._id : undefined,
          condition: itemCondition ? itemCondition._id : undefined,
          wareHouse: warehouseId,
        });
      }

      if (!items.length) {
        skipped.push({
          row: index + 1,
          reason: "No valid items found",
          invalidItems,
        });
        continue;
      }

      const purchaseCount = await SaleModel.countDocuments({
        purchaseType: queryParam,
      });
      const newCode = `${queryParam === "pp" ? "p" : "po"}-${purchaseCount + 1}`;

      const purchaseData = {
        vendor: vendor[0]._id,
        terms: terms._id,
        condition: condition._id,
        currency: currency._id,
        tax: tax._id,
        rep: rep.id,
        items,
        userId: (req as any).user?.id,
        companyId: (req as any).user?.companyId,
        purchaseType: queryParam,
        code: newCode,
        ...proposal,
      };

      bulkInsert.push(purchaseData);
      created.push({
        row: index + 1,
        vendor: proposal.vendor,
        validItemCount: items.length,
        skippedItems: invalidItems,
      });
    }

    if (bulkInsert.length) {
      await SaleModel.insertMany(bulkInsert);
    }

    res.status(201).json({
      message: "Import completed",
      created,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("Import sale error:", error);
    res.status(500).json({ message: "Error while importing sales", error });
  }
};

export const sampleSalesXLSX = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const queryParam = req.query.type as string;

    if (!queryParam) {
      res.status(400).json({ message: "Missing query parameter 'type'" });
      return
    }

    if (!["sp", "so"].includes(queryParam)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return
    }

    let data: any = {};
    if (queryParam === "sp") {
      const { sampleData } = require("../config/sampleData-sp");
      data = sampleData;
    } else if (queryParam === "so") {
      const { sampleData } = require("../config/sampleData-so");
      data = sampleData;
    }

    /** 📝 For 'so': has Sales (array) and Items (array) **/
    /** 📝 For 'sp': has single object with items array **/

    if (queryParam === "so") {
      // Sheet: Sales
      const salesSheet = workbook.addWorksheet("Sales");
      const salesRows = data.Sales || [];
      if (salesRows.length > 0) {
        salesSheet.columns = Object.keys(salesRows[0]).map((key) => ({
          header: key,
          key,
          width: 25
        }));
        salesRows.forEach((row: any) => salesSheet.addRow(row));
      }

      // Sheet: Items
      const itemsSheet = workbook.addWorksheet("Items");
      const itemsRows = data.Items || [];
      if (itemsRows.length > 0) {
        itemsSheet.columns = Object.keys(itemsRows[0]).map((key) => ({
          header: key,
          key,
          width: 25
        }));
        itemsRows.forEach((row: any) => itemsSheet.addRow(row));
      }

    } else if (queryParam === "sp") {
      // Sheet: SalesProposal (single object)
      const salesSheet = workbook.addWorksheet("SalesProposal");
      const saleObj = { ...data };
      delete saleObj.items; // remove nested items before adding

      salesSheet.columns = Object.keys(saleObj).map((key) => ({
        header: key,
        key,
        width: 25
      }));
      salesSheet.addRow(saleObj);

      // Sheet: Items (nested items array)
      const itemsSheet = workbook.addWorksheet("Items");
      const itemsRows = data.items || [];
      if (itemsRows.length > 0) {
        itemsSheet.columns = Object.keys(itemsRows[0]).map((key) => ({
          header: key,
          key,
          width: 25
        }));
        itemsRows.forEach((row: any) => itemsSheet.addRow(row));
      }
    }

    /** 📤 Send file buffer **/
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-sample-${queryParam}-${Date.now()}.xlsx`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
