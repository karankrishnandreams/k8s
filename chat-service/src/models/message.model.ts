import { Schema } from "mongoose";
import { IMessage, IUserChatMeta } from "@interfaces/message.interface";

// 🟩 Main Message Schema
const MessageSchema: Schema<IMessage> = new Schema<IMessage>(
  {
    content: {
      type: String,
      required: [true, "Content is required"],
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    replayText: {
      type: String,
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    replayId: {
      type: String,
      index: false,
    },
    senderId: {
      type: String,
      required: [true, "Sender ID is required"],
      index: true,
    },
    recipientId: {
      type: String,
      required: function () {
        return !this.groupId;
      },
    },
    groupId: {
      type: String,
      required: function () {
        return !this.recipientId;
      },
    },
    attachment: {
      url: String,
      type: {
        type: String,
        enum: ["image", "video", "document", "audio"],
      },
      filename: String,
      size: Number,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen", "failed"],
      default: "sent",
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    reactions: [
      {
        userId: String,
        emoji: String,
      },
    ],
    replyTo: {
      type: String,
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// 🟩 Virtuals
MessageSchema.virtual("sender", {
  ref: "CachedUser",
  localField: "senderId",
  foreignField: "userId",
  justOne: true,
});

MessageSchema.virtual("recipient", {
  ref: "CachedUser",
  localField: "recipientId",
  foreignField: "userId",
  justOne: true,
});

// 🟩 Methods
MessageSchema.methods.markAsSeen = async function () {
  if (this.status !== "seen") {
    this.status = "seen";
    await this.save();
  }
  return this;
};

MessageSchema.methods.addReaction = async function (
  userId: string,
  emoji: string
) {
  const existingIndex = this.reactions.findIndex(
    (r: any) => r.userId === userId
  );

  if (existingIndex >= 0) {
    if (this.reactions[existingIndex].emoji === emoji) {
      this.reactions.splice(existingIndex, 1); // remove
    } else {
      this.reactions[existingIndex].emoji = emoji; // update
    }
  } else {
    this.reactions.push({ userId, emoji });
  }

  await this.save();
  return this;
};

// 🟩 Indexes
MessageSchema.index({ senderId: 1, recipientId: 1, isDeleted: 1, createdAt: -1 });
MessageSchema.index({ groupId: 1, isDeleted: 1, createdAt: -1 });
MessageSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
MessageSchema.index({ content: "text" });


// 🟩 Cached User Schema
const CachedUserSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    profile_image: { type: String },
    lastUpdated: { type: Date, default: Date.now },
    isOnline: { type: Boolean },
  },
  { timestamps: true }
);

// 🟩 Schema
const UserChatMetaSchema: Schema<IUserChatMeta> = new Schema(
  {
    userId: { type: String, required: true, index: true },
    targetUserId: { type: String, required: true, index: true },
    isPinned: { type: Boolean, default: false },
    isFavourited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Prevent duplicate entries per user-to-user relation
UserChatMetaSchema.index({ userId: 1, targetUserId: 1 }, { unique: true });

// Expire cache after 24 hours
CachedUserSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 86400 });
CachedUserSchema.index({ name: 1 });
CachedUserSchema.index({ userId: 1, name: 1, profile_image: 1 });

export { MessageSchema, CachedUserSchema, UserChatMetaSchema };
