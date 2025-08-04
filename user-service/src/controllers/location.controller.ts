import { Request, Response, NextFunction } from "express";
import { getDbConnection } from "../config/database";
import mongoose, { Model, Types } from "mongoose";
import { paginate } from "@utils/paginate";
import { ICountries } from "@interfaces/countries.interface";
import CountrySchema from "@models/countries.model";
import { IState } from "@interfaces/state.interface";
import StateSchema from "@models/state.model";
import { ICity } from "@interfaces/city.interface";
import CitySchema from "@models/city.model";
import createHttpError from "http-errors";

const getCountriesModel = (dbName: string): Model<ICountries> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Country ||
    connection.model<ICountries>("Country", CountrySchema, "country")
  );
};

const getStateModel = (dbName: string): Model<IState> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.State ||
    connection.model<IState>("State", StateSchema, "state")
  );
};

const getCityModel = (dbName: string): Model<ICity> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.City ||
    connection.model<ICity>("City", CitySchema, "city")
  );
};

const DB_NAME: any = process.env.DB_NAME;

export const getLocations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // const Location = getLocationModel(dbName);
    const { countryCode, stateCode, cityName } = req.query;

    const match: any = { isActive: true };

    if (countryCode)
      match.countryShortCode = (countryCode as string).toUpperCase();
    if (stateCode) match.stateCode = (stateCode as string).toUpperCase();
    if (cityName) match.name = new RegExp(`^${cityName}$`, "i"); // case-insensitive exact match

    let results;
    if (countryCode && stateCode) {
      if (cityName) {
        results = await getCityModel(DB_NAME).find(match);
      } else {
        results = await getStateModel(DB_NAME).find(match);
      }
    } else if (countryCode) {
      results = await getCountriesModel(DB_NAME).find(match);
    }

    res.status(200).json({
      message: "Location data retrieved successfully",
      data: results,
    });
  } catch (err) {
    console.error(err);
    next(err);
  }
};

// Get countries by phone code
export const getCountriesByPhoneCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!DB_NAME) {
      throw createHttpError(400, "Database connection missing");
    }

    const Country = getCountriesModel(DB_NAME);

    const phoneCode = req.params.phoneCode;
    if (typeof phoneCode === "string") {
      const formattedPhoneCode = `${phoneCode}`;

      const countries = await Country.find({
        // type: 'country',
        countryPhoneCode: formattedPhoneCode,
        // isActive: true,
      }).select("name countryShortCode countryPhoneCode");

      res.status(200).json({
        message: "Countries retrieved by phone code successfully",
        data: countries,
      });
    } else {
      throw createHttpError(400, "Invalid phone code format");
    }
  } catch (error: any) {
    next(error);
  }
};

// Get states by country code
export const getStatesByCountryCode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!DB_NAME) {
      throw createHttpError(400, "Database connection missing");
    }

    const State = getStateModel(DB_NAME);

    const countryCode = req.query.countryCode;
    const phoneCode =
      typeof req.query.countryPhoneCode === "string"
        ? req.query.countryPhoneCode.replace("+", "")
        : undefined;
    if (typeof countryCode === "string" || typeof phoneCode === "string") {
      const CountryDB = getCountriesModel(DB_NAME);
      let country;
      if (countryCode) {
        country = await CountryDB.findOne({
          countryShortCode: countryCode.toString().toUpperCase(),
          isActive: true,
        });
      } else if (phoneCode) {
        country = await CountryDB.findOne({
          countryPhoneCode: phoneCode,
          isActive: true,
        });
      }

      if (!country) {
        throw createHttpError(404, "Country not found");
      }

      const states = await State.find({
        countryShortCode: country.countryShortCode,
        isActive: true,
      }).select("name stateCode isActive");

      res.status(200).json({
        message: "States retrieved successfully",
        data: {
          country: {
            name: country.name,
            countryShortCode: country.countryShortCode,
            countryPhoneCode: country.countryPhoneCode,
          },
          states,
        },
      });
    } else {
      throw createHttpError(400, "Invalid country code format");
    }
  } catch (error: any) {
    next(error);
  }
};

