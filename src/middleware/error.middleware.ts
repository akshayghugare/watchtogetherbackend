import type { NextFunction, Request, Response } from 'express';
import {
  UniqueConstraintError,
  ValidationError as SequelizeValidationError,
  ForeignKeyConstraintError,
} from 'sequelize';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { isProd } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const error = err instanceof ApiError ? err : normalizeError(err);

  if (!(err instanceof ApiError)) {
    logger.error(err instanceof Error ? err : String(err));
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details ? { errors: error.details } : {}),
    ...(!isProd && err instanceof Error ? { stack: err.stack } : {}),
  });
}

function normalizeError(err: unknown): ApiError {
  if (err instanceof UniqueConstraintError) {
    const fields = Object.keys(err.fields ?? {}).join(', ') || 'field';
    return ApiError.conflict(`Duplicate value for ${fields}.`);
  }
  if (err instanceof ForeignKeyConstraintError) {
    return ApiError.badRequest('Related record does not exist.');
  }
  if (err instanceof SequelizeValidationError) {
    return ApiError.badRequest(
      'Validation failed',
      err.errors.map((e) => ({ field: e.path, message: e.message })),
    );
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return ApiError.badRequest('Malformed JSON body.');
  }
  if (isProd) return ApiError.internal();
  return ApiError.internal(err instanceof Error ? err.message : 'Unknown error');
}
