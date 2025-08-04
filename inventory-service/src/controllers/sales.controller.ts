import e, { Request, Response } from "express";
import { NextFunction } from "express";
import PurchaseModel from "../models/purchase.model";
import { getDbConnection } from "@config/database";
import { IPurchase } from "../interfaces/purchase.interface";
import mongoose, { Model } from "mongoose";
import PurchaseSchema from "../models/purchase.model";
import { ITax } from "../interfaces/tax.interface";
import TaxSchema from "../models/tax.model";
import { ICondition } from "../interfaces/condition.interface";
import ConditionSchema from "../models/condition.model";
import { Icurrency } from "../interfaces/currency.interface";
import CurrencySchema from "../models/currency.model";
import { ITerm } from "../interfaces/term.interface";
import TermSchema from "../models/term.model";
import { IManufacturer } from "@interfaces/manufacturer.interface";
import ManufacturerSchema from "@models/manufacturer.model";
import ExcelJS from "exceljs";
import createHttpError from "http-errors";
import xlsx from "xlsx";
import { groupDataBySheetName } from "@utils/auth.utils";
import { validatePurchaseProposalImportRow } from "@validations/purchase-proposal.validation";
import {
  generateFullSaleInvoiceHtml,
  generateInvoiceHtml,
  generatePdfBufferFromHtml,
  generateSaleInvoiceHtml,
} from "@utils/export.utils";
import { Types } from "mongoose";
import { isSet } from "node:util/types";
import moment from "moment";
import { paginateAggregate } from "@utils/paginate";
import { MetricsStatus } from "@aws-sdk/client-s3";
import SalesSchema from "../models/sales.model";
import { ISales } from "../interfaces/sales.interface";
import kongAxios from "@services/kong.service";
import { IItem } from "@interfaces/item.interface";
import ItemSchema from "@models/item.model";
import { IInventory } from "@interfaces/inventory.interface";
import InventorySchema from "@models/inventory.model";
import { IInvoice } from "@interfaces/invoice.interface";
import InvoiceSchema from "@models/invoice.model";
import CounterSchema from "@models/counter.model";
import { ICounter } from "@interfaces/counter.interface";
import { log } from "node:util";

const DB_NAME: any = process.env.DB_NAME;

const getPurchaseModel = (dbName: string): Model<IPurchase> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Purchase ||
    connection.model<IPurchase>("Purchase", PurchaseSchema)
  );
};

const getInvoiceModel = (dbName: string): Model<IInvoice> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Invoice ||
    connection.model<IInvoice>("Invoice", InvoiceSchema)
  );
};

const getInventoryModel = (dbName: string): Model<IInventory> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Inventory ||
    connection.model<IInventory>("Inventory", InventorySchema)
  );
};

const getTaxModel = (dbName: string): Model<ITax> => {
  const connection = getDbConnection(dbName);
  return connection.models.Tax || connection.model<ITax>("Tax", TaxSchema);
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

const getManufacturerModel = (dbName: string): Model<IManufacturer> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Manufacturer ||
    connection.model<IManufacturer>("Manufacturer", ManufacturerSchema)
  );
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

