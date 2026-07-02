import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import User from '../user/model/user.model';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { generateOpaqueToken, hashToken } from '../../helpers/token.helper';
import { AUTH_MESSAGES, TOKEN_TTL } from '../../constants';
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../../services/email.service';
import { issueTokenPair, revokeAllSessions, type TokenPair } from '../../services/token.service';

interface ClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<void> {
  const [emailTaken, usernameTaken] = await Promise.all([
    User.findOne({ where: { email: input.email } }),
    User.findOne({ where: { username: input.username } }),
  ]);
  if (emailTaken) throw ApiError.conflict(AUTH_MESSAGES.EMAIL_TAKEN);
  if (usernameTaken) throw ApiError.conflict(AUTH_MESSAGES.USERNAME_TAKEN);

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);
  const verify = generateOpaqueToken();

  const user = await User.create({
    username: input.username,
    email: input.email,
    password: passwordHash,
    displayName: input.displayName ?? input.username,
    emailVerifyToken: verify.hash,
    emailVerifyExpiresAt: new Date(Date.now() + TOKEN_TTL.EMAIL_VERIFY_HOURS * 3600e3),
  });

  await sendVerificationEmail(user.email, user.username, verify.raw);
}

export async function login(
  input: { email: string; password: string },
  meta: ClientMeta,
): Promise<{ user: ReturnType<User['toSafeJSON']>; tokens: TokenPair }> {
  const user = await User.findOne({ where: { email: input.email } });

  // Constant-shape comparison even when the user doesn't exist.
  const passwordOk = user
    ? await bcrypt.compare(input.password, user.password)
    : (await bcrypt.hash(input.password, 4), false);

  if (!user || !passwordOk) throw ApiError.unauthorized(AUTH_MESSAGES.INVALID_CREDENTIALS);
  if (user.isBanned) throw ApiError.forbidden(AUTH_MESSAGES.ACCOUNT_BANNED);
  if (!user.isEmailVerified) throw ApiError.forbidden(AUTH_MESSAGES.EMAIL_NOT_VERIFIED);

  const tokens = await issueTokenPair(user.id, user.role, meta);
  return { user: user.toSafeJSON(), tokens };
}

export async function verifyEmail(rawToken: string): Promise<void> {
  const user = await User.findOne({
    where: {
      emailVerifyToken: hashToken(rawToken),
      emailVerifyExpiresAt: { [Op.gt]: new Date() },
    },
  });
  if (!user) throw ApiError.badRequest(AUTH_MESSAGES.INVALID_TOKEN);

  await user.update({
    isEmailVerified: true,
    emailVerifyToken: null,
    emailVerifyExpiresAt: null,
  });
}

export async function resendVerification(email: string): Promise<void> {
  const user = await User.findOne({ where: { email } });
  // Silently succeed to avoid account enumeration.
  if (!user || user.isEmailVerified) return;

  const verify = generateOpaqueToken();
  await user.update({
    emailVerifyToken: verify.hash,
    emailVerifyExpiresAt: new Date(Date.now() + TOKEN_TTL.EMAIL_VERIFY_HOURS * 3600e3),
  });
  await sendVerificationEmail(user.email, user.username, verify.raw);
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ where: { email } });
  // Silently succeed to avoid account enumeration.
  if (!user) return;

  const reset = generateOpaqueToken();
  await user.update({
    passwordResetToken: reset.hash,
    passwordResetExpiresAt: new Date(Date.now() + TOKEN_TTL.PASSWORD_RESET_MINUTES * 60e3),
  });
  await sendPasswordResetEmail(user.email, user.username, reset.raw);
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const user = await User.findOne({
    where: {
      passwordResetToken: hashToken(rawToken),
      passwordResetExpiresAt: { [Op.gt]: new Date() },
    },
  });
  if (!user) throw ApiError.badRequest(AUTH_MESSAGES.INVALID_TOKEN);

  await user.update({
    password: await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS),
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    passwordChangedAt: new Date(),
  });

  await revokeAllSessions(user.id);
  await sendPasswordChangedEmail(user.email, user.username);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.unauthorized(AUTH_MESSAGES.UNAUTHORIZED);

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) throw ApiError.badRequest(AUTH_MESSAGES.WRONG_CURRENT_PASSWORD);

  await user.update({
    password: await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS),
    passwordChangedAt: new Date(),
  });

  // Keep no other device logged in after a password change.
  await revokeAllSessions(user.id);
  await sendPasswordChangedEmail(user.email, user.username);
}
