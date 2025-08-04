// socket.service.ts
import { Server, Socket } from "socket.io";
import { MessageSchema } from "../models/message.model";
import logger from "../utils/logger";
import { IMessage } from "../interfaces/message.interface";
import userCacheService from "./user-cache.service";
import { getDbConnection } from "@config/database";
import { Model } from "mongoose";
import jwt from "jsonwebtoken";
import createHttpError from "http-errors";
import moment from "moment";

interface SocketUser {
  id: string;
  companyId?: string;
}

interface MessageData {
  content: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  attachment?: {
    url: string;
    type: string;
  };
}

export const getMessageModel = (dbName: string): Model<IMessage> => {
  const connection = getDbConnection(dbName);
  return (
    connection.models.Message ||
    connection.model<IMessage>("Message", MessageSchema)
  );
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const socketUserMap = new Map<string, { userId: string; company_id: string }>();

const configureSocket = (io: Server) => {

  // 🔐 Authentication or guest middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(" ")[1];

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as SocketUser;
        socket.data.user = decoded;
        socket.data.isAuthenticated = true;
        return next();
      }

      // Allow guest connection
      socket.data.user = {
        id: null,
        company_id: null,
        role: "guest",
      };
      socket.data.isAuthenticated = false;
      return next();
    } catch (error: any) {
      logger.error(`Socket authentication failed: ${error.message}`);
      return next(new Error("Authentication failed"));
    }
  });

  // 🔄 Socket connection handler
  io.on("connection", async (socket: Socket & { data: { user: SocketUser; isAuthenticated: boolean } }) => {
    const isAuthenticated = socket.data.isAuthenticated;

    if (!isAuthenticated) {

      // ✅ Guest can join rooms
      socket.on("join_public_room", (roomName: string) => {
        const room = `public:${roomName}`;
        socket.join(room);
      });

      // ✅ Guest can send messages
      socket.on("public_message", ({ roomName, content, assignee, userId }) => {
        const room = `public:${roomName}`;
        socket.join(room);
        if (assignee) {
          io.to(`User:${assignee}`).emit("public_message", {
            from: "guest",
            content,
            timestamp: moment().toDate(),
          });
        } else if (userId) {
          io.to(`User:${userId}`).emit("public_message", {
            from: "guest",
            content,
            timestamp: moment().toDate(),
          });
        }
      });

      return;
    }

    // ✅ Authenticated user logic
    const { id: userId, company_id } = socket.data.user;

    const dbName = `${company_id}${process.env.DB_SUFFIX}`;
    const Message = getMessageModel(dbName);

    logger.info(`User connected: ${userId}`);

    // Cache userId for disconnect fallback
    socketUserMap.set(socket.id, { userId, company_id });

    // Join relevant rooms
    socket.join(`user:${userId}`);
    if (company_id) socket.join(`company:${company_id}`);
    // Message Creation Handler
    socket.on("create_message", async (messageData: MessageData, callback) => {
      try {
        // Validate sender exists
        const user = await userCacheService.verifyUserExists(messageData.senderId, dbName);

        // Create and save message
        const message = (await Message.create({
          ...messageData,
          status: "delivered",
          metadata: {
            ipAddress: socket.handshake.address,
            userAgent: socket.handshake.headers["user-agent"],
          },
        })) as IMessage;

        // Broadcast based on message type
        if (message.recipientId) {
          io.to(`user:${message.recipientId}`).emit("new_message", message);
        } else if (message.groupId) {
          io.to(`group:${message.groupId}`).emit("new_message", message);
        }

        callback({ success: true, message });
      } catch (error: any) {
        logger.error(`Message creation error: ${error.message}`);
        callback({ success: false, error: "Failed to create message" });
      }
    });

    // Message Status Handler
    socket.on("message_seen", async (messageId: string) => {
      try {
        const Message = getMessageModel(dbName);
        const message = await Message.findById(messageId);
        if (!message) return;

        // Verify recipient and update status
        if (message.recipientId === socket.data.user.id) {
          const messagesData = await message.markAsSeen();
          io.to(`user:${message.senderId}`).emit("message_status", {
            id: message.id,
            status: "seen",
          });
        }
      } catch (error: any) {
        logger.error(`Message status update error: ${error.message}`);
      }
    });

    // Typing Indicator Handler
    socket.on("typing", ({ recipientId, isTyping }: { recipientId: string, isTyping: boolean }) => {
      const senderId = socket.data.user.id;

      io.to(`user:${recipientId}`).emit("typing", {
        from: senderId,
        isTyping,
      });
    });

    // Reaction Handler
    socket.on("addreaction", async (data) => {
      try {
        const user = socket.data.user;
        const { id: userId } = user;
        const { messageId, emoji } = data;

        if (!messageId || !emoji) {
          throw new Error("messageId and emoji are required");
        }

        const Message = getMessageModel(dbName);
        const message = await Message.findOne({ _id: messageId, isDeleted: false });

        if (!message) {
          return;
        }

        const updatedMessage = await message.addReaction(userId, emoji);

        const recipients = [`user:${message.senderId}`, `user:${message.recipientId}`];
        recipients.forEach((room) => {
          io.to(room).emit("addreaction", {
            userId,
            messageId,
            emoji,
            updatedMessage,
          });
        });

        logger.info(`[addreaction] User ${userId} reacted to message ${messageId} with "${emoji}"`);
      } catch (error) {
        logger.error("[addreaction] Error:", error);
      }
    });

    socket.on("bulk_message_seen", async (data) => {
      try {
        const user = socket.data.user;
        const userId = user?.id;
        const { senderId } = data;

        if (!userId) throw createHttpError(401, "Unauthenticated");
        if (!dbName) throw createHttpError(400, "Missing database name");
        if (!senderId) throw createHttpError(400, "senderId is required");

        const recipientId = userId;
        const Message = getMessageModel(dbName);

        // 1️⃣ Fetch unseen messages first
        const unseenMessages = await Message.find({
          senderId,
          recipientId,
          status: { $ne: "seen" },
          isDeleted: false,
        });

        // 2️⃣ Update them
        const now = moment().toDate();
        await Message.updateMany(
          {
            senderId,
            recipientId,
            status: { $ne: "seen" },
            isDeleted: false,
          },
          {
            $set: { status: "seen", seenAt: now },
          }
        );

        // 3️⃣ Prepare updated messages
        const updatedMessages = unseenMessages.map((msg) => ({
          ...msg.toObject(),
          status: "seen",
          seenAt: now,
        }));

        const updatedCount = updatedMessages.length;

        const payload = {
          recipientId,
          updatedCount,
          result: updatedMessages,
        };

        // 4️⃣ Emit to both sender and recipient
        io.to(`user:${senderId}`).emit("bulk_message_seen", payload);
        io.to(`user:${recipientId}`).emit("bulk_message_seen", payload);

        logger.info(
          `[bulk_message_seen] ${updatedCount} messages from ${senderId} marked as seen by ${recipientId}`
        );
      } catch (error) {
        logger.error("[bulk_message_seen] Error:", error);
      }
    });


    socket.on("delete", async (data) => {
      try {
        const user = socket.data.user;
        const userId = user?.id;
        const { messageId } = data;

        if (!messageId || !userId) throw new Error("Missing required fields");

        const Message = getMessageModel(dbName);
        const existing = await Message.findOne({ _id: messageId, isDeleted: false });

        if (!existing) {
          socket.emit("error", { message: "Message not found" });
          return;
        }

        if (existing.senderId.toString() !== userId) {
          socket.emit("error", { message: "Not authorized to delete this message" });
          return;
        }

        const deletedMessage: any = await Message.findByIdAndUpdate(
          messageId,
          { isDeleted: true, deletedAt: moment().toDate() },
          { new: true }
        );

        const payload = {
          messageId: deletedMessage._id,
          senderId: deletedMessage.senderId,
          recipientId: deletedMessage.recipientId || null,
          groupId: deletedMessage.groupId || null,
          deletedAt: deletedMessage.deletedAt,
        };

        if (deletedMessage.groupId) {
          io.to(`group:${deletedMessage.groupId}`).emit("message_deleted", payload);
        } else {
          io.to(`user:${deletedMessage.senderId}`).emit("message_deleted", payload);
          io.to(`user:${deletedMessage.recipientId}`).emit("message_deleted", payload);
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    socket.on("edit_message", async (data) => {
      try {
        const user = socket.data.user;
        const userId = user?.id;
        const { messageId, content, replayText } = data;

        if (!dbName || !messageId || !content) {
          throw createHttpError(400, "Missing messageId/content/dbName");
        }

        const Message = getMessageModel(dbName);
        const existing: any = await Message.findOne({ _id: messageId, isDeleted: false });

        if (!existing) {
          socket.emit("edit_message_error", {
            messageId,
            message: "Message not found",
          });
          return;
        }

        if (existing.senderId.toString() !== userId) {
          socket.emit("edit_message_error", {
            messageId,
            message: "Not authorized to edit this message",
          });
          return;
        }

        const cutoff = new Date(Date.now() - 135000); // 2m 15s
        if (existing.createdAt < cutoff) {
          socket.emit("edit_message_error", {
            messageId,
            message: "Cannot edit messages older than 2 minutes 15 seconds",
          });
          return;
        }

        let updateData: any = {
          isEdited: true,
          editedAt: moment().toDate(),
        };

        if (content) {
          updateData.content = content;
        } else if (replayText) {
          updateData.replayText = replayText;
        }


        const updated: any = await Message.findByIdAndUpdate(
          messageId,
          updateData,
          { new: true }
        );

        const payload = {
          messageId,
          updatedMessage: updated,
        };

        if (updated.groupId) {
          io.to(`group:${updated.groupId}`).emit("message_edited", payload);
        } else {
          io.to(`user:${updated.senderId}`).emit("message_edited", payload);
          io.to(`user:${updated.recipientId}`).emit("message_edited", payload);
        }
      } catch (error) {
        socket.emit("edit_message_error", {
          message: "Something went wrong while editing the message",
        });
      }
    });

    socket.on("online", async (data) => {
      const { company_id, id: userId } = socket.data.user;
      const dbName = `${company_id}${process.env.DB_SUFFIX}`;
      let userID;
      // Update cached user record
      if (data && data.userId) {
        userID = data.userId
      } else {
        userID = userId
      }
      try {
        await userCacheService.updateCachedUser(userID, dbName, {
          isOnline: true,
        });

        const Message = getMessageModel(dbName);
        await Message.updateMany(
          { recipientId: userID, status: "sent" },
          { $set: { status: "delivered" } }
        );

        // ⏳ Wait for 500ms before fetching
        await wait(500);

        // ✅ Emit full cached user list to this socket only (or all users if needed)
        const allCachedUsers = await userCacheService.getAllCachedUsers(dbName);
        io.to(`company:${company_id}`).emit("onlineUsers", allCachedUsers); // 🔁 Send to connected user

        logger.info(`User marked online and cached list sent: ${userID}`);
      } catch (err) {
        logger.error(`Error updating online status for user ${userID}: ${err}`);
      }
    });

    // Disconnection Handler
    socket.on("offline", async (data) => {
      const { company_id, id: userId } = socket.data.user;
      const dbName = `${company_id}${process.env.DB_SUFFIX}`;
      logger.info(`User disconnected: ${data.userId}`);

      let userID;
      // Update cached user record
      if (data && data.userId) {
        userID = data.userId
      } else {
        userID = userId
      }
      try {
        await userCacheService.updateCachedUser(userID, dbName, {
          isOnline: false,
        });

        // ⏳ Wait for 500ms before fetching
        await wait(500);

        // Send updated cached user list to company
        const allCachedUsers = await userCacheService.getAllCachedUsers(dbName);
        io.to(`company:${company_id}`).emit("all_cached_users", allCachedUsers);

        logger.info(`User marked offline and updates emitted: ${userID}`);
      } catch (err) {
        logger.error(`Error during disconnect cleanup for ${userID}: ${err}`);
      }
    });

    // Handle disconnect (e.g. tab close, crash, network loss)
    socket.on("disconnect", async (reason) => {
      try {
        const cached = socketUserMap.get(socket.id);
        const userID = socket.data?.user?.id || cached?.userId;
        const compID = socket.data?.user?.company_id || cached?.company_id;

        if (!userID || !compID) {
          console.warn(`⚠️ Disconnect received but no user data for socket ${socket.id}`);
          return;
        }


        const dbName = `${compID}${process.env.DB_SUFFIX}`;

        await userCacheService.updateCachedUser(userID, dbName, {
          isOnline: false,
        });

        await wait(500);

        const allCachedUsers = await userCacheService.getAllCachedUsers(dbName);
        io.to(`company:${compID}`).emit("all_cached_users", allCachedUsers);

        logger.info(`✅ Disconnection cleanup complete for user: ${userID}`);
      } catch (err) {
        logger.error(`❌ Error during disconnect cleanup for socket ${socket.id}:`, err);
      } finally {
        socketUserMap.delete(socket.id);
      }
    });

  });
};

export default configureSocket;
