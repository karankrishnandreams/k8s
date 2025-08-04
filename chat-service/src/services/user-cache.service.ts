import { getDbConnection } from "@config/database";
import { ICachedUser } from "@interfaces/message.interface";
import { CachedUserSchema } from "@models/message.model";
import { Model } from "mongoose";
import kongAxios, { CustomAxiosRequestConfig } from "./kong.service";
import moment from "moment";

export const getCatchedUserModel = (dbName: string): Model<ICachedUser> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.CachedUser ||
    connection.model<ICachedUser>("CachedUser", CachedUserSchema)
  );
};

// 🟩 Verify and Cache User
export const verifyUserExists = async (
  userId: string,
  dbName: string
): Promise<any> => {
  const CachedUser = getCatchedUserModel(dbName);
  const cached = await CachedUser.findOne({ userId });
  if (cached?.name && cached.profile_image) return cached;

  try {
    const companyConfig: CustomAxiosRequestConfig = {
      method: "get",
      url: `/user/public/company/user/socket-detail/${userId}`,
      data: {
        dbName,
      },
    };

    // if (cached) {
    //   response.data.isOnline = cached.
    // }


    const response: any = await kongAxios(companyConfig);

    return await cacheUser(response.data, dbName);
  } catch (error) {
    throw new Error("User verification failed");
  }
};

// 🟩 Cache User Data
export const cacheUser = async (
  userData: any,
  dbName: string
): Promise<any> => {
  const CachedUser = getCatchedUserModel(dbName);
  const result = await CachedUser.findOneAndUpdate(
    { userId: userData.data._id },
    {
      name: userData.data.userName,
      profile_image: userData.data.profile_image || "",
      lastUpdated: moment().toDate(),
    },
    { upsert: true }
  );
  return result;
};

// 🟩 Batch Cache Users
export const cacheUsers = async (
  users: any[],
  dbName: string
): Promise<any[]> => {
  if (!Array.isArray(users)) {
    throw new Error("Invalid input: expected an array of users");
  }

  const CachedUser = getCatchedUserModel(dbName);

  const bulkOps = users.map((user) => ({
    updateOne: {
      filter: { userId: user._id },
      update: {
        $set: {
          userId: user._id,
          name: user.userName,
          profile_image: user.profile_image || "",
          lastUpdated: moment().toDate(),
        },
      },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    await CachedUser.bulkWrite(bulkOps);
  }

  return await CachedUser.find({ userId: { $in: users.map((u) => u._id) } });
};

// 🟩 Get Cached User
export const getCachedUser = async (userId: string, dbName: string) => {
  const CachedUser = getCatchedUserModel(dbName);
  return await CachedUser.findOne({ userId });
};

export const getCachedUsers = async (
  userIds: string[],
  dbName: string
): Promise<any[]> => {
  const CachedUser = getCatchedUserModel(dbName);

  // Step 1: Try to get all from cache
  const cachedUsers = await CachedUser.find({ userId: { $in: userIds } });

  const cachedIds = cachedUsers.map((user) => user.userId);
  const missingIds = userIds.filter((id) => !cachedIds.includes(id));

  // Step 2: If all found in cache, return immediately
  if (missingIds.length === 0) {
    return cachedUsers;
  }

  try {
    // Step 3: Fetch missing users from external service (Kong)
    const companyConfig: CustomAxiosRequestConfig = {
      method: "post",
      url: `/user/public/company/user/socket-details`,
      data: {
        dbName,
        ids: missingIds,
      },
    };

    const response: any = await kongAxios(companyConfig);

    // Extract the user array from response.data
    const usersArray = Array.isArray(response.data)
      ? response.data
      : response.data && Array.isArray(response.data.data)
        ? response.data.data
        : null;

    if (!usersArray) {
      throw new Error("Invalid response structure: no user array found");
    }

    // Step 4: Cache newly fetched users
    const newlyCachedUsers = await cacheUsers(usersArray, dbName);

    // Step 5: Return combined cached + newly cached users
    return [...cachedUsers, ...newlyCachedUsers];
  } catch (error) {
    throw new Error("User verification failed");
  }
};

// 🟩 Update multiple users' cache
export const refreshUsersCache = async (userIds: string[], dbName: string) => {
  try {
    const CachedUser = getCatchedUserModel(dbName);

    const companyConfig: CustomAxiosRequestConfig = {
      method: "post",
      url: "/user/public/company/webhook/update",
      //   data: {
      //     id: subscription.metadata.companyObjId,
      //     subscriptionStartDate: new Date(subscription.current_period_start * 1000),
      //     subscriptionEndDate: new Date(subscription.current_period_end * 1000),
      //   },
    };

    const response: any = await kongAxios(companyConfig);
    // const response = await axios.post(
    //   `${userServiceUrl}/internal/users/batch`,
    //   {
    //     userIds,
    //   },
    //   {
    //     headers: {
    //       "x-internal-auth": process.env.INTERNAL_AUTH_TOKEN,
    //     },
    //   }
    // );

    await cacheUsers(response.data.users, dbName);
  } catch (error: any) {
    throw new Error(`Failed to refresh users cache: ${error.message}`);
  }
};

export const updateCachedUser = async (
  userId: string,
  dbName: string,
  updates: Partial<{ isOnline: boolean; }>
) => {
  const CachedUser = getCatchedUserModel(dbName);
  const updated = await CachedUser.findOneAndUpdate(
    { userId },
    { $set: updates },
    { new: true, upsert: true }
  ).lean();
  return updated;
};

export const getAllCachedUsers = async (dbName: string): Promise<ICachedUser[]> => {
  const CachedUser = getCatchedUserModel(dbName);
  return await CachedUser.find().lean();
};

export default {
  verifyUserExists,
  cacheUser,
  cacheUsers,
  getCachedUser,
  refreshUsersCache,
  getCachedUsers,
  updateCachedUser,
  getAllCachedUsers,
};
