import { Request, Response, NextFunction } from "express";
import moment from "moment";
import logger from "@utils/logger";
import { getDbConnection } from "@config/database";
import { ISubscription } from "@interfaces/subscription.interface";
import subscriptionSchema from "@models/subscription.model";
import { getS3Parallel } from "@utils/auth.utils";
import { paginate } from "@utils/paginate";
import mongoose, { Model } from "mongoose";
import {
  generateExcelDownload,
  generatePdfBufferFromHtml,
  generatePdfDownload,
  generateSubscriptionHtml,
} from "@utils/export.utils";
import createHttpError from "http-errors";

const getSubscriptionModel = (dbName: string): Model<ISubscription> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Subscription ||
    connection.model<ISubscription>("Subscription", subscriptionSchema)
  );
};

const db_Name = process.env.DB_NAME;

export const listSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError("Database connection missing");

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      search,
      status,
      disablePagination,
      startDate,
      endDate,
      plan,
    } = req.query;

    const exportFormat = req.params.export;
    const Subscriptions = getSubscriptionModel(dbName);
    const filter: any = {};

    // Always show only active subscriptions unless deletedAt logic says otherwise
    if (!status || status === "all") {
      filter.deletedAt = null;
    }

    // === Status Filter ===
    if (status && status !== "all") {
      if (status === "Paid") {
        filter.status = "active";
        filter.deletedAt = null;
      } else if (status === "Unpaid") {
        filter.status = "inactive";
        filter.deletedAt = { $ne: null };
      }
    }

    // === Date Filter ===
    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = moment(startDate as string)
          .startOf("day")
          .toDate();
        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = moment(endDate as string)
          .endOf("day")
          .toDate();
        filter.createdAt.$lte = end;
      }
    } else if (sortBy === "last_7_days") {
      filter.createdAt = {
        $gte: moment().subtract(7, "days").startOf("day").toDate(),
      };
    } else if (sortBy === "last_month") {
      filter.createdAt = {
        $gte: moment().subtract(30, "days").startOf("day").toDate(),
        $lte: moment().endOf("day").toDate(),
      };
    }
    // === Plan Filter ===
    if (
      plan &&
      plan !== "all" &&
      mongoose.Types.ObjectId.isValid(plan as string)
    ) {
      filter.package_id = new mongoose.Types.ObjectId(plan as string);
    }

    // === Sort Logic ===
    let finalSortBy = "createdAt";
    let finalOrder = order === "asc" ? 1 : -1;

    switch (sortBy) {
      case "recently_added":
      case "descending":
        finalOrder = -1;
        break;
      case "ascending":
        finalOrder = 1;
        break;
    }

    // === Aggregation Pipeline Setup ===
    const aggregationPipeline: any[] = [
      { $match: filter },
      {
        $lookup: {
          from: "companies",
          localField: "company_obj_id",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "packages",
          localField: "package_id",
          foreignField: "_id",
          as: "package",
        },
      },
      { $unwind: { path: "$package", preserveNullAndEmptyArrays: true } },
    ];

    // === Search Filter applied AFTER lookups to include company/package fields ===
    if (search) {
      const searchStr = search.toString().trim();
      const regex = new RegExp(searchStr, "i");
      const numeric = Number(searchStr);
      const isBoolean =
        searchStr.toLowerCase() === "true" ||
        searchStr.toLowerCase() === "false";
      const searchDate = moment(searchStr, ["DD MMM YYYY", "YYYY-MM-DD"], true);

      const orConditions: any[] = [
        { subscription_id: regex },
        { customer_id: regex },
        { mode: regex },
        { payment_status: regex },
        { "company.name": regex },
        { "package.plan_name": regex },
      ];

      if (!isNaN(numeric)) {
        orConditions.push({ price: numeric });
      }

      if (isBoolean) {
        orConditions.push({ status: searchStr.toLowerCase() === "true" });
      }

      if (searchDate.isValid()) {
        const start = searchDate.startOf("day").toDate();
        const end = searchDate.endOf("day").toDate();
        orConditions.push({ createdAt: { $gte: start, $lte: end } });
      }

      aggregationPipeline.push({ $match: { $or: orConditions } });
    }
    // Continue pipeline with projection and sorting
    aggregationPipeline.push(
      {
        $project: {
          subscription_id: 1,
          customer_id: 1,
          mode: 1,
          status: 1,
          payment_status: 1,
          receipt_url: 1,
          subscriptionDate: 1,
          nextBillingDate: 1,
          createdAt: 1,
          updatedAt: 1,
          package_id: 1,
          price: 1,
          payment_method: 1,
          "company.name": 1,
          "company.email": 1,
          "company.phoneNumber": 1,
          "company.tenant_company_id": 1,
          "company.profileImage": 1,
          "package.plan_name": 1,
          "package.plan_type": 1,
          "package.price": 1,
        },
      },
      {
        $sort: { [finalSortBy]: finalOrder },
      }
    );

    // === S3 Signing Helper ===
    const processSignedUrls = async (data: any[]) =>
      await Promise.all(
        data.map(async (sub: any) => {
          let receiptUrl = sub.receipt_url;
          let profileImage = null;

          if (receiptUrl) {
            try {
              receiptUrl = await getS3Parallel(receiptUrl);
            } catch (err) {
              logger.warn("Failed to sign receipt URL", err);
            }
          }

          if (sub.company?.profileImage) {
            try {
              profileImage = await getS3Parallel(sub.company.profileImage);
            } catch (err) {
              logger.warn("Failed to sign profile image URL", err);
            }
          }

          return {
            ...sub,
            receipt_url: receiptUrl,
            company: sub.company ? { ...sub.company, profileImage } : undefined,
          };
        })
      );

    // === Export without Pagination ===
    if (disablePagination === "true") {
      const allData = await Subscriptions.aggregate(aggregationPipeline);
      const signedData = await processSignedUrls(allData);

      if (exportFormat === "excel") {
        const buffer = await generateExcelDownload(res, signedData);
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=subscriptions.xlsx"
        );
        res.send(buffer);
        return;
      }

      if (exportFormat === "pdf") {
        if (!signedData.length) {
          throw createHttpError(404, "No data to export as PDF");
        }

        const buffer = await generatePdfDownload(res, signedData);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=subscriptions.pdf"
        );
        res.send(buffer);
        return;
      }

      res.status(200).json({
        status: 200,
        message: "All subscriptions retrieved successfully",
        data: signedData,
        type: "array",
      });
      return;
    }

    // === Pagination ===
    const skip = (Number(page) - 1) * Number(limit);
    const paginatedPipeline = [
      ...aggregationPipeline,
      { $skip: skip },
      { $limit: Number(limit) },
    ];

    const [data, totalCount] = await Promise.all([
      Subscriptions.aggregate(paginatedPipeline),
      Subscriptions.countDocuments(filter),
    ]);

    const signedData = await processSignedUrls(data);

    res.status(200).json({
      status: 200,
      message: "Subscriptions retrieved successfully",
      data: signedData,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalRecords: totalCount,
      },
      type: "array",
    });
    return;
  } catch (err) {
    logger.error("List Subscriptions function failed", err);
    next(err);
  }
};

