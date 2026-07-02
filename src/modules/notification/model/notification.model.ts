import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";

export type NotificationType =
  | "FRIEND_REQUEST"
  | "FRIEND_ACCEPTED"
  | "MOVIE_STARTED"
  | "MOVIE_INVITATION"
  | "INCOMING_CALL"
  | "NEW_MESSAGE"
  | "ROOM_INVITE"
  | "MEMBER_JOINED"
  | "HOST_TRANSFERRED"
  | "SYSTEM";

export interface NotificationAttributes {
  id: string;
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  imageUrl: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NotificationCreationAttributes = Optional<
  NotificationAttributes,
  "id" | "actorId" | "body" | "imageUrl" | "data" | "isRead"
>;

export class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  declare id: string;
  declare recipientId: string;
  declare actorId: string | null;
  declare type: NotificationType;
  declare title: string;
  declare body: string | null;
  declare imageUrl: string | null;
  declare data: Record<string, unknown> | null;
  declare isRead: boolean;
  declare readonly createdAt: Date;

  declare actor?: User;
}

Notification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    recipientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    actorId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    type: {
      type: DataTypes.ENUM(
        "FRIEND_REQUEST",
        "FRIEND_ACCEPTED",
        "MOVIE_STARTED",
        "MOVIE_INVITATION",
        "INCOMING_CALL",
        "NEW_MESSAGE",
        "ROOM_INVITE",
        "MEMBER_JOINED",
        "HOST_TRANSFERRED",
        "SYSTEM",
      ),
      allowNull: false,
    },
    title: { type: DataTypes.STRING(150), allowNull: false },
    body: { type: DataTypes.STRING(500), allowNull: true },
    imageUrl: { type: DataTypes.STRING, allowNull: true },
    data: { type: DataTypes.JSONB, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    sequelize,
    modelName: "Notification",
    tableName: "notifications",
    indexes: [{ fields: ["recipient_id", "is_read", "created_at"] }],
  },
);

Notification.belongsTo(User, { foreignKey: "actorId", as: "actor" });

export default Notification;
