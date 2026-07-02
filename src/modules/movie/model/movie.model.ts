import { DataTypes, Model, type Optional } from "sequelize";
import sequelize from "../../../config/db";
import User from "../../user/model/user.model";

export type MovieSource = "UPLOAD" | "URL";

export interface MovieAttributes {
  id: string;
  title: string;
  description: string | null;
  source: MovieSource;
  fileUrl: string;
  thumbnailUrl: string | null;
  subtitleUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSec: number | null;
  uploaderId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type MovieCreationAttributes = Optional<
  MovieAttributes,
  "id" | "description" | "source" | "thumbnailUrl" | "subtitleUrl" | "mimeType" | "sizeBytes" | "durationSec"
>;

export class Movie
  extends Model<MovieAttributes, MovieCreationAttributes>
  implements MovieAttributes
{
  declare id: string;
  declare title: string;
  declare description: string | null;
  declare source: MovieSource;
  declare fileUrl: string;
  declare thumbnailUrl: string | null;
  declare subtitleUrl: string | null;
  declare mimeType: string | null;
  declare sizeBytes: number | null;
  declare durationSec: number | null;
  declare uploaderId: string;
  declare readonly createdAt: Date;

  declare uploader?: User;
}

Movie.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.STRING(1000), allowNull: true },
    source: {
      type: DataTypes.ENUM("UPLOAD", "URL"),
      allowNull: false,
      defaultValue: "UPLOAD",
    },
    fileUrl: { type: DataTypes.STRING(2048), allowNull: false },
    thumbnailUrl: { type: DataTypes.STRING(2048), allowNull: true },
    subtitleUrl: { type: DataTypes.STRING(2048), allowNull: true },
    mimeType: { type: DataTypes.STRING(100), allowNull: true },
    sizeBytes: { type: DataTypes.BIGINT, allowNull: true },
    durationSec: { type: DataTypes.FLOAT, allowNull: true },
    uploaderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
    },
  },
  {
    sequelize,
    modelName: "Movie",
    tableName: "movies",
    indexes: [{ fields: ["uploader_id"] }],
  },
);

Movie.belongsTo(User, { foreignKey: "uploaderId", as: "uploader" });

export default Movie;
