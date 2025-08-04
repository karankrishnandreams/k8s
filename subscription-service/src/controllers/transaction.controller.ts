import { Request, Response, NextFunction } from "express";
import moment from "moment";
import { getDbConnection } from "@config/database";
import logger from "@utils/logger";
import transactionSchema from "@models/transaction.model";
import { paginate, paginateAggregate } from "@utils/paginate";
import subscriptionSchema from "@models/subscription.model";
import {
  generateExcelDownload,
  generateInvoiceHtml,
  generatePdfBufferFromHtml,
  generatePdfDownload,
} from "@utils/export.utils";
import { getS3Parallel } from "@utils/auth.utils";
import createHttpError from "http-errors";
import mongoose from "mongoose";

const db_Name = process.env.DB_NAME;

export const listTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      search,
      status,
      payment_method,
    } = req.query;

    const db = await getDbConnection(dbName);
    const TransactionModel =
      db.models.Transaction || db.model("Transaction", transactionSchema);
    const filter: any = { deletedAt: null };

    const now = moment(); // current time reference
    let finalSortBy: string = sortBy.toString();
    let finalOrder: "asc" | "desc" =
      order?.toString().toLowerCase() === "asc" ? "asc" : "desc";

    // Handle special sortBy values
    if (sortBy === "last_7_days") {
      filter.createdAt = {
        $gte: now.clone().subtract(7, "days").startOf("day").toDate(),
      };
      finalSortBy = "createdAt";
      finalOrder = "desc";
    } else if (sortBy === "last_month") {
      const startOfLastMonth = moment()
        .utc()
        .subtract(1, "month")
        .startOf("month")
        .toDate();
      const endOfLastMonth = moment()
        .utc()
        .subtract(1, "month")
        .endOf("month")
        .toDate();

      filter.createdAt = {
        $gte: startOfLastMonth,
        $lte: endOfLastMonth,
      };
      finalSortBy = "createdAt";
      finalOrder = "desc";
    } else if (sortBy === "recently_added") {
      finalSortBy = "createdAt";
      finalOrder = "desc";
    } else if (sortBy === "ascending") {
      finalSortBy = "createdAt";
      finalOrder = "asc";
    } else if (sortBy === "descending") {
      finalSortBy = "createdAt";
      finalOrder = "desc";
    }

    if (status !== undefined && status.toString().toLowerCase() !== "all") {
      filter.status = status;
    }

    if (
      payment_method !== undefined &&
      payment_method.toString().toLowerCase() !== "all"
    ) {
      filter.payment_method = payment_method;
    }

    if (search) {
      const searchStr = search.toString().trim();
      const regex = new RegExp(searchStr, "i");
      const numeric = Number(searchStr);
      const isBoolean =
        searchStr.toLowerCase() === "true" ||
        searchStr.toLowerCase() === "false";
      const searchDate = moment(searchStr, ["DD MMM YYYY", "YYYY-MM-DD"], true);

      filter.$or = [
        { transaction_id: regex },
        { payment_status: regex },
        { payment_mode: regex },
        { currency: regex },
        { invoice_label: regex },
        { payment_method: regex },
      ];

      if (!isNaN(numeric)) {
        filter.$or.push({ amount_paid: numeric });
      }

      if (isBoolean) {
        filter.$or.push({ status: searchStr.toLowerCase() === "true" });
      }

      if (searchDate.isValid()) {
        const start = searchDate.startOf("day").toDate();
        const end = searchDate.endOf("day").toDate();
        filter.$or.push({ createdAt: { $gte: start, $lte: end } });
      }
    }

    const aggregationPipeline: any[] = [
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
    ];

    // If search contains company fields, add $match later
    const searchStr = search?.toString().trim();

    if (searchStr) {
      const regex = new RegExp(searchStr, "i");
      const numeric = Number(searchStr);
      const isBoolean =
        searchStr.toLowerCase() === "true" ||
        searchStr.toLowerCase() === "false";
      const searchDate = moment(searchStr, ["DD MMM YYYY", "YYYY-MM-DD"], true);

      filter.$or = [
        { payment_status: regex },
        { payment_mode: regex },
        { currency: regex },
        { invoice_label: regex },
        { payment_method: regex },
        { "company.name": regex },
        { "company.email": regex },
      ];

      if (!isNaN(numeric)) {
        filter.$or.push({ amount_paid: numeric });
      }

      if (isBoolean) {
        filter.$or.push({ status: searchStr.toLowerCase() === "true" });
      }

      if (searchDate.isValid()) {
        const start = searchDate.startOf("day").toDate();
        const end = searchDate.endOf("day").toDate();
        filter.$or.push({ createdAt: { $gte: start, $lte: end } });
      }

      aggregationPipeline.push({ $match: filter });
    } else {
      aggregationPipeline.unshift({ $match: filter }); // basic match without search
    }

    aggregationPipeline.push({
      $project: {
        invoiceId: 1,
        invoice_label: 1,
        type: 1,
        status: 1,
        amount: 1,
        currency: 1,
        paymentIntentId: 1,
        failureReason: 1,
        coupon_id: 1,
        coupon_percent_off: 1,
        coupon_amount_off: 1,
        coupon_duration: 1,
        coupon_valid: 1,
        transactionDetails: 1,
        payment_method: 1,
        createdAt: 1,
        updatedAt: 1,
        "company.name": 1,
        "company.email": 1,
        "company.profileImage": 1,
      },
    });

    const { data, pagination } = await paginateAggregate(
      TransactionModel,
      aggregationPipeline,
      {
        page: Number(page),
        limit: Number(limit),
        sortBy: finalSortBy,
        order: finalOrder,
      }
    );

    // Replace local S3 keys with signed URLs
    await Promise.all(
      data.map(async (item: any) => {
        const profileKey = item.company?.profileImage;
        if (profileKey) {
          try {
            const signedUrl = await getS3Parallel(profileKey);
            item.company.profileImage = signedUrl;
          } catch (err) {
            // Optional: log or skip, but don’t block the whole response
            console.warn(`Failed to get signed URL for ${profileKey}`, err);
          }
        }
      })
    );

    res.status(200).json({
      status: 200,
      message: "Transactions retrieved successfully",
      data,
      pagination,
      type: "array",
    });
  } catch (err) {
    logger.error("List Transactions function failed", err);
    next(err);
  }
};

