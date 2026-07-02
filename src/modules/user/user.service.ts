import fs from 'fs/promises';
import path from 'path';
import User from './model/user.model';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { AUTH_MESSAGES, USER_MESSAGES } from '../../constants';
import { localFileUrl } from '../../middleware/upload.middleware';

export async function getMe(userId: string) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound(USER_MESSAGES.NOT_FOUND);
  return user.toSafeJSON();
}

export async function updateProfile(
  userId: string,
  input: { displayName?: string; bio?: string; username?: string },
) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound(USER_MESSAGES.NOT_FOUND);

  if (input.username && input.username !== user.username) {
    const taken = await User.findOne({ where: { username: input.username } });
    if (taken) throw ApiError.conflict(AUTH_MESSAGES.USERNAME_TAKEN);
  }

  await user.update({
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.bio !== undefined ? { bio: input.bio || null } : {}),
    ...(input.username ? { username: input.username } : {}),
  });

  return user.toSafeJSON();
}

export async function updateAvatar(userId: string, filename: string) {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound(USER_MESSAGES.NOT_FOUND);

  const oldUrl = user.avatarUrl;
  await user.update({ avatarUrl: localFileUrl('avatars', filename) });

  // Best-effort cleanup of the previous local avatar file.
  if (oldUrl?.startsWith('/uploads/')) {
    const oldPath = path.join(process.cwd(), env.UPLOAD_DIR, oldUrl.replace('/uploads/', ''));
    fs.unlink(oldPath).catch((err) => logger.warn(`Could not delete old avatar: ${err.message}`));
  }

  return user.toSafeJSON();
}
