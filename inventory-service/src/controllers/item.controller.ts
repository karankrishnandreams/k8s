import { NextFunction, Request, Response } from "express";
import { IItem } from "@interfaces/item.interface";
import { Model } from "mongoose";
import mongoose from "mongoose";
import { getDbConnection } from "@config/database";
import ItemSchema from "@models/item.model";
import createHttpError from "http-errors";
import path from "path";
import {
  readJSONFile,
  uploadParallel,
  getS3Parallel,
  getItemImage,
  slugify,
} from "@utils/auth.utils";
import ManufacturerSchema from "@models/manufacturer.model";
import { IManufacturer } from "@interfaces/manufacturer.interface";
import { ICategory } from "@interfaces/category.interface";
import CategorySchema from "@models/category.model";
import kongAxios from "@services/kong.service";
import pLimit from "p-limit";
import {
  generatePdfDownload,
  generateExcelDownload,
} from "@utils/export.utils";
import { validateItemImportRow } from "@validations/item.validation";
import xlsx from "xlsx";
import moment from "moment";
import { handleImageUpdate } from "@utils/auth.utils";

// import WarehouseSchema from "../models/";
// import { IWarehouse } from "@interfaces/warehouse.interface";

const DB_NAME: any = process.env.DB_NAME;

const getItemModel = (dbName: string): Model<IItem> => {
  const connection = getDbConnection(dbName);
  return connection.models.Item || connection.model<IItem>("Item", ItemSchema);
};

const getManufacturerModel = (dbName: string): Model<IManufacturer> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Manufacturer ||
    connection.model<IManufacturer>("Manufacturer", ManufacturerSchema)
  );
};

const getCategoryModel = (dbName: string): Model<ICategory> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Category ||
    connection.model<ICategory>("Category", CategorySchema)
  );
};

const getWarehouseModel = async (dbName: string, id: string): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: `/people/public/warehouse/warehouse/${id}`,
      headers: {
        "x-db-name": dbName,
      },
    };

    const response = await kongAxios(config);

    const companyList = response.data?.data || [];

    return companyList;
  } catch (error) {
    return [];
  }
};

const getWarehouseSearch = async (
  name: string,
  token: string,
  Origin: string
): Promise<any> => {
  try {
    const config = {
      method: "get",
      url: `/people/warehouse/warehouse/search/${name}`,
      token: token,
      headers: {
        Origin: Origin,
        Authorization: token,
      },
    };

    const response = await kongAxios(config);

    const companyList = response.data?.data || [];

    return companyList;
  } catch (error) {
    return [];
  }
};



const getWarehousesName = async (
  names: string[],
  token: string,
  Origin: string
): Promise<any[]> => {
  try {
    const config = {
      method: "post",
      url: `/people/warehouse/name`,
      headers: {
        Origin: Origin,
        Authorization: token,
      },
      data: { names },
    };

    const response = await kongAxios(config);
    return response.data?.data || [];
  } catch (error) {
    return [];
  }
};




const getLocation = async (
  country: any,
): Promise<any> => {
  try {
    const nameConfig = {
      method: "post",
      url: "/user/public/locations/names/by-ids", // adjust as per Kong route
      data: {
        countryIds: country ? country : [],
      },
    };

    const locationRes = await kongAxios(nameConfig);
    const locationData = locationRes.data?.data || {};

    return {
      success: true,
      message: "Location data retrived successfully",
      data: locationData,
    };
  } catch (error) {
    return {
      success: false,
      message: "County,state or city data not found",
      data: [],
    };
  }
};

