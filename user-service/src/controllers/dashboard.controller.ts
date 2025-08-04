import { Request, Response, NextFunction } from "express";
import mongoose, { Model } from "mongoose";
import companySchema from "../models/company.model";
import subscriptionSchema from "../models/subscription.model";
import logger from "../utils/logger"; // Assuming you have a logger
import { getDbConnection } from "@config/database";
import { ICompany } from "@interfaces/company.interface";
import { ISubscription } from "@interfaces/subscription.interface";
import { ITransaction } from "@interfaces/transaction.interface";
import transactionSchema from "@models/transaction.model";
import moment from "moment";
import { getS3Parallel } from "@utils/auth.utils";
import { IUser } from "@interfaces/user.interface";
import UserSchema from "@models/user.model";
import { end } from "pdfkit";
import createHttpError from "http-errors";
import { ERROR_MESSAGE } from "@utils/message.constant";
import EmailTemplateSchema from "@models/emailtemplate.model";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";
import kongAxios from "@services/kong.service";

const getCompanyModel = (dbName: string): Model<ICompany> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Company ||
    connection.model<ICompany>("Company", companySchema)
  );
};

const getSubscriptionModel = (dbName: string): Model<ISubscription> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Subscription ||
    connection.model<ISubscription>("Subscription", subscriptionSchema)
  );
};

const getUserModel = (dbName: string): Model<IUser> => {
  const connection = getDbConnection(dbName);
  return connection.models.User || connection.model<IUser>("User", UserSchema);
};

const getTransactionModel = (dbName: string): Model<ITransaction> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Transaction ||
    connection.model<ITransaction>("Transaction", transactionSchema)
  );
};

const getEmailTemplateModel = (dbName: string): Model<IEmailTemplate> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.EmailTemplate ||
    connection.model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema)
  );
};

const db_Name = process.env.DB_NAME;