const getCountry = async (country: string, currency: string): Promise<any> => {
  try {
    const nameConfig = {
      method: "post",
      url: "/user/public/locations/names/by-ids", // adjust as per Kong route
      data: {
        countryIds: country ? country : [],
        currencyIds: currency ? [currency] : [],
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

const getSalesModel = (dbName: string): Model<ISales> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Sale || connection.model<ISales>("Sale", SalesSchema)
  );
};

export const createSale = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const type = req.query.type as string;
    const token: string = req.headers["authorization"] as string;
    const origin: string = (req.headers["origin"] ||
      req.headers["referer"]) as string;
    const body = req.body;

    if (!type || !["sp", "so"].includes(type)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return;
    }

    const salesModel = getSalesModel(dbName);

    // if (type == "so" && !isSet(body.spId)) {
    //   res.status(400).json({ message: "sales proposal id is required" });
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
    const vendor = await getVendor(dbName, body.client, token, origin);
    if (!vendor.length) {
      res
        .status(400)
        .json({ success: false, message: "Client not found", data: [] });
      return;
    }

    const user = await getUser(dbName, body.rep, token, origin);
    if (!user.success) {
      res
        .status(400)
        .json({ success: false, message: "User not found", data: [] });
      return;
    }

    if (body.country && body.state && body.city) {
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
    }

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
      if (type == "so") {
        const result = await salesModel.aggregate([
          {
            $match: {
              _id: new mongoose.Types.ObjectId(body.spId),
              deletedAt: null,
              saleType: "so",
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
      }

      // if (type == "sp") {
      //   ppqty += item.quantity;
      // }

      receivedqty += item.quantity;

      if (!item.item || !item.condition) {
        res.status(400).json({
          success: false,
          message: `Missing field(s) in item at index ${index}`,
        });
        return;
      }

      const itemPromise = item.item
        ? getItemModel(dbName).findOne({
          _id: item.item,
          status: "Active",
          deletedAt: null,
        })
        : Promise.resolve(null);

      const manufacturerPromise = item.manufacturerId
        ? getManufacturerModel(dbName).findOne({
          _id: item.manufacturerId,
          // status: "active",
          deletedAt: null,
        })
        : Promise.resolve(null);

      const conditionPromise = item.condition
        ? getConditionModel(dbName).findOne({
          _id: item.condition,
          deletedAt: null,
        })
        : Promise.resolve(null);

      const warehousePromise = item.warehouseId
        ? getWarehouseModel(dbName, item.warehouseId, token, origin)
        : Promise.resolve(null);

      const [itemDoc, manufacturerDoc, conditionDoc, warehouseDoc] =
        await Promise.all([
          itemPromise,
          manufacturerPromise,
          conditionPromise,
          warehousePromise,
        ]);

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

    balanceqty = totalqty - receivedqty;

    // if (ppqty < body.serialNo.length) {
    //   res.status(400).json({
    //     success: false,
    //     message: "Serialnumber count is greater then item quantity",
    //   });
    //   return;
    // }

    // const salesCount = await salesModel.find({
    //   saleType: type,
    // });
    // const newCode = `${type === "sp" ? "sp" : "so"}-${salesCount.length + 1}`;
    const Counter = getCounterModel(dbName);

    const counter = await Counter.findOneAndUpdate(
      { type }, // type is 'sp' or 'so'
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    if (!counter) {
      res.status(500).json({
        success: false,
        message: `Failed to update counter for sale type '${type}'`,
      });
      return;
    }

    const seq = counter.seq.toString();
    const digits = counter.digits || 0;

    const paddedCode = seq.padStart(digits, "0"); // ✅ '0001', '0012', etc.

    // const serialNo = body.serialNo || [];

    delete body.serialNo;

    const salesData = {
      ...body,
      userId: req.user.id,
      //@ts-ignore
      companyId: req.company_id,
      saleType: type,
      sp: type === "sp" ? paddedCode : "-",
      so: type === "so" ? paddedCode : "-",
      // spId: body.spId,
    };

    const createdSale = await salesModel.create(salesData);

    res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: createdSale,
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const getAllSales = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const salesModel = await getSalesModel(dbName);
    const queryParams = req.query.type as string;

    if (!["sp", "so"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
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

    const filter: any = {
      deletedAt: null,
      saleType: queryParams,
    };

    if (queryParams === "sp") filter.isConverted = false;

    if (status !== "all") {
      filter.status = status;
      filter.isActive = true;
    }

    if (status === "inActive") {
      filter.isActive = false;
      delete filter.status;
    }

    const pipeline: any[] = [
      { $match: filter },
      {
        $lookup: {
          from: "customers",
          localField: "client",
          foreignField: "_id",
          as: "clientInfo",
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
        $unwind: { path: "$itemInfo", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "manufacturers",
          localField: "items.manufacturerId",
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
          localField: "items.warehouseId",
          foreignField: "_id",
          as: "warehouseInfo",
        },
      },
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          items: {
            $push: {
              lineNumber: "$items.lineNumber",
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
              saleCostCAD: "$items.saleCostCAD",
              saleCostUSD: "$items.saleCostUSD",
              saleExtendedCostCAD: "$items.saleExtendedCostCAD",
              saleExtendedCostUSD: "$items.saleExtendedCostUSD",
              serialNumber: "$items.serialNumber",
              condition: {
                id: { $arrayElemAt: ["$itemConditionInfo._id", 0] },
                name: { $arrayElemAt: ["$itemConditionInfo.name", 0] },
              },
              sn: "$items.sn",
              CLEI: "$items.CLEI",
              bulk: "$items.bulk",
              nonInventory: "$items.nonInventory",
              listPriceCAD: "$items.listPriceCAD",
              unitPriceCAD: "$items.unitPriceCAD",
              extendedPriceCAD: "$items.extendedPriceCAD",
              estUnitCostCAD: "$items.estUnitCostCAD",
              extCostCAD: "$items.extCostCAD",
              listPrice: "$items.listPrice",
              unitPrice: "$items.unitPrice",
              extendedPrice: "$items.extendedPrice",
              estUnitCost: "$items.estUnitCost",
              extCost: "$items.extCost",
              taxable: "$items.taxable",
              taxAuthority: "$items.taxAuthority",
              taxAuthorityPrice: "$items.taxAuthorityPrice",
              taxRate: "$items.taxRate",
              local1: "$items.local1",
              local2: "$items.local2",
              local3: "$items.local3",
              local4: "$items.local4",
              tax5: "$items.tax5",
              tax6: "$items.tax6",
              reference: "$items.reference",
              wareHouse: {
                id: { $arrayElemAt: ["$warehouseInfo._id", 0] },
                name: { $arrayElemAt: ["$warehouseInfo.name", 0] },
              },
              location: "$items.location",
              salesDistribution: "$items.salesDistribution",
              harmonizedSystem: "$items.harmonizedSystem",
              selectedInventoryId: "$items.selectedInventoryId",
              associatedItem: "$items.associatedItem",
              description: "$items.description",
              extendedDescription: "$items.extendedDescription",
              inventory: "$items.inventory",
              status: "$items.status",
              cost: "$items.cost",
              grossMargin: "$items.grossMargin",
              commissionCost: "$items.commissionCost",
              commissionPercentage: "$items.commissionPercentage",
              repSellerMargin: "$items.repSellerMargin",
              buyerMargin: "$items.buyerMargin",
              supplierMargin: "$items.supplierMargin",
              internalComments: "$items.internalComments",
              commentsToCustomer: "$items.commentsToCustomer",
            },
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$doc",
              {
                client: {
                  id: { $arrayElemAt: ["$doc.clientInfo._id", 0] },
                  name: { $arrayElemAt: ["$doc.clientInfo.companyName", 0] },
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
                tax: {
                  id: { $arrayElemAt: ["$doc.taxInfo._id", 0] },
                  name: { $arrayElemAt: ["$doc.taxInfo.name", 0] },
                  tax: { $arrayElemAt: ["$doc.taxInfo.tax", 0] },
                },
                items: "$items",
              },
            ],
          },
        },
      },
      {
        $unset: [
          "clientInfo",
          "repInfo",
          "taxInfo",
          "conditionInfo",
          "currencyInfo",
          "termsInfo",
          "itemInfo",
          "manufacturerInfo",
          "itemConditionInfo",
          "warehouseInfo",
        ],
      },
    ];

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "client.name": { $regex: new RegExp(search.toString(), "i") } },
            { [queryParams]: { $regex: new RegExp(search.toString(), "i") } },
          ],
        },
      });
    }

    pipeline.push({ $sort: { updatedAt: -1 } });
    if (disablePagination !== "true") {
      const skip = (Number(page) - 1) * Number(limit);
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: Number(limit) });
    }

    const sales = await salesModel.aggregate(pipeline);
    const total = await salesModel.countDocuments(filter);

    // const cityIds = new Set();
    // const stateIds = new Set();
    // const countryIds = new Set();
    const currencyIds = new Set();
    const itemCountryIds = new Set();

    sales.forEach((sale) => {
      // if (sale.city) cityIds.add(sale.city.toString());
      // if (sale.state) stateIds.add(sale.state.toString());
      // if (sale.country) countryIds.add(sale.country.toString());
      if (sale.currency) currencyIds.add(sale.currency.toString());
      sale.items?.forEach((item: any) => {
        if (item.item?.country)
          itemCountryIds.add(item.item.country.toString());
      });
    });

    const [locationRes, itemCountryRes] = await Promise.all([
      kongAxios({
        method: "post",
        url: "/user/public/locations/names/by-ids",
        data: {
          // cityIds: [...cityIds],
          // stateIds: [...stateIds],
          // countryIds: [...countryIds],
          currencyIds: [...currencyIds],
        },
      }),
      kongAxios({
        method: "post",
        url: "/user/public/locations/names/by-ids",
        data: {
          countryIds: [...itemCountryIds],
        },
      }),
    ]);

    const locationData = locationRes.data?.data || {};
    const itemCountryData = itemCountryRes.data?.data || {};

    const enrichedSales = sales.map((sale) => {
      sale.items.forEach((item: any) => {
        item.itemCountryName =
          itemCountryData.countryNames?.[item.item?.country?.toString()] ||
          null;
      });

      return {
        ...sale,
        // cityName: locationData.cityNames?.[sale.city?.toString()] || null,
        // stateName: locationData.stateNames?.[sale.state?.toString()] || null,
        // countryName:
        //   locationData.countryNames?.[sale.country?.toString()] || null,
        currencyName:
          locationData.currencies?.[sale.currency?.toString()] || null,
      };
    });

    res.status(200).json({
      success: true,
      message: "Sales fetched successfully",
      data: enrichedSales,
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

export const getSaleById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const salesModel = await getSalesModel(dbName);
    const id = req.params.id;
    const queryParams = req.query.type as string;

    if (!["sp", "so"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return;
    }

    const lookup: any = [];
    if (queryParams === "so") {
      lookup.push({
        $lookup: {
          from: "inventories",
          localField: "_id",
          foreignField: "soId",
          as: "inventoryInfo",
        },
      });
    }

    const pipeline: any[] = [
      {
        $match: {
          _id: new Types.ObjectId(id),
          deletedAt: null,
          saleType: queryParams,
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "client",
          foreignField: "_id",
          as: "clientInfo",
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
        $unwind: { path: "$itemInfo", preserveNullAndEmptyArrays: true },
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
          from: "currencies",
          localField: "currency",
          foreignField: "_id",
          as: "currencyInfo",
        },
      },
      {
        $lookup: {
          from: "warehouses",
          localField: "items.warehouseId",
          foreignField: "_id",
          as: "warehouseInfo",
        },
      },
      ...lookup,
      {
        $set: {
          inventoryInfo: {
            $function: {
              body: function (arr: any) {
                if (!Array.isArray(arr)) return [];
                return arr.sort((a: any, b: any) => {
                  const dateA = new Date(a.reservedAt).getTime();
                  const dateB = new Date(b.reservedAt).getTime();
                  return dateA - dateB;
                });
              },
              args: ["$inventoryInfo"],
              lang: "js",
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          items: {
            $push: {
              lineNumber: "$items.lineNumber",
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
              saleCostCAD: "$items.saleCostCAD",
              saleCostUSD: "$items.saleCostUSD",
              saleExtendedCostCAD: "$items.saleExtendedCostCAD",
              saleExtendedCostUSD: "$items.saleExtendedCostUSD",
              serialNumber: "$items.serialNumber",
              condition: {
                id: { $arrayElemAt: ["$itemConditionInfo._id", 0] },
                name: { $arrayElemAt: ["$itemConditionInfo.name", 0] },
              },
              location: "$items.location",
              status: "$items.status",
              wareHouse: {
                id: { $arrayElemAt: ["$warehouseInfo._id", 0] },
                name: { $arrayElemAt: ["$warehouseInfo.name", 0] },
              },
              CLEI: "$items.CLEI",
              bulk: "$items.bulk",
              nonInventory: "$items.nonInventory",
              listPriceCAD: "$items.listPriceCAD",
              unitPriceCAD: "$items.unitPriceCAD",
              extendedPriceCAD: "$items.extendedPriceCAD",
              estUnitCostCAD: "$items.estUnitCostCAD",
              extCostCAD: "$items.extCostCAD",
              listPrice: "$items.listPrice",
              unitPrice: "$items.unitPrice",
              extendedPrice: "$items.extendedPrice",
              estUnitCost: "$items.estUnitCost",
              extCost: "$items.extCost",
              taxable: "$items.taxable",
              taxAuthority: "$items.taxAuthority",
              taxAuthorityPrice: "$items.taxAuthorityPrice",
              taxRate: "$items.taxRate",
              local1: "$items.local1",
              local2: "$items.local2",
              local3: "$items.local3",
              local4: "$items.local4",
              tax5: "$items.tax5",
              tax6: "$items.tax6",
              reference: "$items.reference",
              salesDistribution: "$items.salesDistribution",
              harmonizedSystem: "$items.harmonizedSystem",
              selectedInventoryId: "$items.selectedInventoryId",
              associatedItem: "$items.associatedItem",
              description: "$items.description",
              extendedDescription: "$items.extendedDescription",
              cost: "$items.cost",
              grossMargin: "$items.grossMargin",
              commissionCost: "$items.commissionCost",
              commissionPercentage: "$items.commissionPercentage",
              repSellerMargin: "$items.repSellerMargin",
              buyerMargin: "$items.buyerMargin",
              supplierMargin: "$items.supplierMargin",
              internalComments: "$items.internalComments",
              commentsToCustomer: "$items.commentsToCustomer",
            },
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$doc",
              {
                client: {
                  id: { $arrayElemAt: ["$doc.clientInfo._id", 0] },
                  name: { $arrayElemAt: ["$doc.clientInfo.companyName", 0] },
                  email: { $arrayElemAt: ["$doc.clientInfo.email", 0] },
                  phone: { $arrayElemAt: ["$doc.clientInfo.phone", 0] },
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
                tax: {
                  id: { $arrayElemAt: ["$doc.taxInfo._id", 0] },
                  name: { $arrayElemAt: ["$doc.taxInfo.name", 0] },
                },
                currencyName: {
                  $arrayElemAt: ["$doc.currencyInfo.currency", 0],
                },
                items: "$items",
              },
            ],
          },
        },
      },
      {
        $unset: [
          "clientInfo",
          "repInfo",
          "taxInfo",
          "conditionInfo",
          "termsInfo",
          "itemInfo",
          "manufacturerInfo",
          "itemConditionInfo",
          "warehouseInfo",
          "currencyInfo",
        ],
      },
    ];

    const [result] = await salesModel.aggregate(pipeline);

    if (!result) {
      res.status(404).json({ success: false, message: "Sale not found" });
      return;
    }

    const itemCountry = result.items
      .map((item: any) => item.item.country)
      .filter((country: any) => country != null);

    const itemCountryData = await getCountry(itemCountry, result.currency);

    for (const item of result.items) {
      item.itemCountryName =
        item.item?.country &&
          itemCountryData?.data?.countryNames?.[item.item.country]
          ? itemCountryData.data.countryNames[item.item.country]
          : "";
    }

    result.currencyName = itemCountryData.success
      ? itemCountryData.data?.currencies[result.currency]
      : "";

    if (queryParams === "so") {
      result.items = mapItemsWithSerialNumbers(
        result.items,
        result.inventoryInfo,
        result._id
      );
      delete result.inventoryInfo;
    } else {
      delete result.inventoryInfo;
    }

    function mapItemsWithSerialNumbers(
      items: any[],
      inventoryInfo: any[],
      soId: string
    ) {
      const result: any[] = [];

      items.forEach((originalItem: any) => {
        const itemId = originalItem.item.id || originalItem.item;

        const matchedInventory = inventoryInfo.filter(
          (inv: any) =>
            inv.item?.toString() === itemId?.toString() &&
            inv.soId?.toString() === soId?.toString()
        );

        const reservedSerials = matchedInventory.filter((inv: any) =>
          Boolean(inv.serialNumber)
        );

        const reservedCount = reservedSerials.length;
        const totalQty = originalItem.quantity || 0;
        const unreservedQty = totalQty - reservedCount;

        if (unreservedQty > 0) {
          result.push({
            ...originalItem,
            quantity: unreservedQty,
            receivedStatus: "",
            serialNumber: "",
            status: "",
            inventoryId: "",
          });
        }

        reservedSerials.forEach((serial: any) => {
          result.push({
            ...originalItem,
            status: serial.status,
            quantity: 1,
            receivedStatus: serial.receivedStatus,
            inventoryId: serial._id,
            serialNumber: serial.serialNumber,
          });
        });
      });

      return result;
    }

    res.status(200).json({
      success: true,
      message: "Sale fetched successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSale = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const salesModel = getSalesModel(dbName);

    if (!req.params.id) {
      res.status(400).json({
        success: false,
        message: "Sale ID is required",
      });
      return;
    }

    const queryParams = req.query.type as string;
    if (!queryParams || !["sp", "so"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return;
    }

    const sale = await salesModel.findOne({
      _id: req.params.id,
      deletedAt: null,
      saleType: queryParams,
    });

    if (!sale) {
      res.status(404).json({
        success: false,
        message: "Sale not found",
      });
      return;
    }

    if (sale.isConverted) {
      res.status(400).json({
        success: false,
        message:
          "Editing is not allowed: this sale has already been converted to a Sales Order",
      });
      return;
    }

    const body = req.body;
    const token: string = req.headers["authorization"] as string;
    const origin: string = (req.headers["origin"] ||
      req.headers["referer"]) as string;

    // Parallel validation
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

    const vendor = await getVendor(dbName, body.client, token, origin);
    if (!vendor.length) {
      res
        .status(400)
        .json({ success: false, message: "Client not found", data: [] });
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
        message: "Country, state, or city data not found",
        data: [],
      });
      return;
    }
    if (!locations.data.countryNames) {
      res
        .status(400)
        .json({ success: false, message: "Country not found", data: [] });
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

    // const warehouseDoc = await getWarehouseModel(
    //   dbName,
    //   body.wareHouse,
    //   token,
    //   origin
    // );

    // if (!warehouseDoc.success) {
    //   res.status(400).json({ success: false, message: "Warehouse not found" });
    //   return;
    // }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "At least one item is required" });
      return;
    }
    let ppqty = 0;
    // Validate each item in parallel if needed
    for (const [index, item] of body.items.entries()) {
      if (!item.item || !item.condition) {
        res.status(400).json({
          success: false,
          message: `Missing field(s) in item at index ${index}`,
        });
        return;
      }

      ppqty += item.quantity;

      const itemPromise = item.item
        ? getItemModel(dbName).findOne({
          _id: item.item,
          status: "Active",
          deletedAt: null,
        })
        : Promise.resolve(null);

      const conditionPromise = item.condition
        ? getConditionModel(dbName).findOne({
          _id: item.condition,
          deletedAt: null,
        })
        : Promise.resolve(null);

      const warehousePromise = item.warehouseId
        ? getWarehouseModel(dbName, item.warehouseId, token, origin)
        : Promise.resolve(null);

      const [itemDoc, conditionDoc, warehouseDoc] = await Promise.all([
        itemPromise,
        conditionPromise,
        warehousePromise,
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
      if (!warehouseDoc.success) {
        res.status(400).json({
          success: false,
          message: `Warehouse not found at index ${index}`,
        });
        return;
      }
    }
    // ✅ Update
    const updateData = {
      ...body,
      userId: req.user.id,
      //@ts-ignore
      companyId: req.company_id,
      // spId: body.spId, // keep commented as in createSale
    };

    const updatedSale = await salesModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: "Sale updated successfully",
      data: updatedSale,
    });
  } catch (error) {
    next(error);
  }
};

export const convertSoSale = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const salesModel = getSalesModel(dbName);
    const saleId = req.params.id;

    if (!saleId) {
      res.status(400).json({
        success: false,
        message: "Sale ID is required",
      });
      return;
    }

    // Check if SO already exists for this proposal
    const existingSo = await salesModel.findOne({
      spId: new mongoose.Types.ObjectId(saleId),
      deletedAt: null,
      saleType: "so",
    });

    if (existingSo) {
      res.status(400).json({
        success: false,
        message: "This proposal has already been converted to a Sales Order.",
      });
      return;
    }

    // Find the sales proposal
    const salesProposal = await salesModel.findOne({
      _id: saleId,
      deletedAt: null,
      saleType: "sp",
    });

    if (!salesProposal) {
      res.status(404).json({
        success: false,
        message: "Sales proposal not found",
      });
      return;
    }

    // Generate new SO code
    const soCount = await salesModel.countDocuments({ saleType: "so" });
    const newCode = `so-${soCount + 1}`;

    // Prepare new SO object
    const newSalesData = {
      ...salesProposal.toObject(),
      _id: undefined, // let MongoDB generate new ID
      saleType: "so",
      so: newCode,
      spId: salesProposal._id,
    };

    const createdSo = await salesModel.create(newSalesData);

    // Mark original proposal as converted
    salesProposal.isConverted = true;
    salesProposal.status = "Closed";
    await salesProposal.save();

    res.status(201).json({
      success: true,
      message: "Sales Order created successfully",
      soNo: createdSo.so,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSale = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const salesModel = await getSalesModel(dbName);
    const queryParams = req.query.type as string;
    if (!["sp", "so"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return;
    }

    const sale = await salesModel.findOne({
      _id: req.params.id,
      deletedAt: null,
      saleType: queryParams,
    });

    if (!sale) {
      res.status(404).json({
        success: false,
        message: "Sale proposal not found",
      });
      return;
    } else {
      // Soft delete (recommended)
      sale.deletedAt = moment().toDate();
      await sale.save();

      res.status(201).json({
        success: true,
        message: "Sale proposal deleted successfully",
      });
    }
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
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const token: any = req.headers["authorization"];
    const origin: any = req.headers["origin"] || req.headers["referer"];
    const file = req.file as Express.Multer.File;
    const queryParam = req.query.type as string;

    if (!file) {
      throw createHttpError(
        400,
        "No file uploaded. Make sure to send it as 'file' field."
      );
    }

    if (!["sp", "so"].includes(queryParam)) {
      res
        .status(400)
        .json({ message: "Invalid or missing query param 'type'" });
      return;
    }

    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetNames = workbook.SheetNames;
    const groupedData = groupDataBySheetName(workbook, sheetNames);

    const SalesModel = getSalesModel(dbName);
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
        proposal.wareHouse,
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

        let sales = await SalesModel.find({ saleType: queryParam });

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

      const salesCount = await SalesModel.find({
        saleType: queryParam,
      });
      const newCode = `${queryParam === "sp" ? "sp" : "so"}-${salesCount.length + 1}`;

      const salesData = {
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

        //@ts-ignores
        companyId: req.companyId,
        saleType: queryParam,
        sp: queryParam === "sp" ? newCode : undefined,
        so: queryParam === "so" ? newCode : undefined,
      };

      bulkInsert.push(salesData);

      created.push({
        row: index + 1,
        vendor: proposal.vendor,
        validItemCount: items.length,
        skippedItems: invalidItems,
      });
    }

    if (bulkInsert.length) {
      await SalesModel.insertMany(bulkInsert);
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

export const sampleSaleXLSX = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const queryParam = req.query.type as string;

    if (!queryParam) {
      res.status(400).json({ message: "Missing query parameter 'type'" });
      return;
    }

    if (!["sp", "so"].includes(queryParam)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return;
    }

    let data: any = {};
    if (queryParam == "sp") {
      const { sampleData } = require("../config/sampleData-sp");
      data = sampleData;
    } else if (queryParam == "so") {
      const { sampleData } = require("../config/sampleData-so");
      data = sampleData;
    }

    /** 📄 Sheet 1: SalesProposal **/
    const salesSheet = workbook.addWorksheet("Sales");
    const salesRows = data.Sales || [];

    if (salesRows.length > 0) {
      const salesColumns = Object.keys(salesRows[0]).map((key) => ({
        header: key,
        key,
        width: 25,
      }));
      salesSheet.columns = salesColumns;
      salesRows.forEach((row: any) => salesSheet.addRow(row));
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
      `attachment; filename=sales-${queryParam}-sample-${Date.now()}.xlsx`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const exportAllSales = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const salesModel = await getSalesModel(dbName);
    const queryParams = req.query.type as string;

    if (!["sp", "so"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
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
      saleType: queryParams,
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
      {
        $lookup: {
          from: "warehouses",
          localField: "wareHouse",
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
              saleCostCAD: "$items.saleCostCAD",
              saleCostUSD: "$items.saleCostUSD",
              saleExtendedCostCAD: "$items.saleExtendedCostCAD",
              saleExtendedCostUSD: "$items.saleExtendedCostUSD",
              serialNumber: "$items.serialNumber",
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
          wareHouse: {
            id: { $arrayElemAt: ["$doc.warehouseInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.warehouseInfo.name", 0] },
          },
          shipDate: "$doc.shipDate",
          status: "$doc.status",
          receive: "$doc.receive",
          saleType: "$doc.saleType",
          sourcePP: "$doc.sourcePP",
          sourceSO: "$doc.sourceSO",
          billDistribution: "$doc.billDistribution",
          poType: "$doc.poType",
          erasureMethod: "$doc.erasureMethod",
          workflowTemplate: "$doc.workflowTemplate",
          serviceFee: "$doc.serviceFee",
          saleCostTemplate: "$doc.saleCostTemplate",
          supplierMargin: "$doc.supplierMargin",
          prePaid: "$doc.prePaid",
          extendedCost: "$doc.extendedCost",
          freight: "$doc.freight",
          extraCost: "$doc.extraCost",
          subTotal: "$doc.subTotal",
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

    const sales = await salesModel.aggregate(pipeline);
    const total = await salesModel.countDocuments(filter);

    const cityIds = new Set();
    const stateIds = new Set();
    const countryIds = new Set();
    const currencyIds = new Set();

    sales.forEach((sale) => {
      if (sale.city) cityIds.add(sale.city.toString());
      if (sale.state) stateIds.add(sale.state.toString());
      if (sale.country) countryIds.add(sale.country.toString());
      if (sale.currency) currencyIds.add(sale.currency.toString());
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

    const enrichedSales = sales.map((sale) => ({
      ...sale,
      cityName: locationData.cityNames?.[sale.city?.toString()] || null,
      stateName: locationData.stateNames?.[sale.state?.toString()] || null,
      countryName:
        locationData.countryNames?.[sale.country?.toString()] || null,
      currencyName:
        locationData.currencies?.[sale.currency?.toString()] || null,
    }));

    // inside try block in getAllSales controller...
    if (req.params.export === "excel") {
      const workbook = new ExcelJS.Workbook();

      // Sheet 1: Sales
      // Sales Sheet
      const salesSheet = workbook.addWorksheet("Sales");
      salesSheet.columns = [
        { header: "S.No", key: "sno", width: 10 },
        { header: "Sales ID", key: "_id", width: 25 },
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
      const salesSnoMap = new Map<string, number>(); // Map to store salesId -> sno

      enrichedSales.forEach((s) => {
        salesSnoMap.set(s._id.toString(), sno); // track S.No for reference in item sheet

        salesSheet.addRow({
          sno,
          _id: s._id,
          vendor: s.vendor?.name || "",
          date: new Date(s.date).toLocaleDateString(),
          status: s.status,
          total: s.total,
          subTotal: s.subTotal,
          vendorSO: s.vendorSO,
          shipDate: s.shipDate,
          cityName: s.cityName,
          stateName: s.stateName,
          countryName: s.countryName,
          currencyName: s.currencyName,
        });

        sno++;
      });
      // Items Sheet
      const itemSheet = workbook.addWorksheet("Items");
      itemSheet.columns = [
        { header: "Sales S.No", key: "salesSno", width: 12 },
        { header: "Sales ID", key: "salesId", width: 25 },
        { header: "Item ID", key: "itemId", width: 25 },
        { header: "Item Name", key: "itemName", width: 25 },
        { header: "Condition", key: "condition", width: 20 },
        { header: "Quantity", key: "quantity", width: 10 },
        { header: "Cost (CAD)", key: "saleCostCAD", width: 15 },
        { header: "Cost (USD)", key: "saleCostUSD", width: 15 },
        { header: "Extended (CAD)", key: "saleExtendedCostCAD", width: 20 },
        { header: "Extended (USD)", key: "saleExtendedCostUSD", width: 20 },
        { header: "Serial Number", key: "serialNumber", width: 20 },
      ];

      enrichedSales.forEach((sale) => {
        const salesSno = salesSnoMap.get(sale._id.toString()) || "";
        (sale.items || []).forEach(
          (item: {
            item: { id: any; itemName: any };
            condition: { name: any };
            quantity: any;
            saleCostCAD: any;
            saleCostUSD: any;
            saleExtendedCostCAD: any;
            saleExtendedCostUSD: any;
            serialNumber: any;
          }) => {
            itemSheet.addRow({
              salesSno,
              salesId: sale._id,
              itemId: item.item?.id || "",
              itemName: item.item?.itemName || "",
              condition: item.condition?.name || "",
              quantity: item.quantity,
              saleCostCAD: item.saleCostCAD,
              saleCostUSD: item.saleCostUSD,
              saleExtendedCostCAD: item.saleExtendedCostCAD,
              saleExtendedCostUSD: item.saleExtendedCostUSD,
              serialNumber: item.serialNumber,
            });
          }
        );
      });

      // Set headers
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=sales_${Date.now()}.xlsx`
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
      message: "Sales fetched successfully",
      data: enrichedSales,
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

export const statusUpdateSale = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const salesModel = getSalesModel(dbName);

    if (!req.params.id) {
      res.status(400).json({
        success: false,
        message: "Sale ID is required",
      });
      return;
    }

    const queryParams = req.query.type as string;
    if (!queryParams || !["sp", "so"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return;
    }

    const sale = await salesModel.findOne({
      _id: req.params.id,
      deletedAt: null,
      saleType: queryParams,
    });

    if (!sale) {
      res.status(404).json({
        success: false,
        message: "Sale not found",
      });
      return;
    }

    const status = "Voided";
    // ✅ Update
    const updateData = {
      status,
      voided: moment().toDate(),
    };

    const updatedSale = await salesModel.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Sale marked as voided successfully",
      data: updatedSale,
    });
  } catch (error) {
    next(error);
  }
};

export const updateComments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const salesModel = getSalesModel(dbName);
    const id = req.params.id;
    const { commentToVendor, internalComment } = req.body;

    const sale = await salesModel.findByIdAndUpdate(
      id,
      { commentToVendor, internalComment },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Comments updated successfully",
      data: sale,
    });
  } catch (err) {
    next(err);
  }
};

export const getInventory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const inventoryModel = getInventoryModel(dbName);
    const id = req.params.id;

    const inventory = await inventoryModel.find({
      item: id,
      status: "Received",
    });

    res.status(200).json({
      success: true,
      message: "Inventory fetched successfully",
      data: inventory,
    });
  } catch (err) {
    next(err);
  }
};

export const downloadSalePdf = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const salesModel = await getSalesModel(dbName);
    const id = req.params.id;
    const queryParams = req.query.type as string;

    if (!["sp", "so"].includes(queryParams)) {
      res.status(400).json({ message: "Invalid query parameter 'type'" });
      return;
    }

    const pipeline: any[] = [
      {
        $match: {
          _id: new Types.ObjectId(id),
          deletedAt: null,
          saleType: queryParams,
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "client",
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
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "company_id",
          as: "companyInfo",
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
              saleCostCAD: "$items.saleCostCAD",
              saleCostUSD: "$items.saleCostUSD",
              saleExtendedCostCAD: "$items.saleExtendedCostCAD",
              saleExtendedCostUSD: "$items.saleExtendedCostUSD",
              serialNumber: "$items.serialNumber",
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
          so: "$doc.so",
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
          company: {
            id: { $arrayElemAt: ["$doc.companyInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.companyInfo.name", 0] },
            workPhone: { $arrayElemAt: ["$doc.companyInfo.phoneNumber", 0] },
            email: { $arrayElemAt: ["$doc.companyInfo.email", 0] },
            address: { $arrayElemAt: ["$doc.companyInfo.address", 0] },
            // country: { $arrayElemAt: ["$doc.companyInfo.country", 0] },
            // state: { $arrayElemAt: ["$doc.companyInfo.state", 0] },
            // city: { $arrayElemAt: ["$doc.companyInfo.city", 0] },
            // zipcode: { $arrayElemAt: ["$doc.companyInfo.zipcode", 0] },
          },
          tax: {
            id: { $arrayElemAt: ["$doc.taxInfo._id", 0] },
            name: { $arrayElemAt: ["$doc.taxInfo.name", 0] },
          },
          status: "$doc.status",
          receive: "$doc.receive",
          saleType: "$doc.saleType",
          // extendedCost: "$doc.extendedCost",
          freight: "$doc.freight",
          extraCost: "$doc.extraCost",
          subTotal: "$doc.subTotal",
          total: "$doc.total",
          items: "$items",
          deletedAt: "$doc.deletedAt",
          createdAt: "$doc.createdAt",
          updatedAt: "$doc.updatedAt",
        },
      },
    ];

    const [result] = await salesModel.aggregate(pipeline);

    if (!result) {
      res.status(404).json({ success: false, message: "Sale not found" });
      return;
    }

    // getLocation enrichment
    const city = result.city;
    const state = result.state;
    const country = result.country;

    // const warehousecity = result.wareHouse.city;
    // const warehousestate = result.wareHouse.state;
    // const warehousecountry = result.wareHouse.country;

    const locationData = await getLocation(country, state, city);
    // const warehouselocationData = await getLocation(
    //   warehousecountry,
    //   warehousestate,
    //   warehousecity
    // );

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
    const html = generateFullSaleInvoiceHtml(result); // See below for this helper

    const pdfBuffer = await generatePdfBufferFromHtml(html);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.vendorSO}.pdf"`,
    });

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};
