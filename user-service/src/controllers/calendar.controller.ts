import { NextFunction, Request, Response } from "express";
import { Model, Types } from "mongoose";
import mongoose from "mongoose";
import { getDbConnection } from "@config/database";
import logger from "@utils/logger";
import EventSchema from "@models/calendar.model";
import createHttpError from "http-errors";
import { ERROR_MESSAGE } from "@utils/message.constant";
import { IEvent } from "@interfaces/calendar.interface";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";
import EmailTemplateSchema from "@models/emailtemplate.model";
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import { scheduleEventReminders } from "../jobs/scheduler";
import {
  generatePdfDownload,
  generateExcelDownload,
} from "@utils/export.utils";
import { IUser } from "@interfaces/user.interface";
import UserSchema from "@models/user.model";
import { agenda } from "@utils/agenda";
import { getS3Parallel } from "@utils/auth.utils";
import { emit } from "node:process";

const DB_NAME: any = process.env.DB_NAME;

const getEventModel = (dbName: string): Model<IEvent> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Note || connection.model<IEvent>("calendar", EventSchema)
  );
};

const getUserModel = (dbName: string): Model<IUser> => {
  const connection = getDbConnection(dbName);
  return connection.models.User || connection.model<IUser>("User", UserSchema);
};

const getEmailTemplateModel = (dbName: string): Model<IEmailTemplate> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.EmailTemplate ||
    connection.model<IEmailTemplate>("EmailTemplate", EmailTemplateSchema)
  );
};

const db_Name = process.env.DB_NAME;

export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const token: any = req.headers["authorization"];

    const body = req.body;
    const timeZone = req.body.timeZone
    const EventModel = getEventModel(dbName);
    const event = new EventModel({
      title: body.title,
      description: body.description,
      eventDate: body.eventDate,
      startTime: body.startTime,
      endTime: body.endTime,
      colorTag: body.colorTag,
      location: body.location,
      status: "Active",
      companyId: req.companyObjId,
      userId: req.user.id,
      assignee: body.assignee,
    });
    // user data
    const UserModel = getUserModel(dbName);

    const user = await UserModel.findOne(
      { _id: req.user.id },
      { userName: 1, email: 1, _id: 0 }
    );

    if (!user) {
      throw createHttpError(404, "User not found");
    }

    const savedEvent = await event.save();

    // ➕ Send Event Alert Email
    const EmailTemplate = getEmailTemplateModel(DB_NAME);
    const template = await EmailTemplate.findOne({
      slug: "calendar-event-reminder-email",
      isActive: true,
    }).select("htmlBody -_id");


    // body assignee email
    const assignee: any = await UserModel.findOne({ _id: body.assignee }, { email: 1, _id: 1 });

    if (!assignee) {
      res.status(404).json({ message: "Assignee not found", data: [] });
      return;
    }

    // Remove duplicate emails
    const emailParams: string[] = Array.from(new Set([user.email, assignee.email]));

    if (template) {
      let emailData: object = {
        user_name: user.userName,
        event_title: body.title,
        event_date: body.eventDate,
        start_time: `${body.startTime} - ${body.endTime}`,
        location: body.location,
        event_url:
          DB_NAME === "fusion_main_qa"
            ? `https://zolo-org.fusion.dreamstechnologies.com/company/calendar`
            : `https://zolo-org.fusion.dreamstechnologies.com/company/calendar`,
      };


      const configEmail: CustomAxiosRequestConfig = {
        method: "post",
        url: "/email/mail/send",
        token,
        data: {
          to: emailParams,
          subject: "Event Alert",
          htmlBody: template.htmlBody,
          message: "Event Alert",
          emailData: emailData,
        },
      };
      await kongAxios(configEmail);
    }
    // ➕ Schedule Event Reminders
    await scheduleEventReminders({
      dbName: DB_NAME,
      companyObjId: req.companyObjId || "",
      eventId: event._id.toString(),
      event_title: body.title,
      event_date: body.eventDate,
      start_time: `${body.startTime} - ${body.endTime}`,
      eventStartTime: body.startTime,
      eventEndTime: body.endTime,
      location: body.location || '',
      event_url: DB_NAME === 'fusion_main_qa' ? `https://zolo-org.fusion.dreamstechnologies.com/company/calendar` : `https://zolo-org.fusion.dreamstechnologies.com/company/calendar`,
      email: emailParams,
      user_name: user.userName,
      company_id: req.user.company_id,
      assignee: assignee?._id,
      userId: req.user.id,
      timeZone: timeZone
    });

    res.status(201).json({
      status: 201,
      message: "Event created successfully",
      data: savedEvent,
    });
  } catch (error) {
    res.status(500).json({ message: "Error while creating Event", error });
  }
};