export const globalMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const CompanyModel = getCompanyModel(dbName);
    const SubscriptionModel = getSubscriptionModel(dbName);

    const {
      filterRange = "custom",
      startDate,
      endDate,
    } = req.query as {
      filterRange?: string;
      startDate?: string;
      endDate?: string;
    };

    // 🕓 Create date filter
    let dateFilter: any = {};
    const today = moment();

    switch (filterRange) {
      case "today":
        dateFilter = {
          createdAt: {
            $gte: today.clone().startOf("day").toDate(),
            $lte: today.clone().endOf("day").toDate(),
          },
        };
        break;

      case "yesterday":
        dateFilter = {
          createdAt: {
            $gte: today.clone().subtract(1, "day").startOf("day").toDate(),
            $lte: today.clone().subtract(1, "day").endOf("day").toDate(),
          },
        };
        break;

      case "last_7_days":
        dateFilter = {
          createdAt: {
            $gte: today.clone().subtract(6, "days").startOf("day").toDate(),
            $lte: today.clone().endOf("day").toDate(),
          },
        };
        break;

      case "last_30_days":
        dateFilter = {
          createdAt: {
            $gte: today.clone().subtract(29, "days").startOf("day").toDate(),
            $lte: today.clone().endOf("day").toDate(),
          },
        };
        break;

      case "this_month":
        dateFilter = {
          createdAt: {
            $gte: today.clone().startOf("month").toDate(),
            $lte: today.clone().endOf("month").toDate(),
          },
        };
        break;

      case "last_month":
        dateFilter = {
          createdAt: {
            $gte: today.clone().subtract(1, "month").startOf("month").toDate(),
            $lte: today.clone().subtract(1, "month").endOf("month").toDate(),
          },
        };
        break;

      case "custom":
        if (startDate && endDate) {
          dateFilter = {
            createdAt: {
              $gte: moment.utc(startDate).startOf("day").toDate(),
              $lte: moment.utc(endDate).endOf("day").toDate(),
            },
          };
        }
        break;
    }

    // 🟦 COMPANIES
    const companyFilter = { deletedAt: null, ...dateFilter };
    const companyStats = await CompanyModel.aggregate([
      { $match: companyFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    let totalCompanies = 0;
    let activeCompanies = 0;

    for (const stat of companyStats) {
      totalCompanies += stat.count;
      if (stat._id === "Active") {
        activeCompanies = stat.count;
      }
    }
    const activeCompaniesWithSub = await CompanyModel.countDocuments({
      deletedAt: null,
      status: "Active",
      subscriptionStartDate: { $ne: null },
      ...dateFilter,
    });

    // 🟦 SUBSCRIPTIONS
    const subscriptionFilter = {
      deletedAt: null,
      status: { $in: ["active", "trialing"] },
      ...dateFilter,
    };

    const totalSubscribers =
      await SubscriptionModel.countDocuments(subscriptionFilter);

    const earningsResult = await SubscriptionModel.aggregate([
      { $match: subscriptionFilter },
      {
        $group: {
          _id: null,
          total: { $sum: "$price" },
        },
      },
    ]);

    const totalEarnings = earningsResult[0]?.total || 0;

    res.status(200).json({
      status: 200,
      message: "Global metrics retrieved successfully",
      metrics: {
        totalCompanies,
        activeCompanies: activeCompaniesWithSub,
        totalSubscribers,
        totalEarnings,
      },
    });
  } catch (error) {
    logger.error("Global metrics retrieval failed", error);
    next(error);
  }
};

export const getRecentTransactions = async (req: Request, res: Response) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const db = await getDbConnection(dbName);

    const { startDate = null, endDate = null } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    let dateFilter: any = {};

    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: moment.utc(startDate).startOf("day").toDate(),
        $lte: moment.utc(endDate).endOf("day").toDate(),
      };
    }

    const TransactionModel = getTransactionModel(dbName);

    const transactions = await TransactionModel.aggregate([
      {
        $match: {
          deletedAt: null,
          ...dateFilter,
        },
      },
      {
        $sort: { createdAt: -1 }, // 🆕 Sort by latest
      },
      {
        $limit: 5, // 🆕 Limit to 10 results
      },
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "_id",
          as: "companyInfo",
        },
      },
      {
        $unwind: {
          path: "$companyInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "packages",
          localField: "companyInfo.package_id",
          foreignField: "_id",
          as: "packageInfo",
        },
      },
      {
        $unwind: {
          path: "$packageInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          amount: 1,
          type: 1,
          status: 1,
          createdAt: 1,
          invoice_label: 1,
          company_name: "$companyInfo.name",
          profile_image: "$companyInfo.profileImage",
          plan_name: "$packageInfo.plan_name",
          plan_type: "$packageInfo.plan_type",
        },
      },
    ]);

    // 🔁 Add S3 Signed URLs
    const finalResult = await Promise.all(
      transactions.map(async (txn) => {
        let signedUrl = null;
        if (txn.profile_image) {
          try {
            signedUrl = await getS3Parallel(txn.profile_image);
          } catch (err) {
            console.warn("S3 signing failed for:", txn.profile_image, err);
          }
        }
        return {
          ...txn,
          profile_image: signedUrl,
        };
      })
    );

    res.status(200).json({
      message: "Transactions with company and package info",
      data: finalResult,
    });
  } catch (err: any) {
    console.error("Error listing transactions:", err);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: err.message });
  }
};

export const getRecentTransactionsWithPackage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }
    const TransactionModel = getTransactionModel(dbName);
    const recentTransactionsWithPackage = await TransactionModel.aggregate([
      {
        $match: {
          deletedAt: null,
        },
      },
      {
        $lookup: {
          from: "companies",
          localField: "companyId",
          foreignField: "_id",
          as: "companyInfo",
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "packages", // actual packages collection name
          localField: "companyInfo.package_id", // note: using package_id from companyInfo now
          foreignField: "_id",
          as: "packageInfo",
        },
      },
      {
        $unwind: {
          path: "$packageInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $unwind: {
          path: "$companyInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          invoice_label: 1,
          type: 1,
          status: 1,
          amount: 1,
          currency: 1,
          createdAt: 1,
          "packageInfo.plan_name": 1,
          "packageInfo.plan_type": 1,
          "companyInfo.name": 1,
          "companyInfo.profileImage": 1,
        },
      },
    ]);

    const finalResult = await Promise.all(
      recentTransactionsWithPackage.map(async (txn) => {
        let signedUrl = null;
        if (txn.companyInfo?.profileImage) {
          try {
            signedUrl = await getS3Parallel(txn.companyInfo.profileImage);
          } catch (err) {
            console.warn(
              "S3 signing failed for:",
              txn.companyInfo.profileImage,
              err
            );
          }
        }
        return {
          ...txn,
          companyInfo: {
            ...txn.companyInfo,
            profileImage: signedUrl, // 🔍 Correctly override only profileImage here
          },
        };
      })
    );

    res.status(200).json({
      status: 200,
      message: "Recent transactions retrieved successfully",
      data: finalResult,
    });
  } catch (error) {
    console.error("Error fetching recent transactions:", error);
    next(error);
  }
};