export const createItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;

    const files = req.files as {
      [profile_image: string]: Express.Multer.File[];
    };
    const body = JSON.parse(req.body.data);

    const Item = getItemModel(dbName);

    // Check if account_url already exists
    const existingItem = await Item.findOne({ itemName: body.itemName });
    if (existingItem) {
      throw createHttpError(400, `Item "${body.itemName}" is already in use.`);
    }

    const getManufacturer = await getManufacturerModel(dbName).findOne({
      _id: body.manufacturer,
    });
    if (!getManufacturer) {
      throw createHttpError(
        400,
        `Manufacturer "${body.manufacturer}" is not found.`
      );
    }

    const getCategory = await getCategoryModel(dbName).findOne({
      _id: body.category,
    });
    if (!getCategory) {
      throw createHttpError(400, `Category "${body.category}" is not found.`);
    }
    if (body.warehouse) {
      const getWarehouse = await getWarehouseModel(dbName, body.warehouse);
      if (getWarehouse && getWarehouse.length === 0) {
        throw createHttpError(
          400,
          `Warehouse "${body.warehouse}" is not found.`
        );
      }
    }

    const profileImageFiles = files?.profile_image || [];
    let image = body.profile_image || [];
    if (profileImageFiles.length > 0) {
      image = [];
      for (const file of profileImageFiles) {
        const uploadedKey = await uploadParallel(
          file,
          `${process.env.BUCKET_FOLDER}/company/inventory/item`,
          res
        );
        image.push(uploadedKey);
      }
    }

    const {
      itemName,
      manufacturer,
      clei,
      type,
      description,
      extDescription,
      category,
      warehouse,
      nonInventory,
      heci,
      itemGLCode,
      country,
      weight,
      primaryLocation,
      taxGoodCategory,
    } = body;
    const item = await Item.create({
      itemName,
      manufacturer,
      clei,
      type,
      description,
      extDescription,
      category,
      image: image,
      warehouse,
      nonInventory,
      heci,
      itemGLCode,
      country,
      weight,
      primaryLocation,
      taxGoodCategory,
    });
    res.status(201).json({
      message: "Item created successfully",
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const getAllItems = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Item = getItemModel(dbName);

    const {
      search,
      manufacturer,
      type,
      category,
      warehouse,
      nonInventory,
      sortBy = null,
      page = 1,
      limit = 10,
      disablePagination = false,
    } = req.query;

    const filter: any = {
      deletedAt: null,
      status: "Active",
    };

    // Apply search filter
    if (search) {
      const regex = new RegExp(search.toString(), "i");
      filter.itemName = { $regex: regex };
    }

    // Apply exact filters
    if (manufacturer) filter.manufacturer = manufacturer;
    if (type) filter.type = type;
    if (category) {
      const categoryArray = category.toString().split(","); // support for multiple categories too
      filter.category = {
        $in: categoryArray.map((id) => new mongoose.Types.ObjectId(id.trim())),
      };
    }
    if (warehouse) filter.warehouse = warehouse;
    if (nonInventory !== undefined) {
      filter.nonInventory = nonInventory === "true";
    }
    const now = moment();
    const sort: any = {};
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
    } else if (sortBy === "recently_added" || sortBy === "all") {
      sort.createdAt = -1;
    } else if (sortBy === "ascending") {
      sort.itemName = 1;
    } else if (sortBy === "descending") {
      sort.itemName = -1;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline: any[] = [
      { $match: filter },
      {
        $lookup: {
          from: "manufacturers",
          localField: "manufacturer",
          foreignField: "_id",
          as: "manufacturer",
        },
      },
      {
        $unwind: {
          path: "$manufacturer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "warehouses",
          localField: "warehouse",
          foreignField: "_id",
          as: "warehouse",
        },
      },
      {
        $unwind: {
          path: "$warehouse",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          itemName: 1,
          clei: 1,
          type: 1,
          description: 1,
          extDescription: 1,
          image: 1,
          nonInventory: 1,
          heci: 1,
          itemGLCode: 1,
          weight: 1,
          country: 1,
          primaryLocation: 1,
          taxGoodCategory: 1,
          status: 1,
          deletedAt: 1,
          createdAt: 1,
          updatedAt: 1,
          manufacturer: {
            _id: "$manufacturer._id",
            name: "$manufacturer.manufacturer",
          },
          category: {
            _id: "$category._id",
            name: "$category.category",
          },
          warehouse: {
            _id: "$warehouse._id",
            name: "$warehouse.name",
          },
        },
      },
    ];

    // Apply pagination if not disabled
    if (disablePagination !== "true") {
      if (Object.keys(sort).length > 0) {
        pipeline.push({ $sort: sort });
      }

      pipeline.push({ $skip: skip }, { $limit: Number(limit) });
    }

    const items = await Item.aggregate(pipeline);
    const total = await Item.countDocuments(filter);

    if (items.length === 0) {
      res.status(200).json({
        message: "No items found",
        data: [],
        pagination:
          disablePagination === "true"
            ? undefined
            : {
              total,
              page: Number(page),
              limit: Number(limit),
              pages: Math.ceil(total / Number(limit)),
            },
      });
    } else {
      const countryIds = [
        ...new Set(items.map((item: any) => item.country).filter(Boolean)),
      ];

      let countryNameMap: Record<string, string> = {};
      const locationData = await getLocation(countryIds);

      if (locationData.success) {
        countryNameMap = locationData.data.countryNames || {};
      }

      // Transform image to signed URL (first image only)
      for (const item of items) {
        item.countryName = countryNameMap[item.country] || "";
        if (item.image && item.image.length > 0) {
          item.image = [await getS3Parallel(item.image[0])];
        } else {
          item.image = [];
        }
      }

      res.status(200).json({
        message: "Items fetched successfully",
        data: items,
        pagination:
          disablePagination === "true"
            ? undefined
            : {
              total,
              page: Number(page),
              limit: Number(limit),
              pages: Math.ceil(total / Number(limit)),
            },
      });
    }
  } catch (error) {
    next(error);
  }
};

