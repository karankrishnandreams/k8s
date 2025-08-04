import { Document } from "mongoose";

interface IAttachment {
  url: string;
  type: "image" | "video" | "document" | "audio";
  filename?: string;
  size?: number;
}

interface IReaction {
  userId: string;
  emoji: string;
}

interface IMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface IMessage extends Document {
  content: string;
  replayText: string;
  replayId: string;
  senderId: string;
  recipientId?: string;
  groupId?: string;
  attachment?: IAttachment;
  status: "sent" | "delivered" | "seen" | "failed";
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  reactions: IReaction[];
  replyTo?: string;
  metadata: IMetadata;

  // Methods
  softDelete: () => Promise<void>;
  markAsSeen: () => Promise<IMessage>;
  addReaction: (userId: string, emoji: string) => Promise<IMessage>;
}

export interface ICachedUser {
  userId: string;
  name?: string;
  profile_image?: string;
  lastUpdated?: Date;
  createdAt?: Date; // from timestamps: true
  updatedAt?: Date; // from timestamps: true
}

export interface IUserChatMeta {
  userId: string;
  targetUserId: string;
  isPinned: boolean;
  isFavourited: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