export const transactionMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const db = await getDbConnection(dbName);
    const SubscriptionModel =
      db.models.Subscription || db.model("Subscription", subscriptionSchema);
    const TransactionModel =
      db.models.Transaction || db.model("Transaction", transactionSchema);

    // Filters
    const subscriptionFilter = { deletedAt: null, status: "active" };
    const transactionFilter = { deletedAt: null };

    // Perform parallel aggregation
    const [totalSubscriptions, totalTransactions] = await Promise.all([
      SubscriptionModel.countDocuments(subscriptionFilter),
      TransactionModel.aggregate([
        { $match: transactionFilter },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
      ]),
    ]);

    res.status(200).json({
      status: 200,
      message: "System metrics retrieved successfully",
      metrics: {
        totalSubscriptions,
        totalTransactions,
      },
    });
  } catch (err) {
    logger.error("System Metrics function failed", err);
    return next(err);
  }
};

export const listTransactionsExport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const exportFormat = (req.params.export || "").toLowerCase();

    const db = await getDbConnection(dbName);
    const TransactionModel =
      db.models.Transaction || db.model("Transaction", transactionSchema);

    const aggregationPipeline: any[] = [
      {
        $match: { deletedAt: null },
      },
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "_id",
          as: "company",
        },
      },
      {
        $unwind: {
          path: "$company",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          invoiceId: 1,
          invoice_label: 1,
          type: 1,
          status: 1,
          amount: 1,
          currency: 1,
          paymentIntentId: 1,
          failureReason: 1,
          coupon_id: 1,
          coupon_percent_off: 1,
          coupon_amount_off: 1,
          coupon_duration: 1,
          coupon_valid: 1,
          transactionDetails: 1,
          payment_method: 1,
          createdAt: 1,
          updatedAt: 1,
          "company.name": 1,
          "company.email": 1,
          "company.profileImage": 1,
        },
      },
    ];

    const data = await TransactionModel.aggregate(aggregationPipeline);
    if (!data.length) {
      throw createHttpError(404, "No transaction data found");
    }
    // Optional: Format or rename fields before export
    const exportData = data.map((item: any) => ({
      invoice_label: item.invoice_label,
      amount: item.amount,
      currency: item.currency,
      payment_method: item.payment_method,
      company_name: item.company?.name || "",
      company_email: item.company?.email || "",
      created_at: item.createdAt? moment(item.createdAt).format("MM/DD/YYYY")   : "",
    }));

    // Export logic
    if (exportFormat === "excel") {
      return await generateExcelDownload(res, exportData, "transactions");
    }

    if (exportFormat === "pdf") {
      return await generatePdfDownload(res, exportData, "transactions");
    }

    // Default JSON response
    res.status(200).json({
      status: 200,
      message: "Transactions retrieved successfully",
      data: exportData,
      type: "array",
    });
  } catch (err) {
    logger.error("List Transactions Export failed", err);
    return next(err);
  }
};

