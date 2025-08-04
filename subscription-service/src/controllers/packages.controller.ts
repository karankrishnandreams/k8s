import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { getDbConnection } from "../config/database";
import stripe from "@utils/stripe";
import { paginate } from "@utils/paginate";
import PackageSchema from "@models/package.model";
import moment from "moment";
import { getS3Parallel, uploadParallel } from "@utils/auth.utils";
import {
  generateExcelDownload,
  generatePdfDownload,
} from "@utils/export.utils";
import subscriptionSchema from "@models/subscription.model";
import mongoose, { Model } from "mongoose";
import { ISubscription } from "@interfaces/subscription.interface";
import transactionSchema from "@models/transaction.model";
import { ITransaction } from "@interfaces/transaction.interface";
import createHttpError from "http-errors";

// Helper to get tenant-aware User model
const getSubscriptionModel = (dbName: string): Model<ISubscription> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Subscription ||
    connection.model<ISubscription>("Subscription", subscriptionSchema)
  );
};

const getTransactionModel = (dbName: string): Model<ITransaction> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Transaction ||
    connection.model<ITransaction>("Transaction", transactionSchema)
  );
};

const db_Name = process.env.DB_NAME;

// export const createPackage = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const dbName = (req.headers["x-db-name"] as string) || dbName;
//     if (!dbName) {
//       res.status(400).json({ error: "Database connection missing" }); // <== RETURN to stop execution
//     }
//     logger.info("Create Package function started");

//     const db = await getDbConnection(dbName);
//     const PackageModel =
//       db.models.Package || db.model("Package", PackageSchema);

//     const bodyData = { ...req.body };

//     if (bodyData?.is_recommended) {
//       await PackageModel.updateMany({}, { is_recommended: false });
//     }

//     let discountType: "percent_off" | "amount_off" | undefined;
//     if (bodyData.discount_type === "percentage") discountType = "percent_off";
//     else if (bodyData.discount_type === "fixed") discountType = "amount_off";

//     if (discountType) {
//       const coupon = await stripe.coupons.create({
//         [discountType]:
//           discountType === "percent_off"
//             ? bodyData.discount
//             : bodyData.discount * 100,
//         ...(discountType === "amount_off" && { currency: "usd" }),
//         duration: "once",
//       });
//       bodyData.coupon_id = coupon.id;
//     }

//     const price = await stripe.prices.create({
//       currency: bodyData.plan_currency || "usd",
//       unit_amount: Math.round(bodyData.price * 100),
//       recurring: {
//         interval: bodyData.plan_type,
//         interval_count: bodyData.interval_count || 1,
//       },
//       product_data: {
//         name: bodyData.plan_name,
//       },
//       lookup_key: `plan_${Date.now()}`,
//     });

//     bodyData.stripe_product = price.product;
//     bodyData.pricing_id = price.id;
//     bodyData.unit_amount = price.unit_amount;
//     bodyData.unit_amount_decimal = price.unit_amount_decimal;
//     bodyData.stripe_json = JSON.stringify(price);

//     const session = await db.startSession();

//     let isReplicaSet = false;
//     if (db.db) {
//       const serverStatus = await db.db.admin().serverStatus();
//       isReplicaSet = !!serverStatus.repl;
//     }

//     try {
//       if (isReplicaSet) await session.startTransaction();

//       let newPosition = bodyData.plan_position;
//       if (!newPosition) {
//         const highestPlan = await PackageModel.findOne({ deletedAt: null })
//           .sort({ plan_position: -1 })
//           .select("plan_position")
//           .session(session);

//         newPosition = (highestPlan?.plan_position ?? 0) + 1;
//       } else {
//         await PackageModel.updateMany(
//           { plan_position: { $gte: newPosition }, deletedAt: null },
//           { $inc: { plan_position: 1 } },
//           { session }
//         );
//       }

//       bodyData.plan_position = newPosition;
//       const [data] = await PackageModel.create([bodyData], { session });

//       if (isReplicaSet) await session.commitTransaction();

//       logger.info("Package created successfully");

//       res.status(201).json({
//         status: 201,
//         message: "Package created successfully",
//         data,
//         type: "object",
//       });
//     } catch (err) {
//       if (isReplicaSet) await session.abortTransaction();
//       logger.error("Error during transaction", err);
//       return next(err);
//     } finally {
//       session.endSession();
//     }
//   } catch (err) {
//     logger.error("Create Package function failed", err);
//     return next(err);
//   }
// };