export const getCompanyCounts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const CompanyModel = getCompanyModel(dbName);
    const type = (req.query.type as string) || "week";

    const validTypes = ["day", "week", "month", "year"];
    if (!validTypes.includes(type)) {
      throw createHttpError(
        400,
        "Invalid type. Must be day, week, month, or year."
      );
    }

    if (type === "day") {
      // Just send today's count
      const todayStart = moment().startOf("day").toDate();
      const todayEnd = moment().endOf("day").toDate();

      const todayCount = await CompanyModel.countDocuments({
        subscriptionStartDate: { $ne: null },
        createdAt: { $gte: todayStart, $lte: todayEnd },
        deletedAt: null,
      });

      res.status(200).json({
        message: "Company count for today",
        data: {
          today: todayCount,
        },
      });
    } else if (type === "week") {
      const startOfWeek = moment().startOf("isoWeek");

      // Generate each day of the current week (Monday to Sunday)
      const dailyRanges = Array.from({ length: 7 }).map((_, i) => {
        const day = startOfWeek.clone().add(i, "days");
        return {
          label: day.format("dddd"), // e.g., "Monday"
          start: day.clone().startOf("day").toDate(),
          end: day.clone().endOf("day").toDate(),
        };
      });

      const dailyCounts = await Promise.all(
        dailyRanges.map(({ start, end }) =>
          CompanyModel.countDocuments({
            subscriptionStartDate: { $ne: null },
            createdAt: { $gte: start, $lte: end },
            deletedAt: null,
          })
        )
      );

      res.status(200).json({
        message: "Company count per day for the current week",
        data: {
          week: dailyRanges.map((range, i) => ({
            day: range.label,
            count: dailyCounts[i],
          })),
        },
      });
      return;
    }

    // For week, month, year — proceed as before
    const unitMap: Record<
      string,
      {
        duration: moment.unitOfTime.DurationConstructor;
        startOf: moment.unitOfTime.StartOf;
      }
    > = {
      week: { duration: "weeks", startOf: "isoWeek" },
      month: { duration: "months", startOf: "month" },
      year: { duration: "years", startOf: "year" },
    };

    const { duration, startOf } = unitMap[type];

    const ranges = Array.from({ length: 7 }).map((_, i) => {
      const ref = moment().subtract(6 - i, duration);
      return {
        start: ref.clone().startOf(startOf).toDate(),
        end: ref.clone().endOf(startOf).toDate(),
      };
    });
    const counts = await Promise.all(
      ranges.map(({ start, end }) =>
        CompanyModel.countDocuments({
          subscriptionStartDate: { $ne: null },
          createdAt: { $gte: start, $lte: end },
          deletedAt: null,
        })
      )
    );

    res.status(200).json({
      message: `Company counts for last 7 ${type}s`,
      data: {
        company: counts,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getRevenueFromSubscriptions = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const Subscription = getSubscriptionModel(dbName);
    const plan_type = req.query.plan_type as "month" | "year" | undefined;

    const queryYear = parseInt(req.query.year as string);
    const year =
      !isNaN(queryYear) && queryYear > 1900 ? queryYear : moment().year();

    if (!year || isNaN(year)) {
      throw createHttpError(400, "Valid year query param is required");
    }

    const startOfYear = moment().year(year).startOf("year").toDate();
    const endOfYear = moment().year(year).endOf("year").toDate();

    const matchStage: any = {
      status: "active",
      deletedAt: null,
      subscriptionDate: { $gte: startOfYear, $lte: endOfYear },
    };
    if (plan_type) {
      matchStage.plan_type = plan_type;
    }

    const result = await Subscription.aggregate([
      { $match: matchStage },
      {
        $project: {
          month: { $month: "$subscriptionDate" },
          price: 1,
        },
      },
      {
        $group: {
          _id: "$month",
          totalRevenue: { $sum: "$price" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const incomeData = Array(12).fill(0);
    for (const doc of result) {
      incomeData[doc._id - 1] = Math.round(doc.totalRevenue * 100) / 100;
    }

    const expensesData = Array(12).fill(0);

    res.status(200).json({
      labels: moment.monthsShort(), // ['Jan', 'Feb', ..., 'Dec']
      series: [
        { name: "Income", data: incomeData },
        { name: "Expenses", data: expensesData },
      ],
    });
  } catch (err) {
    next(err);
  }
};

export const getRecentlyRegisteredCompanies = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }
    const { startDate = null, endDate = null } = req.query as {
      startDate?: string;
      endDate?: string;
    };

    let dateFilter: any = {};

    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: moment.utc(startDate).startOf("day").toDate(),
        $lte: moment.utc(endDate).endOf("day").toDate(),
      };
    }

    const CompanyModel = getCompanyModel(dbName);
    const companiesWithPackages = await CompanyModel.aggregate([
      {
        $match: {
          deletedAt: null,
          ...dateFilter,
          subscriptionStartDate: { $ne: null },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 5 },

      // Lookup subscription linked to this company
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "company_obj_id",
          as: "subscriptionInfo",
        },
      },
      {
        $unwind: {
          path: "$subscriptionInfo",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Lookup package based on subscription
      {
        $lookup: {
          from: "packages", // assuming your collection is named "pacakages"
          localField: "subscriptionInfo.package_id",
          foreignField: "_id",
          as: "packageInfo",
        },
      },
      { $unwind: { path: "$packageInfo", preserveNullAndEmptyArrays: true } },

      // Final projection
      {
        $project: {
          company_db_name: "$company_id",
          company_name: "$name",
          profile_image: "$profileImage",
          package_name: "$packageInfo.plan_name",
          plan_type: "$subscriptionInfo.plan_type", // "month" or "year"
        },
      },
    ]);

    // Append signed S3 URLs to profile_image
    // const enrichedResults = await Promise.all(
    //   companiesWithPackages.map(async (company: any) => {
    //     let signedUrl = null;
    //     if (company.profile_image) {
    //       try {
    //         signedUrl = await getS3Parallel(company.profile_image);
    //       } catch (err) {
    //         console.warn(
    //           `S3 URL generation failed for image: ${company.profile_image}`,
    //           err
    //         );
    //       }
    //     }

    //     return {
    //       ...company,
    //       profile_image: signedUrl,
    //     };
    //   })
    // );

    const enrichedResults = await Promise.all(
      companiesWithPackages.map(async (company: any) => {
        let signedUrl = null;
        let userCount = 0;

        if (company.profile_image) {
          try {
            signedUrl = await getS3Parallel(company.profile_image);
          } catch (err) {
            console.warn(
              `S3 URL generation failed for image: ${company.profile_image}`,
              err
            );
          }
        }

        try {
          // Get user count from each company's DB
          const UserModel = getUserModel(
            `${company.company_db_name}${process.env.DB_SUFFIX}`
          );
          userCount = await UserModel.countDocuments({ deletedAt: null });
        } catch (err) {
          console.warn(
            `Error fetching user count for company DB: ${company.company_db_name}`,
            err
          );
          userCount = -1;
        }

        return {
          ...company,
          profile_image: signedUrl,
          user_count: userCount, // added user count here
        };
      })
    );

    res.status(200).json({
      message: "Recently registered companies with package info",
      data: enrichedResults,
    });
  } catch (error: any) {
    console.error("Error fetching recently registered companies:", error);
    next(error);
  }
};

export const getRecentlyExpiredPlans = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const today = moment().toDate();

    const SubscriptionModel = getSubscriptionModel(dbName);

    const expiredPlans = await SubscriptionModel.aggregate([
      {
        $match: {
          deletedAt: null,
          status: { $ne: "active" },
          nextBillingDate: { $lt: today },
        },
      },
      {
        $lookup: {
          from: "companies",
          localField: "company_obj_id",
          foreignField: "_id",
          as: "companyInfo",
        },
      },
      {
        $unwind: {
          path: "$companyInfo",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $sort: {
          nextBillingDate: -1,
        },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          _id: 1,
          company_id: "$companyInfo._id",
          company_name: "$companyInfo.name",
          profile_image: "$companyInfo.profileImage",
          expired_date: "$nextBillingDate",
        },
      },
    ]);

    // Generate signed S3 URLs for each profile image
    const enrichedResults = await Promise.all(
      expiredPlans.map(async (plan) => {
        let signedUrl = null;
        if (plan.profile_image) {
          try {
            signedUrl = await getS3Parallel(plan.profile_image);
          } catch (err) {
            console.warn(
              `Error generating S3 URL for image: ${plan.profile_image}`,
              err
            );
          }
        }

        return {
          ...plan,
          profile_image: signedUrl,
        };
      })
    );

    res.status(200).json({
      message: "Recent expired plans",
      data: enrichedResults,
    });
  } catch (error: any) {
    console.error("Error fetching expired plans:", error);
    next(error);
  }
};

