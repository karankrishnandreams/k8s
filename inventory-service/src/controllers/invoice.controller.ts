import { NextFunction, Request, Response } from "express";
import { Model, Types } from "mongoose";
import { getDbConnection } from "@config/database";
import createHttpError from "http-errors";
import logger from "@utils/logger";
import { IInvoice } from "@interfaces/invoice.interface";
import { ITerm } from "@interfaces/term.interface";
import InvoiceSchema from "@models/invoice.model";
import TermSchema from "@models/term.model";
import mongoose from "mongoose";
import { generateInvoiceNumber } from "@utils/invoice.utils";
import PurchaseSchema from "@models/purchase.model";
import { IPurchase } from "@interfaces/purchase.interface";
import { ICounter } from "@interfaces/counter.interface";
import CounterSchema from "@models/counter.model";
import { ISales } from "@interfaces/sales.interface";
import SalesSchema from "@models/sales.model";
import { IInventory } from "@interfaces/inventory.interface";
import InventorySchema from "@models/inventory.model";
import kongAxios from "@services/kong.service";
import {
  generatePdfBufferFromHtml,
  generateSaleInvoiceHtml,
} from "@utils/export.utils";
import FormData from "form-data";
import { Buffer } from "buffer";
import axios from "axios";
import moment from "moment";

const db_Name = process.env.DB_NAME;

const getInvoiceModel = (dbName: string): Model<IInvoice> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Invoice ||
    connection.model<IInvoice>("Invoice", InvoiceSchema)
  );
};

export const getTermModel = (dbName: string): Model<ITerm> => {
  const connection = getDbConnection(dbName);
  return connection.model<ITerm>("Term", TermSchema as any);
};

const getPurchaseModel = (dbName: string): Model<IPurchase> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Purchase ||
    connection.model<IPurchase>("Purchase", PurchaseSchema)
  );
};

const getCounterModel = (dbName: string): Model<ICounter> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Counter ||
    connection.model<ICounter>("counters", CounterSchema)
  );
};

const getSalesModel = (dbName: string): Model<ISales> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Sale || connection.model<ISales>("Sale", SalesSchema)
  );
};

const getInventoryModel = (dbName: string): Model<IInventory> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.inventory ||
    connection.model<IInventory>("Inventory", InventorySchema)
  );
};

const validateReferencedIdsExist = async (
  data: any,
  validations: { field: string; model: mongoose.Model<any>; label?: string }[]
) => {
  for (const { field, model, label } of validations) {
    const value = data[field];
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
      throw createHttpError(400, `Invalid ObjectId for ${label || field}`);
    }
    const exists = await model.exists({ _id: value });
    if (!exists) {
      throw createHttpError(404, `${label || field} not found`);
    }
  }
};

export const getCountryNameMap = async (
  countryIds: string[]
): Promise<Record<string, string>> => {
  try {
    console.log("countryIds -----", countryIds);
    const response = await kongAxios.post(
      "/user/public/locations/country/name",
      {
        ids: countryIds,
      }
    );

    const countries = response.data?.data || [];

    const countryMap: Record<string, string> = {};
    for (const country of countries) {
      countryMap[country._id] = country.currency;
    }
    console.log("countryMap -----", countryMap);

    return countryMap;
  } catch (error) {
    console.error("Error fetching country names:", error);
    return {}; // Return empty if request fails
  }
};

const sendEmail = async (
  dbName: string,
  token: string,
  origin: string,
  to: string,
  subject: string,
  htmlContent: string,
  attachmentBuffer: Buffer,
  filename: string = "invoice.pdf"
): Promise<any> => {
  try {
    const form = new FormData();

    // ✅ Send the JSON body under `data` key
    form.append(
      "data",
      JSON.stringify({
        from: "", // backend will fill using logged-in user
        to,
        subject,
        html: htmlContent,
        text: "", // optional plain text fallback
        cc: "",
        bcc: "",
      })
    );

    // ✅ Attach PDF buffer
    form.append("attachments", attachmentBuffer, {
      filename,
      contentType: "application/pdf",
    });

    console.log('form ----------', form);

    const response = await axios.post(
      `${process.env.KONG_BASE_URL}/email/email/send`, // ⬅️ Replace with actual URL
      form,
      {
        headers: {
          ...form.getHeaders(),
          "x-db-name": dbName,
          Authorization: token,
          Origin: origin,
        },
        maxBodyLength: Infinity, // Important for file uploads
      }
    );

    return response.data;
  } catch (error: any) {
    console.error("Email send failed:", error.response?.data || error.message);
    return { success: false, error };
  }
};