export const getCountryList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!DB_NAME) {
      throw createHttpError(400, "Database connection missing");
    }

    const Country = getCountriesModel(DB_NAME);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || "name";
    const order = (req.query.order as string) === "asc" ? "asc" : "desc";
    const search = (req.query.search as string)?.trim();
    const disablePagination = req.query.disablePagination === "true";

    const filters: any = {};

    if (search) {
      const regex = new RegExp(search, "i");
      filters.$or = [
        { name: regex },
        { countryShortCode: regex },
        { countryPhoneCode: regex },
      ];
    }

    const projection: any = {
      _id: 1,
      name: 1,
      countryShortCode: 1,
      countryPhoneCode: 1,
      isActive: 1,
    };

    let resultData: any;
    let paginationInfo = null;

    if (disablePagination) {
      const sortField = sortBy || "name";

      resultData = await Country.find(filters)
        .select("_id name countryShortCode countryPhoneCode isActive")
        .sort({ [sortField]: order === "asc" ? 1 : -1 });
    } else {
      const result = await paginate(
        Country,
        filters,
        {
          page,
          limit,
          sortBy,
          order,
        },
        projection
      );
      resultData = result.data;
      paginationInfo = result.pagination;
    }

    res.status(200).json({
      message:
        resultData.length > 0
          ? "Countries fetched successfully"
          : "No countries found",
      data: {
        rows: resultData,
        pagination: paginationInfo,
        batchSummary: {
          totalCountries: paginationInfo?.total ?? resultData.length,
          successCount: resultData.length,
          errorCount: 0,
        },
      },
      type: "object",
    });
  } catch (error) {
    console.error("Country Fetch Error:", error);
    next(error);
  }
};

export const getStateList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!DB_NAME) {
      throw createHttpError(400, "Database connection missing");
    }

    const Location = getStateModel(DB_NAME);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || "name";
    const order = (req.query.order as string) === "asc" ? "asc" : "desc";
    const search = (req.query.search as string)?.trim();
    const disablePagination = req.query.disablePagination === "true";

    const filters: any = {};

    if (search) {
      const regex = new RegExp(search, "i");
      filters.$or = [{ name: regex }, { stateCode: regex }];
    }

    if (req.query.countryShortCode) {
      const countryDB = getCountriesModel(DB_NAME);
      const country = await countryDB
        .findOne({
          countryShortCode: req.query.countryShortCode,
        })
        .select("country_id");

      if (country) {
        filters.parent = country.country_id;
      }
    }
    if (req.query.countryPhoneCode) {
      const phoneCode =
        typeof req.query.countryPhoneCode === "string"
          ? req.query.countryPhoneCode.replace("+", "")
          : undefined;
      const countryDB = getCountriesModel(DB_NAME);
      const country = await countryDB
        .findOne({
          countryPhoneCode: phoneCode,
        })
        .select("country_id");

      if (country) {
        filters.parent = country.country_id;
      }
    } else if (req.query.id) {
      const countryDB = getCountriesModel(DB_NAME);
      const country = await countryDB
        .findOne({
          _id: req.query.id,
        })
        .select("country_id");

      if (country) {
        filters.parent = country.country_id;
      }
    }

    const projection: any = {
      _id: 1,
      name: 1,
      stateCode: 1,
      isActive: 1,
      parent: 1,
    };

    let resultData: any;
    let paginationInfo = null;

    if (disablePagination) {
      resultData = await Location.find(filters, projection).sort({
        [sortBy]: order === "asc" ? 1 : -1,
      });
    } else {
      const result = await paginate(
        Location,
        filters,
        { page, limit, sortBy, order },
        projection
      );
      resultData = result.data;
      paginationInfo = result.pagination;
    }

    res.status(200).json({
      message:
        resultData.length > 0
          ? "States fetched successfully"
          : "No states found",
      data: {
        rows: resultData,
        pagination: paginationInfo,
        batchSummary: {
          totalStates: paginationInfo?.total ?? resultData.length,
          successCount: resultData.length,
          errorCount: 0,
        },
      },
      type: "object",
    });
  } catch (error) {
    console.error("State Fetch Error:", error);
    next(error);
  }
};