export const createPackage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }
    logger.info("Create Package function started");

    // Validate required fields
    if (req.body.price === undefined || req.body.plan_name === undefined) {
      throw createHttpError(400, "Missing required fields");
    }

    const db = await getDbConnection(dbName);
    const PackageModel: Model<any> =
      db.models.Package || db.model("Package", PackageSchema);
    const session = await db.startSession(); // <-- Move session creation after DB connection

    try {
      const bodyData = { ...req.body };

      // Reset recommended flag if needed
      if (bodyData?.is_recommended) {
        await PackageModel.updateMany({}, { is_recommended: false });
      }

      // Coupon creation
      if (bodyData.discount_type && bodyData.discount) {
        let discountType: "percent_off" | "amount_off";
        if (bodyData.discount_type === "percentage") {
          discountType = "percent_off";
        } else if (bodyData.discount_type === "fixed") {
          discountType = "amount_off";
        } else {
          throw createHttpError(400, "Invalid discount type");
        }

        try {
          const coupon = await stripe.coupons.create({
            [discountType]:
              discountType === "percent_off"
                ? bodyData.discount
                : bodyData.discount * 100,
            ...(discountType === "amount_off" && { currency: "usd" }),
            duration: "once",
          });
          bodyData.coupon_id = coupon.id;
        } catch (stripeError) {
          logger.error("Stripe coupon creation failed", stripeError);
          throw createHttpError(404, "Coupon creation failed");
        }
      }
      // Price creation
      try {
        const price = await stripe.prices.create({
          currency: bodyData.plan_currency || "usd",
          unit_amount: Math.round(bodyData.price * 100),
          recurring: {
            interval: bodyData.plan_type,
            interval_count: bodyData.interval_count || 1,
          },
          product_data: {
            name: bodyData.plan_name,
          },
          lookup_key: `plan_${Date.now()}`,
        });

        bodyData.stripe_product = price.product;
        bodyData.pricing_id = price.id;
        bodyData.unit_amount = price.unit_amount;
        bodyData.unit_amount_decimal = price.unit_amount_decimal;
        bodyData.stripe_json = JSON.stringify(price);
      } catch (stripeError) {
        logger.error("Stripe price creation failed", stripeError);
        throw createHttpError(404, "Price creation failed");
      }

      // Position management
      await session.withTransaction(async () => {
        let newPosition = bodyData.plan_position;

        if (!newPosition) {
          const highestPlan = await PackageModel.findOne({ deletedAt: null })
            .sort({ plan_position: -1 })
            .select("plan_position");
          newPosition = (highestPlan?.plan_position ?? 0) + 1;
        } else {
          await PackageModel.updateMany(
            { plan_position: { $gte: newPosition }, deletedAt: null },
            { $inc: { plan_position: 1 } }
          );
        }

        bodyData.plan_position = newPosition;
        const [data] = await PackageModel.create([bodyData]);

        logger.info("Package created successfully");
        res.status(201).json({
          status: 201,
          message: "Package created successfully",
          data,
          type: "object",
        });
      });
    } catch (err) {
      logger.error("Error in package creation", err);
      next(err);
    } finally {
      session.endSession();
    }
  } catch (err) {
    logger.error("Create Package function failed", err);
    next(err);
  }
};

export const createPlanImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;
    const planImageFile = files?.plan_image?.[0];

    if (!planImageFile || !Buffer.isBuffer(planImageFile.buffer)) {
      throw createHttpError(
        400,
        "Plan image is required and must be a valid file."
      );
    }

    const uploadedImageUrl = await uploadParallel(
      planImageFile,
      `${process.env.BUCKET_FOLDER}/plans/images`,
      res
    );

    res.status(201).json({
      status: 201,
      message: "Plan image uploaded successfully",
      imageUrl: uploadedImageUrl,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePackage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const { id } = req.params;
    const updateData = { ...req.body };

    logger.info("Update Package function started");
    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);
    const Subscriptions = getSubscriptionModel(dbName);

    if (updateData.status === false) {
      const hasActiveSubscription = await Subscriptions.findOne({
        package_id: id,
        status: "active",
        deletedAt: null,
      });

      if (hasActiveSubscription) {
        throw createHttpError(
          409,
          "Cannot deactivate package with active subscriptions"
        );
      }
    }

    const session = await db.startSession();
    let isReplicaSet = false;
    if (db.db) {
      const serverStatus = await db.db.admin().serverStatus();
      isReplicaSet = serverStatus.repl !== undefined;
    }

    try {
      if (isReplicaSet) await session.startTransaction();

      const currentPackage = await PackageModel.findById(id).session(session);
      if (!currentPackage) throw createHttpError(404, "Package not found");

      // 🔁 Handle plan_position shifting
      if (
        updateData.plan_position !== undefined &&
        updateData.plan_position !== currentPackage.plan_position
      ) {
        const oldPos = currentPackage.plan_position;
        const newPos = updateData.plan_position;

        if (newPos > oldPos) {
          await PackageModel.updateMany(
            {
              plan_position: { $gt: oldPos, $lte: newPos },
              deletedAt: null,
              _id: { $ne: id },
            },
            { $inc: { plan_position: -1 } },
            { session }
          );
        } else {
          await PackageModel.updateMany(
            {
              plan_position: { $gte: newPos, $lt: oldPos },
              deletedAt: null,
              _id: { $ne: id },
            },
            { $inc: { plan_position: 1 } },
            { session }
          );
        }
      }

      // 🏷️ Unset other recommended plans
      if (updateData.is_recommended) {
        await PackageModel.updateMany(
          {},
          { is_recommended: false },
          { session }
        );
      }

      // 💰 Handle Stripe Price update
      if (
        updateData.price &&
        updateData.price !== currentPackage.price &&
        currentPackage.stripe_product
      ) {
        const unitAmount = Math.round(updateData.price * 100);
        const currency = currentPackage.plan_currency || "inr";

        const newStripePrice = await stripe.prices.create({
          unit_amount: unitAmount,
          currency,
          recurring: {
            interval: currentPackage.plan_type === "monthly" ? "month" : "year",
            interval_count: currentPackage.interval_count || 1,
          },
          product: currentPackage.stripe_product,
        });

        // Add new Stripe fields to updateData
        updateData.pricing_id = newStripePrice.id;
        updateData.unit_amount = newStripePrice.unit_amount;
        updateData.unit_amount_decimal = Number(
          newStripePrice.unit_amount_decimal
        );
        updateData.stripe_json = JSON.stringify(newStripePrice);

        // 🔄 Update Stripe subscriptions
        const activeSubscriptions = await Subscriptions.find({
          package_id: currentPackage._id,
          status: "active",
          deletedAt: null,
        });

        for (const sub of activeSubscriptions) {
          try {
            const stripeSub = await stripe.subscriptions.retrieve(
              sub.subscription_id
            );

            const updated = await stripe.subscriptions.update(
              sub.subscription_id,
              {
                cancel_at_period_end: false,
                proration_behavior: "create_prorations",
                items: [
                  {
                    id: stripeSub.items.data[0].id,
                    price: newStripePrice.id,
                  },
                ],
              }
            );

            // 🔄 Update in Mongo
            await Subscriptions.findByIdAndUpdate(sub._id, {
              pricing_id: newStripePrice.id,
              unit_amount: newStripePrice.unit_amount,
              unit_amount_decimal: Number(newStripePrice.unit_amount_decimal),
              price: updateData.price,
              plan_currency: currency,
            });
          } catch (subErr) {
            logger.error("Error updating Stripe subscription", subErr);
          }
        }
      }

      // 📦 Final Package Update
      const updatedPackage = await PackageModel.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          session,
        }
      );

      if (!updatedPackage) throw createHttpError(404, "Package not found");

      if (isReplicaSet) await session.commitTransaction();
      session.endSession();

      logger.info("Package updated successfully");
      res.status(201).json({
        status: 201,
        message: "Package updated successfully",
        data: updatedPackage,
        type: "object",
      });
    } catch (err) {
      if (isReplicaSet) await session.abortTransaction();
      session.endSession();
      logger.error("Error during update transaction", err);
      next(err);
    }
  } catch (err) {
    logger.error("Update Package function failed", err);
    next(err);
  }
};