export const subscriptionMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const baseFilter = { deletedAt: null };

    const SubscriptionModel = getSubscriptionModel(dbName);

    // Aggregating revenue
    const revenueAgg = await SubscriptionModel.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ["$price", 0] } },
        },
      },
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;

    const [
      totalSubscriptions,
      activeSubscriptions,
      expiredSubscriptions,
      trialCount,
      paidCount,
      manualCount,
    ] = await Promise.all([
      SubscriptionModel.countDocuments(baseFilter),
      SubscriptionModel.countDocuments({ ...baseFilter, status: "active" }),
      SubscriptionModel.countDocuments({
        ...baseFilter,
        status: { $in: ["canceled", "unpaid", "incomplete_expired"] },
      }),
      SubscriptionModel.countDocuments({ ...baseFilter, mode: "trial" }),
      SubscriptionModel.countDocuments({ ...baseFilter, mode: "subscription" }),
      SubscriptionModel.countDocuments({ ...baseFilter, mode: "manual" }),
    ]);

    res.status(200).json({
      status: 200,
      message: "Subscription metrics retrieved successfully",
      metrics: {
        totalSubscriptions,
        activeSubscriptions,
        expiredSubscriptions,
        trialSubscriptions: trialCount,
        paidSubscriptions: paidCount,
        manualSubscriptions: manualCount,
        totalRevenue,
      },
    });
  } catch (err) {
    logger.error("Subscription Metrics function failed", err);
    next(err);
  }
};

