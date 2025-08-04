import { getDbConnection } from '@config/database';
import RFS from '../models/rfs.model'; // ✅ Correct relative path
import { Request, Response, NextFunction } from "express";
import { Model } from 'mongoose';
import { IRfs } from '@interfaces/rfs.interface';
import RfsSchema from '../models/rfs.model';
import { RequestHandler } from "express";


const DB_NAME: any = process.env.DB_NAME;
const getRFSModel = (dbName: string): Model<IRfs> => {
  const connection = getDbConnection(dbName);
  return connection.models.RFS || connection.model<IRfs>("RFS", RfsSchema);
};

export const createRFS = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = JSON.parse(req.body.data);

    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Rfs = getRFSModel(dbName);
    // Handle file if uploaded
    if (req.file) {
      data.attachedFile = `/uploads/${req.file.filename}`;
    }
     // Set default status if not present
    if (!data.status) {
      data.status = "Open";
    }

    const newRFS = await Rfs.create(data);
    res.status(201).json({ message: "RFS created", data: newRFS });
  } catch (error) {
    next(error);
  }
};

export const updateRFS: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    // pick the correct tenant DB
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Rfs = getRFSModel(dbName);
    const rfsId = req.params.id as string;

    // destructure only the fields we want
    const {
      rfsNumber,
      entity,
      user,
      branch,
      service,
      pickupType,
      address,
      preferredPickupDate,
      additionalComments,
      status,
      suppliers,
    } = req.body;

    const toUpdate: Partial<IRfs> = {
      rfsNumber,
      entity,
      user,
      branch,
      service,
      pickupType,
      address,
      preferredPickupDate,
      additionalComments,
      status,
      suppliers,
    };

    // handle file upload
    if (req.file) {
       toUpdate.attachedFile = `/uploads/${req.file.filename}`;
    }

    const updated = await Rfs.findByIdAndUpdate(rfsId, toUpdate, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      res.status(404).json({ message: "RFS not found" });
      return;
    }

    res.status(200).json({ message: "RFS updated successfully", data: updated });
  } catch (err) {
    next(err);
  }
};


export const getAllRfs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Rfs = getRFSModel(dbName);

    const { status } = req.query;

    // Build query conditionally
    const filter: any = {};
    if (status && typeof status === "string") {
      filter.status = status;
    }

    const rfsList = await Rfs.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      status: 200,
      message: "Fetched RFS list successfully",
      data: rfsList,
    });
  } catch (error) {
    next(error);
  }
};