export const listPackages1 = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      search,
      status,
      disablePagination,
    } = req.query;

    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    const filter: any = { deletedAt: null };

    // Status Filter
    if (status !== undefined) {
      filter.status = status === "true";
    }

    // Search Filter
    if (search && disablePagination !== "true") {
      const searchStr = search.toString().trim();
      const regex = new RegExp(searchStr, "i");
      const numeric = Number(searchStr);
      const isBoolean =
        searchStr.toLowerCase() === "true" ||
        searchStr.toLowerCase() === "false";
      const searchDate = moment(searchStr, ["DD MMM YYYY", "YYYY-MM-DD"], true);

      filter.$or = [
        { plan_name: regex },
        { plan_type: regex },
        { plan_currency: regex },
        { description: regex },
      ];

      if (!isNaN(numeric)) {
        filter.$or.push(
          { price: numeric },
          { unit_amount: numeric },
          { plan_position: numeric }
        );
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

    // 🧠 If disablePagination is true, return all data
    if (disablePagination === "true") {
      const allData = await PackageModel.find({ deletedAt: null }).lean();
      res.status(200).json({
        status: 200,
        message: "All packages retrieved successfully",
        data: allData,
        type: "array",
      });
    }

    // Time Range Filters using `sortBy`
    const now = moment();
    let finalSortBy: any = sortBy;
    let finalOrder: any = order;

    if (sortBy === "last7days") {
      filter.createdAt = {
        $gte: now.clone().subtract(7, "days").startOf("day").toDate(),
      };
      finalSortBy = "createdAt";
      finalOrder = "desc";
    } else if (sortBy === "lastMonth") {
      filter.createdAt = {
        $gte: now.clone().subtract(1, "month").startOf("day").toDate(),
      };
      finalSortBy = "createdAt";
      finalOrder = "desc";
    } else if (sortBy === "recentlyAdded") {
      finalSortBy = "createdAt";
      finalOrder = "desc";
    } else if (sortBy === "ascending") {
      finalSortBy = "createdAt";
      finalOrder = "asc";
    } else if (sortBy === "descending") {
      finalSortBy = "createdAt";
      finalOrder = "desc";
    }

    const result = await paginate(PackageModel, filter, {
      page: Number(page),
      limit: Number(limit),
      sortBy: finalSortBy,
      order: finalOrder,
    });

    // Append signed S3 image URLs to each package
    const packagesWithSignedUrls = await Promise.all(
      result.data.map(async (pkg: any) => {
        let signedUrl = null;
        if (pkg.plan_image) {
          try {
            signedUrl = await getS3Parallel(pkg.plan_image);
          } catch (err) {
            logger.warn(
              `Failed to generate signed URL for package ${pkg._id}`,
              err
            );
          }
        }

        return {
          ...pkg,
          plan_image: signedUrl,
        };
      })
    );

    res.status(200).json({
      status: 200,
      message: "Packages retrieved successfully",
      data: packagesWithSignedUrls,
      pagination: result.pagination,
      type: "array",
    });
  } catch (err) {
    logger.error("List Packages function failed", err);
    return next(err);
  }
};

