import e, { Request, Response } from "express";
import { NextFunction } from "express";
import PurchaseModel from "../models/purchase.model";
import { getDbConnection } from "@config/database";
import { IPurchase } from "../interfaces/purchase.interface";
import mongoose, { Model, now } from "mongoose";
import PurchaseSchema from "../models/purchase.model";
import { ITax } from "../interfaces/tax.interface";
import TaxSchema from "../models/tax.model";
import { ICondition } from "../interfaces/condition.interface";
import ConditionSchema from "../models/condition.model";
import { Icurrency } from "../interfaces/currency.interface";
import CurrencySchema from "../models/currency.model";
import { ITerm } from "../interfaces/term.interface";
import TermSchema from "../models/term.model";
import { IInventory } from "../interfaces/inventory.interface";
import InventorySchema from "../models/inventory.model";
import { ITempInventory } from "../interfaces/tempinventory.interface";
import TempInventorySchema from "../models/tempInventory.model";
import kongAxios from "@services/kong.service";
import { IItem } from "@interfaces/item.interface";
import ItemSchema from "@models/item.model";
import { IManufacturer } from "@interfaces/manufacturer.interface";
import ManufacturerSchema from "@models/manufacturer.model";
import ExcelJS from "exceljs";
import createHttpError from "http-errors";
import xlsx from "xlsx";
import { groupDataBySheetName } from "@utils/auth.utils";
import { validatePurchaseProposalImportRow } from "@validations/purchase-proposal.validation";
import {
  generateInvoiceHtml,
  generatePdfBufferFromHtml,
} from "@utils/export.utils";
import { Types } from "mongoose";
import { isSet } from "node:util/types";
import moment from "moment";
import { paginateAggregate } from "@utils/paginate";
import { MetricsStatus } from "@aws-sdk/client-s3";
import { ICounter } from "@interfaces/counter.interface";
import CounterSchema from "@models/counter.model";

const DB_NAME: any = process.env.DB_NAME;

const getPurchaseModel = (dbName: string): Model<IPurchase> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Purchase ||
    connection.model<IPurchase>("Purchase", PurchaseSchema)
  );
};

const getTaxModel = (dbName: string): Model<ITax> => {
  const connection = getDbConnection(dbName);
  return connection.models.Tax || connection.model<ITax>("Tax", TaxSchema);
};

const getInventoryModel = (dbName: string): Model<IInventory> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.inventory ||
    connection.model<IInventory>("Inventory", InventorySchema)
  );
};

const getTempInventoryModel = (dbName: string): Model<ITempInventory> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.TempInventory ||
    connection.model<ITempInventory>("TmpInventory", TempInventorySchema)
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

const getTermsModel = (dbName: string): Model<ITerm> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Terms ||
    connection.model<ITerm>("Terms", TermSchema as any)
  );
};

const getItemModel = (dbName: string): Model<IItem> => {
  const connection = getDbConnection(dbName);
  return connection.models.Item || connection.model<IItem>("Item", ItemSchema);
};

const getCounterModel = (dbName: string): Model<ICounter> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Counter ||
    connection.model<ICounter>("counters", CounterSchema)
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

