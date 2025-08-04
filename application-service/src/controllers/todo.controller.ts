import { NextFunction, Request, Response } from "express";
import { Model } from "mongoose";
import mongoose from "mongoose";
import { getDbConnection } from "@config/database";
import { getS3Parallel } from "@utils/auth.utils";
import jwt from "jsonwebtoken";
import logger from "@utils/logger";
import TodoSchema from "@models/todo.model";
import { todoStatus, todoPriority } from "@utils/constant";
import { paginate, paginateAggregate } from "@utils/paginate";
import moment from "moment";
import { ERROR_MESSAGE, INFO_MESSAGE } from "@utils/message.constant";
import { ITodo } from "@interfaces/todo.interface";
import { IUser } from "@interfaces/user.interface";
import UserSchema from "@models/user.model";
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import createHttpError from "http-errors";
import { IEmailTemplate } from "@interfaces/emailtemplate.interface";
import EmailTemplateSchema from "@models/emailtemplate.model";

const getTodoModel = (dbName: string): Model<ITodo> => {
  const connection = getDbConnection(dbName);
  return connection.models.Todo || connection.model<ITodo>("Todo", TodoSchema);
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

export const createTodo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const body = req.body;

    const token: any = req.headers["authorization"];

    const TodoModal = getTodoModel(dbName);

    const Todo = new TodoModal({
      title: body.title,
      assignee: body.assignee,
      taskflow: body.taskflow,
      priority:
        todoPriority[body.priority as keyof typeof todoPriority] ||
        todoPriority.Low,
      due_date: body.due_date,
      status:
        todoStatus[body.status as keyof typeof todoStatus] ||
        todoStatus.Pending,
      timeline: {
        start: body.timeline?.start || null,
        end: body.timeline?.end || null,
      },
      description: body.description,
      comments: body.comments,
    });

    const savedTodo = await Todo.save();
    await sendTemplateEmail(
      dbName,
      "create-ticket-reminder-email", // change slug as per the action
      "New Ticket Created",
      "New ticket creation alert",
      { item_title: Todo.title },
      Todo.assignee.map((id: any) => id.toString()),
      token
    );

    res.status(201).json({
      message: INFO_MESSAGE.TODO_CREATED_SUCCESSFULLY,
      savedTodo,
    });
  } catch (error) {
    logger.error(error);
    res
      .status(500)
      .json({ message: ERROR_MESSAGE.ERROR_WHILE_CREATE_TODO, error });
  }
};

export const updateTodo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const body = req.body;
    const token: any = req.headers["authorization"];

    const TodoModal = getTodoModel(dbName);
    const id = req.params.id;

    const todo: any = await TodoModal.findById(id);
    if (!todo) throw createHttpError(404, ERROR_MESSAGE.TODO_NOT_FOUND);

    // Detect status change
    const emailSend = todo.status !== body.status ? true : false;
    const oldStatus = todo.status;

    // Detect assignee change
    const oldAssigneeIds = todo.assignee.map(String);
    const newAssigneeIds = body.assignee.map(String);

    const assigneeChanged =
      oldAssigneeIds.length !== newAssigneeIds.length ||
      oldAssigneeIds.some((id: any) => !newAssigneeIds.includes(id));

    let oldAssigneeNames: string[] = [];
    let newAssigneeNames: string[] = [];

    if (assigneeChanged) {
      const UserModel = getUserModel(dbName);

      const oldAssigneeUsers = await UserModel.find({
        _id: {
          $in: oldAssigneeIds.map((id: any) => new mongoose.Types.ObjectId(id)),
        },
      }).select("userName");

      const newAssigneeUsers = await UserModel.find({
        _id: {
          $in: newAssigneeIds.map((id: any) => new mongoose.Types.ObjectId(id)),
        },
      }).select("userName");

      oldAssigneeNames = oldAssigneeUsers.map((user) => user.userName);
      newAssigneeNames = newAssigneeUsers.map((user) => user.userName);
    }

    // Update todo
    todo.set({
      title: body.title,
      assignee: body.assignee,
      taskflow: body.taskflow,
      priority:
        todoPriority[body.priority as keyof typeof todoPriority] ||
        todoPriority.Low,
      due_date: body.due_date,
      status:
        todoStatus[body.status as keyof typeof todoStatus] ||
        todoStatus.Pending,
      timeline: {
        start: body.timeline?.start || null,
        end: body.timeline?.end || null,
      },
      description: body.description,
      comments: body.comments,
    });

    // Send status change email
    if (emailSend) {
      await sendTemplateEmail(
        dbName,
        "status-change-reminder-email",
        "Ticket Status Change Alert",
        "Ticket Status update alert",
        {
          item_title: todo.title,
          old_status: oldStatus,
          new_status: body.status,
        },
        todo.assignee,
        token
      );
    }

    // Send assignee change email
    if (assigneeChanged) {
      const allAssigneeIds = Array.from(
        new Set([...oldAssigneeIds, ...newAssigneeIds])
      );
      await sendTemplateEmail(
        dbName,
        "assignee-change-reminder-email",
        "Ticket Assignee Change Alert",
        "Ticket Assignee update alert",
        {
          item_title: todo.title,
          old_assignees: oldAssigneeNames.join(", "),
          new_assignees: newAssigneeNames.join(", "),
        },
        // newAssigneeIds, //email send only new assignees
        allAssigneeIds, //email send old and new assignees
        token
      );
    }

    const updateTodo = await todo.save();

    res.status(201).json({
      message: INFO_MESSAGE.TODO_UPDATED_SUCCESSFULLY,
      updateTodo,
    });
  } catch (error) {
    logger.error(error);
    res
      .status(500)
      .json({ message: ERROR_MESSAGE.ERROR_WHILE_UPDATE_TODO, error });
  }
};