export const listTransactionsbyIdExport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const exportFormat = req.params.export || "pdf";
    const transactionId = req.params.id?.toString();

    const db = await getDbConnection(dbName);
    const TransactionModel =
      db.models.Transaction || db.model("Transaction", transactionSchema);

    const filter: any = { deletedAt: null };
    if (transactionId) {
      filter._id = transactionId;
    }

    const data = await TransactionModel.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Optional: Convert profileImage to S3 URL
    await Promise.all(
      data.map(async (item: any) => {
        const profileKey = item.company?.profileImage;
        if (profileKey) {
          try {
            const signedUrl = await getS3Parallel(profileKey);
            item.company.profileImage = signedUrl;
          } catch (err) {
            console.warn(`Failed to generate S3 URL for ${profileKey}`, err);
          }
        }
      })
    );

    // Export logic
    if (exportFormat === "excel") {
      await generateExcelDownload(res, data, "transaction");
      return;
    }

    if (exportFormat === "pdf") {
      await generatePdfDownload(res, data, "transaction");
      return;
    }

    // Default JSON response
    res.status(200).json({
      status: 200,
      message: "Transactions retrieved successfully",
      data,
      type: Array.isArray(data) ? "array" : "object",
    });
  } catch (err) {
    logger.error("List Transactions Export failed", err);
    return next(err);
  }
};

export const downloadTransactionPdf = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: transactionId } = req.params;
    const dbName = (req.headers["x-db-name"] as string) || db_Name;

    if (!dbName) throw createHttpError(400, "Database connection missing");

    const db = await getDbConnection(dbName);
    const Transaction = db.model("Transaction", transactionSchema);
    const objectId = new mongoose.Types.ObjectId(transactionId);

    const result = await Transaction.aggregate([
      { $match: { _id: objectId, deletedAt: null } },
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: "$company" },
      {
        $lookup: {
          from: "subscriptions",
          let: { companyId: "$companyId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$company_obj_id", "$$companyId"] },
                deletedAt: null,
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "subscription",
        },
      },
      { $unwind: "$subscription" },
      {
        $lookup: {
          from: "packages",
          localField: "subscription.package_id",
          foreignField: "_id",
          as: "packageData",
        },
      },
      { $unwind: "$packageData" },
      {
        $project: {
          invoice_label: 1,
          createdAt: 1,
          amount: 1,
          payment_method: 1,
          "company.name": 1,
          "company.email": 1,
          "subscription.billingCycle": 1,
          "subscription.createdAt": 1,
          "subscription.endDate": 1,
          "packageData.plan_name": 1,
          "packageData.plan_type": 1,
        },
      },
    ]);

    if (!result?.length) {
      throw createHttpError(404, "Transaction not found");
    }

    const t = result[0];
    const dataMap = {
      invoice_label: t.invoice_label || t._id.toString(),
      billed_date: moment(t.createdAt).format("DD MMM YYYY"),
      company_name: t.company?.name || "-",
      company_email: t.company?.email || "-",
      super_admin_name: "Super Admin",
      plan_name: t.packageData?.plan_name || "N/A",
      plan_type: t.packageData?.plan_type || "N/A",
      billing_cycle: `${t.subscription?.billingCycle || 30} Days`,
      created_date: moment(t.subscription?.createdAt).format("DD MMM YYYY"),
      expiry_date: moment(t.subscription?.endDate).format("DD MMM YYYY"),
      amount: `$${(t.amount || 0).toFixed(2)}`,
      payment_method: t.payment_method || "N/A",
      sub_total: `$${(t.amount || 0).toFixed(2)}`,
      tax: "$0.00",
      total: `$${(t.amount || 0).toFixed(2)}`,
    };

    // Load your HTML template
    const html = generateInvoiceHtml(dataMap); // See below for this helper

    const pdfBuffer = await generatePdfBufferFromHtml(html);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${dataMap.invoice_label}.pdf"`,
    });

    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};
