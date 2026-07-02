import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";

/**
 * Rotating refresh-token sessions — one row per logged-in device.
 * Powers refresh rotation, logout, and the future "Devices & Sessions" page.
 */
export interface SessionAttributes {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type SessionCreationAttributes = Optional<
  SessionAttributes,
  "id" | "userAgent" | "ipAddress" | "revokedAt"
>;

export class Session
  extends Model<SessionAttributes, SessionCreationAttributes>
  implements SessionAttributes
{
  declare id: string;
  declare userId: string;
  declare refreshTokenHash: string;
  declare userAgent: string | null;
  declare ipAddress: string | null;
  declare expiresAt: Date;
  declare revokedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare user?: User;
}

Session.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    refreshTokenHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    userAgent: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Session",
    tableName: "sessions",
    indexes: [{ fields: ["user_id"] }, { fields: ["expires_at"] }],
  },
);

User.hasMany(Session, { foreignKey: "userId", as: "sessions", onDelete: "CASCADE" });
Session.belongsTo(User, { foreignKey: "userId", as: "user" });

export default Session;