export const listTodos = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    if (!dbName) {
      throw createHttpError(400, "Database connection missing");
    }

    let {
      page = "1",
      limit = "10",
      sortBy = "createdAt",
      order = "desc",
      search,
      priority,
      startDate = null,
      start_due_date = null,
      end_due_date = null,
      due_date = null,
      endDate = null,
      status = null,
      type = "grid",
      assignee = null,
      taskflow,
      disablePagination = "false",
    } = req.query;

    page = page.toString();
    limit = limit.toString();
    sortBy = sortBy.toString().toLowerCase();
    order = order.toString().toLowerCase();
    disablePagination = disablePagination.toString().toLowerCase();

    const todoModel = getTodoModel(dbName);
    const filter: any = { deletedAt: null };

    filter.$or = [];

    if (priority && priority !== "" && priority !== "all") {
      filter.$or.push({
        priority:
          todoPriority[priority as keyof typeof todoPriority] ||
          todoPriority.Low,
      });
    }

    if (typeof taskflow === "string") {
      taskflow = taskflow.split(",").map((item) => item.trim());
    } else if (Array.isArray(taskflow)) {
      taskflow = taskflow.map((item: any) => item.toString().trim());
    } else {
      taskflow = [];
    }

    if (Array.isArray(taskflow) && taskflow.length > 0) {
      filter.taskflow = {
        $in: taskflow.map((id: any) => new mongoose.Types.ObjectId(id)),
      };
    }

    if (filter.$or.length === 0) {
      delete filter.$or;
    }

    if (search && disablePagination !== "true") {
      const searchStr = search.toString().trim();
      const regex = new RegExp(searchStr, "i");
      const searchDate = moment(searchStr, ["DD MMM YYYY", "YYYY-MM-DD"], true);
      filter.$or = [
        { title: regex },
        { "taskflowDetails.name": regex },
        { due_date: regex },
        { status: regex },
      ];

      if (searchDate.isValid()) {
        const start = searchDate.startOf("day").toDate();
        const end = searchDate.endOf("day").toDate();
        filter.$or.push({ createdAt: { $gte: start, $lte: end } });
      }
    }

    if (status && status !== "all" && status !== "null") {
      filter.status = status.toString();
    }

    if (assignee && assignee !== "all" && assignee !== "null") {
      filter.assigneeDetails = {
        $elemMatch: {
          _id: new mongoose.Types.ObjectId(assignee.toString()),
        },
      };
    }

    const sort: any = {};
    const now = moment();
    let finalSortBy: string = sortBy === "due_date" ? "due_date" : "createdAt";
    let finalOrder: "asc" | "desc" = order === "asc" ? "asc" : "desc";

    if (finalSortBy === "due_date") finalOrder = "desc";

    if (sortBy === "last_7_days" || sortBy === "last7days") {
      const startDate = now.clone().subtract(7, "days").startOf("day").toDate();
      const endDate = now.endOf("day").toDate();
      filter.createdAt = { $gte: startDate, $lte: endDate };
    } else if (sortBy === "last_month" || sortBy === "lastmonth") {
      const startDate = now
        .clone()
        .subtract(1, "month")
        .startOf("month")
        .toDate();
      const endDate = now.clone().subtract(1, "month").endOf("month").toDate();
      filter.createdAt = { $gte: startDate, $lte: endDate };
    } else if (sortBy === "last_year" || sortBy === "lastyear") {
      const startDate = now
        .clone()
        .subtract(1, "year")
        .startOf("year")
        .toDate();
      const endDate = now.clone().subtract(1, "year").endOf("year").toDate();
      filter.createdAt = { $gte: startDate, $lte: endDate };
    } else if (sortBy === "recently_added") {
      const startDate = now.clone().subtract(1, "hour").toDate();
      const endDate = now.toDate();
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    if (startDate && endDate && sortBy === "createdat") {
      const start = moment
        .utc(startDate as string)
        .startOf("day")
        .toDate();
      const end = moment
        .utc(endDate as string)
        .endOf("day")
        .toDate();
      filter.createdAt = { $gte: start, $lte: end };
    }

    if (due_date) {
      const startDate = moment
        .utc(due_date as string)
        .startOf("day")
        .toDate();
      if (!filter.due_date) filter.due_date = {};
      filter.due_date.$gte = startDate;

      const endDate = moment
        .utc(due_date as string)
        .add(1, "day")
        .startOf("day")
        .toDate();
      filter.due_date.$lt = endDate;
    }

    if (start_due_date && end_due_date) {
      const startDate = moment
        .utc(start_due_date as string)
        .startOf("day")
        .toDate();
      if (!filter.due_date) filter.due_date = {};
      filter.due_date.$gte = startDate;

      const endDate = moment
        .utc(end_due_date as string)
        .add(1, "day")
        .startOf("day")
        .toDate();
      filter.due_date.$lt = endDate;
    }

    let prioritySortPipeline = [
      {
        $addFields: {
          priorityOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$priority", "Critical"] }, then: 1 },
                { case: { $eq: ["$priority", "High"] }, then: 2 },
                { case: { $eq: ["$priority", "Medium"] }, then: 3 },
                { case: { $eq: ["$priority", "Low"] }, then: 4 },
              ],
              default: 5,
            },
          },
        },
      },
      { $sort: { priorityOrder: 1 } },
    ];

    let dueDateSortPipeline = [
      {
        $sort: {
          due_date: finalOrder === "desc" ? 1 : -1,
        },
      },
    ];
    
    if (req.user.role[0].key_value === "Employee") {
      filter.assignee = { $in: [new mongoose.Types.ObjectId(req.user.id)] };
    }

    let pipeline: any = [
      {
        $lookup: {
          from: "users",
          localField: "assignee",
          foreignField: "_id",
          as: "assigneeDetails",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "comments.userId",
          foreignField: "_id",
          as: "commentedUserDetails",
        },
      },
      {
        $lookup: {
          from: "taskflows",
          localField: "taskflow",
          foreignField: "_id",
          as: "taskflowDetails",
        },
      },
      {
        $match: {
          ...filter,
          ...(type == "grid" && disablePagination !== "true" && status == "All"
            ? { status: { $in: ["Todo", "Inprogress", "Completed"] } }
            : {}),
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          taskflow: 1,
          priority: 1,
          due_date: 1,
          timeline: 1,
          status: 1,
          createdAt: 1,
          description: 1,
          comments: 1,
          updatedAt: 1,
          is_important: 1,
          assigneeDetails: {
            $map: {
              input: "$assigneeDetails",
              as: "assignee",
              in: {
                _id: "$$assignee._id",
                userName: "$$assignee.userName",
                last_name: "$$assignee.lastName",
                profile_image: "$$assignee.profile_image",
              },
            },
          },
          taskflowDetails: {
            _id: { $arrayElemAt: ["$taskflowDetails._id", 0] },
            taskflowName: { $arrayElemAt: ["$taskflowDetails.name", 0] },
          },
          commentedUserDetails: 1,
        },
      },
    ];

    if (sortBy === "due_date") {
      pipeline.push(...dueDateSortPipeline);
    } else if (sortBy === "priority") {
      pipeline.push(...prioritySortPipeline);
    }

    if (type == "grid" && disablePagination !== "true") {
      pipeline.push(
        {
          $group: {
            _id: "$status",
            todos: {
              $push: {
                _id: "$_id",
                title: "$title",
                taskflow: "$taskflow",
                due_date: "$due_date",
                timeline: "$timeline",
                comments: "$comments",
                priority: "$priority",
                is_important: "$is_important",
                description: "$description",
                status: "$status",
                createdAt: "$createdAt",
                updatedAt: "$updatedAt",
                assigneeDetails: "$assigneeDetails",
                commentedUserDetails: "$commentedUserDetails",
                taskflowDetails: "$taskflowDetails",
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            priority: "$_id",
            todos: 1,
            count: 1,
            _id: 0,
          },
        }
      );
    }

    let todosWithSignedUrls;
    if (disablePagination === "true") {
      const allData = await todoModel.aggregate(pipeline).exec();
      todosWithSignedUrls = await Promise.all(
        allData.map(async (group: any) => {
          const updatedTodos = await Promise.all(
            (group.todos || []).map(async (todo: any) => {
              const updatedAssignees = await Promise.all(
                (todo.assigneeDetails || []).map(async (user: any) => {
                  let signedUrl = null;
                  if (user.profile_image) {
                    try {
                      signedUrl = await getS3Parallel(user.profile_image);
                    } catch (err) {
                      logger.warn(`Failed to generate signed URL`, err);
                    }
                  }
                  return { ...user, profile_image: signedUrl };
                })
              );

              // Enrich comments with user details
              const updatedComments = (todo.comments || []).map(
                (comment: any) => {
                  const user = (todo.commentedUserDetails || []).find(
                    (u: any) => u._id.toString() === comment.userId.toString()
                  );
                  return {
                    ...comment,
                    userDetails: user
                      ? {
                          _id: user._id,
                          userName: user.userName,
                          profile_image: user.profile_image,
                        }
                      : null,
                  };
                }
              );

              return {
                ...todo,
                assigneeDetails: updatedAssignees,
                comments: updatedComments,
              };
            })
          );
          return { ...group, todos: updatedTodos };
        })
      );

      res.status(200).json({
        message: "All Tickets retrieved successfully",
        data: todosWithSignedUrls,
        type: "array",
      });
      return;
    }

    const result = await paginateAggregate(todoModel, pipeline, {
      page: Number(page),
      limit: Number(limit),
      sortBy: finalSortBy,
      order: finalOrder,
    });

    if (type === "grid") {
      todosWithSignedUrls = await Promise.all(
        result.data.map(async (group: any) => {
          const updatedTodos = await Promise.all(
            (group.todos || []).map(async (todo: any) => {
              // Assignee Details - Signed URLs
              const updatedAssignees = await Promise.all(
                (todo.assigneeDetails || []).map(async (user: any) => {
                  let signedUrl = null;
                  if (user.profile_image) {
                    try {
                      signedUrl = await getS3Parallel(user.profile_image);
                    } catch (err) {
                      logger.warn(
                        `Failed to generate signed URL for assignee`,
                        err
                      );
                    }
                  }
                  return { ...user, profile_image: signedUrl };
                })
              );

              // Comment User Details - Signed URLs
              const updatedComments = await Promise.all(
                (todo.comments || []).map(async (comment: any) => {
                  const user = (todo.commentedUserDetails || []).find(
                    (u: any) => u._id.toString() === comment.userId.toString()
                  );

                  let signedUrl = null;
                  if (user && user.profile_image) {
                    try {
                      signedUrl = await getS3Parallel(user.profile_image);
                    } catch (err) {
                      logger.warn(
                        `Failed to generate signed URL for comment user`,
                        err
                      );
                    }
                  }

                  return {
                    ...comment,
                    userDetails: user
                      ? {
                          _id: user._id,
                          userName: user.userName,
                          profile_image: signedUrl,
                        }
                      : null,
                  };
                })
              );

              delete todo.commentedUserDetails; // Remove after processing

              return {
                ...todo,
                assigneeDetails: updatedAssignees,
                comments: updatedComments,
              };
            })
          );

          return { ...group, todos: updatedTodos };
        })
      );
    } else {
      // For 'list' type
      todosWithSignedUrls = await Promise.all(
        result.data.map(async (todo: any) => {
          // Assignee Details - Signed URLs
          const updatedAssignees = await Promise.all(
            (todo.assigneeDetails || []).map(async (user: any) => {
              let signedUrl = null;
              if (user.profile_image) {
                try {
                  signedUrl = await getS3Parallel(user.profile_image);
                } catch (err) {
                  logger.warn(
                    `Failed to generate signed URL for assignee`,
                    err
                  );
                }
              }
              return { ...user, profile_image: signedUrl };
            })
          );

          // Comment User Details - Signed URLs
          const updatedComments = await Promise.all(
            (todo.comments || []).map(async (comment: any) => {
              const user = (todo.commentedUserDetails || []).find(
                (u: any) => u._id.toString() === comment.userId.toString()
              );

              let signedUrl = null;
              if (user && user.profile_image) {
                try {
                  signedUrl = await getS3Parallel(user.profile_image);
                } catch (err) {
                  logger.warn(
                    `Failed to generate signed URL for comment user`,
                    err
                  );
                }
              }

              return {
                ...comment,
                userDetails: user
                  ? {
                      _id: user._id,
                      userName: user.userName,
                      profile_image: signedUrl,
                    }
                  : null,
              };
            })
          );

          delete todo.commentedUserDetails; // Remove after processing

          return {
            ...todo,
            assigneeDetails: updatedAssignees,
            comments: updatedComments,
          };
        })
      );
    }

    const statsPipeline = [
      { $match: { deletedAt: null } },
      {
        $facet: {
          totalCount: [{ $count: "total" }],
          statusCounts: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        },
      },
    ];

    const statsResult = await todoModel.aggregate(statsPipeline);

    const totalCount = statsResult[0]?.totalCount[0]?.total || 0;
    const statusCounts = statsResult[0]?.statusCounts || [];

    let pending_count = 0;
    let completed_count = 0;

    for (const item of statusCounts) {
      if (item._id === "Todo" || item._id === "Inprogress") {
        pending_count = item.count;
      } else if (item._id === "Completed") {
        completed_count = item.count;
      }
    }

    const UserModel = getUserModel(dbName);
    const totalUserCount = await UserModel.collection.countDocuments({});

    res.status(200).json({
      message: "Ticket retrieved successfully",
      data: todosWithSignedUrls,
      pagination: result.pagination,
      stats: {
        total_todos: totalCount,
        pending_count,
        completed_count,
      },
      total_users: totalUserCount,
      type: "array",
    });
  } catch (err) {
    logger.error("List Tickets function failed", err);
    next(err);
  }
};

