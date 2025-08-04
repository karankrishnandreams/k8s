// src/controllers/project.controller.ts

import { RequestHandler } from "express";
import { Model }         from "mongoose";
import { getDbConnection } from "@config/database";
import ProjectSchema     from "../models/project.model";
import { IProject }      from "@interfaces/project.interface";

const DB_NAME = process.env.DB_NAME!;

function getProjectModel(): Model<IProject> {
  const conn = getDbConnection(DB_NAME);
  return conn.models.Project || conn.model<IProject>("Project", ProjectSchema);
}

// Create
export const createProject: RequestHandler = async (req, res, next) => {
  try {
    const payload = req.body as IProject;
    const Project = getProjectModel();
    const created = await Project.create(payload);
    res.status(201).json(created);
    // no return here
  } catch (err) {
    next(err);
  }
};

// List
export const listProjects: RequestHandler = async (_req, res, next) => {
  try {
    const Project = getProjectModel();
    const list = await Project.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    next(err);
  }
};

// Update
export const updateProject: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id;
    const Project = getProjectModel();
    const updated = await Project.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// Delete
export const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    const id = req.params.id;
    const Project = getProjectModel();
    await Project.findByIdAndDelete(id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// GET only project numbers for AMS dropdown in Report
export const listProjectNumbers: RequestHandler = async (_req, res, next) => {
  try {
    const Project = getProjectModel();
    const list = await Project.find({}, { projectNumber: 1 }).sort({ createdAt: -1 });
    res.json(list); // returns [{ _id, projectNumber }]
  } catch (err) {
    next(err);
  }
};
// GET project details by projectNumber
export const getProjectDetailsByNumber: RequestHandler = async (req, res, next) => {
  try {
    const Project = getProjectModel();
    const project = await Project.findOne(
      { projectNumber: req.params.projectNumber },
      { entity: 1, branch: 1, agent: 1 }
    );

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return; // Important: avoid falling through
    }

    res.json(project); // Don't return this!
  } catch (err) {
    next(err);
  }
};



