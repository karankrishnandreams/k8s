import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import stripe from "@utils/stripe";
import { Model } from "mongoose";
import { getDbConnection } from "@config/database";
import transactionSchema from "@models/transaction.model";
import { ITransaction } from "@interfaces/transaction.interface";
import { ISubscription } from "@interfaces/subscription.interface";
import subscriptionSchema from "@models/subscription.model";
import { logWebhookEvent } from "../utils/logWebhookEvent";
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";
import EmailTemplateSchema from "@models/emailtemplate.model";
import { scheduleSubscriptionReminders } from "./job.controller";
import createHttpError from "http-errors";


const endpointSecret: any = process.env.STRIPE_WEBHOOK_SECRET;
const DB_NAME: any = process.env.DB_NAME;

const getTransactionModel = (dbName: string): Model<ITransaction> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Transaction ||
    connection.model<ITransaction>("Transaction", transactionSchema)
  );
};

const getSubscriptionModel = (dbName: string): Model<ISubscription> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Subscription ||
    connection.model<ISubscription>("Subscription", subscriptionSchema)
  );
};

const getEmailTemplateModel = (dbName: string): Model<IEmailTemplate> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.EmailTemplate ||
    connection.model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema)
  );
};

export const stripeWebhookHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      logger.error("Missing Stripe signature.");
      throw createHttpError(400, "Missing Stripe signature.");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: any) {
      logger.error(`Webhook Error: ${err.message}`);
      return next(err);
      //   return custom_error_message([], res, `Webhook Error: ${err.message}`);
    }

    logger.info(`Received event: ${event.type}`);

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailure(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCancellation(event.data.object);
        break;
      default:
        logger.warn(`Unhandled event type: ${event.type}`);
    }
    res.status(200).json({
      message: "Ok",
      data: { received: true },
      type: "object",
    });
  } catch (err: any) {
    logger.error(`Webhook Handler Error: ${err.message}`);
    return next(err);
  }
};

// ✅ Payment success
const handlePaymentSuccess = async (paymentIntent: any) => {
  try {
    logger.info(`✅ Payment Success: ${paymentIntent.id}`);

    const fullPaymentIntent: any = await stripe.paymentIntents.retrieve(
      paymentIntent.id,
      {
        expand: ["invoice.subscription.discount.coupon"],
      }
    );

    await logWebhookEvent("payment_intent.succeeded", fullPaymentIntent);

    const subscription = fullPaymentIntent.invoice?.subscription;

    const coupon = subscription?.discount?.coupon;

    const Transactions = getTransactionModel(DB_NAME);
    const Subscriptions = getSubscriptionModel(DB_NAME);

    const transaction = new Transactions({
      customerId: subscription.metadata?.customerId,
      invoiceId: fullPaymentIntent.invoice?.id,
      companyId: subscription.metadata?.companyObjId,
      type: "charge",
      status: "succeeded",
      amount: fullPaymentIntent.amount_received / 100,
      currency: fullPaymentIntent.currency.toUpperCase(),
      paymentIntentId: fullPaymentIntent.id,
      coupon_id: coupon?.id,
      coupon_percent_off: coupon?.percent_off,
      coupon_amount_off: coupon?.amount_off,
      coupon_duration: coupon?.duration,
      coupon_valid: coupon?.valid,
      transactionDetails: paymentIntent,
      payment_method: subscription.metadata.payment_method,
    });

    await transaction.save();

    const sub = await Subscriptions.findOneAndUpdate(
      { subscription_id: subscription.id },
      {
        subscriptionDate: new Date(subscription.current_period_start * 1000),
        nextBillingDate: new Date(subscription.current_period_end * 1000),
        status: 'active'
      },
      { upsert: true, new: true }
    );

    const companyConfig: CustomAxiosRequestConfig = {
      method: "post",
      url: "/user/public/company/webhook/update",
      data: {
        id: subscription.metadata.companyObjId,
        subscriptionStartDate: new Date(subscription.current_period_start * 1000),
        subscriptionEndDate: new Date(subscription.current_period_end * 1000),
      },
    };

    const comapnyData: any = await kongAxios(companyConfig);

    const EmailTemplate = getEmailTemplateModel(DB_NAME);
    const template: any = await EmailTemplate.findOne({
      slug: "comapany-activation",
      isActive: true,
    }).select("htmlBody -_id");


    const configEmail: CustomAxiosRequestConfig = {
      method: "post",
      url: "/email/public/mail/send",
      data: {
        to: comapnyData.data.company.email,
        subject: "Your Account is now activated",
        htmlBody: template.htmlBody,
        message: "Account activated",
        emailData: {
          user_name: comapnyData.data.company.name,
        },
      },
    };

    await kongAxios(configEmail);

    await scheduleSubscriptionReminders({
      dbName: DB_NAME,
      companyId: subscription.metadata.company_id,
      companyObjId: subscription.metadata.companyObjId,
      endDate: new Date(subscription.current_period_end * 1000).toISOString(),
      companyEmail: subscription.metadata.companyEmail,
    });
    logger.info(`Transaction recorded for payment: ${paymentIntent.id}`);
  } catch (err: any) {
    logger.error(`❌ Error in handlePaymentSuccess: ${err.message}`);
  }
};