export const deleteTodo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const todoId = req.params.id;

    if (!todoId) {
      throw createHttpError(400, "Ticket ID is required");
    }

    const TodoModel = getTodoModel(dbName);

    const todo = await TodoModel.findById(todoId);
    if (!todo) {
      throw createHttpError(404, "Ticket not found");
    }

    todo.deletedAt = moment().toDate();
    await todo.save();

    res.status(201).json({ message: "Ticket deleted successfully" });
  } catch (err: any) {
    next(err);
  }
};

export const getTodoById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const todoId = req.params.id;

    if (!todoId) {
      throw createHttpError(400, "Ticket ID is required");
    }

    const TodoModel = getTodoModel(dbName);

    // Use aggregation to join assignee details
    const pipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(todoId),
          deletedAt: null,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "assignee",
          foreignField: "_id",
          as: "assigneeDetails",
        },
      },
      {
        $project: {
          title: 1,
          taskflow: 1,
          priority: 1,
          due_date: 1,
          timeline: 1,
          status: 1,
          createdAt: 1,
          is_important: 1,
          updatedAt: 1,
          description: 1,
          comment: 1,
          assigneeDetails: {
            $map: {
              input: "$assigneeDetails",
              as: "assignee",
              in: {
                _id: "$$assignee._id",
                userName: "$$assignee.userName",
                profile_image: "$$assignee.profile_image",
                email: "$$assignee.email",
              },
            },
          },
        },
      },
    ];

    const [todo] = await TodoModel.aggregate(pipeline);

    if (!todo) {
      throw createHttpError(404, "Ticket not found");
    }

    // Attach signed URLs for assignee profile images
    if (todo.assigneeDetails && todo.assigneeDetails.length > 0) {
      todo.assigneeDetails = await Promise.all(
        todo.assigneeDetails.map(async (user: any) => {
          let signedUrl = null;
          if (user.profile_image) {
            try {
              signedUrl = await getS3Parallel(user.profile_image);
            } catch (err) {
              logger.warn(`Failed to generate signed URL for user`, err);
            }
          }
          return {
            ...user,
            profile_image: signedUrl,
          };
        })
      );
    }

    res.status(200).json({
      message: "Ticket retrieved successfully",
      data: todo,
      type: "object",
    });
  } catch (err) {
    next(err);
  }
};