export const getCityList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!DB_NAME) {
      throw createHttpError(400, "Database connection missing");
    }

    const Location = getCityModel(DB_NAME);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || "name";
    const order = (req.query.order as string) === "asc" ? "asc" : "desc";
    const search = (req.query.search as string)?.trim();
    const stateCode = (req.query.stateCode as string)?.trim();
    const disablePagination = req.query.disablePagination === "true";

    const filters: any = {};

    if (stateCode) filters.stateCode = stateCode;
    if (search) filters.name = new RegExp(search, "i");

    const projection: any = {
      _id: 1,
      name: 1,
      isActive: 1,
      stateCode: 1,
      parent: 1,
      country_code: 1,
    };

    if (req.query.id) {
      const stateDB = getStateModel(DB_NAME);
      const state = await stateDB
        .findOne({
          _id: req.query.id,
        })
        .select("state_id");

      if (state) {
        filters.parent = state.state_id;
      }
    } else if (req.query.stateCode) {
      const stateDB = getStateModel(DB_NAME);
      const state = await stateDB
        .findOne({
          stateCode: req.query.stateCode,
        })
        .select("state_id");

      if (state) {
        filters.parent = state.state_id;
      }
    }

    let resultData: any;
    let paginationInfo = null;

    if (disablePagination) {
      resultData = await Location.find(filters, projection).sort({
        [sortBy]: order === "asc" ? 1 : -1,
      });
    } else {
      const result = await paginate(
        Location,
        filters,
        { page, limit, sortBy, order },
        projection
      );
      resultData = result.data;
      paginationInfo = result.pagination;
    }

    res.status(200).json({
      message:
        resultData.length > 0 ? "city fetched successfully" : "No city found",
      data: {
        rows: resultData,
        pagination: paginationInfo,
        batchSummary: {
          totalcity: paginationInfo?.total ?? resultData.length,
          successCount: resultData.length,
          errorCount: 0,
        },
      },
      type: "object",
    });
  } catch (error) {
    console.error("City Fetch Error:", error);
    next(error);
  }
};

export const getCountryFullList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!DB_NAME) {
      throw createHttpError(400, "Database connection missing");
    }

    const Location = getCountriesModel(DB_NAME);

    const countries = await Location.find({
      _id: 1,
      name: 1,
    });

    res.status(200).json({
      message: "",
      data: countries,
      type: "array",
    });
  } catch (error) {
    console.error("Country Fetch Error:", error);
    next(error);
  }
};

export const getStateFullList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!DB_NAME) {
      throw createHttpError(400, "Database connection missing");
    }

    const countryId = req.params.id as string;
    if (!countryId || !Types.ObjectId.isValid(countryId)) {
      throw createHttpError(400, "Invalid or missing country_id");
    }

    const Location = getStateModel(DB_NAME);

    const states = await Location.find({
      _id: 1,
      name: 1,
      stateCode: 1,
      isActive: 1,
      parent: 1,
    });

    res.status(200).json({
      message: "",
      data: states,
      type: "array",
    });
  } catch (error) {
    console.error("State Fetch Error:", error);
    next(error);
  }
};

export const getLocationsbyId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  ``;
  try {
    const id = req.params.id as string;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw createHttpError(400, "Invalid or missing id");
    }

    const type = req.query.type as string;
    if (!type || !["country", "state", "city"].includes(type)) {
      throw createHttpError(
        400,
        "Type should be either Country, State or City"
      );
    }

    let result;
    if (type === "country") {
      result = await getCountriesModel(DB_NAME).findById(id);
    } else if (type === "state") {
      result = await getStateModel(DB_NAME).findById(id);
    } else if (type === "city") {
      result = await getCityModel(DB_NAME).findById(id);
    }

    if (!result) {
      throw createHttpError(404, `${type} not found`);
    }

    res.status(200).json({
      message: "Location data retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Location GetBy Id Error:", error);
    next(error);
  }
};

