import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import routes from './routes';
import mediaRoutes from './modules/movie/movie.media.routes';
import { apiLimiter } from './middleware/rateLimit.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

const app = express();

app.set('trust proxy', 1);

// Security
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow serving uploads to the SPA
  }),
);
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(hpp());

// Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(compression());

// Static uploads (avatars, chat files; legacy movie files uploaded before DB storage)
app.use('/uploads', express.static(path.join(process.cwd(), env.UPLOAD_DIR)));

// DB-stored movie files/thumbnails/subtitles — outside the API rate limiter,
// since video seeking fires many small range requests.
app.use('/media', mediaRoutes);

// API
app.use(env.API_PREFIX, apiLimiter, routes);

// 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
