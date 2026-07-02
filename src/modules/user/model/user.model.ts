import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";

export type UserRole = "USER" | "ADMIN";

export interface UserAttributes {
  id: string;
  username: string;
  email: string;
  password: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  isEmailVerified: boolean;
  emailVerifyToken: string | null;
  emailVerifyExpiresAt: Date | null;
  passwordResetToken: string | null;
  passwordResetExpiresAt: Date | null;
  passwordChangedAt: Date | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  isBanned: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  | "id"
  | "displayName"
  | "avatarUrl"
  | "bio"
  | "role"
  | "isEmailVerified"
  | "emailVerifyToken"
  | "emailVerifyExpiresAt"
  | "passwordResetToken"
  | "passwordResetExpiresAt"
  | "passwordChangedAt"
  | "isOnline"
  | "lastSeenAt"
  | "isBanned"
>;

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare username: string;
  declare email: string;
  declare password: string;
  declare displayName: string | null;
  declare avatarUrl: string | null;
  declare bio: string | null;
  declare role: UserRole;
  declare isEmailVerified: boolean;
  declare emailVerifyToken: string | null;
  declare emailVerifyExpiresAt: Date | null;
  declare passwordResetToken: string | null;
  declare passwordResetExpiresAt: Date | null;
  declare passwordChangedAt: Date | null;
  declare isOnline: boolean;
  declare lastSeenAt: Date | null;
  declare isBanned: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  /** Public shape — never leaks password or token fields. */
  toSafeJSON() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      displayName: this.displayName,
      avatarUrl: this.avatarUrl,
      bio: this.bio,
      role: this.role,
      isEmailVerified: this.isEmailVerified,
      isOnline: this.isOnline,
      lastSeenAt: this.lastSeenAt,
      createdAt: this.createdAt,
    };
  }
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    displayName: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    avatarUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bio: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM("USER", "ADMIN"),
      allowNull: false,
      defaultValue: "USER",
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    emailVerifyToken: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    emailVerifyExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING(64),
      allowNull: true,
      unique: true,
    },
    passwordResetExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passwordChangedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isOnline: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isBanned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "users",
    indexes: [
      { fields: ["email"] },
      { fields: ["username"] },
      { fields: ["is_online"] },
    ],
  },
);

export default User;
