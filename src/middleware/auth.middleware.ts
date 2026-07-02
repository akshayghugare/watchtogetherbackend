import type { NextFunction, Request, Response } from 'express';
import User from '../modules/user/model/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAccessToken } from '../utils/jwt';
import { AUTH_MESSAGES } from '../constants';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  displayName: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Requires a valid Bearer access token; attaches req.user. */
export const requireAuth = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw ApiError.unauthorized(AUTH_MESSAGES.UNAUTHORIZED);
    }

    const payload = verifyAccessToken(header.slice(7));

    const user = await User.findByPk(payload.sub, {
      attributes: [
        'id',
        'username',
        'email',
        'role',
        'avatarUrl',
        'displayName',
        'isBanned',
        'passwordChangedAt',
      ],
    });

    if (!user) throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_TOKEN);
    if (user.isBanned) throw ApiError.forbidden(AUTH_MESSAGES.ACCOUNT_BANNED);

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
    };
    next();
  },
);

/** Restrict a route to specific roles, e.g. requireRole('ADMIN'). */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(ApiError.forbidden(AUTH_MESSAGES.FORBIDDEN));
      return;
    }
    next();
  };
}