export const listPackages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      search,
      status,
      disablePagination,
    } = req.query;

    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);
    const Subscriptions = getSubscriptionModel(dbName);

    const filter: any = { deletedAt: null };

    // Status Filter
    if (status !== undefined) {
      filter.status = status === "true";
    }

    // Search Filter
    if (search && disablePagination !== "true") {
      const searchStr = search.toString().trim();
      const regex = new RegExp(searchStr, "i");
      const numeric = Number(searchStr);
      const isBoolean =
        searchStr.toLowerCase() === "true" ||
        searchStr.toLowerCase() === "false";
      const searchDate = moment(searchStr, ["DD MMM YYYY", "YYYY-MM-DD"], true);

      filter.$or = [
        { plan_name: regex },
        { plan_type: regex },
        { plan_currency: regex },
        { description: regex },
      ];

      if (!isNaN(numeric)) {
        filter.$or.push(
          { price: numeric },
          { unit_amount: numeric },
          { plan_position: numeric }
        );
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

    // 🔁 Fetch active subscriptions once
    const activeSubscriptions = await Subscriptions.find({
      status: "active",
      deletedAt: null,
      package_id: { $ne: null },
    })
      .select("package_id")
      .lean();

    const subscribedPackageIds = new Set(
      activeSubscriptions.map((sub: any) => sub.package_id.toString())
    );

    // 🧠 If disablePagination is true, return all data
    if (disablePagination) {
      const allData = await PackageModel.find({
        deletedAt: null,
        status: true,
      }).lean();

      const enrichedData = await Promise.all(
        allData.map(async (pkg: any) => {
          let signedUrl = null;
          if (pkg.plan_image) {
            try {
              signedUrl = await getS3Parallel(pkg.plan_image);
            } catch (err) {
              logger.warn(
                `Failed to generate signed URL for package ${pkg._id}`,
                err
              );
            }
          }

          const hasSubscription = subscribedPackageIds.has(pkg._id.toString());

          return { ...pkg, plan_image: signedUrl, hasSubscription };
        })
      );

      res.status(200).json({
        status: 200,
        message: "All packages retrieved successfully",
        data: enrichedData,
        type: "array",
      });
    }

    // Time Range Filters using `sortBy`
    const now = moment();
    let finalSortBy: any = sortBy;
    let finalOrder: any = order;

    if (sortBy === "last7days") {
      filter.createdAt = {
        $gte: now.clone().subtract(7, "days").startOf("day").toDate(),
      };
      finalSortBy = "createdAt";
      finalOrder = "desc";
    } else if (sortBy === "lastMonth") {
      filter.createdAt = {
        $gte: now.clone().subtract(1, "month").startOf("day").toDate(),
      };
      finalSortBy = "createdAt";
      finalOrder = "desc";
    } else if (sortBy === "recentlyAdded") {
      finalSortBy = "createdAt";
      finalOrder = "desc";
    } else if (sortBy === "ascending") {
      finalSortBy = "createdAt";
      finalOrder = "asc";
    } else if (sortBy === "descending") {
      finalSortBy = "createdAt";
      finalOrder = "desc";
    }

    // Use pagination helper
    const result = await paginate(PackageModel, filter, {
      page: Number(page),
      limit: Number(limit),
      sortBy: finalSortBy,
      order: finalOrder,
    });

    const packagesWithSignedUrls = await Promise.all(
      result.data.map(async (pkg: any) => {
        let signedUrl = null;
        if (pkg.plan_image) {
          try {
            signedUrl = await getS3Parallel(pkg.plan_image);
          } catch (err) {
            logger.warn(
              `Failed to generate signed URL for package ${pkg._id}`,
              err
            );
          }
        }

        const hasSubscription = subscribedPackageIds.has(pkg._id.toString());

        return {
          ...pkg,
          plan_image: signedUrl,
          hasSubscription,
        };
      })
    );

    res.status(200).json({
      status: 200,
      message: "Packages retrieved successfully",
      data: packagesWithSignedUrls,
      pagination: result.pagination,
      type: "array",
    });
  } catch (err) {
    logger.error("List Packages function failed", err);
    return next(err);
  }
};

export const listPackagesExport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const exportFormat = (req.params.export || "").toLowerCase();

    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    const filter = { deletedAt: null };
    const rawData = await PackageModel.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    if (!rawData.length) {
      throw createHttpError(404, "No pacakge data found");
    }
    const exportData = rawData.map((item) => ({
      plan_name: item.plan_name,
      plan_type: item.plan_type,
      plan_position: item.plan_position,
      plan_currency: item.plan_currency,
      price: item.price,
      discount_type: item.discount_type,
      discount: item.discount,
      plan_modules: item.plan_modules,
      status: item.status,
    }));

    // Export logic
    if (exportFormat === "excel") {
      await generateExcelDownload(res, exportData, "packages");
      return; // ✅ Exit early
    }

    if (exportFormat === "pdf") {
      await generatePdfDownload(res, exportData, "Packages");
      return; // ✅ Exit early
    }

    // Default JSON response
    res.status(200).json({
      status: 200,
      message: "Packages retrieved successfully",
      exportData,
      type: "array",
    });
  } catch (err) {
    logger.error("List Packages Export failed", err);
    return next(err);
  }
};