const getUserName = async (
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

const getCurrencyByName = async (name: string, token: string): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: `/user/public/locations/currency?search=${name}`,
      token: token,
      headers: {
        Authorization: token,
      },
    };
    const response = await kongAxios(config);
    if (response.data.error) {
      return [];
    } else {
      const currency = response.data?.data || [];
      return currency;
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

const getLocation = async (
  country: string,
  state: string,
  city: string
): Promise<any> => {
  try {
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

    return {
      success: true,
      message: "Location data retrived successfully",
      data: locationData,
    };
  } catch (error) {
    return {
      success: false,
      message: "County,state or city data not found",
      data: [],
    };
  }
};

const getCountry = async (country: string): Promise<any> => {
  try {
    const nameConfig = {
      method: "post",
      url: "/user/public/locations/names/by-ids", // adjust as per Kong route
      data: {
        countryIds: country ? [country] : [],
      },
    };

    const locationRes = await kongAxios(nameConfig);
    const locationData = locationRes.data?.data || {};

    return {
      success: true,
      message: "Location data retrived successfully",
      data: locationData,
    };
  } catch (error) {
    return {
      success: false,
      message: "County,state or city data not found",
      data: [],
    };
  }
};

// ✅ Accepts multiple IDs
const getCountryNames = async (countryIds: string[]): Promise<any> => {
  console.log("countryIds: ", countryIds);
  try {
    const nameConfig = {
      method: "post",
      url: "/user/public/locations/names/by-ids",
      data: {
        ids: countryIds, // expects: ["60d...", "60e..."]
      },
    };

    const locationRes = await kongAxios(nameConfig);
    const locationData = locationRes.data?.data || [];

    // Convert to map: { "60d...": "India", "60e...": "USA" }
    const countryMap = locationData.reduce(
      (acc: Record<string, string>, c: any) => {
        acc[c._id] = c.name;
        return acc;
      },
      {}
    );

    return {
      success: true,
      message: "Country data retrieved successfully",
      data: countryMap,
    };
  } catch (error) {
    return {
      success: false,
      message: "Country data not found",
      data: {},
    };
  }
};

export const getCountryNameMap = async (
  countryIds: string[]
): Promise<Record<string, string>> => {
  try {
    const response = await kongAxios.post(
      "/user/public/locations/country/name",
      {
        ids: countryIds,
      }
    );

    const countries = response.data?.data || [];

    const countryMap: Record<string, string> = {};
    for (const country of countries) {
      countryMap[country._id] = country.name;
    }

    return countryMap;
  } catch (error) {
    console.error("Error fetching country names:", error);
    return {}; // Return empty if request fails
  }
};

const getLocationByName = async (
  country: string,
  state: string,
  city: string
): Promise<any> => {
  try {
    const nameConfig = {
      method: "get",
      url: "/user/public/locations/locations/get-ids", // adjust as per Kong route
      params: {
        countryName: country,
        stateName: state,
        cityName: city,
      },
    };

    const locationRes = await kongAxios(nameConfig);
    const locationData = locationRes.data?.data || {};

    return {
      success: true,
      message: "Location data retrived successfully",
      data: locationData,
    };
  } catch (error) {
    return {
      success: false,
      message: "County,state or city data not found",
      data: [],
    };
  }
};

export const createPurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const queryParams = req.query.p as string;
    const token: string = req.headers["authorization"] as string;
    const origin: string = (req.headers["origin"] ||
      req.headers["referer"]) as string;
    const body = req.body;

    if (!queryParams || !["pp", "po"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'p'" });
      return;
    }

    const purchaseModel = getPurchaseModel(dbName);

    // if (queryParams == "po" && !isSet(body.ppId)) {
    //   res.status(400).json({ message: "purchase proposal id is required" });
    //   return;
    // }

    const [getTerms, getTax] = await Promise.all([
      //   getCurrencyModel(dbName).findOne({ _id: body.currency }),
      getTermsModel(dbName).findOne({ _id: body.terms }),
      getTaxModel(dbName).findOne({ _id: body.tax }),
      // getConditionModel(dbName).findOne({ _id: body.condition }),
    ]);

    if (!getTax) {
      res.status(400).json({ success: false, message: "Tax not found" });
      return;
    }
    // if (!getCondition) {
    //   res.status(400).json({ success: false, message: "Condition not found" });
    //   return;
    // }
    // if (!getCurrency) {
    //   res.status(400).json({ success: false, message: "Currency not found" });
    //   return;
    // }
    if (!getTerms) {
      res.status(400).json({ success: false, message: "Terms not found" });
      return;
    }
    const vendor = await getVendor(dbName, body.vendor, token, origin);
    if (!vendor.length) {
      res
        .status(400)
        .json({ success: false, message: "Vendor not found", data: [] });
      return;
    }

    const user = await getUser(dbName, body.rep, token, origin);
    if (!user.success) {
      res
        .status(400)
        .json({ success: false, message: "User not found", data: [] });
      return;
    }

    const locations = await getLocation(body.country, body.state, body.city);
    if (!locations.success) {
      res.status(400).json({
        success: false,
        message: "County,state or city data not found",
        data: [],
      });
      return;
    }

    if (locations.success) {
      if (!locations.data.countryNames) {
        res
          .status(400)
          .json({ success: false, message: "County not found", data: [] });
        return;
      }
      if (!locations.data.stateNames) {
        res
          .status(400)
          .json({ success: false, message: "State not found", data: [] });
        return;
      }
      if (!locations.data.cityNames) {
        res
          .status(400)
          .json({ success: false, message: "City not found", data: [] });
        return;
      }
    }
    // if (body.wareHouse) {
    //   const warehouseDoc = await getWarehouseModel(
    //     dbName,
    //     body.wareHouse,
    //     token,
    //     origin
    //   );

    //   if (!warehouseDoc.success) {
    //     res.status(400).json({
    //       success: false,
    //       message: "Warehouse not found",
    //     });
    //     return;
    //   }
    // }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "At least one item is required" });
      return;
    }

    let totalqty = 0;
    let ppqty = 0;
    let receivedqty = 0;
    let balanceqty = 0;

    for (const [index, item] of body.items.entries()) {
      if (queryParams == "po") {
        const result = await purchaseModel.aggregate([
          {
            $match: {
              _id: new mongoose.Types.ObjectId(body.ppId),
              deletedAt: null,
              purchaseType: "po",
            },
          },
          {
            $project: {
              _id: 0,
              totalQuantity: {
                $cond: {
                  if: { $isArray: "$items" },
                  then: {
                    $sum: {
                      $map: {
                        input: "$items",
                        as: "item",
                        in: { $ifNull: ["$$item.quantity", 0] },
                      },
                    },
                  },
                  else: 0,
                },
              },
            },
          },
        ]);
        totalqty = result[0]?.totalQuantity || 0;
        body.serialNo = body.serialNo.map((serial: any) => {
          if (item.item.toString() === serial.item.toString()) {
            return {
              ...serial,
              condition: item.condition,
              cost: item.purchaseCostCAD,
              originalCost: item.purchaseCostCAD,
              ...(item.location && { location: item.location }),
            };
          }
          return serial;
        });
      }
      // if (queryParams == "pp") {
      ppqty += item.quantity;
      // }

      receivedqty += item.quantity;

      if (!item.item || !item.condition) {
        res.status(400).json({
          success: false,
          message: `Missing field(s) in item at index ${index}`,
        });
        return;
      }

      const [itemDoc, conditionDoc] = await Promise.all([
        getItemModel(dbName).findOne({
          _id: item.item,
          status: "Active",
          deletedAt: null,
        }),
        // getManufacturerModel(dbName).findOne({
        //   _id: item.manufacturer,
        //   status: "active",
        //   deletedAt: null,
        // }),
        getConditionModel(dbName).findOne({
          _id: item.condition,
          deletedAt: null,
        }),
      ]);

      if (!itemDoc) {
        res.status(400).json({
          success: false,
          message: `Item not found at index ${index}`,
        });
        return;
      }
      //   if (!manufacturerDoc) {
      //     res.status(400).json({
      //       success: false,
      //       message: `Manufacturer not found at index ${index}`,
      //     });
      //     return;
      //   }
      if (!conditionDoc) {
        res.status(400).json({
          success: false,
          message: `Condition not found at index ${index}`,
        });
        return;
      }
    }

    balanceqty = totalqty - receivedqty;
    if (ppqty < body.serialNo.length) {
      res.status(400).json({
        success: false,
        message: "Serialnumber count is greater then item quantity",
      });
      return;
    }

    const Counter = getCounterModel(dbName);

    let counter: any;
    let ppid: any;
    let poid: any;

    // if (queryParams === "pp") {
    //   counter = await Counter.findOneAndUpdate(
    //     { type: "pp" },
    //     { $inc: { seq: 1 } },
    //     { new: true, upsert: true }
    //   );
    //   console.log("counter -----", counter);
    //   ppid = counter.seq.toString();
    //   body.status = "Open";
    // } else if (queryParams === "po") {
    //   counter = await Counter.findOneAndUpdate(
    //     { type: "po" },
    //     { $inc: { seq: 1 } },
    //     { new: true, upsert: true }
    //   );
    //   console.log("counter -----", counter);
    //   poid = counter.seq.toString();
    //   body.status = "Available";
    // }

    if (queryParams === "pp") {
      counter = await Counter.findOneAndUpdate(
        { type: "pp" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      const seq = counter.seq.toString();
      const digits = counter.digits || 0;
      ppid = seq.padStart(digits, "0"); // 👈 zero pad

      body.status = "Open";
    } else if (queryParams === "po") {
      counter = await Counter.findOneAndUpdate(
        { type: "po" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );

      const seq = counter.seq.toString();
      const digits = counter.digits || 0;
      poid = seq.padStart(digits, "0"); // 👈 zero pad

      body.status = "Available";
      body.receivedStatus = "In Transit";
    }

    body.totalQty = totalqty;

    const newCode = queryParams === "pp" ? ppid : poid;
    const serialNo = body.serialNo || [];

    delete body.serialNo;
    //@ts-ignore
    const company_id = req.company_id;

    const purchaseData = {
      ...body,
      userId: req.user.id,
      companyId: company_id,
      purchaseType: queryParams,
      pp: queryParams === "pp" ? newCode : "-",
      po: queryParams === "po" ? newCode : "-",
    };

    // 1. Fetch the initial counter
    const inventoryCounter = await Counter.findOneAndUpdate(
      { type: "inventory" },
      { $inc: { seq: serialNo.length } }, // Increment once for all
      { new: true, upsert: true }
    );

    const endSeq = inventoryCounter.seq;
    const startSeq = endSeq - serialNo.length + 1;
    const digits = inventoryCounter.digits || 0;

    const createdPurchase = await purchaseModel.create(purchaseData);
    let inventoryData: any[] = [];
    if (queryParams == "po") {
      inventoryData = serialNo.map((serial: any, index: number) => {
        const currentSeq = (startSeq + index).toString().padStart(digits, "0");
        return {
          po: createdPurchase._id,
          item: serial.item,
          wareHouse: serial.Warehouse,
          purchaseNumber: createdPurchase.po,
          serialNumber: serial.serialNumber,
          inventoryno: currentSeq,
          condition: serial.condition,
          conditionData: now(),
          location: serial.location,
          cost: serial.cost,
          originalCost: serial.originalCost,
          receivedStatus: "In Transit",
        };
      });
    } else {
      inventoryData = serialNo.map((serial: any, index: number) => ({
        pp: createdPurchase._id,
        item: serial.item,
        wareHouse: serial.Warehouse,
        purchaseNumber: createdPurchase.pp,
        serialNumber: serial.serialNumber,
      }));
    }

    if (inventoryData.length > 0) {
      const inventoryModel: any =
        queryParams == "po"
          ? getInventoryModel(dbName)
          : getTempInventoryModel(dbName);
      const createdInventory = await inventoryModel.insertMany(inventoryData);
      if (!createdInventory || createdInventory.length === 0) {
        res.status(400).json({
          success: false,
          message: "Failed to create inventory records",
        });
        return;
      }
    }

    res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      data: createdPurchase,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const getAllPurchases = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const purchaseModel = await getPurchaseModel(dbName);
    const queryParams = req.query.p as string;

    if (!["pp", "po"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'p'" });
      return;
    }

    const {
      search,
      page = 1,
      limit = 10,
      disablePagination = false,
    } = req.query;

    const status =
      typeof req.query.status === "undefined" || !req.query.status
        ? "all"
        : req.query.status;

    const recievedStatus =
      typeof req.query.recievedStatus === "undefined" ||
        !req.query.recievedStatus
        ? "all"
        : req.query.recievedStatus;

    const filter: any = {
      deletedAt: null,
      purchaseType: queryParams,
    };

    if (status != "all") filter.status = status;
    if (recievedStatus !== "all") {
      if (recievedStatus === "In Transit") {
        filter.recievedStatus = { $in: ["In Transit", "Partially Received"] };
      } else {
        filter.recievedStatus = recievedStatus;
      }
    }
    if (status == "inActive") {
      filter.isActive = false;
      delete filter.status;
    }

    const aggrigate: any[] = [];

    if (queryParams == "po") {
      aggrigate.push({
        $lookup: {
          from: "inventories",
          localField: "_id",
          foreignField: "po",
          as: "serialNumbers",
        },
      });
    } else {
      aggrigate.push({
        $lookup: {
          from: "tmpinventories",
          localField: "_id",
          foreignField: "pp",
          as: "serialNumbers",
        },
      });
    }

    let pipeline: any[] = [
      { $match: filter },
      {
        $lookup: {
          from: "customers",
          localField: "vendor",
          foreignField: "_id",
          as: "vendorInfo",
        },
      },
      ...aggrigate,
      {
        $lookup: {
          from: "users",
          localField: "rep",
          foreignField: "_id",
          as: "repInfo",
        },
      },
      {
        $lookup: {
          from: "taxes",
          localField: "tax",
          foreignField: "_id",
          as: "taxInfo",
        },
      },
      {
        $lookup: {
          from: "conditions",
          localField: "condition",
          foreignField: "_id",
          as: "conditionInfo",
        },
      },
      {
        $lookup: {
          from: "currencies",
          localField: "currency",
          foreignField: "_id",
          as: "currencyInfo",
        },
      },
      {
        $lookup: {
          from: "terms",
          localField: "terms",
          foreignField: "_id",
          as: "termsInfo",
        },
      },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "items",
          localField: "items.item",
          foreignField: "_id",
          as: "itemInfo",
        },
      },
      {
        $unwind: {
          path: "$itemInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "manufacturers",
          localField: "itemInfo.manufacturer",
          foreignField: "_id",
          as: "manufacturerInfo",
        },
      },
      {
        $lookup: {
          from: "conditions",
          localField: "items.condition",
          foreignField: "_id",
          as: "itemConditionInfo",
        },
      },
      {
        $lookup: {
          from: "warehouses",
          localField: "items.wareHouse",
          foreignField: "_id",
          as: "warehouseInfo",
        },
      },

      // Group back to array of items
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          items: {
            $push: {
              item: {
                id: "$itemInfo._id",
                itemName: "$itemInfo.itemName",
                country: "$itemInfo.country",
                manufacturer: {
                  id: { $arrayElemAt: ["$manufacturerInfo._id", 0] },
                  manufacturer: {
                    $arrayElemAt: ["$manufacturerInfo.manufacturer", 0],
                  },
                },
              },
              quantity: "$items.quantity",
              purchaseCostCAD: "$items.purchaseCostCAD",
              purchaseCostUSD: "$items.purchaseCostUSD",
              extendedCostCAD: "$items.extendedCostCAD",
              extendedCostUSD: "$items.extendedCostUSD",
              serialNumber: "$items.serialNumber",
              lineNo: "$items.lineNo",
              itemDescription: "$itemInfo.description",
              // condition: {
              //   id: { $arrayElemAt: ["$itemConditionInfo._id", 0] },
              //   name: { $arrayElemAt: ["$itemConditionInfo.name", 0] },
              // },
              condition: {
                id: { $arrayElemAt: ["$itemConditionInfo._id", 0] },
                name: { $arrayElemAt: ["$itemConditionInfo.name", 0] },
              },
              wareHouse: {
                id: { $arrayElemAt: ["$warehouseInfo._id", 0] },
                name: { $arrayElemAt: ["$warehouseInfo.name", 0] },
              },
              location: "$items.location",
              status: "$items.status",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          state: "$doc.state",
          city: "$doc.city",
          country: "$doc.country",
          userId: "$doc.userId",
          companyId: "$doc.companyId",
          address: "$doc.address",
          po: "$doc.po",
          pp: "$doc.pp",
          reference: "$doc.reference",
          date: "$doc.date",
          isConverted: "$doc.isConverted",
          vendor: {
            id: { $arrayElemAt: ["$doc.vendorInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.vendorInfo.companyName", 0] },
            vendor_id: { $arrayElemAt: ["$doc.vendorInfo.code", 0] },
            phone: { $arrayElemAt: ["$doc.vendorInfo.phone", 0] },
            address: { $arrayElemAt: ["$doc.vendorInfo.address", 0] },
          },
          vendorSO: "$doc.vendorSO",
          currency: "$doc.currency",
          rep: "$doc.rep",
          serialNumbers: "$doc.serialNumbers",
          hideLineItemPricing: "$doc.hideLineItemPricing",
          terms: {
            id: { $arrayElemAt: ["$doc.termsInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.termsInfo.name", 0] },
          },
          condition: {
            id: { $arrayElemAt: ["$doc.conditionInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.conditionInfo.name", 0] },
          },
          representative: {
            id: { $arrayElemAt: ["$doc.repInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.repInfo.userName", 0] },
          },
          shipDate: "$doc.shipDate",
          status: "$doc.status",
          isActive: "$doc.isActive",
          receive: "$doc.receive",
          purchaseType: "$doc.purchaseType",
          sourcePP: "$doc.sourcePP",
          sourceSO: "$doc.sourceSO",
          billDistribution: "$doc.billDistribution",
          poType: "$doc.poType",
          erasureMethod: "$doc.erasureMethod",
          workflowTemplate: "$doc.workflowTemplate",
          serviceFee: "$doc.serviceFee",
          purchaseCostTemplate: "$doc.purchaseCostTemplate",
          supplierMargin: "$doc.supplierMargin",
          prePaid: "$doc.prePaid",
          extendedCost: "$doc.extendedCost",
          freight: "$doc.freight",
          taxPrice: "$doc.taxPrice",
          extraCost: "$doc.extraCost",
          subTotal: "$doc.subTotal",
          commentToVendor: "$doc.commentToVendor",
          internalComment: "$doc.internalComment",
          recievedStatus: "$doc.recievedStatus",
          tax: {
            id: { $arrayElemAt: ["$doc.taxInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.taxInfo.name", 0] },
            tax: { $arrayElemAt: ["$doc.taxInfo.tax", 0] },
          },
          total: "$doc.total",
          totalForeignamount: "$doc.totalForeignamount",
          deletedAt: "$doc.deletedAt",
          createdAt: "$doc.createdAt",
          updatedAt: "$doc.updatedAt",
          items: "$items",
        },
      },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "vendor.name": { $regex: new RegExp(search.toString(), "i") } },
            { [queryParams]: { $regex: new RegExp(search.toString(), "i") } },
          ],
        },
      });
    }

    // ✅ Add consistent sort before pagination
    pipeline.push({ $sort: { updatedAt: -1 } });

    if (disablePagination !== "true") {
      const skip = (Number(page) - 1) * Number(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: Number(limit) });
    }

    const purchases = await purchaseModel.aggregate(pipeline);
    const total = await purchaseModel.countDocuments(filter);

    const cityIds = new Set();
    const stateIds = new Set();
    const countryIds = new Set();
    const currencyIds = new Set();
    const itemCountryIds = new Set();

    purchases.forEach((purchase) => {
      if (purchase.city) cityIds.add(purchase.city.toString());
      if (purchase.state) stateIds.add(purchase.state.toString());
      if (purchase.country) countryIds.add(purchase.country.toString());
      if (purchase.currency) currencyIds.add(purchase.currency.toString());
      if (purchase.items) {
        purchase.items.forEach((item: any) => {
          if (item.item.country)
            itemCountryIds.add(item.item.country.toString());
        });
      }
    });

    const nameConfig = {
      method: "post",
      url: "/user/public/locations/names/by-ids",
      data: {
        cityIds: [...cityIds],
        stateIds: [...stateIds],
        countryIds: [...countryIds],
        currencyIds: [...currencyIds],
      },
    };
    const itemCountryConfig = {
      method: "post",
      url: "/user/public/locations/names/by-ids",
      data: {
        countryIds: [...itemCountryIds],
      },
    };
    const locationRes = await kongAxios(nameConfig);
    const locationData = locationRes.data?.data || {};
    const itemCountryRes = await kongAxios(itemCountryConfig);
    const itemCountryData = itemCountryRes.data?.data || {};

    const enrichedPurchases = purchases.map((purchase) => {
      purchase.items.forEach((item: any) => {
        const countryKey = item?.item?.country?.toString();
        const countryNames = itemCountryData?.countryNames;

        item.itemCountryName =
          countryKey && countryNames?.[countryKey]
            ? countryNames[countryKey]
            : null;
      });

      return {
        ...purchase,
        cityName: locationData.cityNames?.[purchase.city?.toString()] || null,
        stateName:
          locationData.stateNames?.[purchase.state?.toString()] || null,
        countryName:
          locationData.countryNames?.[purchase.country?.toString()] || null,
        currencyName:
          locationData.currencies?.[purchase.currency?.toString()] || null,
      };
    });

    res.status(200).json({
      success: true,
      message: "Purchases fetched successfully",
      data: enrichedPurchases,
      pagination:
        disablePagination === "true"
          ? undefined
          : {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
          },
    });
  } catch (error) {
    next(error);
  }
};

