import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { v4 as uuid } from 'uuid';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

const AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function diskStorage(subDir: string) {
  const dest = path.join(process.cwd(), env.UPLOAD_DIR, subDir);
  fs.mkdirSync(dest, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuid()}${ext}`);
    },
  });
}

const VIDEO_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/x-matroska', // mkv
  'video/quicktime', // mov
]);
const VIDEO_EXT = new Set(['.mp4', '.webm', '.mkv', '.mov']);
const SUBTITLE_EXT = new Set(['.srt', '.vtt']);
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Movie upload: video file + optional thumbnail + optional subtitle.
 * Kept in memory — the payload is persisted into the database (movies table),
 * not the local uploads folder.
 */
export const movieUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_MOVIE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === 'movie') {
      // Browsers report empty/odd MIME for mkv — fall back to the extension.
      if (!VIDEO_MIME.has(file.mimetype) && !VIDEO_EXT.has(ext)) {
        cb(ApiError.badRequest('Only MP4, WEBM, MKV or MOV videos are allowed.'));
        return;
      }
    } else if (file.fieldname === 'thumbnail') {
      if (!IMAGE_MIME.has(file.mimetype)) {
        cb(ApiError.badRequest('Thumbnail must be a JPEG, PNG or WEBP image.'));
        return;
      }
    } else if (file.fieldname === 'subtitle') {
      if (!SUBTITLE_EXT.has(ext)) {
        cb(ApiError.badRequest('Subtitle must be a .srt or .vtt file.'));
        return;
      }
    }
    cb(null, true);
  },
}).fields([
  { name: 'movie', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'subtitle', maxCount: 1 },
]);

/** Chat attachments: images, videos, PDFs, audio (voice notes). */
export const chatFileUpload = multer({
  storage: diskStorage('chat'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      IMAGE_MIME.has(file.mimetype) ||
      file.mimetype === 'image/gif' ||
      VIDEO_MIME.has(file.mimetype) ||
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('audio/');
    if (!ok) {
      cb(ApiError.badRequest('Unsupported file type.'));
      return;
    }
    cb(null, true);
  },
});

export const avatarUpload = multer({
  storage: diskStorage('avatars'),
  limits: { fileSize: env.MAX_AVATAR_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_MIME.has(file.mimetype)) {
      cb(ApiError.badRequest('Only JPEG, PNG, WEBP or GIF images are allowed.'));
      return;
    }
    cb(null, true);
  },
});

/** Public URL path for a locally stored file. */
export function localFileUrl(subDir: string, filename: string): string {
  return `/uploads/${subDir}/${filename}`;
}
