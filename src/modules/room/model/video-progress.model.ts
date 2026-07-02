import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";

/** Per-user resume position ("continue watching"). */
export interface VideoProgressAttributes {
  id: string;
  userId: string;
  roomId: string;
  positionSec: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type VideoProgressCreationAttributes = Optional<VideoProgressAttributes, "id">;

export class VideoProgress
  extends Model<VideoProgressAttributes, VideoProgressCreationAttributes>
  implements VideoProgressAttributes
{
  declare id: string;
  declare userId: string;
  declare roomId: string;
  declare positionSec: number;
}

VideoProgress.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    roomId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "rooms", key: "id" },
      onDelete: "CASCADE",
    },
    positionSec: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: "VideoProgress",
    tableName: "video_progress",
    indexes: [{ fields: ["user_id", "room_id"], unique: true }],
  },
);

export default VideoProgress;
