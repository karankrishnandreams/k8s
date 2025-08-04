import { RequestHandler } from "express";
import { Model } from "mongoose";
import { getDbConnection } from "@config/database";
import RepositorySchema from "../models/repository.model";
import { IRepository } from "@interfaces/repository.interface";
import path from "path";

const DB_NAME = process.env.DB_NAME!;

function getRepositoryModel(): Model<IRepository> {
  const conn = getDbConnection(DB_NAME);
  return conn.models.Repository || conn.model<IRepository>("Repository", RepositorySchema);
}

// Create repository entry with file upload
export const createRepository: RequestHandler = async (req, res, next) => {
  try {
    const file = req.file;
    const {
      amsNo,
      entity,
      branch,
      agent,
      reportType,
      uploadedDate,
      comments,
    } = req.body;

    const repoData: Partial<IRepository> = {
      amsNo,
      entity,
      branch,
      agent,
      reportType,
      uploadedDate,
      comments,
    };

    if (file) {
      repoData.filePath = `/uploads/repositories/${file.filename}`;
      repoData.originalFileName = file.originalname;
    }

    const Repository = getRepositoryModel();
    const created = await Repository.create(repoData);

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
};



// List
export const listRepositories: RequestHandler = async (_req, res, next) => {
  try {
    const Repository = getRepositoryModel();
    const list = await Repository.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    next(err);
  }
};

// Update
export const updateRepository: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id;
    const Repository = getRepositoryModel();

    const file = req.file;
    const updateData = {
      ...req.body,
    };

    if (file) {
      updateData["filePath"] = `/uploads/repositories/${file.filename}`;
      updateData["originalFileName"] = file.originalname;
    }

    const updated = await Repository.findByIdAndUpdate(id, updateData, { new: true });

    if (!updated) {
      res.status(404).json({ message: "Repository not found" });
      return;
    }

    res.json(updated); // ✅ no return
  } catch (err) {
    next(err);
  }
};


// Delete
export const deleteRepository: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id;
    const Repository = getRepositoryModel();
    await Repository.findByIdAndDelete(id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

