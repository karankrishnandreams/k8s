import { NextFunction, Request, Response } from "express";
import { Model, Types } from "mongoose";
import mongoose from "mongoose";
import { getDbConnection } from "@config/database";
import { getS3Parallel } from "@utils/auth.utils";
import logger from "@utils/logger";
import NoteSchema from "@models/notes.model";
import { INotes } from "@interfaces/notes.interface";
import { IUser } from "@interfaces/user.interface";
import UserSchema from "@models/user.model";
import createHttpError from "http-errors";
import { ERROR_MESSAGE } from "@utils/message.constant";
import {
  generateExcelDownload,
  generatePdfDownload,
} from "@utils/export.utils";
import moment from "moment";

const getNoteModel = (dbName: string): Model<INotes> => {
  const connection = getDbConnection(dbName);
  return connection.models.Note || connection.model<INotes>("Note", NoteSchema);
};
const getUserModel = (dbName: string): Model<IUser> => {
  const connection = getDbConnection(dbName);
  return connection.models.User || connection.model<IUser>("User", UserSchema);
};
const db_Name = process.env.DB_NAME;

export const createNote = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const userId = req.user?.id
    if (!userId) {
      throw createHttpError(400, "User ID is required in headers");
    }
    const body = req.body;

    const NoteModel = getNoteModel(dbName);

    const note = new NoteModel({
      title: body.title,
      description: body.description,
      userId: mongoose.Types.ObjectId.createFromHexString(userId),
      tag: body.tag,
      priority: body.priority,
      status: body.status,
      due_date: body.due_date,
      is_important: body.is_important,
      is_read: body.is_read,
    });

    const savedNote = await note.save();

    res.status(201).json({
      message: "Note created successfully",
      data: savedNote,
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

export const updateNote = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const noteId = req.params.id;
    const body = req.body;

    let userId = null;

    if (
      body.update_user_email != "undefined" &&
      body.update_user_email != null &&
      body.update_user_email != ""
    ) {
      try {
        const userEmail = body.update_user_email;

        const updatedUser = (await getUserModel(dbName).findOne({
          email: userEmail,
        })) as IUser;

        if (!updatedUser) {
          throw createHttpError(404, ERROR_MESSAGE.USER_NOT_FOUND);
        }

        userId = new mongoose.Types.ObjectId(updatedUser._id as Types.ObjectId);
      } catch (err) {
        next(err);
      }
    }

    const NoteModel = getNoteModel(dbName);
    const note = await NoteModel.findById(noteId);

    if (!note) {
      throw createHttpError(404, ERROR_MESSAGE.NOTE_NOT_FOUND);
    }

    note.title = body.title;
    note.description = body.description;
    note.tag = body.tag;
    note.priority = body.priority;
    note.status = body.status;
    note.due_date = body.due_date;
    note.is_important = body.is_important;
    note.is_read = body.is_read;

    // Save updated_by from token
    if (userId) {
      note.updatedBy = userId;
    }

    const updatedNote = await note.save();

    res.status(201).json({
      message: "Note updated successfully",
      data: updatedNote,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteNote = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const noteId = req.params.id;

    const NoteModel = getNoteModel(dbName);
    const note = await NoteModel.findById(noteId);

    if (!note) {
      throw createHttpError(404, ERROR_MESSAGE.NOTE_NOT_FOUND);
    }

    note.deletedAt = moment().toDate();
    await note.save();

    res.status(201).json({ message: "Note deleted successfully" });
  } catch (err: any) {
    next(err);
  }
};

export const setNoteImportant = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const noteId = req.params.id;
    const { is_important } = req.body; // expects 0 or 1

    if (is_important !== 0 && is_important !== 1) {
      res
        .status(400)
        .json({ message: "is_important (0 or 1) is required in body" });
      return;
    }

    const NoteModel = getNoteModel(dbName);
    const note = await NoteModel.findById(noteId);

    if (!note) {
      throw createHttpError(404, ERROR_MESSAGE.NOTE_NOT_FOUND);
    }

    note.is_important = is_important; // store as 0 or 1
    await note.save();

    res.status(201).json({
      message: `Note marked as${is_important === 1 ? "" : " not"} important`,
      data: note,
    });
  } catch (error) {
    logger.error(error);
    res
      .status(500)
      .json({ message: "Error while updating important flag", error });
  }
};

export const getNoteById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const noteId = req.params.id;

    const NoteModel = getNoteModel(dbName);

    // Use aggregation to join assignee details
    const pipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(noteId),
          deletedAt: null,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "assigneeDetails",
        },
      },
      {
        $project: {
          title: 1,
          tag: 1,
          priority: 1,
          due_date: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          description: 1,
          is_important: 1,
          assigneeDetails: {
            $let: {
              vars: { assignee: { $arrayElemAt: ["$assigneeDetails", 0] } },
              in: {
                user_name: "$$assignee.userName",
                profile_image: "$$assignee.profile_image",
                email: "$$assignee.email",
                _id: "$$assignee._id",
              },
            },
          },
        },
      },
    ];

    const [note] = await NoteModel.aggregate(pipeline);

    if (!note) {
      throw createHttpError(404, ERROR_MESSAGE.NOTE_NOT_FOUND);
    }

    // Attach signed URLs for assignee profile images
    if (note.assigneeDetails && note.assigneeDetails.profile_image) {
      try {
        const signedUrl = await getS3Parallel(
          note.assigneeDetails.profile_image
        );
        note.assigneeDetails.profile_image = signedUrl;
      } catch (err) {
        logger.warn(`Failed to generate signed URL for user`, err);
      }
    }
    res.status(200).json({
      message: "Note retrieved successfully",
      data: note,
      type: "object",
    });
  } catch (err) {
    next(err);
  }
};