export const convertToInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const { soid, inventoryIds, clientEmail } = req.body;
    const token: string = req.headers["authorization"] as string;
    const origin: string = (req.headers["origin"] ||
      req.headers["referer"]) as string;

    const InvoiceModel = getInvoiceModel(dbName);
    const SalesModel = getSalesModel(dbName);
    const Counter = getCounterModel(dbName);
    const InventoryModel = getInventoryModel(dbName);

    const itemIds = inventoryIds.map((inv: any) => inv.ids);

    // Fetch all inventory in one query
    const inventoryRecords = await InventoryModel.find({
      _id: { $in: itemIds },
    });

    // Validate each inventory record
    const invalidItems = [];
    for (const inv of inventoryIds) {
      const record: any = inventoryRecords.find(
        (item) => item._id.toString() === inv.ids
      );
      if (
        !record ||
        record.status !== "Reserved" ||
        record.receivedStatus !== "Received"
      ) {
        invalidItems.push(inv.ids);
      }
    }

    if (invalidItems.length > 0) {
      res.status(400).json({
        message: "Some inventory items are not valid for invoicing",
        invalidItems,
      });
      return;
    }

    // ✅ Update inventory salesStatus + invoicedPrice
    const bulkOps = inventoryIds.map((inv: any) => ({
      updateOne: {
        filter: { _id: inv.ids },
        update: {
          $set: {
            status: "Sold",
            receivedStatus: "Received",
            invoicedPrice: inv.amount, // Make sure this field exists in model
          },
        },
      },
    }));

    await InventoryModel.bulkWrite(bulkOps);

    // ✅ Create Invoice
    const salesOrder = await SalesModel.findById(soid);
    if (!salesOrder) {
      res.status(404).json({ message: "Sales order not found" });
      return;
    }

    const counter = await Counter.findOneAndUpdate(
      { type: "invoice" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const totalAmount = inventoryIds.reduce(
      (acc: number, curr: any) => acc + (curr.amount || 0),
      0
    );
    const now = moment().toDate();
    const promiseDate = salesOrder.promiseDate || now;

    const invoiceData = {
      invoiceNumber: counter.seq.toString(),
      clientId: salesOrder.client,
      clientSalesId: salesOrder._id,
      termsId: salesOrder.terms,
      currencyId: salesOrder.currency,
      invoiceDistripution: salesOrder.invoiceDistribution || "",
      type: salesOrder.saleType || "sale",
      fromSale: 1,
      amount: totalAmount,
      dept: 0,
      rep: salesOrder.rep,
      date: now,
      dueDate: promiseDate,
      due: promiseDate,
      voided: null,
      earlyInvoice: false,
      paid: new mongoose.Types.Decimal128("0"),
      paidinfull: new mongoose.Types.Decimal128("0"),
      baseAmount: new mongoose.Types.Decimal128(totalAmount.toString()),
      basePaid: new mongoose.Types.Decimal128("0"),
      baseDue: new mongoose.Types.Decimal128(totalAmount.toString()),
      itemId: inventoryIds.map((inv: any) => ({
        id: inv.ids,
        amount: inv.amount,
      })),
      subTotal: new mongoose.Types.Decimal128(totalAmount.toString()),
      tax: new mongoose.Types.Decimal128("0"),
      total: new mongoose.Types.Decimal128(totalAmount.toString()),
      CAD: new mongoose.Types.Decimal128("0"),
    };

    const invoice = new InvoiceModel(invoiceData);
    const savedInvoice = await invoice.save();

    // If your PDFBuffer returns something like { pdfBuffer, filename }
    const { pdfBuffer, filename } = await PDFBuffer(savedInvoice._id.toString(), dbName);

    // Use it like this:
    await sendEmail(
      dbName,
      token,
      origin,
      clientEmail,
      `Invoice #${savedInvoice.invoiceNumber}`,
      `<p>Attached is your invoice.</p>`,
      pdfBuffer, // <-- Must be a raw Buffer
      filename || `Invoice-${savedInvoice.invoiceNumber}.pdf`
    );

    res.status(201).json({
      message: "Invoice created successfully from Sales Order",
      data: savedInvoice,
    });
  } catch (error: any) {
    console.log('error ----', error);
    logger.error(error);
    res.status(error.status || 500).json({
      message: error.message || "Failed to convert sales order to invoice",
    });
  }
};