export const getItemById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Item = getItemModel(dbName);
    const { id } = req.params;

    const item = await Item.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
          deletedAt: null,
          status: "Active",
        },
      },
      {
        $lookup: {
          from: "manufacturers", // collection name (lowercase plural by default)
          localField: "manufacturer",
          foreignField: "_id",
          as: "manufacturer",
        },
      },
      {
        $unwind: {
          path: "$manufacturer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "warehouses",
          localField: "warehouse",
          foreignField: "_id",
          as: "warehouse",
        },
      },
      {
        $unwind: {
          path: "$warehouse",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          itemName: 1,
          clei: 1,
          type: 1,
          description: 1,
          extDescription: 1,
          image: 1,
          nonInventory: 1,
          heci: 1,
          itemGLCode: 1,
          weight: 1,
          country: 1,
          primaryLocation: 1,
          taxGoodCategory: 1,
          status: 1,
          deletedAt: 1,
          createdAt: 1,
          updatedAt: 1,

          manufacturer: {
            _id: "$manufacturer._id",
            name: "$manufacturer.manufacturer",
          },
          category: {
            _id: "$category._id",
            name: "$category.category",
          },
          warehouse: {
            _id: "$warehouse._id",
            name: "$warehouse.name",
          },
        },
      },
    ]);

    if (item.length === 0) {
      res.status(200).json({
        message: "Item not found",
        data: [],
      });
    } else {
      if (item.length > 0) {
        const locationData = await getLocation([item[0].country]);

        if (locationData.success) {
          item[0].countryName = locationData.data.countryNames[item[0].country] || "";
        }
        if (item[0].image && item[0].image.length > 0) {
          item[0].image = await getItemImage(item[0].image);
        } else {
          item[0].image = [];
        }
      }

      res
        .status(200)
        .json({ message: "Item fetched successfully", data: item[0] });
    }
  } catch (error) {
    next(error);
  }
};

