import { NextFunction, Request, Response } from "express";
import { Model } from "mongoose";
import { getDbConnection } from "@config/database";
import logger from "@utils/logger";
import taskflowSchema from "@models/taskflow.model";
import { ITaskflow } from "@interfaces/taskflow.interface";
import createHttpError from "http-errors";
import { ERROR_MESSAGE } from "@utils/message.constant";

const getTaskflowModel = (dbName: string): Model<ITaskflow> => {
  const connection = getDbConnection(dbName);
  return connection.models.Taskflow || connection.model<ITaskflow>("Taskflow", taskflowSchema);
};

const db_Name = process.env.DB_NAME;

export const createTaskflow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const body = req.body;

    const TaskflowModel = getTaskflowModel(dbName);
    const checkExist = await TaskflowModel.findOne({'name' : body.name}) 

    if(checkExist){
      throw createHttpError(422, ERROR_MESSAGE.TASK_FLOW_ALREADY_EXIST);
    }
    const taskflow = new TaskflowModel({
      name: body.name,
      description: body.description,
    });

    const savedTaskflow = await taskflow.save();

    res.status(201).json({
      message: "Taskflow created successfully",
      data: savedTaskflow,
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

export const updateTaskflow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const taskflowId = req.params.id;
    const body = req.body;

    const TaskflowModel = getTaskflowModel(dbName);
    const taskflow = await TaskflowModel.findById(taskflowId);

    if (!taskflow) {
      throw createHttpError(404, ERROR_MESSAGE.TASK_FLOW_NOT_FOUND);
    }

    taskflow.name = body.name;
    taskflow.description = body.description;

    const updatedTaskflow = await taskflow.save();

    res.status(201).json({
      message: "Taskflow updated successfully",
      data: updatedTaskflow,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTaskflow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;
    const taskId = req.params.id;

    const TaskflowModel = getTaskflowModel(dbName);
    const taskflow = await TaskflowModel.findById(taskId);

    if (!taskflow) {
      throw createHttpError(404, ERROR_MESSAGE.TASK_FLOW_NOT_FOUND);
    }

    await taskflow.deleteOne();

    res.status(201).json({ message: "Taskflow deleted successfully" });
  } catch (err: any) {
    next(err);
  }
};

export const listTaskflow = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = (req.headers["x-db-name"] as string) || db_Name;

    const search = (req.query.search as string) || null;

    const TaskflowModel = getTaskflowModel(dbName);

    let taskflows;
    if (search) {
      taskflows = await TaskflowModel.find(
        { name: { $regex: search, $options: "i" } },
        "name"
      );
    } else {
      taskflows = await TaskflowModel.find();
    }

    res.status(200).json({
      message: "Taskflow retrieved successfully",
      data: taskflows,
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