export const deletePackage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    const { id } = req.params;
    // const Subscriptions = getSubscriptionModel(dbName);
    // const hasActiveSubscription = await Subscriptions.findOne({
    //   package_id: id,
    //   status: "active",
    //   deletedAt: null,
    // });

    // if (hasActiveSubscription) {
    //   throw createHttpError(
    //     409,
    //     "Cannot delete package with active subscriptions"
    //   );
    // }
    // Find the package by package_id that is not deleted

    const Subscriptions = getSubscriptionModel(dbName);

    const [result] = await Subscriptions.aggregate([
      {
        $facet: {
          activeSubscriptions: [
            {
              $match: {
                package_id: new mongoose.Types.ObjectId(id),
                status: "active",
                deletedAt: null,
              },
            },
            { $limit: 1 },
          ],
          activeCompanies: [
            {
              $lookup: {
                from: "companies",
                let: { pkgId: mongoose.Types.ObjectId.createFromHexString(id) },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$package_id", "$$pkgId"] },
                          { $eq: ["$deletedAt", null] },
                        ],
                      },
                    },
                  },
                  { $limit: 1 },
                ],
                as: "companies",
              },
            },
            { $unwind: "$companies" },
          ],
        },
      },
    ]);

    const hasSubscription = result?.activeSubscriptions?.length > 0;
    const hasCompany = result?.activeCompanies?.length > 0;

    if (hasSubscription || hasCompany) {
      throw createHttpError(
        409,
        "Cannot delete package: it has active subscriptions or is used by a company"
      );
    }

    const pkg = await PackageModel.findOne({ _id: id, deletedAt: null });

    if (pkg) {
      const deletedPosition = pkg.plan_position;

      // Soft delete the package
      await pkg.softDelete();

      // Adjust positions: decrement plan_position of packages with higher plan_position
      await PackageModel.updateMany(
        { plan_position: { $gt: deletedPosition }, deletedAt: null },
        { $inc: { plan_position: -1 } }
      );

      logger.info(`Package ${id} soft-deleted and positions updated`);

      res.status(201).json({
        status: 201,
        message: "Package deleted successfully",
        type: "object",
        data: { _id: id },
      });
    } else {
      throw createHttpError(404, "Package not found");
    }
  } catch (err) {
    logger.error("Delete Package function failed", err);
    next(err);
  }
};

export const getPackageById1 = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const { id } = req.params;

    logger.info("Get Package by ID function started");
    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    const packageData = await PackageModel.findOne({
      _id: id,
      deletedAt: null,
    });

    if (!packageData) {
      throw createHttpError(404, "Package not found");
    }

    logger.info("Package retrieved successfully");
    res.status(200).json({
      message: "Package retrieved successfully",
      data: packageData,
      type: "object",
    });
  } catch (err) {
    logger.error("Get Package by ID function failed", err);
    return next(err);
  }
};

export const getPackageById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const { id } = req.params;

    logger.info("Get Package by ID function started");
    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    const packageData = await PackageModel.findOne({
      _id: id,
      deletedAt: null,
    });

    if (!packageData) {
      throw createHttpError(404, "Package not found");
    }

    // Generate signed URL for plan_image if it exists
    let signedImageUrl = null;
    if (packageData.plan_image) {
      try {
        signedImageUrl = await getS3Parallel(packageData.plan_image);
      } catch (err) {
        logger.warn("Failed to generate signed S3 URL for plan_image", err);
        // signedImageUrl remains null if error occurs
      }
    }

    logger.info("Package retrieved successfully");

    res.status(200).json({
      status: 200,
      message: "Package retrieved successfully",
      data: {
        ...packageData.toObject(),
        plan_image_url: signedImageUrl, // appended signed URL
      },
      type: "object",
    });
  } catch (err) {
    logger.error("Get Package by ID function failed", err);
    return next(err);
  }
};

export const uploadPlanImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    const { id } = req.params;
    if (!id) {
      throw createHttpError(400, "Package ID is required");
    }

    const files = req.files as
      | { [fieldname: string]: Express.Multer.File[] }
      | undefined;
    const planImageFile = files?.plan_image?.[0];

    if (!planImageFile || !Buffer.isBuffer(planImageFile.buffer)) {
      throw createHttpError(
        400,
        "Plan image is required and must be a valid file."
      );
    }

    const uploadedImageUrl = await uploadParallel(
      planImageFile,
      `${process.env.BUCKET_FOLDER}/plans/images`,
      res
    );

    // Update the package with the new image URL
    const updatedPackage = await PackageModel.findByIdAndUpdate(
      id,
      { plan_image: uploadedImageUrl },
      { new: true }
    );

    if (!updatedPackage) {
      throw createHttpError(404, "Package not found");
    }

    res.status(201).json({
      status: 201,
      message: "Plan image uploaded and saved successfully",
      imageUrl: uploadedImageUrl,
    });
  } catch (error) {
    next(error);
  }
};

