import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";
import ChatMessage from "./chat-message.model";

export interface MessageReactionAttributes {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MessageReactionCreationAttributes = Optional<MessageReactionAttributes, "id">;

export class MessageReaction
  extends Model<MessageReactionAttributes, MessageReactionCreationAttributes>
  implements MessageReactionAttributes
{
  declare id: string;
  declare messageId: string;
  declare userId: string;
  declare emoji: string;

  declare user?: User;
}

MessageReaction.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    messageId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "chat_messages", key: "id" },
      onDelete: "CASCADE",
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    emoji: { type: DataTypes.STRING(32), allowNull: false },
  },
  {
    sequelize,
    modelName: "MessageReaction",
    tableName: "message_reactions",
    indexes: [{ fields: ["message_id", "user_id", "emoji"], unique: true }],
  },
);

MessageReaction.belongsTo(User, { foreignKey: "userId", as: "user" });
ChatMessage.hasMany(MessageReaction, { foreignKey: "messageId", as: "reactions" });

export default MessageReaction;
