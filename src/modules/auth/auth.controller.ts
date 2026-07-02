import type { CookieOptions, Request, Response } from 'express';
import * as authService from './auth.service';
import { rotateRefreshToken, revokeSession } from '../../services/token.service';
import { sendResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { AUTH_MESSAGES, HTTP_STATUS, REFRESH_TOKEN_COOKIE } from '../../constants';
import { isProd } from '../../config/env';

const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 3600 * 1000,
};

function clientMeta(req: Request) {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  await authService.register(req.body);
  sendResponse(res, HTTP_STATUS.CREATED, AUTH_MESSAGES.REGISTER_SUCCESS);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.login(req.body, clientMeta(req));
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, refreshCookieOptions);
  sendResponse(res, HTTP_STATUS.OK, AUTH_MESSAGES.LOGIN_SUCCESS, {
    user,
    accessToken: tokens.accessToken,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const raw = req.cookies?.[REFRESH_TOKEN_COOKIE] ?? req.body?.refreshToken;
  const { accessToken, refreshToken } = await rotateRefreshToken(raw ?? '', clientMeta(req));
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshCookieOptions);
  sendResponse(res, HTTP_STATUS.OK, AUTH_MESSAGES.TOKEN_REFRESHED, { accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const raw = req.cookies?.[REFRESH_TOKEN_COOKIE] ?? req.body?.refreshToken;
  if (raw) await revokeSession(raw);
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...refreshCookieOptions, maxAge: undefined });
  sendResponse(res, HTTP_STATUS.OK, AUTH_MESSAGES.LOGOUT_SUCCESS);
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  await authService.verifyEmail(req.params.token);
  sendResponse(res, HTTP_STATUS.OK, AUTH_MESSAGES.EMAIL_VERIFIED);
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  await authService.resendVerification(req.body.email);
  sendResponse(res, HTTP_STATUS.OK, AUTH_MESSAGES.VERIFICATION_RESENT);
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  sendResponse(res, HTTP_STATUS.OK, AUTH_MESSAGES.PASSWORD_RESET_SENT);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.params.token, req.body.password);
  sendResponse(res, HTTP_STATUS.OK, AUTH_MESSAGES.PASSWORD_RESET_SUCCESS);
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(
    req.user!.id,
    req.body.currentPassword,
    req.body.newPassword,
  );
  // All sessions were revoked — client must log in again.
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...refreshCookieOptions, maxAge: undefined });
  sendResponse(res, HTTP_STATUS.OK, AUTH_MESSAGES.PASSWORD_CHANGED);
});
