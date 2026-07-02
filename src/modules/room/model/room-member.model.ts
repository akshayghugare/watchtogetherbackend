import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";
import Room from "./room.model";

export type RoomMemberRole = "HOST" | "MODERATOR" | "MEMBER";

export interface RoomMemberAttributes {
  id: string;
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  isKicked: boolean;
  leftAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RoomMemberCreationAttributes = Optional<
  RoomMemberAttributes,
  "id" | "role" | "isKicked" | "leftAt"
>;

export class RoomMember
  extends Model<RoomMemberAttributes, RoomMemberCreationAttributes>
  implements RoomMemberAttributes
{
  declare id: string;
  declare roomId: string;
  declare userId: string;
  declare role: RoomMemberRole;
  declare isKicked: boolean;
  declare leftAt: Date | null;
  declare readonly createdAt: Date;

  declare user?: User;
  declare room?: Room;
}

RoomMember.init(
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
    role: {
      type: DataTypes.ENUM("HOST", "MODERATOR", "MEMBER"),
      allowNull: false,
      defaultValue: "MEMBER",
    },
    isKicked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    leftAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "RoomMember",
    tableName: "room_members",
    indexes: [{ fields: ["room_id", "user_id"], unique: true }, { fields: ["user_id"] }],
  },
);

RoomMember.belongsTo(User, { foreignKey: "userId", as: "user" });
RoomMember.belongsTo(Room, { foreignKey: "roomId", as: "room" });
Room.hasMany(RoomMember, { foreignKey: "roomId", as: "members" });

export default RoomMember;
