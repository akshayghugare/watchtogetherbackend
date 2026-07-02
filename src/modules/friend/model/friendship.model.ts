import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";

/** Canonical ordering invariant: userAId < userBId (enforced in service layer). */
export interface FriendshipAttributes {
  id: string;
  userAId: string;
  userBId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type FriendshipCreationAttributes = Optional<FriendshipAttributes, "id">;

export class Friendship
  extends Model<FriendshipAttributes, FriendshipCreationAttributes>
  implements FriendshipAttributes
{
  declare id: string;
  declare userAId: string;
  declare userBId: string;
  declare readonly createdAt: Date;

  declare userA?: User;
  declare userB?: User;
}

Friendship.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userAId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    userBId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
  },
  {
    sequelize,
    modelName: "Friendship",
    tableName: "friendships",
    indexes: [
      { fields: ["user_a_id", "user_b_id"], unique: true },
      { fields: ["user_b_id"] },
    ],
  },
);

Friendship.belongsTo(User, { foreignKey: "userAId", as: "userA" });
Friendship.belongsTo(User, { foreignKey: "userBId", as: "userB" });

export default Friendship;
