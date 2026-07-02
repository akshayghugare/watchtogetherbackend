import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";
import CallHistory from "./call-history.model";

export interface CallParticipantAttributes {
  id: string;
  callId: string;
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CallParticipantCreationAttributes = Optional<
  CallParticipantAttributes,
  "id" | "joinedAt" | "leftAt"
>;

export class CallParticipant
  extends Model<CallParticipantAttributes, CallParticipantCreationAttributes>
  implements CallParticipantAttributes
{
  declare id: string;
  declare callId: string;
  declare userId: string;
  declare joinedAt: Date;
  declare leftAt: Date | null;

  declare user?: User;
}

CallParticipant.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    callId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "call_history", key: "id" },
      onDelete: "CASCADE",
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    joinedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    leftAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "CallParticipant",
    tableName: "call_participants",
    indexes: [{ fields: ["call_id", "user_id"] }, { fields: ["user_id"] }],
  },
);

CallParticipant.belongsTo(User, { foreignKey: "userId", as: "user" });
CallHistory.hasMany(CallParticipant, { foreignKey: "callId", as: "participants" });

export default CallParticipant;