export const getTopPackages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const SubscriptionModel = getSubscriptionModel(dbName);
    const { filterRange, startDate, endDate } = req.query as {
      filterRange?: string;
      startDate?: string;
      endDate?: string;
    };

    // 📆 Date filter logic
    let dateFilter: any = {};
    const today = moment();

    switch (filterRange) {
      case "today":
        dateFilter.createdAt = {
          $gte: today.clone().startOf("day").toDate(),
          $lte: today.clone().endOf("day").toDate(),
        };
        break;

      case "month":
        dateFilter.createdAt = {
          $gte: today.clone().startOf("month").toDate(),
          $lte: today.clone().endOf("month").toDate(),
        };
        break;

      case "week":
        dateFilter.createdAt = {
          $gte: today.clone().startOf("week").toDate(),
          $lte: today.clone().endOf("week").toDate(),
        };
        break;
      default:
        dateFilter.createdAt = {
          $gte: moment.utc(startDate).startOf("day").toDate(),
          $lte: moment.utc(endDate).endOf("day").toDate(),
        };
        break;
    }

    const topPackages = await SubscriptionModel.aggregate([
      {
        $match: {
          deletedAt: null,
          status: "active",
          package_id: { $ne: null },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$package_id",
          subscriberCount: { $sum: 1 },
        },
      },
      {
        $sort: { subscriberCount: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "packages", // ✅ Ensure this matches the actual collection name
          localField: "_id",
          foreignField: "_id",
          as: "packageInfo",
        },
      },
      {
        $unwind: {
          path: "$packageInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $match: {
          "packageInfo.plan_name": { $ne: null }, // ✅ Only keep those with a valid package name
        },
      },
      {
        $project: {
          _id: 0,
          package_name: "$packageInfo.plan_name",
          subscriberCount: 1,
        },
      },
    ]);
    const colors = ["#FFC107", "#1B84FF", "#F26522", "#4CAF50", "#FF4C4C"];
    const series = topPackages.map((p) => p.subscriberCount);
    const labels = topPackages.map((p) => p.package_name);

    res.status(200).json({
      message: "Top packages by subscriptions",
      data: {
        colors: colors.slice(0, series.length),
        series,
        labels,
      },
    });
  } catch (error: any) {
    console.error("Error fetching top packages:", error);
    next(error);
  }
};