export const packageMetrics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    // Filter only non-deleted packages
    const baseFilter = { deletedAt: null };

    // Get all packages
    const data = await PackageModel.find(baseFilter).sort({ createdAt: -1 });

    // Get metrics
    const [activeCount, inactiveCount, planTypeCounts] = await Promise.all([
      PackageModel.countDocuments({ ...baseFilter, status: true }),
      PackageModel.countDocuments({ ...baseFilter, status: false }),
      PackageModel.distinct("plan_type", baseFilter),
    ]);

    res.status(200).json({
      status: 200,
      message: "Packages retrieved successfully",
      metrics: {
        totalPlans: activeCount + inactiveCount || 0,
        activePlans: activeCount || 0,
        inactivePlans: inactiveCount || 0,
        planTypes: planTypeCounts.length || 0,
      },
    });
  } catch (err) {
    logger.error("List Packages function failed", err);
    return next(err);
  }
};

export const createSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    logger.info("Create Subscription function started");

    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const SubscriptionModel = getSubscriptionModel(dbName);

    const {
      email,
      name,
      paymentMethodId,
      priceId,
      productId,
      companyId,
      companyObjId,
      coupon_id,
      mode,
      startDate,
      endDate,
      package_id,
      payment_method,
    } = req.body;

    if (mode === "trial") {
      if (!startDate || !endDate) {
        throw createHttpError(
          "For trial mode, start date and end date are required."
        );
      }

      // Optionally, validate date formats or that endDate > startDate
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw createHttpError(400, "Invalid start or end date format.");
      }

      if (end <= start) {
        throw createHttpError(400, "End date must be after start date.");
      }

      // Proceed with logic for trial mode
    }

    if (!email || !paymentMethodId || !priceId || !productId || !companyId) {
      throw createHttpError(400, "Missing required fields");
    }
    let subscription: any;
    let amount;
    let currency;
    let amountDecimal;
    let interval;
    let customer: any;
    let priceDetails: any;

    if (mode !== "trial") {
      // Step 1: Create Stripe Customer
      customer = await stripe.customers.create({
        email,
        name,
      });

      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customer.id,
      });

      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
        metadata: { companyId, companyObjId },
      });

      logger.info(`Stripe customer created: ${customer.id}`);

      // Step 2: Prepare subscription data
      const subscriptionData: any = {
        customer: customer.id,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
        collection_method: "charge_automatically",
        metadata: {
          companyId,
          companyObjId,
          customerId: customer.id,
          payment_method,
          companyEmail: email,
        },
      };

      // const coupon = await stripe.coupons.create({
      //   id: '25OFF', // optional, can omit for auto-generated ID
      //   percent_off: 25,
      //   duration: 'once', // or 'repeating', 'forever'
      // });

      if (coupon_id) {
        subscriptionData.discounts = [
          {
            coupon: coupon_id,
          },
        ];
      }

      // Step 3: Create Stripe Subscription
      subscription = await stripe.subscriptions.create(subscriptionData);

      logger.info(`Stripe subscription created: ${subscription.id}`);

      const subscriptionItem = subscription?.items?.data[0];
      priceDetails = subscriptionItem?.price;

      amount = priceDetails.unit_amount / 100;
      currency = priceDetails.currency.toUpperCase();
      amountDecimal = priceDetails.unit_amount_decimal;
      interval = priceDetails.recurring?.interval;
    }

    // Step 4: Save subscription to DB
    const newSubscription = new SubscriptionModel({
      subscription_id: subscription?.id,
      package_id,
      coupon_id,
      customer_id: customer?.id,
      company_obj_id: companyObjId,
      company_id: companyId,
      stripe_product: productId,
      pricing_id: priceId,
      price: amount,
      unit_amount: priceDetails?.unit_amount,
      unit_amount_decimal: amountDecimal,
      plan_currency: currency,
      plan_type: interval,
      mode,
      payment_method,
      status: mode === "trial" ? "active" : subscription.status || "incomplete",
    });

    const savedSubscription = await newSubscription.save();

    logger.info("Subscription saved in database");

    if (mode === "trial") {
      const tenantDB = `${req.body.companyId}${process.env.DB_SUFFIX}`;
      const Transactions = getTransactionModel(tenantDB);
      const transaction = new Transactions({
        customerId: null,
        companyId: companyObjId,
        type: "trial",
        status: "succeeded",
        amount: 0,
        currency: null,
        transactionDetails: {
          package_id,
          productId,
          companyId,
          companyObjId,
          mode,
          name,
          email,
          startDate: new Date(startDate * 1000),
          endDate: new Date(endDate * 1000),
          createdBy: req.user?._id || null, // assuming req.user exists
        },
        payment_method: null,
      });

      await transaction.save();

      await SubscriptionModel.findOneAndUpdate(
        { _id: savedSubscription._id },
        {
          subscriptionDate: parseDateString(startDate),
          nextBillingDate: parseDateString(endDate),
        },
        { upsert: true, new: true }
      );
    }

    res.status(201).json({
      message: "Subscription done",
      data: {
        subscriptionId: subscription?.id,
        subscriptionStatus: subscription?.status,
        clientSecret:
          subscription?.latest_invoice?.payment_intent?.client_secret,
        customerId: customer?.id,
        priceId,
        productId,
        companyId,
        companyObjId,
        priceDetails: subscription?.items?.data[0].subscriptionItem?.price,
      },
      type: "object",
    });
  } catch (error: any) {
    logger.error("Create Subscription function failed", error);
    return next(error);
  }
};

