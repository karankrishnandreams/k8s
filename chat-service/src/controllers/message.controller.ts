import { Request, Response, NextFunction } from "express";
import { ICachedUser, IMessage, IUserChatMeta } from "@interfaces/message.interface";
import { getDbConnection } from "@config/database";
import { CachedUserSchema, MessageSchema, UserChatMetaSchema } from "@models/message.model";
import { Model, Types } from "mongoose";
import moment from "moment-timezone";
import { getS3Parallel, uploadParallel } from "@utils/auth.utils";
import { io } from "../app";
import createHttpError from "http-errors";
import { cacheUsers, getCachedUsers, verifyUserExists } from "@services/user-cache.service";
import kongAxios, { CustomAxiosRequestConfig } from "@services/kong.service";
import axios from "axios";

export const getMessageModel = (dbName: string): Model<IMessage> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Message ||
    connection.model<IMessage>("Message", MessageSchema)
  );
};

export const getCatchedUserModel = (dbName: string): Model<ICachedUser> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.CachedUser ||
    connection.model<ICachedUser>("CachedUser", CachedUserSchema)
  );
};

export const getUserChatMetaModel = (dbName: string): Model<IUserChatMeta> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.UserChatMeta ||
    connection.model<IUserChatMeta>("UserChatMeta", UserChatMetaSchema)
  );
};

export const createMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Message = getMessageModel(dbName);

    const files = req.files as {
      [attachment: string]: Express.Multer.File[];
    };

    const body = JSON.parse(req.body.data);
    const { content, senderId, recipientId, groupId, replayText, replayId } = body;

    const attachmentFile = files?.attachment?.[0];

    if (!content && !attachmentFile) {
      throw createHttpError(400, "Either content or attachment is required");
    }

    let attachmentData = undefined;

    if (attachmentFile?.buffer) {
      const uploadedUrl = await uploadParallel(
        attachmentFile,
        `${process.env.BUCKET_FOLDER}/company_admin/message/attachment`,
        res
      );

      const fileType = attachmentFile.mimetype.split("/")[0];
      const validTypes = ["image", "document"];

      attachmentData = {
        url: uploadedUrl,
        type: validTypes.includes(fileType) ? fileType : "document",
        filename: attachmentFile.originalname,
        size: attachmentFile.size,
      };
    }

    // 🟩 Check if recipient is online → Set message status
    let status: "sent" | "delivered" = "sent";
    if (recipientId) {
      const recipient = await verifyUserExists(recipientId, dbName);
      if (recipient?.isOnline) status = "delivered";
    }

    const messageDoc = new Message({
      content: content || "-",
      replayText,
      replayId,
      senderId,
      recipientId,
      groupId,
      attachment: attachmentData,
      status,
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    await messageDoc.save();

    // ✅ Fetch sender info (to emit profile)
    const senderInfo = await verifyUserExists(senderId, dbName);

    const payload = {
      message: messageDoc,
      sender: {
        userId: senderInfo.userId,
        name: senderInfo.name || senderInfo.userName || "",
        profile_image: senderInfo.profile_image || "",
      },
    };

    // ✅ Emit message and sender profile to recipient or group
    if (recipientId) {
      io.to(`user:${recipientId}`).emit("new_message", payload);
    } else if (groupId) {
      io.to(`group:${groupId}`).emit("new_message", payload);
    }

    res.status(200).json({
      status: 200,
      message: "Message created successfully",
      data: messageDoc,
    });
  } catch (error) {
    next(error);
  }
};

export const getMessageById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;

    if (!dbName) throw createHttpError(400, "Missing x-db-name header");

    const Message = getMessageModel(dbName);

    const messageId = req.params.id;

    // Validate ObjectId format
    if (!Types.ObjectId.isValid(messageId)) {
      throw createHttpError(400, "Invalid message id");
    }

    const record = await Message.findOne(
      { _id: new Types.ObjectId(messageId), isDeleted: false },
      { attachment: 1 }
    );
    if (!record) {
      throw createHttpError(404, "Message not found");
    }

    if (record.attachment?.url) {
      try {
        const signedUrl = await getS3Parallel(record.attachment.url);
        record.attachment.url = signedUrl;
      } catch (err) {
        console.warn(`Failed to generate signed URL for message ${record._id}`, err);
      }
    }

    res.status(200).json({
      status: 200,
      message: "Message fetched successfully",
      data: record,
    });
  } catch (error) {
    next(error);
  }
};