export const getCountryNamesByIds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ids } = req.body; // e.g., ids: ["60d...","60e..."]

    if (!Array.isArray(ids) || ids.length === 0) {
      throw createHttpError(400, "No country IDs provided");
    }

    if (!DB_NAME) {
      throw createHttpError(400, "Database connection missing");
    }

    const Location = getCountriesModel(DB_NAME);

    const countries = await Location.find(
      { _id: { $in: ids } },
      { name: 1, currency: 1 } // Project only name
    );

    console.log('countries ----', countries);
    res.status(200).json({
      message: "Countries fetched successfully",
      data: countries,
      type: "array",
    });
  } catch (error) {
    console.error("Error fetching countries by ID:", error);
    next(error);
  }
};

export const getLocationNamesByIds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      cityIds = [],
      stateIds = [],
      countryIds = [],
      currencyIds = [],
    } = req.body;

    if (!DB_NAME) {
      throw createHttpError(400, "Database connection missing");
    }

    const City = getCityModel(DB_NAME);
    const State = getStateModel(DB_NAME);
    const Country = getCountriesModel(DB_NAME);

    const promises = [
      City.find({ _id: { $in: cityIds } }, { name: 1 }),
      State.find({ _id: { $in: stateIds } }, { name: 1 }),
      Country.find({ _id: { $in: countryIds } }, { name: 1 }),
    ];
    // Only fetch currency if currencyIds is provided and not empty
    let currencies: any[] = [];
    if (currencyIds && Array.isArray(currencyIds) && currencyIds.length > 0) {
      currencies = await Country.find(
        { _id: { $in: currencyIds } },
        { currency: 1 }
      );
    }

    const [cities, states, countries] = await Promise.all(promises);

    const format = (arr: any[], field = "name") =>
      arr.reduce((acc, curr) => {
        acc[curr._id] = curr[field];
        return acc;
      }, {});

    const responseData: any = {
      cityNames: format(cities),
      stateNames: format(states),
      countryNames: format(countries),
    };

    if (currencies.length > 0) {
      responseData.currencies = format(currencies, "currency");
    }

    res.status(200).json({
      message: "Location names fetched",
      data: responseData,
    });
  } catch (error) {
    console.error("Failed to fetch location names:", error);
    next(error);
  }
};

export const getCurrency = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const Location = getCountriesModel(DB_NAME);

    const search = req.query.search as string | undefined;

    let currency;

    if (search) {
      if (mongoose.Types.ObjectId.isValid(search)) {
        currency = await Location.find(
          { _id: new mongoose.Types.ObjectId(search) },
          { currency: 1 }
        );
      } else {
        currency = await Location.find(
          { currency: { $regex: `^${search}$`, $options: "i" } },
          { currency: 1 }
        );
      }
    } else {
      currency = await Location.find({ isActive: true }, { currency: 1 });
    }

    res.status(200).json({
      message: "Currency fetched successfully",
      data: currency,
    });
  } catch (error) {
    console.error("Error fetching countries by ID:", error);
    next(error);
  }
};

export const getLocationsByName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      countryName = "",
      stateName = "",
      cityName = "",
    } = req.query as {
      countryName?: string;
      stateName?: string;
      cityName?: string;
    };

    const countryModel = getCountriesModel(DB_NAME);
    const stateModel = getStateModel(DB_NAME);
    const cityModel = getCityModel(DB_NAME);

    const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, "");

    const makeRegex = (input: string) => {
      const normalized = normalize(input);
      return new RegExp(normalized, "i");
    };

    const matchLocation = async (model: any, input: string) => {
      if (!input?.trim()) return null;

      const regex = makeRegex(input);

      const results = await model.aggregate([
        {
          $addFields: {
            normalizedName: {
              $replaceAll: {
                input: { $toLower: "$name" },
                find: " ",
                replacement: "",
              },
            },
          },
        },
        {
          $match: {
            normalizedName: { $regex: regex },
          },
        },
        {
          $limit: 1,
        },
      ]);

      return results[0] || null;
    };

    const [country, state, city] = await Promise.all([
      matchLocation(countryModel, countryName),
      matchLocation(stateModel, stateName),
      matchLocation(cityModel, cityName),
    ]);

    res.status(200).json({
      message: "Locations fetched successfully",
      data: {
        country,
        state,
        city,
      },
    });
  } catch (error) {
    next(error);
  }
};