export const getEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const userId = req.user.id;
    const isAdmin = req.user.role?.some((r: any) => r.key_value === 'company_admin');


    const EventModel = getEventModel(dbName);
    const eventCollection = EventModel.collection;

    const match: any = { status: "Active" };
    if (!isAdmin) {
      match.assignee = new mongoose.Types.ObjectId(userId as Types.ObjectId);;
    } else {
      match.userId = new mongoose.Types.ObjectId(userId as Types.ObjectId);;
    }

    const pipeline: any[] = [
      { $match: match },

      {
        $lookup: {
          from: "users",
          localField: "assignee",
          foreignField: "_id",
          as: "assigneeDetails",
        },
      },
      {
        $unwind: {
          path: "$assigneeDetails",
          preserveNullAndEmptyArrays: true, // in case user is deleted
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          status: 1,
          userId: 1,
          assignee: 1,
          companyId: 1,
          startTime: 1,
          endTime: 1,
          eventDate: 1,
          location: 1,
          colorTag: 1,
          // assignee details
          assigneeDetails: {
            _id: "$assigneeDetails._id",
            userName: "$assigneeDetails.userName",
            profile: "$assigneeDetails.profile_image",
          },
        },
      },
    ];

    const events = await eventCollection.aggregate(pipeline).toArray();
    for (const item of events) {
      if (item.assigneeDetails.profile) {
        item.assigneeDetails.profile = await getS3Parallel(item.assigneeDetails.profile);
      } else {
        item.assigneeDetails.profile = [];
      }
    }

    res.status(200).json({
      status: 200,
      message: "Events fetched successfully",
      data: events,
    });

  } catch (error) {
    res.status(500).json({ message: "Error while getting Event", error });
  }
};

export const getUpcomingEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const userId = req.user.id;
    const companyId = req.companyObjId;
    const EventModel = getEventModel(dbName);

    const dateParam = req.query.date as string | undefined;

    const isAdmin = req.user.role?.some((r: any) => r.key_value === "company_admin");

    const query: any = {
      companyId,
      status: "Active",
      eventDate: {
        $gte: dateParam || new Date().toISOString().split("T")[0],
      },
    };



    if (isAdmin) {
      query.userId = userId;
    } else {
      query.assignee = userId;
    }

    const events = await EventModel.find(query);

    res.status(200).json({
      status: 200,
      message: "Upcoming events fetched successfully",
      data: events,
    });
  } catch (error) {
    res.status(500).json({ message: "Error while getting Event", error });
  }
};