export const getPurchaseById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const purchaseModel = await getPurchaseModel(dbName);
    const inventoryModel = await getInventoryModel(dbName);
    const id = req.params.id;
    const queryParams = req.query.p as string;
    const status = ((req.query.status as string) || "all").toLowerCase();

    // Validate ObjectId
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid ID format" });
      return;
    }

    if (!["pp", "po"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'p'" });
      return;
    }

    // Dynamic $lookup for serial numbers
    const serialLookup = {
      $lookup: {
        from: queryParams === "po" ? "inventories" : "tmpinventories",
        localField: "_id",
        foreignField: queryParams,
        as: "itemsSerialNumbers",
      },
    };

    const pipeline: any[] = [
      {
        $match: {
          _id: new Types.ObjectId(id),
          deletedAt: null,
          purchaseType: queryParams,
        },
      },
      serialLookup,
      {
        $lookup: {
          from: "customers",
          localField: "vendor",
          foreignField: "_id",
          as: "vendorInfo",
        },
      },
      {
        $lookup: {
          from: "taxes",
          localField: "tax",
          foreignField: "_id",
          as: "taxInfo",
        },
      },
      {
        $lookup: {
          from: "terms",
          localField: "terms",
          foreignField: "_id",
          as: "termsInfo",
        },
      },
      {
        $unwind: { path: "$items", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "items",
          localField: "items.item",
          foreignField: "_id",
          as: "itemInfo",
        },
      },
      {
        $unwind: {
          path: "$itemInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "warehouses",
          localField: "items.wareHouse",
          foreignField: "_id",
          as: "warehouseInfo",
        },
      },
      {
        $unwind: {
          path: "$warehouseInfo",
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: "manufacturers",
          localField: "itemInfo.manufacturer",
          foreignField: "_id",
          as: "manufacturerInfo",
        },
      },
      {
        $lookup: {
          from: "conditions",
          localField: "items.condition",
          foreignField: "_id",
          as: "itemConditionInfo",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "rep",
          foreignField: "_id",
          as: "repInfo",
        },
      },
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "company_id",
          as: "companyInfo",
        },
      },

      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          items: {
            $push: {
              item: {
                id: "$itemInfo._id",
                name: "$itemInfo.itemName",
                country: "$itemInfo.country",
                itemDescription: "$itemInfo.description",
              },
              manufacturer: {
                id: { $arrayElemAt: ["$manufacturerInfo._id", 0] },
                manufacturer: {
                  $arrayElemAt: ["$manufacturerInfo.manufacturer", 0],
                },
              },
              quantity: "$items.quantity",
              purchaseCostCAD: "$items.purchaseCostCAD",
              purchaseCostUSD: "$items.purchaseCostUSD",
              extendedCostCAD: "$items.extendedCostCAD",
              extendedCostUSD: "$items.extendedCostUSD",
              lineNo: "$items.lineNo",
              warehouse: {
                id: "$warehouseInfo._id",
                name: "$warehouseInfo.name",
              },

              serialNumbers: {
                $cond: [
                  { $eq: [status, "all"] },
                  {
                    $filter: {
                      input: "$itemsSerialNumbers",
                      as: "serial",
                      cond: {
                        $eq: ["$$serial.item", "$itemInfo._id"],
                      },
                    },
                  },
                  {
                    $filter: {
                      input: "$itemsSerialNumbers",
                      as: "serial",
                      cond: {
                        $and: [
                          { $eq: ["$$serial.item", "$itemInfo._id"] },
                          {
                            $eq: [
                              { $toLower: "$$serial.status" },
                              { $toLower: status },
                            ],
                          },
                        ],
                      },
                    },
                  },
                ],
              },
              condition: {
                id: { $arrayElemAt: ["$itemConditionInfo._id", 0] },
                name: { $arrayElemAt: ["$itemConditionInfo.name", 0] },
              },
              status: "$items.status",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          userId: "$doc.userId",
          companyId: "$doc.companyId",
          date: "$doc.date",
          company: {
            id: { $arrayElemAt: ["$doc.companyInfo._id", 0] },
            company_id: { $arrayElemAt: ["$doc.companyInfo.company_id", 0] },
            name: { $arrayElemAt: ["$doc.companyInfo.name", 0] },
            address: { $arrayElemAt: ["$doc.companyInfo.address", 0] },
            phoneNumber: { $arrayElemAt: ["$doc.companyInfo.phoneNumber", 0] },
          },
          vendor: {
            id: { $arrayElemAt: ["$doc.vendorInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.vendorInfo.companyName", 0] },
            vendor_id: { $arrayElemAt: ["$doc.vendorInfo.code", 0] },
            phone: { $arrayElemAt: ["$doc.vendorInfo.phone", 0] },
            address: { $arrayElemAt: ["$doc.vendorInfo.address", 0] },
          },
          vendorSO: "$doc.vendorSO",
          description: "$doc.description",
          extDescription: "$doc.extDescription",
          internalComment: "$doc.internalComment",
          rep: {
            id: { $arrayElemAt: ["$doc.repInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.repInfo.userName", 0] },
          },
          terms: {
            id: { $arrayElemAt: ["$doc.termsInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.termsInfo.name", 0] },
          },
          shipDate: "$doc.shipDate",
          address: "$doc.address",
          country: "$doc.country",
          state: "$doc.state",
          city: "$doc.city",
          currency: "$doc.currency",
          tax: {
            id: { $arrayElemAt: ["$doc.taxInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.taxInfo.name", 0] },
            tax: { $arrayElemAt: ["$doc.taxInfo.tax", 0] },
          },
          status: "$doc.status",
          receive: "$doc.receive",
          purchaseType: "$doc.purchaseType",
          extendedCost: "$doc.extendedCost",
          freight: "$doc.freight",
          taxPrice: "$doc.taxPrice",
          recievedStatus: "$doc.recievedStatus",
          extraCost: "$doc.extraCost",
          po: "$doc.po",
          subTotal: "$doc.subTotal",
          totalForeignamount: "$doc.totalForeignamount",
          total: "$doc.total",
          items: "$items",
          pp: "$doc.pp",
          deletedAt: "$doc.deletedAt",
          createdAt: "$doc.createdAt",
          updatedAt: "$doc.updatedAt",
        },
      },
    ];

    const [result] = await purchaseModel.aggregate(pipeline);
    if (!result) {
      res.status(404).json({ success: false, message: "Purchase not found" });
      return;
    }
    const token: any = req.headers["authorization"];
    const currency = await getCurrencyByName(result.currency, token);

    const locationData = await getLocation(
      result.country,
      result.state,
      result.city
    );
    const itemCountryCodes = result.items.map((item: any) => item.item.country);
    const itemCountryData = await getCountryNameMap(itemCountryCodes);

    result.cityName = locationData?.data?.cityNames[result.city] || "";
    result.stateName = locationData?.data?.stateNames[result.state] || "";
    result.countryName = locationData?.data?.countryNames[result.country] || "";
    result.currencyName = currency;

    for (const item of result.items) {
      item.itemsCount = 0;
      if (status === "notreceived") {
        const receivedCount = await inventoryModel.countDocuments({
          po: result._id,
          item: item.item.id,
        });
        item.itemsCount = item.quantity - receivedCount;
      }

      item.itemCountryName = item.item.country
        ? itemCountryData[item.item.country] || ""
        : "";
    }

    res.status(200).json({
      success: true,
      message: "Purchase fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error("getPurchaseById Error:", error);
    next(error);
  }
};

// export const updatePurchase = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
//     const purchaseModel = getPurchaseModel(dbName);

//     if (!req.params.id) {
//       res.status(400).json({
//         success: false,
//         message: "Purchase ID is required",
//       });
//       return;
//     }

//     const queryParams = req.query.p as string;
//     if (!queryParams || !["pp", "po"].includes(queryParams)) {
//       res.status(400).json({ message: "Invalid query parameter 'p'" });
//       return;
//     }

//     const purchase = await purchaseModel.findOne({
//       _id: req.params.id,
//       deletedAt: null,
//       purchaseType: queryParams,
//     });

//     if (!purchase) {
//       res.status(404).json({
//         success: false,
//         message: "Purchase not found",
//       });
//       return;
//     }

//     if (purchase.isConverted) {
//       res.status(400).json({
//         success: false,
//         message: "Editing is not allowed: this purchase has already been converted to a Purchase Order",
//       });
//       return;
//     }

//     const body = req.body;
//     const token: string = req.headers["authorization"] as string;
//     const origin: string = (req.headers["origin"] || req.headers["referer"]) as string;

//     const [getTerms, getTax] = await Promise.all([
//       getTermsModel(dbName).findOne({ _id: body.terms }),
//       getTaxModel(dbName).findOne({ _id: body.tax }),
//     ]);

//     if (!getTax) {
//        res.status(400).json({ success: false, message: "Tax not found" });
//        return
//     }

//     if (!getTerms) {
//        res.status(400).json({ success: false, message: "Terms not found" });
//        return
//     }

//     const vendor = await getVendor(dbName, body.vendor, token, origin);
//     if (!vendor.length) {
//        res.status(400).json({ success: false, message: "Vendor not found", data: [] });
//        return
//       }

//     const user = await getUser(dbName, body.rep, token, origin);
//     if (!user.success) {
//        res.status(400).json({ success: false, message: "User not found", data: [] });
//        return
//     }

//     const locations = await getLocation(body.country, body.state, body.city);
//     if (
//       !locations.success ||
//       !locations.data.countryNames ||
//       !locations.data.stateNames ||
//       !locations.data.cityNames
//     ) {
//        res.status(400).json({ success: false, message: "Invalid location data", data: [] });
//        return
//     }

//     const itemCountryData = locations.data;

//     if (!Array.isArray(body.items) || body.items.length === 0) {
//        res.status(400).json({ success: false, message: "At least one item is required" });
//        return
//     }

//     let ppqty = 0;
//     for (const [index, item] of body.items.entries()) {
//       if (!item.item || !item.condition) {
//          res.status(400).json({
//           success: false,
//         });
//         return
//       }

//       ppqty += item.quantity;

//       const [itemDoc, conditionDoc] = await Promise.all([
//         getItemModel(dbName).findOne({
//           _id: item.item,
//           status: "Active",
//           deletedAt: null,
//         }),
//         getConditionModel(dbName).findOne({
//           _id: item.condition,
//           deletedAt: null,
//         }),
//       ]);

//       if (!itemDoc) {
//          res.status(400).json({
//           success: false,
//         });
//         return
//       }

//       if (!conditionDoc) {
//          res.status(400).json({
//           success: false,
//         });
//         return
//       }

//       // ✅ Add country name mapping
//       item.itemCountryName = item.item.country
//         ? itemCountryData?.countryNames?.[item.item.country] || ""
//         : "";
//     }

//     if (ppqty < body.serialNo.length) {
//        res.status(400).json({
//         success: false,
//         message: "Serialnumber count is greater than item quantity",
//       });
//       return
//     }

//     const serialNo = body.serialNo || [];
//     delete body.serialNo;

//     //@ts-ignore
//     const companyId = req.company_id;

//     const updateData = {
//       ...body,
//       userId: req.user.id,
//       companyId: companyId,
//     };

//     const updatedPurchase = await purchaseModel.findByIdAndUpdate(
//       req.params.id,
//       updateData,
//       { new: true }
//     );

//     const itemMap = new Map();
//     for (const item of body.items) {
//       itemMap.set(item.item.toString(), item.wareHouse);
//     }

//     if (queryParams === "pp") {
//       const inventoryModel = getTempInventoryModel(dbName);
//       await inventoryModel.deleteMany({ pp: req.params.id });

//       const inventoryData = serialNo.map((serial: any) => ({
//         pp: req.params.id,
//         item: serial.item,
//         wareHouse: itemMap.get(serial.item.toString()) || null,
//         purchaseNumber: purchase.pp,
//         serialNumber: serial.serialNumber,
//       }));

//       if (inventoryData.length > 0) {
//         await inventoryModel.insertMany(inventoryData);
//       }
//     }

//     if (queryParams === "po") {
//       const inventoryModel = getInventoryModel(dbName);
//       // await inventoryModel.deleteMany({ po: req.params.id });

//       const sequenceMap: Record<string, number> = {};
//       const itemGroupMap: Record<string, number> = {};
//       const itemIndexMap: Record<string, number> = {};
//       let groupCounter = 1;
//       console.log(serialNo,'serialNo-------');

//       for (const serial of serialNo) {
//         const itemId = serial.item.toString();

//         if (!itemGroupMap[itemId]) {
//           itemGroupMap[itemId] = groupCounter++;
//           itemIndexMap[itemId] = 1;
//         } else {
//           itemIndexMap[itemId]++;
//         }
//         console.log(itemGroupMap,'itemGroupMap----------');
//         console.log(itemIndexMap,'itemIndexMap----------');

//         if (!(itemId in sequenceMap)) {
//           const last = await inventoryModel
//             .find({ item: itemId })
//             .sort({ sequenceNumber: -1 })
//             .limit(1);

//           const lastSeq = last.length > 0 ? Number(last[0].sequenceNumber) : 0;
//           sequenceMap[itemId] = isNaN(lastSeq) ? 1 : lastSeq + 1;
//         }
//         console.log(sequenceMap,'sequenceMap--------');

//         const sequenceNumber = sequenceMap[itemId]++;
//         console.log('sequenceNumber ----', sequenceNumber);
//         const groupIndex = itemGroupMap[itemId];
//         console.log('groupIndex ----', groupIndex);
//         const itemIndex = itemIndexMap[itemId];
//         console.log('itemIndex ----', itemIndex);
//         const invno = `${purchase.pp}-${groupIndex}-${itemIndex}`;
//         console.log('invno ----', invno);

//         serial.sequenceNumber = sequenceNumber;
//         serial.invno = invno;
//       }

//       const inventoryData = serialNo.map((serial: any) => ({
//         po: req.params.id,
//         pp: purchase.ppId,
//         item: serial.item,
//         wareHouse: itemMap.get(serial.item.toString()) || null,
//         purchaseNumber: purchase.pp,
//         serialNumber: serial.serialNumber,
//         sequenceNumber: serial.sequenceNumber,
//         invno: serial.invno,
//       }));

//       console.log('inventoryData --------', inventoryData);

//       if (inventoryData.length > 0) {
//         await inventoryModel.insertMany(inventoryData);
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: "Purchase updated successfully",
//       data: updatedPurchase,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

