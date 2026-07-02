import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import Movie from "./model/movie.model";
import User from "../user/model/user.model";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { logger } from "../../utils/logger";
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

  const thumbFile = input.files?.thumbnail?.[0];
  const subFile = input.files?.subtitle?.[0];
  const subExt = subFile ? path.extname(subFile.originalname).toLowerCase() : "";

  // Files live in the DB; the /media endpoints stream them back out.
  const id = randomUUID();
  const movie = await Movie.create({
    id,
    title: input.title,
    description: input.description ?? null,
    source: videoFile ? "UPLOAD" : "URL",
    fileUrl: videoFile ? `/media/movies/${id}/stream` : input.url!,
    thumbnailUrl: thumbFile ? `/media/movies/${id}/thumbnail` : null,
    subtitleUrl: subFile ? `/media/movies/${id}/subtitle${subExt}` : null,
    mimeType: videoFile?.mimetype ?? null,
    sizeBytes: videoFile?.size ?? null,
    uploaderId,
    fileData: videoFile?.buffer ?? null,
    thumbnailData: thumbFile?.buffer ?? null,
    thumbnailMime: thumbFile?.mimetype ?? null,
    subtitleData: subFile?.buffer ?? null,
    subtitleMime: subFile ? (subExt === ".vtt" ? "text/vtt" : "application/x-subrip") : null,
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