export const setTodoImportant = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const todoId = req.params.id;
    const { is_important } = req.body; // expects boolean

    if (!todoId) {
      throw createHttpError(400, "Ticket ID is required");
    }

    const TodoModel = getTodoModel(dbName);
    const todo = await TodoModel.findById(todoId);
    if (!todo) {
      throw createHttpError(404, "Ticket not found");
    }

    todo.is_important = is_important;
    await todo.save();

    res.status(201).json({
      message: `Ticket marked as${is_important ? "" : " not"} important`,
      data: todo,
    });
  } catch (err) {
    next(err);
  }
};

export const updateComment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const todoId = req.params.id;
    const { comments } = req.body; // expects updated array of comment objects
    const token: any = req.headers["authorization"];

    if (!todoId) {
      res.status(400).json({ message: "Ticket ID is required" });
      return;
    }

    const TodoModel = getTodoModel(dbName);
    const UserModel = getUserModel(dbName);

    const todo = await TodoModel.findById(todoId);
    if (!todo) {
      res.status(404).json({ message: "Ticket not found" });
      return;
    }

    // Update comments
    todo.comments = comments;
    await todo.save();

    // Check if comments array has at least 1 comment after update
    const latestComment = comments?.length
      ? comments[comments.length - 1]
      : null;

    if (latestComment) {
      // Fetch the user who added the latest comment
      const commenter = await UserModel.findById(
        latestComment.createdBy
      ).select("userName email");
      const commenterName = commenter?.userName || "Unknown User";

      await sendTemplateEmail(
        dbName,
        "comment-update-reminder-email", // your email template slug
        "Notification: A New Comment Has Been Added or Updated on the Ticket", // subject
        "A comment has been added or updated on the Ticket.", // message
        {
          item_title: todo.title,
        },
        todo.assignee.map((id: any) => id.toString()), // email to assignees
        token
      );
    } else {
      // No comment exists after deletion — skip sending email
    }

    res.status(201).json({
      message: `Ticket comments updated`,
      data: todo,
    });
  } catch (err) {
    next(err);
  }
};

