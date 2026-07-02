import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";
import Room from "../../room/model/room.model";

export type CallType = "AUDIO" | "VIDEO";
export type CallStatus = "ONGOING" | "ENDED";

export interface CallHistoryAttributes {
  id: string;
  roomId: string | null;
  initiatorId: string;
  type: CallType;
  status: CallStatus;
  participantCount: number;
  endedAt: Date | null;
  durationSec: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CallHistoryCreationAttributes = Optional<
  CallHistoryAttributes,
  "id" | "roomId" | "status" | "participantCount" | "endedAt" | "durationSec"
>;

export class CallHistory
  extends Model<CallHistoryAttributes, CallHistoryCreationAttributes>
  implements CallHistoryAttributes
{
  declare id: string;
  declare roomId: string | null;
  declare initiatorId: string;
  declare type: CallType;
  declare status: CallStatus;
  declare participantCount: number;
  declare endedAt: Date | null;
  declare durationSec: number | null;
  declare readonly createdAt: Date;

  declare initiator?: User;
  declare room?: Room;
}

CallHistory.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    roomId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "rooms", key: "id" },
      onDelete: "SET NULL",
    },
    initiatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    type: { type: DataTypes.ENUM("AUDIO", "VIDEO"), allowNull: false },
    status: {
      type: DataTypes.ENUM("ONGOING", "ENDED"),
      allowNull: false,
      defaultValue: "ONGOING",
    },
    participantCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    durationSec: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    modelName: "CallHistory",
    tableName: "call_history",
    indexes: [{ fields: ["initiator_id"] }, { fields: ["room_id"] }],
  },
);

CallHistory.belongsTo(User, { foreignKey: "initiatorId", as: "initiator" });
CallHistory.belongsTo(Room, { foreignKey: "roomId", as: "room" });

export default CallHistory;