export const updateInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const invoiceId = req.params.id;
    const InvoiceModel = getInvoiceModel(dbName);
    const TermModel = getTermModel(dbName);
    const PurchaseModel = getPurchaseModel(dbName);

    // Validate referenced IDs
    await validateReferencedIdsExist(req.body, [
      { field: "termsId", model: TermModel, label: "Term" },
      { field: "clientPurchaseId", model: PurchaseModel, label: "Purchase" },
    ]);

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw createHttpError(404, "Invoice not found");

    Object.assign(invoice, req.body); // update fields
    invoice.updatedAt = moment().toDate();

    const updatedInvoice = await invoice.save();

    res.status(201).json({
      message: "Invoice updated successfully",
      data: updatedInvoice,
    });
  } catch (error: any) {
    logger.error(error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Error while updating invoice" });
  }
};

export const deleteInvoice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const invoiceId = req.params.id;
    const InvoiceModel = getInvoiceModel(dbName);

    const invoice = await InvoiceModel.findById(invoiceId);
    if (!invoice) throw createHttpError(404, "Invoice not found");

    invoice.deletedAt = moment().toDate();
    await invoice.save();

    res.status(201).json({ message: "Invoice deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getInvoiceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const invoiceId = req.params.id;

    const InvoiceModel = getInvoiceModel(dbName);

    const pipeline: any = [
      { $match: { _id: new mongoose.Types.ObjectId(invoiceId) } },

      // Lookup currency details
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

      // Lookup customer details
      {
        $lookup: {
          from: "customers",
          localField: "clientId",
          foreignField: "_id",
          as: "clientDetails",
        },
      },
      { $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true } },

      // Lookup terms details
      {
        $lookup: {
          from: "terms",
          localField: "termsId",
          foreignField: "_id",
          as: "termDetails",
        },
      },
      { $unwind: { path: "$termDetails", preserveNullAndEmptyArrays: true } },

      // Lookup rep (user) details
      {
        $lookup: {
          from: "users",
          localField: "rep",
          foreignField: "_id",
          as: "repDetails",
        },
      },
      { $unwind: { path: "$repDetails", preserveNullAndEmptyArrays: true } },

      // NEW: Lookup sales order to get the SO number
      {
        $lookup: {
          from: "sales",
          localField: "clientSalesId",
          foreignField: "_id",
          as: "salesDetails",
        },
      },
      { $unwind: { path: "$salesDetails", preserveNullAndEmptyArrays: true } },

      // Unwind itemId array for inventory lookup
      { $unwind: { path: "$itemId", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "inventories",
          let: { inventoryId: { $toObjectId: "$itemId.id" } },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$inventoryId"] } } },
            {
              // Nested lookup to get item name/details from 'items' collection
              $lookup: {
                from: "items",
                localField: "item",
                foreignField: "_id",
                as: "itemDetails",
              },
            },
            {
              $unwind: {
                path: "$itemDetails",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
          as: "itemId.inventoryDetails",
        },
      },
      {
        $unwind: {
          path: "$itemId.inventoryDetails",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Group back to reconstruct the invoice document with enriched itemId array
      {
        $group: {
          _id: "$_id",
          doc: { $first: "$$ROOT" },
          itemId: { $push: "$itemId" },
        },
      },
      {
        $addFields: {
          "doc.itemId": "$itemId",
          // Include SO number from salesDetails.so
          "doc.salesOrderNumber": "$doc.salesDetails.so",
        },
      },
      { $replaceRoot: { newRoot: "$doc" } },
    ];
    let invoice = await InvoiceModel.aggregate(pipeline);

    console.log("invoice ----", invoice);

    // After getting `result`
    const currencyIds: string[] = [
      ...new Set(invoice.map((doc: any) => doc.currencyId).filter(Boolean)),
    ];
    const countryMap = await getCountryNameMap(currencyIds);

    console.log("countryMap ----", countryMap);

    invoice = invoice.map((doc: any) => {
      const currencyId = doc.currencyId?.toString?.() || doc.currencyId;
      return {
        ...doc,
        currency: countryMap[currencyId] || null, // or defaultCurrency
      };
    });

    if (!invoice || invoice.length === 0) {
      console.warn(`[getInvoiceById] No invoice found for ID: ${invoiceId}`);
      throw createHttpError(404, "Invoice not found");
    }

    res.status(200).json({
      message: "Invoice retrieved successfully",
      data: invoice[0],
    });
  } catch (error) {
    res.status(500).json({ message: "Error while fetching invoice", error });
  }
};

export const listInvoices = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const InvoiceModel = getInvoiceModel(dbName);

    const {
      search,
      invoiceNumber,
      clientName,
      sortBy = "createdAt",
      order = "desc",
      page = 1,
      disablePagination = false,
      limit = 10,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy as string] = order === "asc" ? 1 : -1;

    const matchFilter: any = { deletedAt: null };

    const basePipeline: any[] = [
      { $match: matchFilter },

      // Lookup client
      {
        $lookup: {
          from: "customers",
          localField: "clientId",
          foreignField: "_id",
          as: "clientDetails",
        },
      },
      { $unwind: { path: "$clientDetails", preserveNullAndEmptyArrays: true } },

      // Lookup sales for SO number
      {
        $lookup: {
          from: "sales",
          localField: "clientSalesId",
          foreignField: "_id",
          as: "salesDetails",
        },
      },
      { $unwind: { path: "$salesDetails", preserveNullAndEmptyArrays: true } },

      // Lookup rep
      {
        $lookup: {
          from: "users",
          localField: "rep",
          foreignField: "_id",
          as: "repDetails",
        },
      },
      { $unwind: { path: "$repDetails", preserveNullAndEmptyArrays: true } },

      // Lookup currency
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

      // Add SO number directly
      {
        $addFields: {
          salesOrderNumber: "$salesDetails.so",
        },
      },
    ];

    // 🔍 Search across multiple fields
    if (search) {
      const regex = new RegExp(search.toString().trim(), "i");
      basePipeline.push({
        $match: {
          $or: [
            { invoiceNumber: regex },
            { "clientDetails.companyName": regex },
            { "salesDetails.so": regex },
          ],
        },
      });
    }

    // 🎯 Exact filters
    const exactMatch: any = {};
    if (invoiceNumber) {
      exactMatch.invoiceNumber = {
        $regex: invoiceNumber.toString().trim(),
        $options: "i",
      };
    }
    if (clientName) {
      exactMatch["clientDetails.companyName"] = {
        $regex: clientName.toString().trim(),
        $options: "i",
      };
    }

    if (Object.keys(exactMatch).length > 0) {
      basePipeline.push({ $match: exactMatch });
    }

    const finalPipeline = [...basePipeline, { $sort: sort }];

    // No pagination
    if (disablePagination === "true") {
      const allData = await InvoiceModel.aggregate(finalPipeline);
      res.status(200).json({
        message: "All invoices retrieved successfully",
        data: allData,
      });
      return;
    }

    // Add pagination
    finalPipeline.push({ $skip: skip }, { $limit: Number(limit) });

    let data = await InvoiceModel.aggregate(finalPipeline);

    // Count total with same filter
    const totalPipeline = [...basePipeline, { $count: "total" }];
    const totalResult = await InvoiceModel.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    console.log("total ----", data);

    // After getting `result`
    const currencyIds: string[] = [
      ...new Set(data.map((doc: any) => doc.currencyId).filter(Boolean)),
    ];
    const countryMap = await getCountryNameMap(currencyIds);

    console.log("countryMap ----", countryMap);

    data = data.map((doc: any) => {
      const currencyId = doc.currencyId?.toString?.() || doc.currencyId;
      return {
        ...doc,
        currency: countryMap[currencyId] || null, // or defaultCurrency
      };
    });

    res.status(200).json({
      message: "Invoices retrieved successfully",
      data,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ message: "Error while listing invoices", error });
  }
};

export const getNextInvoiceNumber = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const InvoiceModel = getInvoiceModel(dbName);
    const invoiceNumber = await generateInvoiceNumber(InvoiceModel);

    res.status(200).json({
      message: "Invoice number generated successfully",
      invoiceNumber,
    });
  } catch (error) {
    next(error);
  }
};