// ❌ Payment failed
const handlePaymentFailure = async (paymentIntent: any) => {
  try {
    logger.warn(`❌ Payment Failed: ${paymentIntent.id}`);

    const fullPaymentIntent: any = await stripe.paymentIntents.retrieve(
      paymentIntent.id,
      {
        expand: ["invoice.subscription.discount.coupon"],
      }
    );

    await logWebhookEvent("payment_intent.payment_failed", fullPaymentIntent);

    const subscription = fullPaymentIntent.invoice?.subscription;

    const tenantDB = `${subscription.metadata?.companyId}${process.env.DB_SUFFIX}`;

    const Transactions = getTransactionModel(tenantDB);
    const Subscriptions = getSubscriptionModel(tenantDB);

    await Transactions.findOneAndUpdate(
      { invoiceId: paymentIntent.id },
      {
        customerId: subscription.metadata?.customerId,
        invoiceId: fullPaymentIntent.invoice?.id,
        companyId: subscription.metadata?.companyObjId,
        type: "charge",
        status: "failed",
        amount: fullPaymentIntent.amount_received / 100,
        currency: fullPaymentIntent.currency.toUpperCase(),
        paymentIntentId: fullPaymentIntent.id,
        failureReason:
          paymentIntent.last_payment_error?.message || "Unknown error",
        transactionDetails: paymentIntent,
        payment_method: subscription.metadata.payment_method,
      },
      { upsert: true, new: true }
    );

    await Subscriptions.findOneAndUpdate(
      { subscription_id: subscription.id },
      { status: subscription.status },
      { upsert: true, new: true }
    );

    logger.warn(`⚠️ Marked payment as failed.`);
  } catch (err: any) {
    logger.error(`❌ Error in handlePaymentFailure: ${err.message}`);
  }
};

// 🚫 Subscription cancelled
const handleSubscriptionCancellation = async (subscription: any) => {
  try {
    logger.warn(`⚠️ Subscription Canceled: ${subscription.id}`);
    const tenantDB = `${subscription.metadata?.companyId}${process.env.DB_SUFFIX}`;

    // const Transactions = getTransactionModel(tenantDB);

    const Subscriptions = getSubscriptionModel(tenantDB);

    await Subscriptions.findOneAndUpdate(
      { subscription_id: subscription.id },
      {
        status: "canceled",
        canceledAt: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : new Date(),
      },
      { new: true }
    );
    logger.info(`✅ Subscription ${subscription.id} marked as canceled.`);
  } catch (err: any) {
    logger.error(`❌ Error in handleSubscriptionCancellation: ${err.message}`);
  }
};