export const updateMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: string = req.headers["x-db-name"] as string;
    const Message = getMessageModel(dbName);

    const existing: any = await Message.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!existing) {
      throw createHttpError(404, "Message not found");
    }

    if (existing.senderId !== req.user.id) {
      throw createHttpError(403, "Not authorized to update this message");
    }

    // ⏱️ Restrict editing if message is older than 2 minutes 15 seconds (135000 ms)
    const now = moment().toDate();
    const cutoffTime = new Date(now.getTime() - 135000);
    if (existing.createdAt < cutoffTime) {
      throw createHttpError(403, "Cannot edit messages older than 2 minutes 15 seconds");
    }

    const updated = await Message.findByIdAndUpdate(
      req.params.id,
      {
        content: req.body.content,
        isEdited: true,
        editedAt: moment().toDate(),
      },
      { new: true }
    );

    res.status(200).json({
      status: 200,
      message: "Message updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Message = getMessageModel(dbName);

    const existing = await Message.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!existing) {
      throw createHttpError(404, "Message not found");
    }

    if (existing.senderId !== req.user.id) {
      throw createHttpError(403).json({ message: "Not authorized to delete this message" });
    }

    const deletedMessage: any = await Message.findByIdAndUpdate(
      req.params.id,
      {
        isDeleted: true,
        deletedAt: moment().toDate(),
      },
      { new: true }
    );

    // ✅ Emit to the recipient or group
    const payload = {
      messageId: req.params.id,
      senderId: existing.senderId,
      recipientId: existing.recipientId,
      groupId: existing.groupId || null,
      deletedAt: deletedMessage.deletedAt,
    };

    if (existing.groupId) {
      io.to(`group:${existing.groupId}`).emit("message_deleted", payload);
    } else if (existing.recipientId) {
      io.to(`user:${existing.recipientId}`).emit("message_deleted", payload);
      io.to(`user:${existing.senderId}`).emit("message_deleted", payload); // optionally notify sender too
    }

    res.status(200).json({
      status: 200,
      message: "Message deleted (soft)",
      data: deletedMessage,
    });
  } catch (error) {
    next(error);
  }
};

// export const updateMessageStatus = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const dbName: any = req.headers["x-db-name"] as string;
//     const Message = getMessageModel(dbName);

//     const { status } = req.body;
//     if (!["sent", "delivered", "seen", "failed"].includes(status)) {
//       res.status(400).json({ message: "Invalid status value" });
//       return;
//     }

//     console.log('status:', status);

//     const updated = await Message.findOneAndUpdate(
//       { _id: req.params.id, isDeleted: false },
//       { status },
//       { new: true }
//     );

//     if (!updated) {
//       res.status(404).json({ message: "Message not found" });
//       return;
//     }

//     // Emit status update via socket if needed
//     io.to(`user:${updated.senderId}`).emit("message_status", {
//       id: updated._id,
//       status: req.body.status,
//     });

//     res.status(200).json({
//       status: 200,
//       message: "Message status updated",
//       data: updated,
//     });
//   } catch (error) {
//     next(error);
//   }
// };

export const getChatsList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();

  try {
    const dbName = req.headers["x-db-name"] as string;
    if (!dbName) {
      throw createHttpError(400, "Missing x-db-name header");
    }

    const Message = getMessageModel(dbName);

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;
    const search = (req.query.search as string) || "";
    const status = req.query.status as string;
    const { senderId, recipientId, groupId } = req.query;

    // 🟩 Build Filters
    const filter: any = { isDeleted: false };

    if (search) {
      filter.$text = { $search: search }; // ensure text index exists on 'content'
    }

    if (status) filter.status = status;
    if (groupId) filter.groupId = groupId;

    if (senderId && recipientId) {
      filter.$or = [
        { senderId, recipientId },
        { senderId: recipientId, recipientId: senderId },
      ];
    } else {
      if (senderId) filter.senderId = senderId;
      if (recipientId) filter.recipientId = recipientId;
    }

    const beforeQuery = Date.now();

    // 🟩 Fetch Paginated Data
    const messages = await Message.find(filter)
      .sort({ [sortBy]: order })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "content senderId recipientId groupId status createdAt attachment replayText replayId isEdited reactions"
      )
      .lean(); // faster read, avoids hydration

    // 🟩 Count Total
    const totalItems = await Message.countDocuments(filter);

    const afterQuery = Date.now();

    // 🟩 Log Performance
    const totalTime = afterQuery - start;
    const mongoTime = afterQuery - beforeQuery;

    // 🟩 Send Response
    res.status(200).json({
      status: 200,
      message: "Messages fetched successfully",
      data: messages,
      page,
      totalPages: Math.ceil(totalItems / limit),
      totalItems,
    });
    return
  } catch (error) {
    console.error("Error in getChatsList:", error);
    return next(error);
  }
};