export const exportAllSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const fileType = req.params.export === "pdf" ? "pdf" : "excel";

    const Subscriptions = getSubscriptionModel(dbName);
    const matchCondition: any = { deletedAt: null };

    const data = await Subscriptions.aggregate([
      { $match: matchCondition },
      {
        $lookup: {
          from: "companies",
          localField: "company_obj_id",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "packages",
          localField: "company.package_id",
          foreignField: "_id",
          as: "package",
        },
      },
      { $unwind: { path: "$package", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          subscription_id: 1,
          customer_id: 1,
          mode: 1,
          status: 1,
          payment_status: 1,
          receipt_url: 1,
          subscriptionDate: 1,
          nextBillingDate: 1,
          createdAt: 1,
          updatedAt: 1,
          payment_method: 1,

          company_name: "$company.name",
          company_email: "$company.email",
          company_phone: "$company.phoneNumber",
          company_id: "$company.tenant_company_id",

          package_name: "$package.plan_name",
          package_type: "$package.plan_type",
          package_price: "$package.price",
        },
      },
    ]);

    if (!data.length) {
      throw createHttpError(404, "No subscription(s) found");
    }
    const exportData = data.map((item: any) => ({
      company_name: item.company_name || "",
      company_email: item.company_email || "",
      package_name: item.package_name || "",
      package_type: item.package_type || "",
      subscriptionDate: item.subscriptionDate
        ? moment(item.subscriptionDate).format("MM/DD/YYYY")
        : "",
      nextBillingDate: item.nextBillingDate
        ? moment(item.nextBillingDate).format("MM/DD/YYYY")
        : "",
      price: item.package_price || 0,
      payment_method: item.payment_method || "",
    }));
    if (fileType === "pdf") {
      return await generatePdfDownload(res, exportData, "all_subscriptions");
    } else {
      return await generateExcelDownload(res, exportData, "all_subscriptions");
    }
  } catch (err) {
    logger.error("Export all subscriptions failed", err);
    next(err);
  }
};

export const exportSingleSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const fileType = req.params.export === "pdf" ? "pdf" : "excel";
    const id = req.params.id as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw createHttpError(400, "Invalid subscription ID");
    }

    const Subscriptions = getSubscriptionModel(dbName);

    const data = await Subscriptions.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id), deletedAt: null } },
      {
        $lookup: {
          from: "companies",
          localField: "company_obj_id",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "packages",
          localField: "company.package_id",
          foreignField: "_id",
          as: "package",
        },
      },
      { $unwind: { path: "$package", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          subscription_id: 1,
          customer_id: 1,
          mode: 1,
          status: 1,
          payment_status: 1,
          receipt_url: 1,
          subscriptionDate: 1,
          nextBillingDate: 1,
          createdAt: 1,
          updatedAt: 1,
          payment_method: 1,
          "company.name": 1,
          "company.email": 1,
          "company.phoneNumber": 1,
          "company.profileImage": 1,
          "company.tenant_company_id": 1,
          "package.plan_name": 1,
          "package.plan_type": 1,
          "package.price": 1,
        },
      },
    ]);

    if (!data.length) {
      throw createHttpError(404, "Subscription not found");
    }

    if (fileType === "pdf") {
      return await generatePdfDownload(res, data, "single subscription");
    } else {
      return await generateExcelDownload(res, data, "single subscription");
    }
  } catch (err) {
    logger.error("Export single subscription failed", err);
    next(err);
  }
};

export const viewSubscriptionInvoiceHtml = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: subscriptionId } = req.params;
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const db = await getDbConnection(dbName);
    const Subscription = db.model("Subscription", subscriptionSchema);

    const objectId = new mongoose.Types.ObjectId(subscriptionId);

    const result = await Subscription.aggregate([
      { $match: { _id: objectId, deletedAt: null } },

      // Company lookup
      {
        $lookup: {
          from: "companies",
          localField: "company_obj_id",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },

      // Package lookup
      {
        $lookup: {
          from: "packages",
          localField: "package_id",
          foreignField: "_id",
          as: "packageData",
        },
      },
      { $unwind: { path: "$packageData", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          _id: 1,
          createdAt: 1,
          nextBillingDate: 1,
          payment_method: 1,
          price: 1,
          "company.name": 1,
          "company.email": 1,
          "packageData.plan_name": 1,
          "packageData.plan_type": 1,
          "packageData.price": 1,
          "packageData.plan_currency": 1,
          "packageData.interval_count": 1,
        },
      },
    ]);

    if (!result || !result[0]) {
      throw createHttpError(404, "Subscription not found");
    }

    const s = result[0];

    const dataMap = {
      billed_date: moment(s.createdAt).format("DD MMM YYYY"),
      company_name: s.company?.name || "-",
      company_email: s.company?.email || "-",
      super_admin_name: "Super Admin",
      plan_name: s.packageData?.plan_name || "N/A",
      billing_cycle: `${s.packageData?.interval_count || 1} ${s.packageData?.plan_type || "month"}(s)`,
      created_date: moment(s.createdAt).format("DD MMM YYYY"),
      expiry_date: moment(s.nextBillingDate).format("DD MMM YYYY"),
      amount: `$${(s.packageData?.price || 0)}`,
      payment_method: s.payment_method || "N/A",
      sub_total: `$${(s.packageData?.price || 0)}`,
      tax: "$0.00",
      total: `$${(s.packageData?.price || 0)}`,
    };

    // Load your HTML template
    const html = generateSubscriptionHtml(dataMap);
    const pdfBuffer = await generatePdfBufferFromHtml(html);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Transaction.pdf"`,
    });

    res.send(pdfBuffer);
  } catch (error) {
    logger.error("Error generating subscription invoice HTML", error);
    next(error);
  }
};