export const PDFBuffer = async (id: string, dbName: string) => {
  try {
    const invoiceModel = await getInvoiceModel(dbName);

    const pipeline: any[] = [
      {
        $match: {
          _id: new Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "clientId",
          foreignField: "_id",
          as: "clientInfo",
        },
      },
      {
        $lookup: {
          from: "currencies",
          localField: "currencyId",
          foreignField: "_id",
          as: "currencyInfo",
        },
      },
      {
        $lookup: {
          from: "terms",
          localField: "termsId",
          foreignField: "_id",
          as: "termsInfo",
        },
      },
      {
        $lookup: {
          from: "sales",
          localField: "clientSalesId",
          foreignField: "_id",
          as: "clientSalesInfo",
        },
      },
      {
        $lookup: {
          from: "companies",
          localField: "clientSalesInfo.companyId",
          foreignField: "_id",
          as: "companyInfo",
        },
      },
      // Lookup inventory info based on itemId[].id
      {
        $lookup: {
          from: "inventories",
          let: { inventoryIds: "$itemId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    "$_id",
                    {
                      $map: {
                        input: "$$inventoryIds",
                        as: "inv",
                        in: { $toObjectId: "$$inv.id" },
                      },
                    },
                  ],
                },
              },
            },
          ],
          as: "allInventoryInfo",
        },
      },
      // Lookup item info for inventories
      {
        $lookup: {
          from: "items",
          let: { itemIds: "$allInventoryInfo.item" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    "$_id",
                    {
                      $map: {
                        input: "$$itemIds",
                        as: "i",
                        in: "$$i",
                      },
                    },
                  ],
                },
              },
            },
          ],
          as: "allItemInfo",
        },
      },
      // Merge inventory and item info into itemId array
      {
        $addFields: {
          itemId: {
            $map: {
              input: "$itemId",
              as: "itemRef",
              in: {
                $let: {
                  vars: {
                    inventory: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$allInventoryInfo",
                            as: "inv",
                            cond: {
                              $eq: [
                                "$$inv._id",
                                { $toObjectId: "$$itemRef.id" },
                              ],
                            },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: {
                    $mergeObjects: [
                      "$$itemRef",
                      {
                        inventoryDetails: "$$inventory",
                        itemDetails: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$allItemInfo",
                                as: "itm",
                                cond: {
                                  $eq: ["$$itm._id", "$$inventory.item"],
                                },
                              },
                            },
                            0,
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          allInventoryInfo: 0,
          allItemInfo: 0,
        },
      },
    ];

    const [result] = await invoiceModel.aggregate(pipeline);

    if (!result) {
      throw new Error("Invoice not found");
    }
    // // Load your HTML template
    const html = generateSaleInvoiceHtml(result); // See below for this helper

    const pdfBuffer = await generatePdfBufferFromHtml(html);

    return {
      pdfBuffer,
      filename: `${result.invoiceNumber + "_invoice" || "invoice"}.pdf`,
    };
  } catch (error) {
    console.log("Error generating PDF buffer:", error);
    throw new Error("Failed to generate PDF");
  }
};

export const invoicePdf = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const id = req.params.id;
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const { pdfBuffer, filename } = await PDFBuffer(id, dbName);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.log("error ----", error);
    next(error);
  }
};