export const listNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const {
      tag = null,
      is_important = null,
      priority = null,
      trash = null,
      search = null,
      status = null,
      start_date = null,
      due_date = null,
      end_date = null,
      sortBy = "updatedAt",
      order = "desc",
      updated_by_me = null,
      page = 1,
      limit = 10,
    } = req.query;

    const NoteModel = getNoteModel(dbName);

    // Build filter
    const filter: any = {};

    // Always filter by userId from req.user.id
    const userId = req.user?.id;
    if (!userId) {
      throw createHttpError(400, "User ID is required");
    }
    filter.userId = mongoose.Types.ObjectId.createFromHexString(userId);

    // "updated by me" filter (optional)
    if (
      updated_by_me != undefined &&
      updated_by_me != null &&
      updated_by_me != ""
    ) {
      try {
        const updatedUser = (await getUserModel(dbName).findOne({
          email: updated_by_me,
        })) as IUser;
        if (!updatedUser) {
          throw createHttpError(404, "User not found");
        }
        filter.updatedBy = new mongoose.Types.ObjectId(updatedUser._id as Types.ObjectId);
      } catch (err) {
        throw createHttpError(401, "Invalid token");
      }
    }

    if (status) {
      filter.status = status;
    }
    // Trash filter (deletedAt)
    if (trash == "true") {
      filter.deletedAt = { $ne: null };
    } else {
      filter.deletedAt = null;
    }

    if (tag) filter.tag = tag;
    if (priority) filter.priority = priority;
    if (Number(is_important) === 1) filter.is_important = 1;

    if (due_date != null) {
      filter.due_date = {
        $gte: new Date(due_date as string),
        $lte: new Date(due_date as string),
      };
    }
    // Date range filter
    if (start_date || end_date) {
      filter.updatedAt = {};
      if (start_date) filter.updatedAt.$gte = new Date(start_date as string);
      if (end_date) filter.updatedAt.$lte = new Date(end_date as string);
    }
    // Search filter
    if (search) {
      const regex = new RegExp(search.toString().trim(), "i");
      filter.$or = [
        { title: regex },
        { description: regex },
        { tag: regex },
        { priority: regex },
      ];
    }

    // Sorting
    const sort: any = {};
    sort[sortBy as string] = order === "asc" ? 1 : -1;

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Only project note fields, no assignee details
    const pipeline: any = [
      { $match: filter },
      {
        $project: {
          title: 1,
          tag: 1,
          priority: 1,
          due_date: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
          description: 1,
          is_important: 1,
          is_read: 1,
          deletedAt: 1,
          updatedBy: 1,
        },
      },
      { $sort: sort },
      { $skip: skip },
      { $limit: Number(limit) },
    ];

    const notes = await NoteModel.aggregate(pipeline);

    // Total count for pagination
    const total = await NoteModel.countDocuments(filter);

    res.status(200).json({
      message: "Notes retrieved successfully",
      data: notes,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

export const exportNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const NoteModel = getNoteModel(dbName);

    const exportType = req.params.export;

    // Aggregation pipeline to get assignee details
    const pipeline: any[] = [
      {
        $match: { deletedAt: null }, // optional filter to include only active notes
      },
      // {
      //   $lookup: {
      //     from: "users",
      //     let: { assigneeId: "$userId" },
      //     pipeline: [
      //       {
      //         $match: {
      //           $expr: { $eq: ["$_id", "$$userId"] },
      //         },
      //       },
      //       {
      //         $project: {
      //           _id: 1,
      //           userName: 1,
      //           profile_image: 1,
      //         },
      //       },
      //     ],
      //     as: "assigneeDetails",
      //   },
      // },
      // {
      //   $unwind: {
      //     path: "$assigneeDetails",
      //     preserveNullAndEmptyArrays: true,
      //   },
      // },
    ];

    // Fetch all data without pagination
    const data = await NoteModel.aggregate(pipeline);
    
    if(data.length == 0){
        throw createHttpError(404, "No records in notes");
    }
    const transformedData = data.map((item: any) => {
      delete item.assigneeDetails;
      delete item.userId;
      delete item.updatedBy;
      delete item.is_important;
      delete item.is_read;
      delete item.deletedAt;
      const { ...rest } = item;

      return {
        ...rest
         };
    });

    // Handle export
    if (exportType === "excel") {
      return await generateExcelDownload(res, transformedData, `notes_list`);
    } else if (exportType === "pdf") {
      return await generatePdfDownload(res, transformedData, `notes_list`);
    }

    // Regular JSON response fallback
    res.status(200).json({
      status: 200,
      message: "Fetched successfully",
      data: transformedData,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserExistInNotes = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const userId = req.params.id;

    const NotesModel = getNoteModel(dbName); // assuming you have a Notes model getter like getTodoModel()

    const pipeline = [
      {
        $match: {
          deletedAt: null,
          userId: new mongoose.Types.ObjectId(userId), // direct match because assignee is a single ObjectId
        },
      },
    ];

    const notes = await NotesModel.aggregate(pipeline);

    res.status(200).json({
      data: notes,
    });
  } catch (err) {
    next(err);
  }
};
