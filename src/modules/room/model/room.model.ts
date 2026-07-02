import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";
import Movie from "../../movie/model/movie.model";

export type RoomPrivacy = "PUBLIC" | "PRIVATE";

export interface RoomAttributes {
  id: string;
  name: string;
  code: string;
  privacy: RoomPrivacy;
  passwordHash: string | null;
  hostId: string;
  movieId: string | null;
  isActive: boolean;
  maxMembers: number;
  // Live playback state — source of truth for late-joiner sync
  playbackPositionSec: number;
  isPlaying: boolean;
  playbackRate: number;
  playbackUpdatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
  endedAt: Date | null;
}

export type RoomCreationAttributes = Optional<
  RoomAttributes,
  | "id"
  | "privacy"
  | "passwordHash"
  | "movieId"
  | "isActive"
  | "maxMembers"
  | "playbackPositionSec"
  | "isPlaying"
  | "playbackRate"
  | "playbackUpdatedAt"
  | "endedAt"
>;

export class Room extends Model<RoomAttributes, RoomCreationAttributes> implements RoomAttributes {
  declare id: string;
  declare name: string;
  declare code: string;
  declare privacy: RoomPrivacy;
  declare passwordHash: string | null;
  declare hostId: string;
  declare movieId: string | null;
  declare isActive: boolean;
  declare maxMembers: number;
  declare playbackPositionSec: number;
  declare isPlaying: boolean;
  declare playbackRate: number;
  declare playbackUpdatedAt: Date;
  declare readonly createdAt: Date;
  declare endedAt: Date | null;

  declare host?: User;
  declare movie?: Movie;
}

Room.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    code: { type: DataTypes.STRING(12), allowNull: false, unique: true },
    privacy: {
      type: DataTypes.ENUM("PUBLIC", "PRIVATE"),
      allowNull: false,
      defaultValue: "PUBLIC",
    },
    passwordHash: { type: DataTypes.STRING, allowNull: true },
    hostId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
    movieId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "movies", key: "id" },
      onDelete: "SET NULL",
    },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    maxMembers: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 25 },
    playbackPositionSec: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    isPlaying: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    playbackRate: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 1 },
    playbackUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    endedAt: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    modelName: "Room",
    tableName: "rooms",
    indexes: [{ fields: ["host_id"] }, { fields: ["privacy", "is_active"] }],
  },
);

Room.belongsTo(User, { foreignKey: "hostId", as: "host" });
Room.belongsTo(Movie, { foreignKey: "movieId", as: "movie" });

export default Room;