export const updateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const body = req.body;
    const token: any = req.headers["authorization"];

    // user data
    const UserModel = getUserModel(dbName);
    const user: any = await UserModel.findOne(
      { _id: req.user.id },
      { userName: 1, email: 1, _id: 1 }
    );

    if (!user) {
      res.status(200).json({ message: "User not found", data: [] });
    } else {



      const EventModel = getEventModel(dbName);
      const event = await EventModel.findOne({ _id: body._id, status: "Active" });
      if (!event) {
        res.status(200).json({ message: "Event not found", data: [] });
      } else {

        const updatedEvent = await EventModel.findOneAndUpdate(
          { _id: body._id, status: 'Active' },
          {
            ...body,
            startTime: body.startTime,
            endTime: body.endTime,
          },
          { new: true }
        );
        // body assignee email
        const assignee = await UserModel.findOne({ _id: body.assignee }, { email: 1, _id: 0 });

        if (!assignee) {
          res.status(404).json({ message: "Assignee not found", data: [] });
          return
        }

        let emailData: string[] = Array.from(new Set([user.email, assignee.email]));

        //@ts-ignore
        const account_url = req.account_url;

        // Cancel previous reminders and schedule new ones
        if (updatedEvent) {
          await agenda.cancel({ "data.eventId": body._id });
          await scheduleEventReminders({
            dbName: DB_NAME,
            companyObjId: req.companyObjId || "",
            eventId: updatedEvent._id.toString(),
            event_title: updatedEvent.title,
            event_date: updatedEvent.eventDate,
            start_time: `${updatedEvent.startTime} - ${updatedEvent.endTime}`,
            eventStartTime: updatedEvent.startTime,
            eventEndTime: updatedEvent.endTime,
            location: updatedEvent.location || '',
            event_url: DB_NAME === 'fusion_main_qa' ? `https://${account_url}.fusion.dreamstechnologies.com/company/calendar` : `https://${account_url}.fusion.dreamstechnologies.com/company/calendar`,
            email: emailData,
            user_name: user.userName,
            company_id: req.user.company_id,
            assignee: assignee.id,
            userId: req.user.id
          });
        }

        // ➕ Send Event Alert Email
        const EmailTemplate = getEmailTemplateModel(DB_NAME);
        const template = await EmailTemplate.findOne({
          slug: "update-calendar-event-reminder-email",
          isActive: true,
        }).select("htmlBody -_id");


        if (template) {
          let emailData: object = {
            user_name: user.userName,
            old_event_title: event.title,
            old_event_date: event.eventDate,
            old_start_time: `${body.startTime} - ${body.endTime}`,
            old_location: event.location,

            new_event_title: body.title,
            new_event_date: body.eventDate,
            new_start_time: `${body.startTime} - ${body.endTime}`,
            new_location: body.location,
            event_url: DB_NAME === 'fusion_main_qa' ? `https://zolo-org.fusion.dreamstechnologies.com/company/calendar` : `https://zolo-org.fusion.dreamstechnologies.com/company/calendar`,
          }
          const configEmail: CustomAxiosRequestConfig = {
            method: "post",
            url: "/email/public/mail/send",
            token,
            data: {
              to: emailData,
              subject: "Event Updated Alert",
              htmlBody: template.htmlBody,
              message: "Event Updated Alert",
              emailData: emailData,
            },
          };
          await kongAxios(configEmail);
        }
        res.status(201).json({
          status: 201,
          message: "Event updated successfully",
          data: updatedEvent,
        });
      }
    }
  } catch (error) {
    res.status(500).json({ message: "Error while updating Event", error });
  }
};

export const deleteCalendar = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const id = req.params.id;
    const EventModel = getEventModel(dbName);
    const event = await EventModel.findOneAndUpdate(
      { _id: id, status: "Active" },
      { status: "Inactive" },
      { new: true }
    );
    if (!event) {
      throw createHttpError(404, "Event not found");
    }

    // Cancel previous reminders for the event
    await agenda.cancel({ "data.eventId": id });

    res.status(201).json({
      status: 201,
      message: "Event deleted (set to Inactive) successfully",
      data: event,
    });
  } catch (error) {
    res.status(500).json({ message: "Error while deleting Event", error });
  }
};

export const exportCalendar = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const format = req.params.export?.toLowerCase() || "excel"; // default to excel

    let userId = req.user.id;
    let companyId = req.companyObjId;
    const EventModel = getEventModel(dbName);
    const events = await EventModel.find(
      { userId, companyId, status: "Active" },
      {
        title: 1,
        description: 1,
        eventDate: 1,
        startTime: 1,
        endTime: 1,
        location: 1,
        _id: 0,
      }
    ).lean();

    if (events.length === 0) {
      throw createHttpError(404, "No events found");
    }
    if (format === "pdf") {
      await generatePdfDownload(res, events, "Events");
    } else {
      await generateExcelDownload(res, events, "Events");
    }
  } catch (error) {
    res.status(500).json({ message: "Error while exporting calendar", error });
  }
};
