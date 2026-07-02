import { Op } from 'sequelize';
import Session from '../modules/auth/model/session.model';
import User from '../modules/user/model/user.model';
import { env } from '../config/env';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { generateOpaqueToken, hashToken } from '../helpers/token.helper';
import { ApiError } from '../utils/ApiError';
import { AUTH_MESSAGES } from '../constants';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface ClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

function refreshExpiryDate(): Date {
  // Mirrors JWT_REFRESH_EXPIRES_IN (e.g. "7d", "12h") for the DB session row.
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  const [, num, unit] = match ?? [undefined, '7', 'd'];
  const ms = { s: 1e3, m: 60e3, h: 3600e3, d: 86400e3 }[unit as 's' | 'm' | 'h' | 'd'];
  return new Date(Date.now() + Number(num) * ms);
}

/** Creates a DB session and issues an access + refresh token pair. */
export async function issueTokenPair(
  userId: string,
  role: string,
  meta: ClientMeta,
): Promise<TokenPair> {
  const session = await Session.create({
    userId,
    refreshTokenHash: `pending:${generateOpaqueToken().hash.slice(0, 56)}`,
    userAgent: meta.userAgent?.slice(0, 512) ?? null,
    ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
    expiresAt: refreshExpiryDate(),
  });

  const refreshToken = signRefreshToken(userId, session.id);
  await session.update({ refreshTokenHash: hashToken(refreshToken) });

  return { accessToken: signAccessToken(userId, role), refreshToken };
}

/**
 * Refresh token rotation: verify JWT → match hash against the stored session →
 * issue a new pair on the same session row. A reused (already-rotated) token
 * revokes the session — stolen-token detection.
 */
export async function rotateRefreshToken(
  rawRefreshToken: string,
  meta: ClientMeta,
): Promise<TokenPair & { userId: string }> {
  const payload = verifyRefreshToken(rawRefreshToken);

  const session = await Session.findByPk(payload.sid, {
    include: [{ model: User, as: 'user', attributes: ['id', 'role', 'isBanned'] }],
  });

  if (!session || session.revokedAt || session.expiresAt < new Date() || !session.user) {
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_TOKEN);
  }

  if (session.refreshTokenHash !== hashToken(rawRefreshToken)) {
    // Token was already rotated — possible theft. Kill the session.
    await session.update({ revokedAt: new Date() });
    throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_TOKEN);
  }

  if (session.user.isBanned) throw ApiError.forbidden(AUTH_MESSAGES.ACCOUNT_BANNED);

  const refreshToken = signRefreshToken(session.userId, session.id);
  await session.update({
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiryDate(),
    userAgent: meta.userAgent?.slice(0, 512) ?? session.userAgent,
    ipAddress: meta.ipAddress?.slice(0, 64) ?? session.ipAddress,
  });

  return {
    accessToken: signAccessToken(session.userId, session.user.role),
    refreshToken,
    userId: session.userId,
  };
}

/** Revokes the session bound to this refresh token (logout). Silent on bad tokens. */
export async function revokeSession(rawRefreshToken: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(rawRefreshToken);
    await Session.update(
      { revokedAt: new Date() },
      { where: { id: payload.sid, revokedAt: { [Op.is]: null } } },
    );
  } catch {
    // Logout must always succeed client-side.
  }
}

/** Revokes every active session for a user (password change/reset). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await Session.update(
    { revokedAt: new Date() },
    {
      where: {
        userId,
        revokedAt: { [Op.is]: null },
        ...(exceptSessionId ? { id: { [Op.ne]: exceptSessionId } } : {}),
      },
    },
  );
}