export const parseDateString = (dateStr: string): Date => {
  const [day, month, year] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day); // Month is 0-based
};

export const getNextPackagePosition = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    const packages = await PackageModel.find({ deletedAt: null })
      .select("plan_position -_id")
      .sort({ plan_position: 1 });

    const positions = packages.map((pkg) => pkg.plan_position);
    const nextPosition = positions.length > 0 ? Math.max(...positions) + 1 : 1;

    positions.push(nextPosition);

    res.status(200).json({
      status: 200,
      message: "Plan positions retrieved successfully",
      data: positions,
    });
  } catch (err) {
    logger.error("Get package position failed", err);
    return next(err);
  }
};

// export const listPackages = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const dbName = (req.headers["x-db-name"] as string) || dbName;
//     if (!dbName) {
//       return res.status(400).json({ error: "Database connection missing" });
//     }

//     const {
//       page = 1,
//       limit = 10,
//       sortBy = "createdAt",
//       order = "desc",
//       search,
//       status,
//       disablePagination,
//     } = req.query;

//     const db = await getDbConnection(dbName);
//     const PackageModel =
//       db.models.Package || db.model("Package", PackageSchema);

//     const filter: any = { deletedAt: null };

//     // Status Filter
//     if (status !== undefined) {
//       filter.status = status === "true";
//     }

//     // Search Filter
//     if (search && disablePagination !== "true") {
//       const searchStr = search.toString().trim();
//       const regex = new RegExp(searchStr, "i");
//       const numeric = Number(searchStr);
//       const isBoolean =
//         searchStr.toLowerCase() === "true" ||
//         searchStr.toLowerCase() === "false";
//       const searchDate = moment(searchStr, ["DD MMM YYYY", "YYYY-MM-DD"], true);

//       filter.$or = [
//         { plan_name: regex },
//         { plan_type: regex },
//         { plan_currency: regex },
//         { description: regex },
//       ];

//       if (!isNaN(numeric)) {
//         filter.$or.push(
//           { price: numeric },
//           { unit_amount: numeric },
//           { plan_position: numeric }
//         );
//       }

//       if (isBoolean) {
//         filter.$or.push({ status: searchStr.toLowerCase() === "true" });
//       }

//       if (searchDate.isValid()) {
//         const start = searchDate.startOf("day").toDate();
//         const end = searchDate.endOf("day").toDate();
//         filter.$or.push({ createdAt: { $gte: start, $lte: end } });
//       }
//     }

//     // Time Range Filters using `sortBy`
//     const now = moment();
//     let finalSortBy: any = sortBy;
//     let finalOrder: any = order;

//     if (sortBy === "last7days") {
//       filter.createdAt = {
//         $gte: now.clone().subtract(7, "days").startOf("day").toDate(),
//       };
//       finalSortBy = "createdAt";
//       finalOrder = "desc";
//     } else if (sortBy === "lastMonth") {
//       filter.createdAt = {
//         $gte: now.clone().subtract(1, "month").startOf("day").toDate(),
//       };
//       finalSortBy = "createdAt";
//       finalOrder = "desc";
//     } else if (sortBy === "recentlyAdded") {
//       finalSortBy = "createdAt";
//       finalOrder = "desc";
//     } else if (sortBy === "ascending") {
//       finalSortBy = "createdAt";
//       finalOrder = "asc";
//     } else if (sortBy === "descending") {
//       finalSortBy = "createdAt";
//       finalOrder = "desc";
//     }

//     // If disablePagination is true, return all
//     if (disablePagination === "true") {
//       const allData = await PackageModel.find({ deletedAt: null }).lean();

//       // Get Company count per package_id
//       const CompanyModel =
//         db.models.Company ||
//         db.model(
//           "Company",
//           new mongoose.Schema({
//             package_id: mongoose.Types.ObjectId,
//             deletedAt: Date,
//           })
//         );

//       const subscriptions = await CompanyModel.aggregate([
//         {
//           $match: {
//             package_id: { $in: allData.map((pkg) => pkg._id) },
//             deletedAt: null,
//           },
//         },
//         {
//           $group: {
//             _id: "$package_id",
//             total_subscriptions: { $sum: 1 },
//           },
//         },
//       ]);

//       const subscriptionMap = subscriptions.reduce((acc, cur) => {
//         acc[cur._id.toString()] = cur.total_subscriptions;
//         return acc;
//       }, {} as Record<string, number>);

//       const enrichedPackages = await Promise.all(
//         allData.map(async (pkg: any) => {
//           let signedUrl = null;
//           if (pkg.plan_image) {
//             try {
//               signedUrl = await getS3Parallel(pkg.plan_image);
//             } catch (err) {
//               logger.warn(`Failed to generate signed URL for package ${pkg._id}`, err);
//             }
//           }

//           const totalSubscriptions = subscriptionMap[pkg._id.toString()] || 0;

//           return {
//             ...pkg,
//             plan_image: signedUrl,
//             total_subscriptions: totalSubscriptions,
//           };
//         })
//       );