export const getDailySubscribersCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const SubscriptionModel = getSubscriptionModel(dbName);

    const todayStart = moment().startOf("day").toDate();
    const todayEnd = moment().endOf("day").toDate();

    const dailyCount = await SubscriptionModel.countDocuments({
      createdAt: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ["active", "trialing"] },
      deletedAt: null,
    });

    res.status(200).json({
      status: 200,
      message: "Daily subscribers count retrieved successfully",
      data: {
        date: moment().format("YYYY-MM-DD"),
        count: dailyCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const reminderEmailForExpiry = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) throw createHttpError(400, "Database connection missing");

    const id = req.params.id;

    const CompanyModel = getCompanyModel(dbName);
    const company = await CompanyModel.findById(id);
    if (!company) throw createHttpError(404, "Company not found");

    const email = company.email;
    const name = company.name;
    const accountUrl = company.account_url || "fusion";

    const EmailTemplate = getEmailTemplateModel(dbName);
    const template = await EmailTemplate.findOne({
      slug: "Subscription-expiry-mail",
      isActive: true,
    }).select("htmlBody -_id");

    if (!template) {
      logger.error("Subscription expiry email template not found");
      throw createHttpError(404, ERROR_MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
    }
        const frontendUrl =
      process.env.FRONTEND_URL || "fusion.dreamstechnologies.com";

    const htmlBody = template.htmlBody.replace(/{{companyName}}/g, name);

    const emailConfig = {
      method: "post",
      url: "/email/public/mail/send",
      data: {
        to: email,
        subject: "Your subscription is about to expire",
        htmlBody,
        message:
          "Please renew your subscription to continue using our services.",
        emailData: {
          company_name: name,
          expiry_date: new Date().toLocaleDateString(),
          account_link: `https://${accountUrl}.${frontendUrl}/package`,
        },
      },
    };

    await kongAxios(emailConfig);

    res.status(201).json({
      status: 200,
      message: "Reminder mail sent successfully",
    });
  } catch (error: any) {
    logger.error("reminderEmailForExpiry error:", error);
    if (error?.isAxiosError && error?.response) {
      const status = error.response.status || 502;
      const message =
        error.response.data?.error?.message || // typical structure
        error.response.data?.message || // fallback
        "External service error during company creation";

      return next(createHttpError(status, message));
    }

    if (error?.status && error?.message) {
      return next(error); // Already structured error
    }
    next(error);
  }
};
