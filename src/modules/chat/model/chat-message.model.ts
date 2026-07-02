import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";
import Room from "../../room/model/room.model";

export type MessageType = "TEXT" | "IMAGE" | "VIDEO" | "FILE" | "VOICE_NOTE" | "GIF" | "SYSTEM";

export interface ChatMessageAttributes {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  replyToId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  isPinned: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ChatMessageCreationAttributes = Optional<
  ChatMessageAttributes,
  | "id"
  | "type"
  | "content"
  | "fileUrl"
  | "fileName"
  | "fileSize"
  | "replyToId"
  | "isEdited"
  | "isDeleted"
  | "isPinned"
>;

export class ChatMessage
  extends Model<ChatMessageAttributes, ChatMessageCreationAttributes>
  implements ChatMessageAttributes
{
  declare id: string;
  declare roomId: string;
  declare senderId: string;
  declare type: MessageType;
  declare content: string | null;
  declare fileUrl: string | null;
  declare fileName: string | null;
  declare fileSize: number | null;
  declare replyToId: string | null;
  declare isEdited: boolean;
  declare isDeleted: boolean;
  declare isPinned: boolean;
  declare readonly createdAt: Date;

  declare sender?: User;
  declare replyTo?: ChatMessage;
}

ChatMessage.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    roomId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "rooms", key: "id" },
      onDelete: "CASCADE",
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    type: {
      type: DataTypes.ENUM("TEXT", "IMAGE", "VIDEO", "FILE", "VOICE_NOTE", "GIF", "SYSTEM"),
      allowNull: false,
      defaultValue: "TEXT",
    },
    content: { type: DataTypes.TEXT, allowNull: true },
    fileUrl: { type: DataTypes.STRING(2048), allowNull: true },
    fileName: { type: DataTypes.STRING(255), allowNull: true },
    fileSize: { type: DataTypes.INTEGER, allowNull: true },
    replyToId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "chat_messages", key: "id" },
      onDelete: "SET NULL",
    },
    isEdited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isPinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "ChatMessage",
    tableName: "chat_messages",
    indexes: [{ fields: ["room_id", "created_at"] }, { fields: ["sender_id"] }],
  },
);

ChatMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });
ChatMessage.belongsTo(Room, { foreignKey: "roomId", as: "room" });
ChatMessage.belongsTo(ChatMessage, { foreignKey: "replyToId", as: "replyTo" });

export default ChatMessage;
