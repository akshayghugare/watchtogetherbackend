import { Router, type Request, type Response } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "../../config/db";
import Movie from "./model/movie.model";
import { asyncHandler } from "../../utils/asyncHandler";

/**
 * Public media routes (mounted at /media, outside the API rate limiter):
 * uploaded movie files, thumbnails and subtitles are stored as blobs in the
 * movies table and streamed back out here. <video>/<img> tags cannot send
 * Authorization headers, so — like the old /uploads static folder — these
 * URLs are unauthenticated; the ids are unguessable UUIDs.
 */
const router = Router();

/** Per-response slice size — keeps big movies out of memory. */
const CHUNK_BYTES = 8 * 1024 * 1024;

const UUID_RE = /^[0-9a-f-]{36}$/i;

/** Fetch one byte-slice of a blob column without loading the whole file. */
async function readSlice(
  movieId: string,
  column: "file_data" | "thumbnail_data" | "subtitle_data",
  start: number,
  length: number,
): Promise<Buffer | null> {
  const rows = await sequelize.query<{ chunk: Buffer | null }>(
    `SELECT substring(${column} from :from for :len) AS chunk FROM movies WHERE id = :id`,
    {
      replacements: { from: start + 1, len: length, id: movieId },
      type: QueryTypes.SELECT,
    },
  );
  return rows[0]?.chunk ?? null;
}

router.get(
  "/movies/:movieId/stream",
  asyncHandler(async (req: Request, res: Response) => {
    const { movieId } = req.params;
    if (!UUID_RE.test(movieId)) {
      res.status(404).end();
      return;
    }
    const movie = await Movie.findByPk(movieId); // default scope: no blobs
    if (!movie || movie.source !== "UPLOAD") {
      res.status(404).end();
      return;
    }
    // Movies uploaded before DB storage still live under /uploads.
    if (movie.fileUrl.startsWith("/uploads/")) {
      res.redirect(movie.fileUrl);
      return;
    }

    const size = Number(movie.sizeBytes ?? 0);
    if (!size) {
      res.status(404).end();
      return;
    }
    const mime = movie.mimeType ?? "video/mp4";

    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      const start = match?.[1] ? Number(match[1]) : 0;
      if (!match || start >= size) {
        res.status(416).set("Content-Range", `bytes */${size}`).end();
        return;
      }
      const requestedEnd = match[2] ? Number(match[2]) : size - 1;
      const end = Math.min(requestedEnd, size - 1, start + CHUNK_BYTES - 1);
      const chunk = await readSlice(movieId, "file_data", start, end - start + 1);
      if (!chunk) {
        res.status(404).end();
        return;
      }
      res.status(206).set({
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.length),
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      });
      res.end(chunk);
      return;
    }

    // No Range header — stream the whole file in slices.
    res.status(200).set({
      "Accept-Ranges": "bytes",
      "Content-Length": String(size),
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
    });
    for (let offset = 0; offset < size; offset += CHUNK_BYTES) {
      const chunk = await readSlice(movieId, "file_data", offset, CHUNK_BYTES);
      if (!chunk || res.destroyed) break;
      const canContinue = res.write(chunk);
      if (!canContinue) await new Promise((resolve) => res.once("drain", resolve));
    }
    res.end();
  }),
);

router.get(
  "/movies/:movieId/thumbnail",
  asyncHandler(async (req: Request, res: Response) => {
    const { movieId } = req.params;
    if (!UUID_RE.test(movieId)) {
      res.status(404).end();
      return;
    }
    const movie = await Movie.unscoped().findByPk(movieId, {
      attributes: ["id", "thumbnailData", "thumbnailMime"],
    });
    if (!movie?.thumbnailData) {
      res.status(404).end();
      return;
    }
    res
      .set({
        "Content-Type": movie.thumbnailMime ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      })
      .end(movie.thumbnailData);
  }),
);

router.get(
  "/movies/:movieId/subtitle.:ext(vtt|srt)",
  asyncHandler(async (req: Request, res: Response) => {
    const { movieId } = req.params;
    if (!UUID_RE.test(movieId)) {
      res.status(404).end();
      return;
    }
    const movie = await Movie.unscoped().findByPk(movieId, {
      attributes: ["id", "subtitleData", "subtitleMime"],
    });
    if (!movie?.subtitleData) {
      res.status(404).end();
      return;
    }
    res
      .set({
        "Content-Type": movie.subtitleMime ?? "text/vtt",
        "Cache-Control": "public, max-age=86400",
      })
      .end(movie.subtitleData);
  }),
);

export default router;