export const updatePurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const purchaseModel = getPurchaseModel(dbName);

    const id = req.params.id;
    const queryParams = req.query.p as string;

    if (!id) {
      res
        .status(400)
        .json({ success: false, message: "Purchase ID is required" });
      return;
    }
    if (!["pp", "po"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'p'" });
      return;
    }

    const purchase = await purchaseModel.findOne({
      _id: id,
      deletedAt: null,
      purchaseType: queryParams,
    });

    if (!purchase) {
      res.status(404).json({ success: false, message: "Purchase not found" });
      return;
    }

    if (purchase.isConverted) {
      res.status(400).json({
        success: false,
        message:
          "Editing not allowed: purchase already converted to Purchase Order",
      });
      return;
    }

    const body = req.body;
    const token: string = req.headers["authorization"] as string;
    const origin: string = (req.headers["origin"] ||
      req.headers["referer"]) as string;

    const [getTerms, getTax] = await Promise.all([
      getTermsModel(dbName).findOne({ _id: body.terms }),
      getTaxModel(dbName).findOne({ _id: body.tax }),
    ]);

    if (!getTax) {
      res.status(400).json({ success: false, message: "Tax not found" });
      return;
    }
    if (!getTerms) {
      res.status(400).json({ success: false, message: "Terms not found" });
      return;
    }

    const vendor = await getVendor(dbName, body.vendor, token, origin);
    if (!vendor.length) {
      res
        .status(400)
        .json({ success: false, message: "Vendor not found", data: [] });
      return;
    }

    const user = await getUser(dbName, body.rep, token, origin);
    if (!user.success) {
      res
        .status(400)
        .json({ success: false, message: "User not found", data: [] });
      return;
    }

    const locations = await getLocation(body.country, body.state, body.city);
    if (
      !locations.success ||
      !locations.data.countryNames ||
      !locations.data.stateNames ||
      !locations.data.cityNames
    ) {
      res
        .status(400)
        .json({ success: false, message: "Invalid location", data: [] });
      return;
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "At least one item is required" });
      return;
    }

    let ppqty = 0;
    const itemWarehouseMap = new Map<string, string>();

    for (const [index, item] of body.items.entries()) {
      body.serialNo = body.serialNo.map((serial: any) => {
        if (item.item.toString() === serial.item.toString()) {
          return {
            ...serial,
            condition: item.condition,
            cost: item.purchaseCostCAD,
            originalCost: item.purchaseCostCAD,
            ...(item.location && { location: item.location }),
          };
        }
        return serial;
      });

      if (!item.item || !item.condition) {
        res.status(400).json({
          success: false,
          message: `Missing item or condition at index ${index}`,
        });
        return;
      }

      ppqty += item.quantity;
      itemWarehouseMap.set(item.item.toString(), item.wareHouse);

      const [itemDoc, conditionDoc] = await Promise.all([
        getItemModel(dbName).findOne({
          _id: item.item,
          status: "Active",
          deletedAt: null,
        }),
        getConditionModel(dbName).findOne({
          _id: item.condition,
          deletedAt: null,
        }),
      ]);

      if (!itemDoc) {
        res.status(400).json({
          success: false,
          message: `Item not found at index ${index}`,
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
    }

    const serialNo = body.serialNo || [];
    if (ppqty < serialNo.length) {
      res.status(400).json({
        success: false,
        message: "Serialnumber count is greater than item quantity",
      });
      return;
    }

    const serialMap = new Map<string, Set<string>>();
    for (const serial of serialNo) {
      const itemId = serial.item.toString();
      const serialStr = serial.serialNumber.trim();

      if (!serialMap.has(itemId)) serialMap.set(itemId, new Set());

      const set = serialMap.get(itemId)!;
      if (set.has(serialStr)) {
        res.status(400).json({
          success: false,
          message: `Duplicate serial number '${serialStr}' found for item '${itemId}'`,
        });
        return;
      }

      set.add(serialStr);
    }

    // ✅ Check existing serial numbers before insert
    if (serialNo.length > 0) {
      const serialNumbersToCheck = serialNo.map((s: any) =>
        s.serialNumber.trim()
      );
      const itemIdsToCheck = serialNo.map((s: any) => s.item);

      const inventoryModel: any =
        queryParams === "pp"
          ? getTempInventoryModel(dbName)
          : getInventoryModel(dbName);

      const existingSerials = await inventoryModel.find({
        serialNumber: { $in: serialNumbersToCheck },
        item: { $in: itemIdsToCheck },
        ...(queryParams === "pp" ? { pp: id } : { po: id }),
      });

      if (existingSerials.length > 0) {
        const duplicates = existingSerials.map(
          (s: { serialNumber: any }) => s.serialNumber
        );
        res.status(400).json({
          success: false,
          message: `Duplicate serial numbers found: ${duplicates.join(", ")}`,
        });
        return;
      }
    }

    delete body.serialNo;

    //@ts-ignore
    const companyId = req.company_id;
    const updateData = {
      ...body,
      userId: req.user.id,
      companyId,
    };

    const updatedPurchase = await purchaseModel.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
      }
    );

    if (queryParams === "pp") {
      const inventoryModel = getTempInventoryModel(dbName);
      await inventoryModel.deleteMany({ pp: id });

      const inventoryData = serialNo.map((serial: any) => ({
        pp: id,
        item: serial.item,
        wareHouse: itemWarehouseMap.get(serial.item.toString()) || null,
        purchaseNumber: purchase.pp,
        condition: serial.condition,
        conditionData: now(),
        cost: serial.cost,
        originalCost: serial.originalCost,
        ...(serial.itemDescription && {
          itemDescription: serial.itemDescription,
        }),
        location: serial.location,
        serialNumber: serial.serialNumber,
        status: "Available",
        receivedStatus: "In Transit",
      }));

      if (inventoryData.length > 0)
        await inventoryModel.insertMany(inventoryData);
    }

    if (queryParams === "po") {
      const inventoryModel = getInventoryModel(dbName);

      const itemIds = [...new Set(serialNo.map((s: any) => s.item.toString()))];
      const lastSequences = await inventoryModel.aggregate([
        {
          $match: {
            item: {
              $in: itemIds.map((id: any) => new mongoose.Types.ObjectId(id)),
            },
          },
        },
        { $sort: { sequenceNumber: -1 } },
        { $group: { _id: "$item", maxSeq: { $first: "$sequenceNumber" } } },
      ]);

      const sequenceMap: Record<string, number> = {};
      for (const { _id, maxSeq } of lastSequences) {
        sequenceMap[_id.toString()] = Number(maxSeq) + 1;
      }

      const itemGroupMap: Record<string, number> = {};
      const itemIndexMap: Record<string, number> = {};
      let groupCounter = 1;

      for (const serial of serialNo) {
        const itemId = serial.item.toString();

        if (!itemGroupMap[itemId]) {
          itemGroupMap[itemId] = groupCounter++;
          itemIndexMap[itemId] = 1;
        } else {
          itemIndexMap[itemId]++;
        }

        const sequenceNumber = sequenceMap[itemId] ?? 1;
        sequenceMap[itemId] = sequenceNumber + 1;

        serial.sequenceNumber = sequenceNumber;
        serial.invno = `${purchase.pp}-${itemGroupMap[itemId]}-${itemIndexMap[itemId]}`;
      }

      const Counter = getCounterModel(dbName);

      const counter = await Counter.findOneAndUpdate(
        { type: "inventory" },
        { $inc: { seq: serialNo.length } },
        { new: true, upsert: true }
      );

      const endSeq = counter.seq;
      const startSeq = endSeq - serialNo.length + 1;
      const digits = counter.digits || 0;

      const invData = serialNo.map((serial: any, index: number) => {
        const currentSeq = (startSeq + index).toString().padStart(digits, "0");
        return {
          po: id,
          pp: purchase.ppId,
          item: serial.item,
          condition: serial.condition,
          conditionData: now(),
          cost: serial.cost,
          originalCost: serial.originalCost,
          location: serial.location,
          ...(serial.itemDescription && {
            itemDescription: serial.itemDescription,
          }),
          // ...(serial.condition && { condition: serial.condition }),
          // ...(serial.condition && { conditionDate: now() }),
          // ...(serial.location && { location: serial.location }),
          // ...(serial.cost && { cost: serial.cost }),
          // ...(serial.originalCost && { originalCost: serial.originalCost }),

          wareHouse: itemWarehouseMap.get(serial.item.toString()) || null,
          purchaseNumber: purchase.pp,
          serialNumber: serial.serialNumber,
          sequenceNumber: serial.sequenceNumber,
          inventoryno: currentSeq,
          status: "Available",
          receivedStatus: serial.receivedStatus,
        };
      });

      if (invData.length > 0) await inventoryModel.insertMany(invData);
    }

    res.status(200).json({
      success: true,
      message: "Purchase updated successfully",
      data: updatedPurchase,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const purchaseModel = await getPurchaseModel(dbName);
    const queryParams = req.query.p as string;
    if (!["pp", "po"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'p'" });
      return;
    }

    const purchase = await purchaseModel.findOne({
      _id: req.params.id,
      deletedAt: null,
      purchaseType: queryParams,
    });

    if (!purchase) {
      res.status(404).json({
        success: false,
        message: "Purchase proposal not found",
      });
      return;
    } else {
      // Soft delete (recommended)
      purchase.deletedAt = moment().toDate();
      await purchase.save();

      res.status(201).json({
        success: true,
        message: "Purchase proposal deleted successfully",
      });
    }
  } catch (error) {
    next(error);
  }
};

export const importPurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const token: any = req.headers["authorization"];
    const origin: any = req.headers["origin"] || req.headers["referer"];
    const file = req.file as Express.Multer.File;
    const queryParam = req.query.p as string;

    if (!file) {
      throw createHttpError(
        400,
        "No file uploaded. Make sure to send it as 'file' field."
      );
    }

    if (!["pp", "po"].includes(queryParam)) {
      res.status(400).json({ message: "Invalid or missing query param 'p'" });
      return;
    }

    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetNames = workbook.SheetNames;
    const groupedData = groupDataBySheetName(workbook, sheetNames);

    const PurchaseModel = getPurchaseModel(dbName);
    const TermsModel = getTermsModel(dbName);
    const ConditionModel = getConditionModel(dbName);
    // const CurrencyModel = getCurrencyModel(dbName);
    const TaxModel = getTaxModel(dbName);
    const ItemModel = getItemModel(dbName);
    // const ManufacturerModel = getManufacturerModel(dbName);

    const fetchRep = async (name: string) => {
      try {
        const config = {
          method: "get",
          url: `/user/company/user/detail-by-name/${name}`,
          headers: {
            Origin: origin,
            Authorization: token,
          },
        };
        const response = await kongAxios(config);
        const rep = response.data?.data || null;
        return rep ? { id: rep._id, name: rep.userName } : null;
      } catch (error) {
        return null;
      }
    };

    const created: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];
    const bulkInsert: any[] = [];

    for (const [index, proposal] of groupedData.entries()) {
      const { errors: rowErrors, validRow } =
        validatePurchaseProposalImportRow(proposal);
      if (!validRow) {
        errors.push({ row: index + 1, errors: rowErrors });
        continue;
      }

      const locations = await getLocationByName(
        proposal.country,
        proposal.state,
        proposal.city
      );

      if (!locations.success) {
        res.status(400).json({
          success: false,
          message: "County,state or city data not found",
          data: [],
        });
        return;
      }

      if (locations.success) {
        if (!locations.data.country) {
          res
            .status(400)
            .json({ success: false, message: "County not found", data: [] });
          return;
        }
        if (!locations.data.state) {
          res
            .status(400)
            .json({ success: false, message: "State not found", data: [] });
          return;
        }
        if (!locations.data.city) {
          res
            .status(400)
            .json({ success: false, message: "City not found", data: [] });
          return;
        }
      }

      const vendor = await getVendorByName(
        dbName,
        proposal.vendor,
        token,
        origin
      );
      if (!vendor?.length) {
        skipped.push({
          row: index + 1,
          reason: "Vendor not found",
          vendor: proposal.vendor,
        });
        continue;
      }

      const currency = await getCurrencyByName(proposal.currency, token);

      if (!currency?.length) {
        skipped.push({
          row: index + 1,
          reason: "Currency not found",
          currency: proposal.currency,
        });
        continue;
      }

      const terms = await TermsModel.findOne({
        name: proposal.terms,
        deletedAt: null,
      }).collation({ locale: "en", strength: 2 });
      if (!terms) {
        skipped.push({
          row: index + 1,
          reason: "Terms not found",
          terms: proposal.terms,
        });
        continue;
      }

      // const condition = await ConditionModel.findOne({
      //   name: proposal.condition,
      //   deletedAt: null,
      // }).collation({ locale: "en", strength: 2 });
      // if (!condition) {
      //   skipped.push({
      //     row: index + 1,
      //     reason: "Condition not found",
      //     condition: proposal.condition,
      //   });
      //   continue;
      // }

      const tax = await TaxModel.findOne({ name: proposal.tax }).collation({
        locale: "en",
        strength: 2,
      });
      if (!tax) {
        skipped.push({
          row: index + 1,
          reason: "Tax not found",
          tax: proposal.tax,
        });
        continue;
      }

      const rep = await fetchRep(proposal.rep);
      if (!rep) {
        skipped.push({
          row: index + 1,
          reason: "Rep not found",
          rep: proposal.rep,
        });
        continue;
      }
      const warehouse = await getWarehouseSearch(
        proposal.Warehouse,
        token,
        origin
      );

      if (warehouse.length <= 0) {
        res
          .status(400)
          .json({ success: false, message: "warehouse not found", data: [] });
        return;
      }

      const warehouseId = Array.isArray(warehouse)
        ? warehouse[0]?._id
        : warehouse?._id;

      let items: any[] = [];
      let invalidItems: any[] = [];

      for (const item of proposal.items || []) {
        const rowItemErrors: string[] = [];

        const itemDoc = await ItemModel.findOne({
          itemName: item.item,
          deletedAt: null,
        }).collation({ locale: "en", strength: 2 });
        if (!itemDoc) rowItemErrors.push("Item not found");

        // const manufacturer = await ManufacturerModel.findOne({
        //   manufacturer: item.manufacturer,
        //   deletedAt: null,
        // }).collation({ locale: "en", strength: 2 });
        // if (!manufacturer) rowItemErrors.push("Manufacturer not found");

        const itemCondition = await ConditionModel.findOne({
          name: item.condition,
          deletedAt: null,
        }).collation({ locale: "en", strength: 2 });
        if (!itemCondition) rowItemErrors.push("Condition not found");

        if (rowItemErrors.length) {
          invalidItems.push({
            row: index + 1,
            item: item.item,
            reason: rowItemErrors,
          });
          continue;
        }

        let purchase = await PurchaseModel.find({ purchaseType: queryParam });

        items.push({
          ...item,
          item: itemDoc?._id,
          // manufacturer: manufacturer?._id,
          condition: itemCondition?._id,
          // wareHouse: warehouseId,
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

      const Counter = getCounterModel(dbName);

      console.log("Counter -----", Counter);
      let counter: any;
      let ppid: any;
      let poid: any;

      // if (queryParam === "pp") {
      //   counter = await Counter.findOneAndUpdate(
      //     { type: "pp" },
      //     { $inc: { seq: 1 } },
      //     { new: true, upsert: true }
      //   );
      //   console.log("counter -----", counter);
      //   ppid = counter.seq.toString();
      // } else if (queryParam === "po") {
      //   counter = await Counter.findOneAndUpdate(
      //     { type: "po" },
      //     { $inc: { seq: 1 } },
      //     { new: true, upsert: true }
      //   );
      //   console.log("counter -----", counter);
      //   poid = counter.seq.toString();
      // }

      if (queryParam === "pp") {
        counter = await Counter.findOneAndUpdate(
          { type: "pp" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );
        console.log("counter -----", counter);

        const seq = counter.seq.toString();
        const digits = counter.digits || 0;
        ppid = seq.padStart(digits, "0"); // 👈 zero pad
      } else if (queryParam === "po") {
        counter = await Counter.findOneAndUpdate(
          { type: "po" },
          { $inc: { seq: 1 } },
          { new: true, upsert: true }
        );
        console.log("counter -----", counter);

        const seq = counter.seq.toString();
        const digits = counter.digits || 0;
        poid = seq.padStart(digits, "0"); // 👈 zero pad
      }

      console.log("ppid ----", ppid);
      console.log("poid ----", poid);
      const newCode = queryParam === "pp" ? ppid : poid;

      const purchaseData = {
        ...proposal,
        vendor: vendor[0]._id,
        terms: terms._id,
        // condition: condition._id,
        currency: currency[0]._id,
        tax: tax._id,
        rep: rep.id,
        country: locations.data.country._id,
        wareHouse: warehouseId,
        state: locations.data.state._id,
        city: locations.data.city._id,
        items,
        userId: req.user.id,
        companyId: req.user.companyId,
        purchaseType: queryParam,
        pp: queryParam === "pp" ? newCode : undefined,
        po: queryParam === "po" ? newCode : undefined,
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
      await PurchaseModel.insertMany(bulkInsert);
    }

    res.status(201).json({
      message: "Import completed",
      created,
      skipped,
      errors,
    });
  } catch (error) {
    next(error);
  }
};

export const samplePurchaseXLSX = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const queryParam = req.query.p as string;

    if (!queryParam) {
      res.status(400).json({ message: "Missing query parameter 'p'" });
      return;
    }

    if (!["pp", "po"].includes(queryParam)) {
      res.status(400).json({ message: "Invalid query parameter 'p'" });
      return;
    }

    let data: any = {};
    if (queryParam == "pp") {
      const { sampleData } = require("../config/sampleData-pp");
      data = sampleData;
    } else if (queryParam == "po") {
      const { sampleData } = require("../config/sampleData-po");
      data = sampleData;
    }

    /** 📄 Sheet 1: PurchaseProposal **/
    const purchaseSheet = workbook.addWorksheet("Purchase");
    const purchaseRows = data.Purchase || [];

    if (purchaseRows.length > 0) {
      const purchaseColumns = Object.keys(purchaseRows[0]).map((key) => ({
        header: key,
        key,
        width: 25,
      }));
      purchaseSheet.columns = purchaseColumns;
      purchaseRows.forEach((row: any) => purchaseSheet.addRow(row));
    }

    /** 📄 Sheet 2: Items **/
    const itemsSheet = workbook.addWorksheet("Items");
    const itemsRows = data.Items || [];

    if (itemsRows.length > 0) {
      const itemColumns = Object.keys(itemsRows[0]).map((key) => ({
        header: key,
        key,
        width: 25,
      }));
      itemsSheet.columns = itemColumns;
      itemsRows.forEach((row: any) => itemsSheet.addRow(row));
    }

    /** 📤 Send file buffer **/
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=purchase-${queryParam}-sample-${Date.now()}.xlsx`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const exportAllPurchases = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const purchaseModel = await getPurchaseModel(dbName);
    const queryParams = req.query.p as string;

    if (!["pp", "po"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'p'" });
      return;
    }

    const {
      search,
      status,
      page = 1,
      limit = 10,
      disablePagination = false,
    } = req.query;

    const filter: any = {
      deletedAt: null,
      purchaseType: queryParams,
    };

    let pipeline: any[] = [
      { $match: filter },

      // Lookups for references
      {
        $lookup: {
          from: "customers",
          localField: "vendor",
          foreignField: "_id",
          as: "vendorInfo",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "rep",
          foreignField: "_id",
          as: "repInfo",
        },
      },
      {
        $lookup: {
          from: "taxes",
          localField: "tax",
          foreignField: "_id",
          as: "taxInfo",
        },
      },
      {
        $lookup: {
          from: "conditions",
          localField: "condition",
          foreignField: "_id",
          as: "conditionInfo",
        },
      },
      {
        $lookup: {
          from: "currencies",
          localField: "currency",
          foreignField: "_id",
          as: "currencyInfo",
        },
      },
      {
        $lookup: {
          from: "terms",
          localField: "terms",
          foreignField: "_id",
          as: "termsInfo",
        },
      },

      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "items",
          localField: "items.item",
          foreignField: "_id",
          as: "itemInfo",
        },
      },
      {
        $lookup: {
          from: "manufacturers",
          localField: "items.manufacturer",
          foreignField: "_id",
          as: "manufacturerInfo",
        },
      },
      {
        $lookup: {
          from: "conditions",
          localField: "items.condition",
          foreignField: "_id",
          as: "itemConditionInfo",
        },
      },
      // {
      //   $lookup: {
      //     from: "warehouses",
      //     localField: "wareHouse",
      //     foreignField: "_id",
      //     as: "warehouseInfo",
      //   },
      // },

      // Group back to array of items
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          items: {
            $push: {
              item: {
                id: { $arrayElemAt: ["$itemInfo._id", 0] },
                itemName: { $arrayElemAt: ["$itemInfo.itemName", 0] },
              },
              manufacturer: {
                id: { $arrayElemAt: ["$manufacturerInfo._id", 0] },
                manufacturer: {
                  $arrayElemAt: ["$manufacturerInfo.manufacturer", 0],
                },
              },
              quantity: "$items.quantity",
              purchaseCostCAD: "$items.purchaseCostCAD",
              purchaseCostUSD: "$items.purchaseCostUSD",
              extendedCostCAD: "$items.extendedCostCAD",
              extendedCostUSD: "$items.extendedCostUSD",
              serialNumber: "$items.serialNumber",
              lineNo: "$items.lineNo",
              condition: {
                id: { $arrayElemAt: ["$itemConditionInfo._id", 0] },
                name: { $arrayElemAt: ["$itemConditionInfo.name", 0] },
              },

              location: "$items.location",
              status: "$items.status",
            },
          },
        },
      },

      {
        $project: {
          _id: 1,
          state: "$doc.state",
          city: "$doc.city",
          country: "$doc.country",
          userId: "$doc.userId",
          companyId: "$doc.companyId",
          address: "$doc.address",
          po: "$doc.po",
          pp: "$doc.pp",
          reference: "$doc.reference",
          date: "$doc.date",
          vendor: {
            id: { $arrayElemAt: ["$doc.vendorInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.vendorInfo.companyName", 0] },
          },
          vendorSO: "$doc.vendorSO",
          currency: "$doc.currency",
          rep: "$doc.rep",
          hideLineItemPricing: "$doc.hideLineItemPricing",
          terms: {
            id: { $arrayElemAt: ["$doc.termsInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.termsInfo.name", 0] },
          },
          condition: {
            id: { $arrayElemAt: ["$doc.conditionInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.conditionInfo.name", 0] },
          },
          representative: {
            id: { $arrayElemAt: ["$doc.repInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.repInfo.userName", 0] }, // assuming 'name' is the field
          },
          // wareHouse: {
          //   id: { $arrayElemAt: ["$doc.warehouseInfo._id", 0] },
          //   name: { $arrayElemAt: ["$doc.warehouseInfo.name", 0] },
          // },
          shipDate: "$doc.shipDate",
          status: "$doc.status",
          receive: "$doc.receive",
          purchaseType: "$doc.purchaseType",
          sourcePP: "$doc.sourcePP",
          sourceSO: "$doc.sourceSO",
          billDistribution: "$doc.billDistribution",
          poType: "$doc.poType",
          erasureMethod: "$doc.erasureMethod",
          workflowTemplate: "$doc.workflowTemplate",
          serviceFee: "$doc.serviceFee",
          purchaseCostTemplate: "$doc.purchaseCostTemplate",
          supplierMargin: "$doc.supplierMargin",
          prePaid: "$doc.prePaid",
          extendedCost: "$doc.extendedCost",
          freight: "$doc.freight",
          extraCost: "$doc.extraCost",
          subTotal: "$doc.subTotal",
          totalForeignamount: "$doc.totalForeignamount",
          tax: {
            id: { $arrayElemAt: ["$doc.taxInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.taxInfo.name", 0] },
          },
          total: "$doc.total",
          deletedAt: "$doc.deletedAt",
          createdAt: "$doc.createdAt",
          updatedAt: "$doc.updatedAt",
          items: "$items",
        },
      },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "vendor.name": { $regex: new RegExp(search.toString(), "i") } },
            { [queryParams]: { $regex: new RegExp(search.toString(), "i") } },
          ],
        },
      });
    }

    if (disablePagination !== "true") {
      const skip = (Number(page) - 1) * Number(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: Number(limit) });
    }

    const purchases = await purchaseModel.aggregate(pipeline);
    const total = await purchaseModel.countDocuments(filter);

    const cityIds = new Set();
    const stateIds = new Set();
    const countryIds = new Set();
    const currencyIds = new Set();

    purchases.forEach((purchase) => {
      if (purchase.city) cityIds.add(purchase.city.toString());
      if (purchase.state) stateIds.add(purchase.state.toString());
      if (purchase.country) countryIds.add(purchase.country.toString());
      if (purchase.currency) currencyIds.add(purchase.currency.toString());
    });

    const nameConfig = {
      method: "post",
      url: "/user/public/locations/names/by-ids",
      data: {
        cityIds: [...cityIds],
        stateIds: [...stateIds],
        countryIds: [...countryIds],
        currencyIds: [...currencyIds],
      },
    };
    const locationRes = await kongAxios(nameConfig);
    const locationData = locationRes.data?.data || {};

    const enrichedPurchases = purchases.map((purchase) => ({
      ...purchase,
      cityName: locationData.cityNames?.[purchase.city?.toString()] || null,
      stateName: locationData.stateNames?.[purchase.state?.toString()] || null,
      countryName:
        locationData.countryNames?.[purchase.country?.toString()] || null,
      currencyName:
        locationData.currencies?.[purchase.currency?.toString()] || null,
    }));

    // inside try block in getAllPurchases controller...
    if (req.params.export === "excel") {
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Purchases
      // Purchases Sheet
      const purchaseSheet = workbook.addWorksheet("Purchases");
      purchaseSheet.columns = [
        { header: "S.No", key: "sno", width: 10 },
        { header: "Purchase ID", key: "_id", width: 25 },
        { header: "Vendor", key: "vendor", width: 25 },
        { header: "vendorSO", key: "vendorSO", width: 25 },
        { header: "shipDate", key: "shipDate", width: 20 },
        { header: "subTotal", key: "subTotal", width: 15 },
        { header: "Date", key: "date", width: 20 },
        { header: "Status", key: "status", width: 15 },
        { header: "Total", key: "total", width: 15 },
        { header: "City", key: "cityName", width: 20 },
        { header: "State", key: "stateName", width: 20 },
        { header: "Country", key: "countryName", width: 20 },
        { header: "Currency", key: "currencyName", width: 20 },
      ];

      let sno = 1;
      const purchaseSnoMap = new Map<string, number>(); // Map to store purchaseId -> sno

      enrichedPurchases.forEach((p) => {
        purchaseSnoMap.set(p._id.toString(), sno); // track S.No for reference in item sheet

        purchaseSheet.addRow({
          sno,
          _id: p._id,
          vendor: p.vendor?.name || "",
          date: new Date(p.date).toLocaleDateString(),
          status: p.status,
          total: p.total,
          subTotal: p.subTotal,
          vendorSO: p.vendorSO,
          shipDate: p.shipDate,
          cityName: p.cityName,
          stateName: p.stateName,
          countryName: p.countryName,
          currencyName: p.currencyName,
        });

        sno++;
      });
      // Items Sheet
      const itemSheet = workbook.addWorksheet("Items");
      itemSheet.columns = [
        { header: "Purchase S.No", key: "purchaseSno", width: 12 },
        { header: "Purchase ID", key: "purchaseId", width: 25 },
        { header: "Item ID", key: "itemId", width: 25 },
        { header: "Item Name", key: "itemName", width: 25 },
        { header: "Condition", key: "condition", width: 20 },
        { header: "Quantity", key: "quantity", width: 10 },
        { header: "Cost (CAD)", key: "purchaseCostCAD", width: 15 },
        { header: "Cost (USD)", key: "purchaseCostUSD", width: 15 },
        { header: "Extended (CAD)", key: "extendedCostCAD", width: 20 },
        { header: "Extended (USD)", key: "extendedCostUSD", width: 20 },
        { header: "Serial Number", key: "serialNumber", width: 20 },
      ];

      enrichedPurchases.forEach((purchase) => {
        const purchaseSno = purchaseSnoMap.get(purchase._id.toString()) || "";
        (purchase.items || []).forEach(
          (item: {
            item: { id: any; itemName: any };
            condition: { name: any };
            quantity: any;
            purchaseCostCAD: any;
            purchaseCostUSD: any;
            extendedCostCAD: any;
            extendedCostUSD: any;
            serialNumber: any;
          }) => {
            itemSheet.addRow({
              purchaseSno,
              purchaseId: purchase._id,
              itemId: item.item?.id || "",
              itemName: item.item?.itemName || "",
              condition: item.condition?.name || "",
              quantity: item.quantity,
              purchaseCostCAD: item.purchaseCostCAD,
              purchaseCostUSD: item.purchaseCostUSD,
              extendedCostCAD: item.extendedCostCAD,
              extendedCostUSD: item.extendedCostUSD,
              serialNumber: item.serialNumber,
            });
          }
        );
      });

      // Set headers
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=purchases_${Date.now()}.xlsx`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      // Stream to response
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    res.status(200).json({
      success: true,
      message: "Purchases fetched successfully",
      data: enrichedPurchases,
      pagination:
        disablePagination === "true"
          ? undefined
          : {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / Number(limit)),
          },
    });
  } catch (error) {
    next(error);
  }
};

export const statusUpdatePurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const purchaseModel = getPurchaseModel(dbName);

    const id = req.params.id;
    const queryParams = req.query.p as string;

    if (!id) {
      res.status(400).json({
        success: false,
        message: "Purchase ID is required",
      });
      return;
    }

    if (!["pp", "po"].includes(queryParams)) {
      res.status(400).json({
        success: false,
        message: "Invalid query parameter 'p'",
      });
    }

    const purchase = await purchaseModel.findOne({
      _id: id,
      deletedAt: null,
      purchaseType: queryParams,
    });

    if (!purchase) {
      res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
      return;
    }

    const isActive = req.body.isActive;

    // ❌ Prevent voiding PO if it's received or partially received
    if (
      queryParams === "po" &&
      isActive === false &&
      ["Received", "Partially Received"].includes(purchase.recievedStatus)
    ) {
      res.status(400).json({
        success: false,
        message: `Cannot void a PO that is already ${purchase.recievedStatus}`,
      });
      return;
    }

    // ✅ Determine new status based on activation toggle
    let newStatus = purchase.status;
    if (isActive === false) {
      newStatus = "Voided";
    } else {
      newStatus = queryParams === "pp" ? "Open" : "Available";
    }

    // ✅ Update the current purchase
    const updatedPurchase = await purchaseModel.findByIdAndUpdate(
      id,
      {
        isActive,
        status: newStatus,
      },
      { new: true }
    );

    // ✅ Cascade void to linked records
    if (isActive === false) {
      if (queryParams === "pp") {
        // Void all linked POs
        const result = await purchaseModel.updateMany(
          {
            ppId: purchase._id,
            purchaseType: "po",
            deletedAt: null,
            recievedStatus: { $nin: ["Received", "Partially Received"] }, // skip received ones
          },
          { $set: { isActive: false, status: "Voided" } }
        );
        console.log(
          `[Cascade Void] Voided ${result.modifiedCount} linked POs for PP: ${purchase._id}`
        );
      } else if (queryParams === "po" && purchase.ppId) {
        // Void linked PP
        const result = await purchaseModel.updateOne(
          {
            _id: purchase.ppId,
            purchaseType: "pp",
            deletedAt: null,
          },
          { $set: { isActive: false, status: "Voided" } }
        );
        if (result.modifiedCount > 0) {
          console.log(`[Cascade Void] Voided linked PP: ${purchase.ppId}`);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Purchase status updated successfully",
      data: updatedPurchase,
    });
  } catch (error) {
    next(error);
  }
};

