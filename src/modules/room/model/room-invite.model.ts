import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";
import Room from "./room.model";

export interface RoomInviteAttributes {
  id: string;
  roomId: string;
  userId: string;
  invitedById: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RoomInviteCreationAttributes = Optional<RoomInviteAttributes, "id" | "invitedById">;

/**
 * Persisted invite allowlist for private rooms: only the host, invited users
 * and admins may see or join a PRIVATE room.
 */
export class RoomInvite
  extends Model<RoomInviteAttributes, RoomInviteCreationAttributes>
  implements RoomInviteAttributes
{
  declare id: string;
  declare roomId: string;
  declare userId: string;
  declare invitedById: string | null;
  declare readonly createdAt: Date;

  declare user?: User;
  declare room?: Room;
}

RoomInvite.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    roomId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "rooms", key: "id" },
      onDelete: "CASCADE",
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    invitedById: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
  },
  {
    sequelize,
    modelName: "RoomInvite",
    tableName: "room_invites",
    indexes: [{ fields: ["room_id", "user_id"], unique: true }, { fields: ["user_id"] }],
  },
);

RoomInvite.belongsTo(User, { foreignKey: "userId", as: "user" });
RoomInvite.belongsTo(Room, { foreignKey: "roomId", as: "room" });
Room.hasMany(RoomInvite, { foreignKey: "roomId", as: "invites" });

export default RoomInvite;