export const updateItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Item = getItemModel(dbName);
    const { id } = req.params;

    const files = req.files as {
      [profile_image: string]: Express.Multer.File[];
    };
    const body = JSON.parse(req.body.data);

    const item = await Item.findOne({ _id: id, deletedAt: null });
    if (!item) {
      res.status(201).json({
        message: "Item not found",
        data: [],
      });
    } else {
      // Check if item name is already in use
      if (body.itemName.toLowerCase() !== item.itemName.toLowerCase()) {
        const existingItem = await Item.findOne({ itemName: body.itemName });
        if (existingItem) {
          throw createHttpError(
            400,
            `Item "${body.itemName}" is already in use.`
          );
        }
      }

      // Check if manufacturer is already in use
      const getManufacturer = await getManufacturerModel(dbName).findOne({
        _id: body.manufacturer,
      });
      if (!getManufacturer) {
        throw createHttpError(
          400,
          `Manufacturer "${body.manufacturer}" is not found.`
        );
      }

      // Check if category is already in use
      const getCategory = await getCategoryModel(dbName).findOne({
        _id: body.category,
      });
      if (!getCategory) {
        throw createHttpError(400, `Category "${body.category}" is not found.`);
      }

      if (body.warehouse) {
        // Check if warehouse is already in use
        const getWarehouse = await getWarehouseModel(dbName, body.warehouse);
        if (getWarehouse && getWarehouse.length === 0) {
          throw createHttpError(
            400,
            `Warehouse "${body.warehouse}" is not found.`
          );
        }
      }

      // Image update handler
      let image: string[] = [];

      if (body.image && body.image.length > 0) {
        image = await handleImageUpdate(body.image);
      }

      // Handle images

      const profileImageFiles = files?.profile_image || [];
      if (profileImageFiles.length > 0) {
        for (const file of profileImageFiles) {
          const uploadedKey = await uploadParallel(
            file,
            `${process.env.BUCKET_FOLDER}/super_admin/users/profile_images`,
            res
          );
          image.push(uploadedKey);
        }
      }
      // Update fields
      Object.assign(item, {
        ...body,
        image,
        updatedAt: moment().toDate(),
      });

      let updatedItem = await item.save();

      res
        .status(201)
        .json({ message: "Item updated successfully", data: updatedItem });
    }
  } catch (error) {
    next(error);
  }
};

export const deleteItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Item = getItemModel(dbName);
    const { id } = req.params;

    const item = await Item.findOne({ _id: id, deletedAt: null });
    if (!item) {
      res.status(201).json({
        message: "Item not found",
        data: [],
      });
    } else {
      item.deletedAt = moment().toDate();
      item.status = "Inactive";
      await item.save();

      res.status(201).json({ message: "Item deleted successfully" });
    }
  } catch (error) {
    next(error);
  }
};

export const exportItems = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const Item = getItemModel(dbName);
    const format = req.params.export?.toLowerCase() || "excel"; // default to excel

    const items = await Item.aggregate([
      {
        $match: {
          deletedAt: null,
          status: "Active",
        },
      },
      {
        $lookup: {
          from: "manufacturers", // collection name (lowercase plural by default)
          localField: "manufacturer",
          foreignField: "_id",
          as: "manufacturer",
        },
      },
      {
        $unwind: {
          path: "$manufacturer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category",
        },
      },
      {
        $unwind: {
          path: "$category",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "warehouses",
          localField: "warehouse",
          foreignField: "_id",
          as: "warehouse",
        },
      },
      {
        $unwind: {
          path: "$warehouse",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          itemName: 1,
          clei: 1,
          type: 1,
          description: 1,
          extDescription: 1,
          // image: 1,
          nonInventory: 1,
          heci: 1,
          itemGLCode: 1,
          weight: 1,
          primaryLocation: 1,
          taxGoodCategory: 1,
          manufacturer: "$manufacturer.manufacturer",
          category: "$category.category",
          warehouse: "$warehouse.name",
          _id: 0,
        },
      },
    ]);

    if (items.length === 0) {
      res.status(201).json({
        message: "No items found",
        data: [],
      });
    } else {
      if (format === "pdf") {
        await generatePdfDownload(res, items, "Items");
      } else {
        await generateExcelDownload(res, items, "Items");
      }
    }
  } catch (error) {
    next(error);
  }
};