//       return res.status(200).json({
//         status: 200,
//         message: "All packages retrieved successfully",
//         data: enrichedPackages,
//         type: "array",
//       });
//     }

//     // Paginated result
//     const result = await paginate(PackageModel, filter, {
//       page: Number(page),
//       limit: Number(limit),
//       sortBy: finalSortBy,
//       order: finalOrder,
//     });

//     const packageIds = result.data.map((pkg: any) => pkg._id);

//     // Get Company count per package_id
//     const CompanyModel =
//       db.models.Company ||
//       db.model(
//         "Company",
//         new mongoose.Schema({
//           package_id: mongoose.Types.ObjectId,
//           deletedAt: Date,
//         })
//       );

//     const subscriptions = await CompanyModel.aggregate([
//       {
//         $match: {
//           package_id: { $in: packageIds },
//           deletedAt: null,
//         },
//       },
//       {
//         $group: {
//           _id: "$package_id",
//           total_subscriptions: { $sum: 1 },
//         },
//       },
//     ]);

//     const subscriptionMap = subscriptions.reduce((acc, cur) => {
//       acc[cur._id.toString()] = cur.total_subscriptions;
//       return acc;
//     }, {} as Record<string, number>);

//     // Append signed image and total subscriptions
//     const packagesWithSignedUrls = await Promise.all(
//       result.data.map(async (pkg: any) => {
//         let signedUrl = null;
//         if (pkg.plan_image) {
//           try {
//             signedUrl = await getS3Parallel(pkg.plan_image);
//           } catch (err) {
//             logger.warn(`Failed to generate signed URL for package ${pkg._id}`, err);
//           }
//         }

//         const totalSubscriptions = subscriptionMap[pkg._id.toString()] || 0;

//         return {
//           ...pkg,
//           plan_image: signedUrl,
//           total_subscriptions: totalSubscriptions,
//         };
//       })
//     );

//     res.status(200).json({
//       status: 200,
//       message: "Packages retrieved successfully",
//       data: packagesWithSignedUrls,
//       pagination: result.pagination,
//       type: "array",
//     });
//   } catch (err) {
//     logger.error("List Packages function failed", err);
//     return next(err);
//   }
// };

export const updatePackageStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    const { id } = req.params;
    const { status } = req.body;

    if (typeof status !== "boolean") {
      throw createHttpError(400, "Invalid status value");
    }

    logger.info("Update Package Status function started");
    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    if (status === false) {
      const Subscriptions = getSubscriptionModel(dbName);

      const [result] = await Subscriptions.aggregate([
        {
          $facet: {
            activeSubscriptions: [
              {
                $match: {
                  package_id: new mongoose.Types.ObjectId(id),
                  status: "active",
                  deletedAt: null,
                },
              },
              { $limit: 1 },
            ],
            activeCompanies: [
              {
                $lookup: {
                  from: "companies",
                  let: { pkgId: mongoose.Types.ObjectId.createFromHexString(id) },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ["$package_id", "$$pkgId"] },
                            { $eq: ["$deletedAt", null] },
                          ],
                        },
                      },
                    },
                    { $limit: 1 },
                  ],
                  as: "companies",
                },
              },
              { $unwind: "$companies" },
            ],
          },
        },
      ]);

      const hasSubscription = result?.activeSubscriptions?.length > 0;
      const hasCompany = result?.activeCompanies?.length > 0;

      if (hasSubscription || hasCompany) {
        throw createHttpError(
          409,
          "Cannot Deactivate a package.  It has active subscriptions or is used by a company"
        );
      }
    }

    const updatedPackage = await PackageModel.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!updatedPackage) {
      throw createHttpError(404, "Package not found");
    }

    logger.info("Package status updated successfully");
    res.status(201).json({
      status: 201,
      message: "Package status updated successfully",
      data: updatedPackage,
      type: "object",
    });
  } catch (err) {
    logger.error("Update Package Status failed", err);
    return next(err);
  }
};



export const getPackageViewById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {console.log('rmkkgvj');
  try {
    const dbName: any =  db_Name;
    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }
console.log('dbName ---', dbName);
    const { id } = req.params;

    logger.info("Get Package by ID function started");
    const db = await getDbConnection(dbName);
    const PackageModel =
      db.models.Package || db.model("Package", PackageSchema);

    const packageData = await PackageModel.findOne({
      _id: id,
      deletedAt: null,
    });

    if (!packageData) {
      throw createHttpError(404, "Package not found");
    }

    // Generate signed URL for plan_image if it exists
    let signedImageUrl = null;
    if (packageData.plan_image) {
      try {
        signedImageUrl = await getS3Parallel(packageData.plan_image);
      } catch (err) {
        logger.warn("Failed to generate signed S3 URL for plan_image", err);
        // signedImageUrl remains null if error occurs
      }
    }

    logger.info("Package retrieved successfully");

    res.status(200).json({
      status: 200,
      message: "Package retrieved successfully",
      data: {
        ...packageData.toObject(),
        plan_image_url: signedImageUrl, // appended signed URL
      },
      type: "object",
    });
  } catch (err) {
    logger.error("Get Package by ID function failed", err);
    return next(err);
  }
};
