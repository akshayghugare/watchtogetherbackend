import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";

export interface ActivityLogAttributes {
  id: string;
  userId: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ActivityLogCreationAttributes = Optional<
  ActivityLogAttributes,
  "id" | "userId" | "entity" | "entityId" | "metadata" | "ipAddress"
>;

export class ActivityLog
  extends Model<ActivityLogAttributes, ActivityLogCreationAttributes>
  implements ActivityLogAttributes
{
  declare id: string;
  declare userId: string | null;
  declare action: string;
  declare entity: string | null;
  declare entityId: string | null;
  declare metadata: Record<string, unknown> | null;
  declare ipAddress: string | null;
  declare readonly createdAt: Date;

  declare user?: User;
}

ActivityLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
    },
    action: { type: DataTypes.STRING(100), allowNull: false },
    entity: { type: DataTypes.STRING(50), allowNull: true },
    entityId: { type: DataTypes.UUID, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: true },
    ipAddress: { type: DataTypes.STRING(64), allowNull: true },
  },
  {
    sequelize,
    modelName: "ActivityLog",
    tableName: "activity_logs",
    indexes: [{ fields: ["user_id", "created_at"] }, { fields: ["action"] }],
  },
);

ActivityLog.belongsTo(User, { foreignKey: "userId", as: "user" });

export default ActivityLog;