// export const convertPoPurchase = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
//     const purchaseModel = getPurchaseModel(dbName);
//     const TempInventoryModel = getTempInventoryModel(dbName);
//     const inventoryModel = getInventoryModel(dbName);
//     const purchaseId = req.params.id;

//     if (!purchaseId) {
//       res.status(400).json({
//         success: false,
//         message: "Purchase ID is required",
//       });
//       return;
//     }

//     const existingPo = await purchaseModel.findOne({
//       ppId: new mongoose.Types.ObjectId(purchaseId),
//       deletedAt: null,
//       purchaseType: "po",
//     });

//     if (existingPo) {
//       res.status(400).json({
//         success: false,
//         message:
//           "This proposal has already been converted to a Purchase Order.",
//       });
//       return;
//     }

//     const purchaseProposal = await purchaseModel.findOne({
//       _id: purchaseId,
//       deletedAt: null,
//       purchaseType: "pp",
//     });

//     if (!purchaseProposal) {
//       res.status(404).json({
//         success: false,
//         message: "Purchase proposal not found",
//       });
//       return;
//     }

//     const poCount = await purchaseModel.countDocuments({ purchaseType: "po" });
//     const newCode = `po-${poCount + 1}`;

//     const newPurchaseData = {
//       ...purchaseProposal.toObject(),
//       _id: undefined,
//       purchaseType: "po",
//       po: newCode,
//       ppId: purchaseProposal._id,
//     };