/* export const importItems = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const token: any = req.headers["authorization"];
    const origin: any = req.headers["origin"] || req.headers["referer"];
    const Item = getItemModel(dbName);
    const Manufacturer = getManufacturerModel(dbName);
    const Category = getCategoryModel(dbName);

    const file = req.file as Express.Multer.File;

    if (!file) {
      throw createHttpError(
        400,
        "No file uploaded. Make sure to send it as 'file' field."
      );
    }
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[] = xlsx.utils.sheet_to_json(sheet);

    const created: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];
    const bulkItemData: any[] = [];

    for (const [index, row] of rows.entries()) {
      const { errors: rowErrors, validRow } = validateItemImportRow(row);
      if (rowErrors.length) {
        errors.push({ row: index + 1, errors: rowErrors });
        continue;
      }

      const existingItem = await Item.findOne({
        itemName: validRow.itemName.trim(),
      }).collation({ locale: "en", strength: 2 });
      if (existingItem) {
        skipped.push({
          row: index + 1,
          itemName: validRow.itemName,
          reason: "Item already exists",
        });
        continue;
      }

      let manufacturer = await Manufacturer.findOne({
        manufacturer: validRow.manufacturerName.trim(),
      }).collation({ locale: "en", strength: 2 });

      if (!manufacturer) {
        manufacturer = await Manufacturer.create({
          manufacturer: validRow.manufacturerName,
          full_name: validRow.manufacturerName,
        });
      }

      let category = await Category.findOne({
        category: validRow.categoryName.trim(),
      }).collation({ locale: "en", strength: 2 });

      if (!category) {
        category = await Category.create({
          category: validRow.categoryName,
          categorySlug: slugify(validRow.categoryName),
        });
      }
      let warehouseId = null;
      if (validRow.warehouseName) {
        let warehouse = await getWarehouseSearch(
          validRow.warehouseName,
          token,
          origin
        );

        if (!warehouse || warehouse.length === 0) {
          skipped.push({
            row: index + 1,
            itemName: validRow.itemName,
            reason: "Warehouse not found/created",
          });
          continue;
        }

        const warehouseId = Array.isArray(warehouse)
          ? warehouse[0]._id
          : warehouse._id;
      }

      bulkItemData.push({
        itemName: validRow.itemName,
        manufacturer: manufacturer._id,
        clei: validRow.clei,
        type: validRow.typeName,
        description: validRow.description,
        extDescription: validRow.extDescription,
        category: category._id,
        warehouse: warehouseId,
        nonInventory: validRow.nonInventory,
        heci: validRow.heci,
        itemGLCode: validRow.glCode,
        weight: validRow.weight,
        primaryLocation: validRow.primaryLocation,
        taxGoodCategory: validRow.taxGoodCategory,
      });

      created.push({ row: index + 1, itemName: validRow.itemName });
    }

    if (bulkItemData.length > 0) {
      await Item.insertMany(bulkItemData, { ordered: false });
    }

    res.status(201).json({
      message: "Import completed",
      data: {
        created: created,
        skipped: skipped,
        errors: errors,
      },
    });
  } catch (error) {
    next(error);
  }
}; */

