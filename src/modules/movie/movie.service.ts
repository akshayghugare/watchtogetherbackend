import fs from "fs/promises";
import path from "path";
import Movie from "./model/movie.model";
import User from "../user/model/user.model";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
import { localFileUrl } from "../../middleware/upload.middleware";
import { logActivity } from "../admin/admin.service";

const UPLOADER_ATTRS = ["id", "username", "displayName", "avatarUrl"] as const;

interface CreateMovieInput {
  title: string;
  description?: string;
  url?: string; // network stream source
  files?: {
    movie?: Express.Multer.File[];
    thumbnail?: Express.Multer.File[];
    subtitle?: Express.Multer.File[];
  };
}

export async function createMovie(uploaderId: string, input: CreateMovieInput) {
  const videoFile = input.files?.movie?.[0];
  if (!videoFile && !input.url) {
    throw ApiError.badRequest("Provide a movie file or a stream URL.");
  }

  const movie = await Movie.create({
    title: input.title,
    description: input.description ?? null,
    source: videoFile ? "UPLOAD" : "URL",
    fileUrl: videoFile ? localFileUrl("movies", videoFile.filename) : input.url!,
    thumbnailUrl: input.files?.thumbnail?.[0]
      ? localFileUrl("movies", input.files.thumbnail[0].filename)
      : null,
    subtitleUrl: input.files?.subtitle?.[0]
      ? localFileUrl("movies", input.files.subtitle[0].filename)
      : null,
    mimeType: videoFile?.mimetype ?? null,
    sizeBytes: videoFile?.size ?? null,
    uploaderId,
  });
  await logActivity("movie.uploaded", {
    userId: uploaderId,
    entity: "movie",
    entityId: movie.id,
    metadata: { title: movie.title, source: movie.source },
  });
  return movie;
}

export async function listMyMovies(userId: string) {
  return Movie.findAll({
    where: { uploaderId: userId },
    include: [{ model: User, as: "uploader", attributes: [...UPLOADER_ATTRS] }],
    order: [["createdAt", "DESC"]],
  });
}

export async function getMovie(movieId: string) {
  const movie = await Movie.findByPk(movieId, {
    include: [{ model: User, as: "uploader", attributes: [...UPLOADER_ATTRS] }],
  });
  if (!movie) throw ApiError.notFound("Movie not found.");
  return movie;
}

export async function deleteMovie(userId: string, movieId: string) {
  const movie = await Movie.findByPk(movieId);
  if (!movie) throw ApiError.notFound("Movie not found.");
  if (movie.uploaderId !== userId) throw ApiError.forbidden("You did not upload this movie.");

  const localPaths = [movie.fileUrl, movie.thumbnailUrl, movie.subtitleUrl].filter(
    (u): u is string => Boolean(u?.startsWith("/uploads/")),
  );
  await movie.destroy();
  await logActivity("movie.deleted", { userId, entity: "movie", entityId: movieId });

  for (const url of localPaths) {
    const filePath = path.join(process.cwd(), env.UPLOAD_DIR, url.replace("/uploads/", ""));
    fs.unlink(filePath).catch((err) => logger.warn(`Could not delete movie file: ${err.message}`));
  }
}
