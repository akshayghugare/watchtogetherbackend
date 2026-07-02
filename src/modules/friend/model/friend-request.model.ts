import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";

export type FriendRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export interface FriendRequestAttributes {
  id: string;
  senderId: string;
  receiverId: string;
  status: FriendRequestStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export type FriendRequestCreationAttributes = Optional<FriendRequestAttributes, "id" | "status">;

export class FriendRequest
  extends Model<FriendRequestAttributes, FriendRequestCreationAttributes>
  implements FriendRequestAttributes
{
  declare id: string;
  declare senderId: string;
  declare receiverId: string;
  declare status: FriendRequestStatus;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare sender?: User;
  declare receiver?: User;
}

FriendRequest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    receiverId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("PENDING", "ACCEPTED", "REJECTED", "CANCELLED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
  },
  {
    sequelize,
    modelName: "FriendRequest",
    tableName: "friend_requests",
    indexes: [
      { fields: ["receiver_id", "status"] },
      { fields: ["sender_id", "receiver_id"], unique: true },
    ],
  },
);

FriendRequest.belongsTo(User, { foreignKey: "senderId", as: "sender" });
FriendRequest.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });

export default FriendRequest;