//     const createdPo = await purchaseModel.create(newPurchaseData);

//     purchaseProposal.isConverted = true;
//     await purchaseProposal.save();

//     const inventoryItems = await TempInventoryModel.find({
//       pp: purchaseProposal._id,
//     });

//     const itemGroups: Record<string, any[]> = {};
//     inventoryItems.forEach((item) => {
//       const itemId = item.item.toString();
//       if (!itemGroups[itemId]) itemGroups[itemId] = [];
//       itemGroups[itemId].push(item);
//     });

//     const itemStartSequenceMap: Record<string, number> = {};
//     for (const itemId of Object.keys(itemGroups)) {
//       const last = await inventoryModel
//         .find({ item: itemId })
//         .sort({ sequenceNumber: -1 })
//         .limit(1);
//       const lastSeq = last.length > 0 ? Number(last[0].sequenceNumber) || 0 : 0;
//       itemStartSequenceMap[itemId] = isNaN(lastSeq) ? 1 : lastSeq + 1;
//     }

//     const inventoryData = inventoryItems.map((item) => {
//       const itemId = item.item.toString();
//       const nextSeq = itemStartSequenceMap[itemId]++;
//       return {
//         pp: purchaseProposal._id,
//         item: item.item,
//         warehouse: item.warehouse,
//         purchaseNumber: purchaseProposal.pp,
//         po: createdPo._id,
//         sequenceNumber: nextSeq, // renamed here
//         status: "In Transit",
//       };
//     });

//     await inventoryModel.insertMany(inventoryData);
//     await TempInventoryModel.deleteMany({ pp: purchaseProposal._id });

//     res.status(201).json({
//       success: true,
//       message: "Purchase Order created successfully",
//       poNo: createdPo.po,
//     });
//     return;
//   } catch (error) {
//     next(error);
//   }
// };