export const getUserExist = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const userId = req.params.id;

    const TodoModel = getTodoModel(dbName);

    const pipeline = [
      {
        $match: {
          deletedAt: null,
          $or: [
            {
              assignee: {
                $elemMatch: { $eq: new mongoose.Types.ObjectId(userId) },
              },
            },
            {
              comments: {
                $elemMatch: { userId: new mongoose.Types.ObjectId(userId) },
              },
            },
          ],
        },
      },
    ];

    const todo = await TodoModel.aggregate(pipeline);

    res.status(200).json({
      data: todo,
    });
  } catch (err) {
    next(err);
  }
};

const sendTemplateEmail = async (
  dbName: string,
  templateSlug: string,
  subject: string,
  message: string,
  emailData: object,
  recipientIds: string[],
  token: string
) => {
  const EmailTemplateModel = getEmailTemplateModel(db_Name || "fusion_main");
  const template = await EmailTemplateModel.findOne({
    slug: templateSlug,
    isActive: true,
  }).select("htmlBody -_id");

  if (!template) return;

  const UserModel = getUserModel(dbName);
  const assigneeObjectIds = recipientIds.map(
    (id) => new mongoose.Types.ObjectId(id)
  );

  const users = await UserModel.find({
    _id: { $in: assigneeObjectIds },
  }).select("email userName");

  for (const user of users) {
    const configEmail: CustomAxiosRequestConfig = {
      method: "post",
      url: "/email/mail/send",
      token,
      data: {
        to: user.email,
        subject,
        htmlBody: template.htmlBody,
        message,
        emailData: {
          ...emailData,
          user_name: user.userName || "User",
        },
      },
    };
    await kongAxios(configEmail);
  }
};