// export const importItems = async (req: Request, res: Response, next: NextFunction) => {
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     try {
//       const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
//       const Item = getItemModel(dbName);
//       const Manufacturer = getManufacturerModel(dbName);
//       const Category = getCategoryModel(dbName);

//       const file = req.file as Express.Multer.File;
//       if (!file) throw createHttpError(400, "No file uploaded. Make sure to send it as 'file' field.");

//       const workbook = xlsx.read(file.buffer, { type: "buffer" });
//       const sheetName = workbook.SheetNames[0];
//       const sheet = workbook.Sheets[sheetName];
//       const rows: any[] = xlsx.utils.sheet_to_json(sheet);

//       const created: any[] = [];
//       const skipped: any[] = [];
//       const errors: any[] = [];
//       const bulkItemData: any[] = [];

//       for (const [index, row] of rows.entries()) {
//         const { errors: rowErrors, validRow } = validateItemImportRow(row);
//         if (rowErrors.length) {
//           errors.push({ row: index + 1, errors: rowErrors });
//           continue;
//         }

//         const existingItem = await Item.findOne({ itemName: validRow.itemName.trim() })
//           .collation({ locale: "en", strength: 2 })
//           .session(session);

//         if (existingItem) {
//           skipped.push({ row: index + 1, itemName: validRow.itemName, reason: "Item already exists" });
//           continue;
//         }

//         let manufacturer = await Manufacturer.findOne({ manufacturer: validRow.manufacturerName.trim() })
//           .collation({ locale: "en", strength: 2 })
//           .session(session);

//         if (!manufacturer) {
//           const created = await Manufacturer.create([{
//             manufacturer: validRow.manufacturerName,
//             full_name: validRow.manufacturerName,
//           }], { session });
//           manufacturer = created[0];
//         }

//         let category = await Category.findOne({ category: validRow.categoryName.trim() })
//           .collation({ locale: "en", strength: 2 })
//           .session(session);

//         if (!category) {
//           const created = await Category.create([{
//             category: validRow.categoryName,
//             categorySlug: slugify(validRow.categoryName),
//           }], { session });
//           category = created[0];
//         }

//         const warehouse = await getWarehouseSearch(dbName, validRow.warehouseName, req.headers["x-token"] as string);
//         if (!warehouse || (Array.isArray(warehouse) && warehouse.length === 0)) {
//           skipped.push({ row: index + 1, itemName: validRow.itemName, reason: "Warehouse not found/created" });
//           continue;
//         }

//         const warehouseId = Array.isArray(warehouse) ? warehouse[0]._id : warehouse._id;

//         bulkItemData.push({
//           itemName: validRow.itemName,
//           manufacturer: manufacturer._id,
//           clei: validRow.clei,
//           type: validRow.typeName,
//           description: validRow.description,
//           extDescription: validRow.extDescription,
//           category: category._id,
//           warehouse: warehouseId,
//           nonInventory: validRow.nonInventory,
//           heci: validRow.heci,
//           itemGLCode: validRow.glCode,
//           weight: validRow.weight,
//           primaryLocation: validRow.primaryLocation,
//           taxGoodCategory: validRow.taxGoodCategory,
//         });

//         created.push({ row: index + 1, itemName: validRow.itemName });
//       }

//       if (bulkItemData.length > 0) {
//         await Item.insertMany(bulkItemData, { session, ordered: false });
//       }

//       await session.commitTransaction();
//       res.status(200).json({
//         message: "Import completed",
//         data: {
//           created,
//           skipped,
//           errors,
//         },
//       });
//     } catch (error) {
//       await session.abortTransaction();
//       next(error);
//     } finally {
//       session.endSession();
//     }
//   };


export const importItems = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    const token: any = req.headers["authorization"];
    const origin: any = req.headers["origin"] || req.headers["referer"];
    const Item = getItemModel(dbName);
    const Manufacturer = getManufacturerModel(dbName);
    const Category = getCategoryModel(dbName);

    const file = req.file as Express.Multer.File;
    if (!file) throw createHttpError(400, "No file uploaded.");

    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    const created: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    const validRows = rows
      .map((row, i) => {
        const { errors: rowErrors, validRow } = validateItemImportRow(row);
        if (rowErrors.length) {
          errors.push({ row: i + 1, errors: rowErrors });
          return null;
        }
        return { index: i + 1, data: validRow };
      })
      .filter(Boolean) as { index: number; data: any }[];

    if (validRows.length === 0) {
       res.status(400).json({ message: "No valid rows to process", errors });
       return
    }

    // Collect unique values
    const itemNames = validRows.map(v => v.data.itemName.trim());
    const manufacturerNames = [...new Set(validRows.map(v => v.data.manufacturerName.trim()))];
    const categoryNames = [...new Set(validRows.map(v => v.data.categoryName.trim()))];
    const warehouseNames = [...new Set(validRows.map(v => v.data.warehouseName?.trim()).filter(Boolean))];

    // Fetch existing from DB
    const [existingItems, existingManufacturers, existingCategories] = await Promise.all([
      Item.find({ itemName: { $in: itemNames } }).collation({ locale: "en", strength: 2 }),
      Manufacturer.find({ manufacturer: { $in: manufacturerNames } }).collation({ locale: "en", strength: 2 }),
      Category.find({ category: { $in: categoryNames } }).collation({ locale: "en", strength: 2 }),
    ]);

    const itemSet = new Set(existingItems.map((i: any) => i.itemName.toLowerCase()));
    const manufacturerMap = new Map(existingManufacturers.map((m: any) => [m.manufacturer.toLowerCase(), m]));
    const categoryMap = new Map(existingCategories.map((c: any) => [c.category.toLowerCase(), c]));

    // Create missing manufacturers
    const newManufacturers = manufacturerNames
      .filter(name => !manufacturerMap.has(name.toLowerCase()))
      .map(name => ({ manufacturer: name, full_name: name }));
    const createdManufacturers = await Manufacturer.insertMany(newManufacturers);
    createdManufacturers.forEach(m => manufacturerMap.set(m.manufacturer.toLowerCase(), m));

    // Create missing categories
    const newCategories = categoryNames
      .filter(name => !categoryMap.has(name.toLowerCase()))
      .map(name => ({ category: name, categorySlug: slugify(name) }));
    const createdCategories = await Category.insertMany(newCategories);
    createdCategories.forEach(c => categoryMap.set(c.category.toLowerCase(), c));

    // 🛠 Get warehouse list from API (external)
    const warehouseList = await getWarehousesName(warehouseNames, token, origin); // Expected to return [{ name, _id }]
    const warehouseMap = new Map(
      (warehouseList || []).map((wh: any) => [wh.name.toLowerCase(), wh._id])
    );

    // Prepare insert
    const bulkItemData = validRows.flatMap(({ index, data }) => {
      const itemNameKey = data.itemName.toLowerCase();
      const manufacturer = manufacturerMap.get(data.manufacturerName.toLowerCase());
      const category = categoryMap.get(data.categoryName.toLowerCase());

      if (itemSet.has(itemNameKey)) {
        skipped.push({ row: index, itemName: data.itemName, reason: "Item already exists" });
        return [];
      }

      if (!manufacturer || !category) {
        skipped.push({ row: index, itemName: data.itemName, reason: "Missing manufacturer or category" });
        return [];
      }

      let warehouseId = null;
      if (data.warehouseName) {
        warehouseId = warehouseMap.get(data.warehouseName.toLowerCase());
        if (!warehouseId) {
          skipped.push({ row: index, itemName: data.itemName, reason: "Warehouse not found" });
          return [];
        }
      }

      created.push({ row: index, itemName: data.itemName });

      return [{
        itemName: data.itemName,
        manufacturer: manufacturer._id,
        clei: data.clei,
        type: data.typeName,
        description: data.description,
        extDescription: data.extDescription,
        category: category._id,
        warehouse: warehouseId,
        nonInventory: data.nonInventory,
        heci: data.heci,
        itemGLCode: data.glCode,
        weight: data.weight,
        primaryLocation: data.primaryLocation,
        taxGoodCategory: data.taxGoodCategory,
      }];
    });

    if (bulkItemData.length > 0) {
      await Item.insertMany(bulkItemData, { ordered: false });
    }

    res.status(201).json({
      message: "Import completed",
      data: { created, skipped, errors },
    });
    return;
  } catch (error) {
    next(error);
  }
};

export const sampleItemImport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sampleData } = require("../config/sampleData-items");
    await generateExcelDownload(res, sampleData, "Items");
  } catch (error) {
    next(error);
  }
};

export const checkWarehouseAssigned = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = req.params;
    const dbName = (req.headers["x-db-name"] as string) || DB_NAME;
    
    const ItemModel = getItemModel(dbName);
    const assigned = await ItemModel.exists({ warehouse: warehouseId });

    res.status(200).json({ assigned: !!assigned });
    return;
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};