export const convertPoPurchase = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const purchaseModel = getPurchaseModel(dbName);
    const TempInventoryModel = getTempInventoryModel(dbName);
    const inventoryModel = getInventoryModel(dbName);
    const purchaseId = req.params.id;

    if (!purchaseId) {
      res.status(400).json({
        success: false,
        message: "Purchase ID is required",
      });
      return;
    }

    const existingPo = await purchaseModel.findOne({
      ppId: mongoose.Types.ObjectId.createFromHexString(purchaseId),
      deletedAt: null,
      purchaseType: "po",
    });

    if (existingPo) {
      res.status(400).json({
        success: false,
        message:
          "This proposal has already been converted to a Purchase Order.",
      });
      return;
    }

    const purchaseProposal = await purchaseModel.findOne({
      _id: purchaseId,
      deletedAt: null,
      purchaseType: "pp",
    });

    if (!purchaseProposal) {
      res.status(404).json({
        success: false,
        message: "Purchase proposal not found",
      });
      return;
    }

    const Counter = getCounterModel(dbName);

    const counter = await Counter.findOneAndUpdate(
      { type: "po" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    console.log("counter -----", counter);

    const seq = counter.seq.toString();
    const digits = counter.digits || 0;
    const newCode = seq.padStart(digits, "0"); // 👈 zero pad

    const newPurchaseData = {
      ...purchaseProposal.toObject(),
      _id: undefined,
      purchaseType: "po",
      po: newCode,
      ppId: purchaseProposal._id,
      status: "Available",
    };

    const createdPo = await purchaseModel.create(newPurchaseData);

    purchaseProposal.isConverted = true;
    await purchaseProposal.save();

    const inventoryItems = await TempInventoryModel.find({
      pp: purchaseProposal._id,
    });

    // Group by item ID for sequence tracking
    const itemGroups: Record<string, any[]> = {};
    inventoryItems.forEach((item) => {
      const itemId = item.item.toString();
      if (!itemGroups[itemId]) itemGroups[itemId] = [];
      itemGroups[itemId].push(item);
    });

    const itemStartSequenceMap: Record<string, number> = {};
    for (const itemId of Object.keys(itemGroups)) {
      const last = await inventoryModel
        .find({ item: itemId })
        .sort({ sequenceNumber: -1 })
        .limit(1);
      const lastSeq = last.length > 0 ? Number(last[0].sequenceNumber) || 0 : 0;
      itemStartSequenceMap[itemId] = isNaN(lastSeq) ? 1 : lastSeq + 1;
    }

    // Assign invno
    const itemIdGroupIndexMap: Record<string, number> = {};
    const itemIdCountMap: Record<string, number> = {};
    let groupIndex = 1;

    inventoryItems.forEach((item) => {
      const itemId = item.item.toString();
      if (!itemIdGroupIndexMap[itemId]) {
        itemIdGroupIndexMap[itemId] = groupIndex++;
        itemIdCountMap[itemId] = 0;
      }
    });

    // 1. Fetch the initial counter
    // ✅ 1. Fetch the inventory counter and increment once for all
    const inventoryCounter = await Counter.findOneAndUpdate(
      { type: "inventory" },
      { $inc: { seq: inventoryItems.length } },
      { new: true, upsert: true }
    );

    // ✅ 2. Calculate startSeq and digits based on inventory counter
    const endSeq = inventoryCounter.seq;
    const startSeq = endSeq - inventoryItems.length + 1;
    const inventoryDigits = inventoryCounter.digits || 0;

    // ✅ 3. Build inventory data array
    const inventoryData = inventoryItems.map((item, index) => {
      const itemId = item.item.toString();
      const nextSeq = itemStartSequenceMap[itemId]++;
      const currentGroupIndex = itemIdGroupIndexMap[itemId];
      const currentItemIndex = ++itemIdCountMap[itemId];
      const currentSeq = (startSeq + index)
        .toString()
        .padStart(inventoryDigits, "0");

      return {
        pp: purchaseProposal._id,
        item: item.item,
        warehouse: item.wareHouse,
        purchaseNumber: purchaseProposal.pp,
        po: createdPo._id,
        sequenceNumber: nextSeq,
        serialNumber: (item as any).serialNumber,
        cost: (item as any).cost,
        originalCost: (item as any).originalCost,
        condition: (item as any).condition,
        conditionDate: (item as any).conditionDate,
        location: (item as any).location,
        status: "Available",
        invno: `${purchaseProposal.pp}-${currentGroupIndex}-${currentItemIndex}`,
        inventoryno: currentSeq, // ✅ Unique inventoryno based on inventory counter
      };
    });

    await inventoryModel.insertMany(inventoryData);
    await TempInventoryModel.deleteMany({ pp: purchaseProposal._id });

    res.status(201).json({
      success: true,
      message: "Purchase Order created successfully",
      poNo: createdPo.po,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const downloadPurchasePdf = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const purchaseModel = await getPurchaseModel(dbName);
    const id = req.params.id;
    const queryParams = req.query.p as string;

    console.log("id ---", id);

    if (!["pp", "po"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'p'" });
      return;
    }

    const pipeline: any[] = [
      {
        $match: {
          _id: new Types.ObjectId(id),
          deletedAt: null,
          purchaseType: queryParams,
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "vendor",
          foreignField: "_id",
          as: "vendorInfo",
        },
      },
      {
        $lookup: {
          from: "taxes",
          localField: "tax",
          foreignField: "_id",
          as: "taxInfo",
        },
      },
      {
        $lookup: {
          from: "conditions",
          localField: "condition",
          foreignField: "_id",
          as: "conditionInfo",
        },
      },
      {
        $lookup: {
          from: "currencies",
          localField: "currency",
          foreignField: "_id",
          as: "currencyInfo",
        },
      },
      {
        $lookup: {
          from: "terms",
          localField: "terms",
          foreignField: "_id",
          as: "termsInfo",
        },
      },
      // {
      //   $lookup: {
      //     from: "warehouses",
      //     localField: "wareHouse",
      //     foreignField: "_id",
      //     as: "warehouseInfo",
      //   },
      // },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "items",
          localField: "items.item",
          foreignField: "_id",
          as: "itemInfo",
        },
      },
      {
        $lookup: {
          from: "manufacturers",
          localField: "items.manufacturer",
          foreignField: "_id",
          as: "manufacturerInfo",
        },
      },
      {
        $lookup: {
          from: "conditions",
          localField: "items.condition",
          foreignField: "_id",
          as: "itemConditionInfo",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "rep",
          foreignField: "_id",
          as: "repInfo",
        },
      },
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          items: {
            $push: {
              item: {
                id: { $arrayElemAt: ["$itemInfo._id", 0] },
                name: { $arrayElemAt: ["$itemInfo.itemName", 0] },
              },
              manufacturer: {
                id: { $arrayElemAt: ["$manufacturerInfo._id", 0] },
                name: { $arrayElemAt: ["$manufacturerInfo.manufacturer", 0] },
              },
              quantity: "$items.quantity",
              purchaseCostCAD: "$items.purchaseCostCAD",
              purchaseCostUSD: "$items.purchaseCostUSD",
              extendedCostCAD: "$items.extendedCostCAD",
              extendedCostUSD: "$items.extendedCostUSD",
              serialNumber: "$items.serialNumber",
              lineNo: "$items.lineNo",
              condition: {
                id: { $arrayElemAt: ["$itemConditionInfo._id", 0] },
                name: { $arrayElemAt: ["$itemConditionInfo.name", 0] },
              },
              status: "$items.status",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          userId: "$doc.userId",
          companyId: "$doc.companyId",
          date: "$doc.date",
          vendor: {
            id: { $arrayElemAt: ["$doc.vendorInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.vendorInfo.companyName", 0] },
            firstName: { $arrayElemAt: ["$doc.vendorInfo.firstName", 0] },
            lastName: { $arrayElemAt: ["$doc.vendorInfo.lastName", 0] },
            email: { $arrayElemAt: ["$doc.vendorInfo.email", 0] },
            phone: { $arrayElemAt: ["$doc.vendorInfo.phone", 0] },
            address: { $arrayElemAt: ["$doc.vendorInfo.address", 0] },
          },
          vendorSO: "$doc.vendorSO",
          description: "$doc.description",
          extDescription: "$doc.extDescription",
          internalComment: "$doc.internalComment",
          currency: {
            id: { $arrayElemAt: ["$doc.currencyInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.currencyInfo.currency", 0] },
          },
          rep: {
            id: { $arrayElemAt: ["$doc.repInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.repInfo.userName", 0] },
          },
          terms: {
            id: { $arrayElemAt: ["$doc.termsInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.termsInfo.name", 0] },
          },
          condition: {
            id: { $arrayElemAt: ["$doc.conditionInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.conditionInfo.name", 0] },
          },
          shipDate: "$doc.shipDate",
          address: "$doc.address",
          country: "$doc.country",
          state: "$doc.state",
          city: "$doc.city",
          // wareHouse: {
          //   id: { $arrayElemAt: ["$doc.warehouseInfo._id", 0] },
          //   name: { $arrayElemAt: ["$doc.warehouseInfo.name", 0] },
          //   workPhone: { $arrayElemAt: ["$doc.warehouseInfo.workPhone", 0] },
          //   email: { $arrayElemAt: ["$doc.warehouseInfo.email", 0] },
          //   address1: { $arrayElemAt: ["$doc.warehouseInfo.address1", 0] },
          //   country: { $arrayElemAt: ["$doc.warehouseInfo.country", 0] },
          //   state: { $arrayElemAt: ["$doc.warehouseInfo.state", 0] },
          //   city: { $arrayElemAt: ["$doc.warehouseInfo.city", 0] },
          //   zipcode: { $arrayElemAt: ["$doc.warehouseInfo.zipcode", 0] },
          // },
          tax: {
            id: { $arrayElemAt: ["$doc.taxInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.taxInfo.name", 0] },
          },
          status: "$doc.status",
          receive: "$doc.receive",
          purchaseType: "$doc.purchaseType",
          extendedCost: "$doc.extendedCost",
          freight: "$doc.freight",
          extraCost: "$doc.extraCost",
          subTotal: "$doc.subTotal",
          totalForeignamount: "$doc.totalForeignamount",
          total: "$doc.total",
          items: "$items",
          deletedAt: "$doc.deletedAt",
          createdAt: "$doc.createdAt",
          updatedAt: "$doc.updatedAt",
        },
      },
    ];

    const [result] = await purchaseModel.aggregate(pipeline);

    console.log("result ----", result);

    if (!result) {
      res.status(404).json({ success: false, message: "Purchase not found" });
      return;
    }

    // getLocation enrichment
    const city = result.city;
    const state = result.state;
    const country = result.country;

    console.log("city ----", city);
    console.log("state ----", state);
    console.log("country ----", country);

    // const warehousecity = result.wareHouse.city;
    // const warehousestate = result.wareHouse.state;
    // const warehousecountry = result.wareHouse.country;

    // console.log('warehousecity ----', warehousecity);
    // console.log('warehousestate ----', warehousestate);
    // console.log('warehousecountry ----', warehousecountry);

    const locationData = await getLocation(country, state, city);
    // const warehouselocationData = await getLocation(
    //   warehousecountry,
    //   warehousestate,
    //   warehousecity
    // );

    console.log("locationData ----", locationData);
    // console.log('warehouselocationData ----', warehouselocationData);

    result.cityName = locationData?.data?.cityNames[city] || "";
    result.stateName = locationData?.data?.stateNames[state] || "";
    result.countryName = locationData?.data?.countryNames[country] || "";

    // result.wareHouse.cityName =
    //   warehouselocationData?.data?.cityNames[city] || "";
    // result.wareHouse.stateName =
    //   warehouselocationData?.data?.stateNames[state] || "";
    // result.wareHouse.countryName =
    //   warehouselocationData?.data?.countryNames[country] || "";

    // res.status(200).json({ success: false, data: result });
    // return;
    //  res.status(200).json({ success: true, data: result });
    // const dataMap = {
    //   invoice_label: result.invoice_label || result._id.toString(),
    //   billed_date: moment(result.date).format("DD MMM YYYY"),
    //   company_name: result.company?.name || "-",
    //   company_email: result.company?.email || "-",
    //   super_admin_name: "Super Admin",
    //   plan_name: result.packageData?.plan_name || "N/A",
    //   plan_type: result.packageData?.plan_type || "N/A",
    //   billing_cycle: `${result.subscription?.billingCycle || 30} Days`,
    //   created_date: moment(result.subscription?.createdAt).format(
    //     "DD MMM YYYY"
    //   ),
    //   expiry_date: moment(result.subscription?.endDate).format("DD MMM YYYY"),
    //   amount: `$${(result.amount || 0).toFixed(2)}`,
    //   payment_method: result.payment_method || "N/A",
    //   sub_total: `$${(result.amount || 0).toFixed(2)}`,
    //   tax: "$0.00",
    //   total: `$${(result.amount || 0).toFixed(2)}`,
    // };

    // // Load your HTML template
    const html: any = generateInvoiceHtml(result); // See below for this helper

    let pdfBuffer: any;

    if (html) {
      pdfBuffer = await generatePdfBufferFromHtml(html);
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.vendorSO}.pdf"`,
    });

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

export const updatePurchaseItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = req.headers["x-db-name"] as string;
    if (!dbName) {
      res.status(400).json({
        success: false,
        message: "Database name (x-db-name) header is missing",
      });
      return;
    }

    const inventoryModel = getInventoryModel(dbName);
    const serialNumber = req.params.serialNumber;

    // Find existing inventory item by serial number
    const existingPo = await inventoryModel.findOne({ serialNumber });

    if (!existingPo) {
      res.status(404).json({
        success: false,
        message: "This Serial Number is not found",
      });
      return;
    }

    // Update status to 'received'
    const updateResult = await inventoryModel.updateOne(
      { serialNumber },
      { $set: { receivedStatus: "Received" } }
    );

    const wasUpdated = updateResult.modifiedCount > 0;

    res.status(200).json({
      success: wasUpdated,
      message: wasUpdated
        ? "Inventory item status updated to 'received'"
        : "Inventory item was already 'received' or no change applied",
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const getInventoryItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const inventoryModel = getInventoryModel(dbName);
    const tempInventoryModel = getTempInventoryModel(dbName);
    const id = req.params.id;
    const queryParams = req.query.p as string;

    if (!["pp", "po"].includes(queryParams)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid query parameter 'p'" });
      return;
    }

    const filter: any = {};
    let result: any;
    if (queryParams === "pp") {
      filter.pp = id;
      result = await tempInventoryModel.find(filter);
    } else {
      filter.po = id;
      result = await inventoryModel.find(filter);
    }

    if (!result || result.length === 0) {
      res.status(200).json({
        success: false,
        message: "Purchase not found",
        data: [],
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Inventory fetched successfully",
      data: result,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const getAllInventories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Inventory = await getInventoryModel(dbName);

    const {
      page = 1,
      limit = 10,
      status,
      warehouse,
      item,
      po, // ✅ added
      search,
      startDate,
      endDate,
      sortOrder,
    } = req.query;
    const sortBy = (req.query.sortBy as string) || "createdAt";

    const pageNum = Number(page);
    const limitNum = Number(limit);

    // Initial filters
    const match: any = {};
    if (status) match.status = status;
    if (warehouse)
      match.wareHouse = mongoose.Types.ObjectId.createFromHexString(
        warehouse as string
      );
    if (item)
      match.item = mongoose.Types.ObjectId.createFromHexString(item as string);
    if (po)
      match.po = mongoose.Types.ObjectId.createFromHexString(po as string);
    if (req.query.status === "excludeReserved") {
      match.status = { $nin: ["Reserved", "Sold"] };
    }

    // createdRange: filter or sort

    let order: "asc" | "desc" = "desc"; // default sort order
    if (sortOrder === "asc" || sortOrder === "desc") {
      order = sortOrder;
    }
    if (startDate && endDate) {
      const fromDate = moment(startDate as string)
        .startOf("day")
        .toDate();
      const toDate = moment(endDate as string)
        .endOf("day")
        .toDate();

      match.createdAt = { $gte: fromDate, $lte: toDate };
    }

    const pipeline: any[] = [
      { $match: match },

      {
        $lookup: {
          from: "items",
          localField: "item",
          foreignField: "_id",
          as: "item",
        },
      },
      { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "manufacturers",
          localField: "item.manufacturer",
          foreignField: "_id",
          as: "manufacturer",
        },
      },
      { $unwind: { path: "$manufacturer", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "purchases",
          localField: "po",
          foreignField: "_id",
          as: "poDetails",
        },
      },
      { $unwind: { path: "$poDetails", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users", // change this to the correct collection if it's not 'users'
          localField: "poDetails.rep",
          foreignField: "_id",
          as: "repDetails",
        },
      },
      { $unwind: { path: "$repDetails", preserveNullAndEmptyArrays: true } },

      // ✅ Add matching purchase item (based on current inventory item)
      {
        $addFields: {
          matchingPOItem: {
            $first: {
              $filter: {
                input: "$poDetails.items",
                as: "poItem",
                cond: { $eq: ["$$poItem.item", "$item._id"] },
              },
            },
          },
        },
      },

      {
        $lookup: {
          from: "warehouses",
          localField: "matchingPOItem.wareHouse",
          foreignField: "_id",
          as: "warehouse",
        },
      },
      { $unwind: { path: "$warehouse", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "conditions",
          localField: "condition",
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
        $addFields: {
          soId: {
            $cond: [
              {
                $and: [
                  { $ne: ["$soId", null] },
                  { $ne: [{ $type: "$soId" }, "objectId"] },
                ],
              },
              { $toObjectId: "$soId" },
              "$soId",
            ],
          },
        },
      },

      {
        $lookup: {
          from: "sales",
          localField: "soId",
          foreignField: "_id",
          as: "saleOrderDetails",
        },
      },
      {
        $unwind: {
          path: "$saleOrderDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      ...(search
        ? [
          {
            $match: {
              $or: [
                { sequenceNumber: { $regex: search, $options: "i" } },
                { "item.itemName": { $regex: search, $options: "i" } },
                { "item.description": { $regex: search, $options: "i" } },
                {
                  "manufacturer.manufacturer": {
                    $regex: search,
                    $options: "i",
                  },
                },
                {
                  "conditionDetails.name": { $regex: search, $options: "i" },
                },
                { serialNumber: { $regex: search, $options: "i" } },
                { purchaseNumber: { $regex: search, $options: "i" } },
                { "poDetails.po": { $regex: search, $options: "i" } },
                { "warehouse.name": { $regex: search, $options: "i" } },
              ],
            },
          },
        ]
        : []),

      {
        $project: {
          _id: 1,
          itemId: "$item._id",
          itemName: "$item.itemName",
          itemDescription: "$item.description",
          inventoryDescription: "$itemDescription",
          country: "$item.country",
          warehouseId: "$warehouse._id",
          warehouseName: "$warehouse.name",
          po: "$poDetails.po",
          poId: "$poDetails._id",
          manufacturerName: "$manufacturer.manufacturer",
          conditionName: "$conditionDetails.name",
          repName: "$repDetails.userName",
          cost: 1,
          originalCost: 1,
          salesOrderNo: "$saleOrderDetails.so",
          conditionDate: 1,
          purchaseNumber: 1,
          sequenceNumber: 1,
          serialNumber: 1,
          status: 1,
          location: 1,
          saleStatus: 1,
          invno: 1,
          inventoryno: 1,
          internalComments: 1,
          inventoryComments: 1,
          createdAt: 1,
          updatedAt: 1,
          receivedStatus: 1,
        },
      },
    ];

    const result = await paginateAggregate(Inventory, pipeline, {
      page: pageNum,
      limit: limitNum,
      sortBy,
      order,
    });

    // After getting result
    const countryIds: string[] = [
      ...new Set(result.data.map((doc: any) => doc.country).filter(Boolean)),
    ];
    const countryMap = await getCountryNameMap(countryIds);

    result.data = result.data.map((doc: any) => ({
      ...doc,
      countryName: countryMap[doc.country] || doc.country,
    }));

    res.status(200).json({
      status: 200,
      message: "Inventory list fetched successfully",
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

export const updateInventrory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const inventoryModel = getInventoryModel(dbName);
    const tempInventoryModel = getTempInventoryModel(dbName);
    const purchaseModel = getPurchaseModel(dbName);
    const itemModel = getItemModel(dbName);
    const Counter = getCounterModel(dbName);

    const id = req.params.id;
    const queryParams = req.query.p as string;
    const { items } = req.body;

    if (!["pp", "po"].includes(queryParams)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid query parameter 'p'" });
      return;
    }

    if (queryParams === "po") {
      for (const item of items) {
        if (Array.isArray(item.serialNumbers)) {
          item.serialNumbers = item.serialNumbers.map((serial: any) => ({
            ...serial,
            cost: item.purchaseCostCAD,
            originalCost: item.purchaseCostCAD,
            ...(item.location && { location: item.location }),
          }));

          console.log("serial ---", item.serialNumbers);
          for (const serial of item.serialNumbers) {
            console.log("serial ---", serial);
            // Get existing record from DB
            const existing = await inventoryModel.findOne({
              po: id,
              serialNumber: serial.serialNumber,
            });

            console.log("existing ---", existing);

            const isConditionChanged =
              existing?.condition?.toString() !== serial.condition?.toString();

            const updateData: any = {
              cost: serial.cost,
              originalCost: serial.originalCost,
              location: serial.location,
              ...(serial.itemDescription && {
                itemDescription: serial.itemDescription,
              }),
              receivedStatus: serial.receivedStatus,
            };

            console.log("updatedData 000", updateData);

            if (isConditionChanged) {
              updateData.condition = serial.condition;
              updateData.conditionDate = now(); // only update date if condition changed
            }

            await inventoryModel.updateOne(
              {
                po: id,
                serialNumber: serial.serialNumber,
              },
              { $set: updateData }
            );
          }
        }
      }
    } else if (queryParams === "pp") {
      for (const item of items) {
        if (Array.isArray(item.serialNumbers)) {
          item.serialNumbers = item.serialNumbers.map((serial: any) => ({
            ...serial,
            cost: item.purchaseCostCAD,
            originalCost: item.purchaseCostCAD,
            ...(item.location && { location: item.location }),
          }));

          for (const serial of item.serialNumbers) {
            if (serial.serialNumber && serial.condition) {
              // Get existing record from DB
              const existing = await tempInventoryModel.findOne({
                pp: id,
                serialNumber: serial.serialNumber,
              });

              if (!existing) continue;

              const isConditionChanged =
                existing.condition?.toString() !== serial.condition?.toString();

              const updateData: any = {
                cost: serial.cost,
                originalCost: serial.originalCost,
                location: serial.location,
                ...(serial.itemDescription && {
                  itemDescription: serial.itemDescription,
                }),
              };

              if (isConditionChanged) {
                updateData.condition = serial.condition;
                updateData.conditionDate = now(); // only update date if condition changed
              }

              await tempInventoryModel.updateOne(
                {
                  pp: id,
                  serialNumber: serial.serialNumber,
                },
                { $set: updateData }
              );
            }
          }
        }
      }
    }

    const purchase = await purchaseModel.findOne({
      _id: id,
      purchaseType: queryParams,
    });
    if (!purchase) {
      res.status(400).json({ success: false, message: "Purchase not found" });
      return;
    }

    if (purchase.isConverted) {
      res.status(400).json({
        success: false,
        message:
          "This purchase has been converted to purchase order; serial numbers can no longer be edited",
      });
      return;
    }

    if (queryParams === "po") {
      const totalQty =
        purchase.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
      const receivedCount = await inventoryModel.countDocuments({
        po: id,
        receivedStatus: "Received",
      });
      const balanceQty = Math.max(0, totalQty - receivedCount);
      if (balanceQty === 0) {
        res.status(400).json({
          success: false,
          message: "All inventory for this purchase has already been received",
        });
        return;
      }
    }

    let totalQuantity = 0;
    let totalSerialNumbers = 0;
    const serialNumberMap = new Map<
      string,
      { count: number; items: string[] }
    >();

    for (const item of items) {
      totalQuantity += item.quantity || 0;
      if (Array.isArray(item.serialNumbers)) {
        totalSerialNumbers += item.serialNumbers.length;
        for (const sn of item.serialNumbers) {
          const serialNumber = sn.serialNumber;
          if (!serialNumber) continue;
          if (serialNumberMap.has(serialNumber)) {
            const data = serialNumberMap.get(serialNumber)!;
            data.count += 1;
            data.items.push(item.item?.id || "unknown");
          } else {
            serialNumberMap.set(serialNumber, {
              count: 1,
              items: [item.item?.id || "unknown"],
            });
          }
        }
      }
    }

    if (totalQuantity < totalSerialNumbers) {
      res.status(400).json({
        success: false,
        message: "Serialnumber count is greater than item quantity",
      });
      return;
    }

    const duplicatesDetailed = Array.from(serialNumberMap.entries())
      .filter(([_, data]) => data.count > 1)
      .map(([serialNumber]) => serialNumber);

    if (duplicatesDetailed.length > 0) {
      res.status(400).json({
        success: false,
        message: "Duplicate serial numbers found",
        duplicates: duplicatesDetailed,
      });
      return;
    }

    // 🧠 Enrich items with descriptions
    const uniqueItemIds = [
      ...new Set(
        items.map((i: { item: { id: any } }) => i.item?.id).filter(Boolean)
      ),
    ];
    const itemDocs = await itemModel
      .find({ _id: { $in: uniqueItemIds } }, { _id: 1, description: 1 })
      .lean();
    const itemDescMap = itemDocs.reduce((acc: any, curr: any) => {
      acc[curr._id.toString()] = curr.description;
      return acc;
    }, {});

    let inventoryData = items.flatMap((item: any) =>
      Array.isArray(item.serialNumbers)
        ? item.serialNumbers.map((serial: any) => {
          const itemId = serial.item;
          const itemDescription = itemDescMap[itemId?.toString()] || "";
          const base = {
            item: serial.item,
            wareHouse: serial.wareHouse,
            serialNumber: serial.serialNumber,
            cost: serial.cost,
            originalCost: serial.originalCost,
            location: serial.location,
            condition: serial.condition,
            conditionDate: now(),
            ...(serial.itemDescription && {
              itemDescription: serial.itemDescription,
            }),
            itemDescription,
            receivedStatus: serial.receivedStatus,
          };
          return queryParams === "pp"
            ? { ...base, pp: purchase._id, purchaseNumber: purchase.pp }
            : {
              ...base,
              pp: purchase.ppId,
              po: purchase._id,
              status: serial.status,
              purchaseNumber: purchase.po,
              cost: serial.cost,
              originalCost: serial.originalCost,
              location: serial.location,
              conditionDate: now(),
              condition: serial.condition,
              ...(serial.itemDescription && {
                itemDescription: serial.itemDescription,
              }),
            };
        })
        : []
    );

    if (queryParams === "pp") {
      await tempInventoryModel.deleteMany({ pp: id });

      if (inventoryData.length > 0) {
        await tempInventoryModel.insertMany(inventoryData);
        res.status(200).json({
          success: true,
          message: "Inventory updated successfully",
        });
        return;
      } else {
        res.status(400).json({
          success: false,
          message: "No inventory data to insert",
        });
        return;
      }
    }

    if (queryParams === "po") {
      console.log("req.body ---", req.body);
      const incomingSerials = inventoryData.map(
        (inv: { serialNumber: any }) => inv.serialNumber
      );
      const existingInventory = await inventoryModel
        .find(
          { po: id, serialNumber: { $in: incomingSerials } },
          { _id: 1, serialNumber: 1, status: 1 }
        )
        .lean();

      const existingSerialMap = new Map(
        existingInventory.map((e) => [
          e.serialNumber,
          { _id: e._id, status: e.status },
        ])
      );

      const alreadyReceived = Array.from(existingSerialMap.entries())
        .filter(([_, data]: any) => data.receivedStatus === "Received")
        .map(([serial]) => serial);

      if (alreadyReceived.length > 0) {
        res.status(400).json({
          success: false,
          message:
            "Serial numbers already received. Cannot update received serials again.",
          duplicates: alreadyReceived,
        });
        return;
      }

      let newSerials: any[] = [];
      const existingSerialsToUpdate: string[] = [];

      for (const record of inventoryData) {
        if (existingSerialMap.has(record.serialNumber)) {
          existingSerialsToUpdate.push(record.serialNumber);
        } else {
          newSerials.push(record);
        }
      }

      let inserted: any[] = [];
      if (newSerials.length > 0) {
        const inventoryCounter = await Counter.findOneAndUpdate(
          { type: "inventory" },
          { $inc: { seq: newSerials.length } },
          { new: true, upsert: true }
        );

        const endSeq = inventoryCounter.seq;
        const startSeq = endSeq - newSerials.length + 1;
        const digits = inventoryCounter.digits || 0;

        newSerials = newSerials.map((record, index) => {
          const inventoryno = (startSeq + index)
            .toString()
            .padStart(digits, "0");
          return {
            ...record,
            inventoryno,
          };
        });

        inserted = await inventoryModel.insertMany(newSerials);
      }

      // ✅ Updated part: only update to "Received" if incoming says so and existing is not already "Received"
      const serialsToReceive = inventoryData
        .filter(
          (rec: any) =>
            rec.receivedStatus === "Received" &&
            existingSerialMap.has(rec.serialNumber)
        )
        .map((rec: any) => {
          const existing: any = existingSerialMap.get(rec.serialNumber);
          if (existing?.receivedStatus !== "Received") {
            return existing._id;
          }
          return null;
        })
        .filter(Boolean);

      if (serialsToReceive.length > 0) {
        const bulkOps = serialsToReceive.map((_id: any) => ({
          updateOne: {
            filter: { _id },
            update: {
              $set: { status: "Available", receivedStatus: "Received" },
            },
          },
        }));

        await inventoryModel.bulkWrite(bulkOps);
      }

      const totalQty =
        purchase.items?.reduce((sum, i) => sum + (i.quantity || 0), 0) || 0;
      const allInventory = await inventoryModel.find({ po: id });
      const receivedQty = allInventory.filter(
        (i: any) => i.receivedStatus === "Received"
      ).length;
      const balanceQty = Math.max(0, totalQty - receivedQty);

      let recievedStatus = "in transit";
      let purchaseStatus: any = purchase.status;

      if (receivedQty === totalQty) {
        recievedStatus = "Received";
        purchaseStatus = "Closed";
      } else if (receivedQty > 0 && receivedQty < totalQty) {
        recievedStatus = "Partially Received";
      }

      await purchaseModel.updateOne(
        { _id: id },
        {
          $set: {
            recievedStatus,
            totalQty,
            receivedQty,
            balanceQty,
            status: purchaseStatus,
          },
        }
      );

      // ✅ Optionally close linked PP
      if (purchaseStatus === "Closed" && purchase.ppId) {
        const ppUpdate = await purchaseModel.updateOne(
          { _id: purchase.ppId, purchaseType: "pp" },
          { $set: { status: "Closed" } }
        );
        if (ppUpdate.modifiedCount > 0) {
          console.log(`[PP] Linked PP (${purchase.ppId}) marked as Closed.`);
        }
      }

      res.status(200).json({
        success: true,
        message: "Inventory updated successfully",
        data: {
          totalQty,
          receivedQty,
          balanceQty,
          recievedStatus,
          insertedCount: inserted.length,
          updatedCount: serialsToReceive.length,
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

export const updateComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const purchaseModel = getPurchaseModel(dbName);
    const id = req.params.id;
    const { commentToVendor, internalComment } = req.body;

    const purchase = await purchaseModel.findByIdAndUpdate(
      id,
      { commentToVendor, internalComment },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Comments updated successfully",
      data: purchase,
    });
  } catch (err) {
    next(err);
  }
};

export const updateSalesInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const inventoryModel = getInventoryModel(dbName);

    const { ids = [], soId } = req.body;

    if (!Array.isArray(ids) || ids.length === 0 || !soId) {
      res.status(400).json({
        success: false,
        message: "Invalid request. 'ids' and 'soId' are required.",
      });
      return;
    }

    // Convert string IDs to ObjectId
    const objectIds = ids.map((id) => {
      try {
        return mongoose.Types.ObjectId.createFromHexString(id);
      } catch (e) {
        throw new Error(`Invalid ObjectId: ${id}`);
      }
    });

    // Step 1: Check for already reserved items
    const reservedItems = await inventoryModel.find({
      _id: { $in: objectIds },
      status: "Reserved",
    });

    if (reservedItems.length > 0) {
      res.status(400).json({
        success: false,
        message: "Some inventory items are already reserved.",
        reservedItemIds: reservedItems.map((item) => item._id),
      });
      return;
    }

    // Step 2: Update only items that are NOT 'InTransit'
    const result = await inventoryModel.updateMany(
      {
        _id: { $in: objectIds },
        status: { $ne: "In Transit" }, // Skip items that are InTransit
      },
      {
        $set: {
          status: "Reserved",
          receivedStatus: "Received",
          soId: mongoose.Types.ObjectId.createFromHexString(soId),
          reservedAt: moment().toDate(),
        },
      }
    );

    const modifiedCount = result.modifiedCount ?? 0;

    res.status(200).json({
      success: true,
      message: `${modifiedCount} inventory items updated to 'Reserved' with soId '${soId}'.`,
    });
  } catch (error) {
    next(error);
  }
};


export const isSerialNumberExist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const inventoryModel = getInventoryModel(dbName);
    // const poId = req.params.id;
    const { serialNumber, itemIds, excluedeId = null } = req.body;
    let matched;
    const excludedIdsRaw = Array.isArray(excluedeId)
      ? excluedeId
      : excluedeId
        ? [excluedeId]
        : [];

    const excludedIds = excludedIdsRaw.filter((id) => id);

    if (excludedIds.length) {
      matched = await inventoryModel.findOne({
        item: { $in: itemIds },
        serialNumber,
        _id: { $nin: excludedIds },
      });
    } else {
      matched = await inventoryModel.findOne({
        item: { $in: itemIds },
        serialNumber,
      });
    }

    if (!matched) {
      res.status(404).json({
        success: false,
        message: "Serial number not exist",
      });
      return;
    }

    if (excluedeId == null) {
      res.status(201).json({
        success: true,
        message: "Serial number found",
        data: matched,
      });
      return;
    }

    if (matched && matched.receivedStatus === "Received") {
      res.status(400).json({
        success: false,
        message: "Serial number already received",
        data: matched,
      });
      return;
    } else {
      res.status(200).json({
        success: true,
        message: "Serial number found",
        data: matched,
      });
    }
  } catch (error) {
    console.error("Error in isSerialNumberExist:", error);
    next(error);
  }
};

export const inventoryUpdateComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const inventoryModel = getInventoryModel(dbName);
    const id = req.params.id;
    const { inventoryComments, internalComments } = req.body;

    const purchase = await inventoryModel.findByIdAndUpdate(
      id,
      { inventoryComments, internalComments },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Comments updated successfully",
      data: purchase,
    });
  } catch (err) {
    next(err);
  }
};