export const addMessageReaction = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Message = getMessageModel(dbName);

    const { emoji } = req.body;

    const userId = req.user.id;
    const message = await Message.findOne({
      _id: req.params.id,
      isDeleted: false,
    });

    if (!message) {
      throw createHttpError(404, "Message not found");
    }

    const updatedMessage = await message.addReaction(userId, emoji);

    // Emit to all users in the company room about the new reaction
    if (userId) {
      io.to(`User:${userId}`).emit("addreaction", {
        userId: userId,
        messageId: message._id,
        emoji,
        updatedMessage,
      });
    }

    res.status(200).json({
      status: 200,
      message: "Reaction added successfully",
      data: updatedMessage,
    });
  } catch (error) {
    console.log('err --------', error);
    next(error);
  }
};

export const listMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const logedUserId = req.user.id;
    const dbName = req.headers["x-db-name"] as string;
    const userId = req.query.senderId as string;
    const search = (req.query.search as string)?.trim()?.toLowerCase() || "";

    if (!dbName || !userId) {
      res.status(400).json({ message: "Missing dbName or senderId" });
      return;
    }

    const Message = getMessageModel(dbName);
    const UserChatMetaModel = getUserChatMetaModel(dbName);
    const CachedUser = getCatchedUserModel(dbName);

    const chatList = await Message.aggregate([
      {
        $match: {
          isDeleted: false,
          $or: [{ senderId: userId }, { recipientId: userId }],
        },
      },
      {
        $project: {
          content: 1,
          senderId: 1,
          recipientId: 1,
          createdAt: 1,
          status: 1,
          chatWith: {
            $cond: [{ $eq: ["$senderId", userId] }, "$recipientId", "$senderId"],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$chatWith",
          lastMessage: { $first: "$content" },
          lastMessageTime: { $first: "$createdAt" },
          lastMessageStatus: { $first: "$status" },
          senderId: { $first: "$senderId" },
          recipientId: { $first: "$recipientId" },
        },
      },
    ]);

    const chatPartnerIds = chatList.map((c) => String(c._id));
    const missingUserIds: string[] = [];

    const cachedUsers = await getCachedUsers(chatPartnerIds, dbName);
    const cachedUserMap = new Map<string, any>();
    cachedUsers.forEach((u) => {
      cachedUserMap.set(u.userId, u);
      if (!u.name || !u.profile_image) {
        missingUserIds.push(u.userId);
      }
    });

    let searchedUsers: any[] = [];
    let enrichedFetchedUsers: any[] = [];

    const userSearchFilter: any = { userId: { $ne: userId } };
    if (search) userSearchFilter.name = { $regex: search, $options: "i" };
    searchedUsers = await CachedUser.find(userSearchFilter).lean();

    if (search && searchedUsers.length === 0) {
      const kongSearchConfig: CustomAxiosRequestConfig = {
        method: "post",
        url: `/user/public/company/user/socket-details`,
        data: { dbName, search },
      };

      const response: any = await kongAxios(kongSearchConfig);
      const usersArray = Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];

      if (usersArray.length === 0) {
        res.status(200).json({
          status: 200,
          message: "Error fetching data from user service",
          error: {
            status: 200,
            message: "No users found",
            details: {},
          },
        });
        return;
      }

      const cached = await getCachedUsers(
        usersArray.map((u: { userId: any }) => u.userId),
        dbName
      );
      const isOnlineMap = new Map(cached.map((u) => [u.userId, u.isOnline]));

      const enrichedUsers = usersArray.map((u: { userId: any }) => ({
        ...u,
        isOnline: isOnlineMap.get(u.userId) ?? false,
      }));

      await cacheUsers(enrichedUsers, dbName);
      searchedUsers = enrichedUsers;
    } else if (missingUserIds.length > 0) {
      try {
        const kongSearchConfig: CustomAxiosRequestConfig = {
          method: "post",
          url: `/user/public/company/user/socket-details`,
          data: { dbName, ids: missingUserIds },
        };

        const response: any = await kongAxios(kongSearchConfig);
        const fetchedUsers: any[] = Array.isArray(response.data)
          ? response.data
          : Array.isArray(response.data?.data)
            ? response.data.data
            : [];

        const updatedUsers = fetchedUsers.map((fetchedUser) => {
          const cached = cachedUserMap.get(fetchedUser.userId);
          return {
            ...fetchedUser,
            isOnline: cached?.isOnline ?? false,
          };
        });

        await cacheUsers(updatedUsers, dbName);
        updatedUsers.forEach((u) => cachedUserMap.set(u.userId, u));

        enrichedFetchedUsers = updatedUsers;
      } catch (err) {
        console.error("❌ Error fetching user details from external service:", err);
      }
    }

    searchedUsers.forEach((u) => cachedUserMap.set(u.userId, u));
    const searchedIds = searchedUsers.map((u) => u.userId);
    const allUserIds = Array.from(new Set([...chatPartnerIds, ...searchedIds]));

    const unreadCounts = await Message.aggregate([
      {
        $match: {
          isDeleted: false,
          recipientId: userId,
          status: { $ne: "seen" },
        },
      },
      {
        $group: {
          _id: "$senderId",
          unreadCount: { $sum: 1 },
        },
      },
    ]);
    const unreadMap = new Map<string, number>();
    unreadCounts.forEach(({ _id, unreadCount }) => {
      unreadMap.set(String(_id), unreadCount);
    });

    const metaDocs = await UserChatMetaModel.find({
      userId,
      targetUserId: { $in: allUserIds },
    }).lean();

    const metaMap = new Map<string, { isPinned: boolean; isFavourited: boolean }>();
    metaDocs.forEach((meta) =>
      metaMap.set(meta.targetUserId, {
        isPinned: meta.isPinned,
        isFavourited: meta.isFavourited,
      })
    );

    const chatMap = new Map(chatList.map((c) => [String(c._id), c]));

    const enrichedUserMap = new Map<string, any>();
    if (Array.isArray(enrichedFetchedUsers) && enrichedFetchedUsers.length > 0) {
      for (const user of enrichedFetchedUsers) {
        const key = String(user.userId || user._id); // Stringify to avoid ObjectId mismatch
        if (key) enrichedUserMap.set(key, user);
      }
    }

    const resultList = search
      ? searchedUsers.map((user) => {
        const id = user.userId;
        const chat = chatMap.get(id);
        const meta = metaMap.get(id) || { isPinned: false, isFavourited: false };

        // Get enriched user info if exists
        const enrichedUser = enrichedUserMap.get(id);

        // Start with existing recipient user object
        const recipient = { ...user };

        // Patch only name and profile_image if enriched user has them
        if (enrichedUser) {
          if (enrichedUser.userName && !recipient.name) {
            recipient.name = enrichedUser.userName;
          }
          if (enrichedUser.profile_image && !recipient.profile_image) {
            recipient.profile_image = enrichedUser.profile_image;
          }
        }

        return {
          recipientId: logedUserId,
          senderId: chat?.senderId || null,
          lastMessage: chat?.lastMessage || null,
          lastMessageTime: chat?.lastMessageTime || null,
          lastMessageStatus: chat?.lastMessageStatus || null,
          unreadCount: unreadMap.get(id) || 0,
          recipient,
          isPinned: meta.isPinned,
          isFavourited: meta.isFavourited,
        };
      })
      : chatList
        .filter((chat) => !!cachedUserMap.get(String(chat._id))) // remove if user cache not found
        .map((chat) => {
          const id = String(chat._id);
          const meta = metaMap.get(id) || { isPinned: false, isFavourited: false };

          // Get enriched user info if exists
          const enrichedUser = enrichedUserMap.get(id);

          // Start with cached user object
          const recipient = { ...cachedUserMap.get(id) };

          // Patch only name and profile_image if enriched user has them
          if (enrichedUser) {
            if (enrichedUser.userName && !recipient.name) {
              recipient.name = enrichedUser.userName;
            }
            if (enrichedUser.profile_image && !recipient.profile_image) {
              recipient.profile_image = enrichedUser.profile_image;
            }
          }

          return {
            recipientId: logedUserId,
            senderId: chat.senderId,
            lastMessage: chat.lastMessage,
            lastMessageTime: chat.lastMessageTime,
            lastMessageStatus: chat.lastMessageStatus,
            unreadCount: unreadMap.get(id) || 0,
            recipient,
            isPinned: meta.isPinned,
            isFavourited: meta.isFavourited,
          };
        });

    resultList.sort((a, b) => {
      const aUnread = unreadMap.get(a.recipientId) || 0;
      const bUnread = unreadMap.get(b.recipientId) || 0;

      if (aUnread > 0 && bUnread === 0) return -1;
      if (bUnread > 0 && aUnread === 0) return 1;

      const aTime = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const bTime = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;

      return bTime - aTime;
    });


    res.status(200).json({
      status: 200,
      message: search
        ? "Search results fetched successfully"
        : "Chat list fetched successfully",
      data: resultList,
    });
  } catch (error: any) {
    console.error("Error in listMessages:");
    if (axios.isAxiosError(error)) {
      res.status(error.response?.status || 500).json({
        status: error.response?.status || 500,
        message: "Error fetching data from user service",
        error: error.response?.data || error.message,
      });
      return;
    }
    res.status(500).json({
      status: 500,
      message: "Internal Server Error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const bulkMarkMessagesSeen = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dbName: any = req.headers["x-db-name"] as string;
    const Message = getMessageModel(dbName);

    const { senderId, recipientId } = req.body;

    if (!senderId) {
      throw createHttpError(400, "senderId is required");
    }

    // Only update messages that are not already 'seen'
    const result = await Message.updateMany(
      {
        senderId,
        recipientId,
        status: { $ne: "seen" },
        isDeleted: false,
      },
      { $set: { status: "seen" } }
    );

    // Optionally emit updates to sender
    io.to(`user:${senderId}`).emit("bulk_message_seen", {
      recipientId,
      updatedCount: result.modifiedCount,
      result,
    });

    res.status(200).json({
      status: 200,
      message: "Messages marked as seen",
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleUserChatMeta = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { targetUserId, type } = req.body;
    const userId = req.user.id;

    if (!targetUserId || !["pin", "favourite"].includes(type)) {
      throw createHttpError(400, "Invalid request payload");
    }

    const fieldToToggle = type === "pin" ? "isPinned" : "isFavourited";

    const dbName = req.headers["x-db-name"] as string; // for multi-tenant setups
    const UserChatMeta = getUserChatMetaModel(dbName); // dynamically get model

    let meta = await UserChatMeta.findOne({ userId, targetUserId });

    if (!meta) {
      // Create with correct initial toggle
      meta = await UserChatMeta.create({
        userId,
        targetUserId,
        isPinned: type === "pin",
        isFavourited: type === "favourite",
      });
    } else {
      // Toggle only the specific field
      meta[fieldToToggle] = !meta[fieldToToggle];
      await meta.save();
    }

    res.status(201).json({
      success: true,
      message: `User ${type} toggled successfully`,
      data: meta,
    });
  } catch (err) {
    next(err);
  }
};

export const calendarTrigger = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Emit to guest users in a public room
    const { roomName = "general", content = "There will be an event in 15 minutes", assignee, userId, } = req.body;

    if (assignee) {
      io.to(`${roomName}:${assignee}`).emit("public_message", {
        from: "guest",
        content,
        timestamp: moment().toDate(),
      });
    } else if (userId) {
      io.to(`${roomName}:${userId}`).emit("public_message", {
        from: "guest",
        content,
        timestamp: moment().toDate(),
      });
    }

    res.status(200).json({ success: true, message: "Event sent to guest users" });
  } catch (error) {
    next(error);
  }
};
