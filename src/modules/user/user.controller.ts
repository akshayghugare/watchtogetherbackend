import type { Request, Response } from 'express';
import * as userService from './user.service';
import { sendResponse } from '../../utils/ApiResponse';
import { asyncHandler } from '../../utils/asyncHandler';
import { ApiError } from '../../utils/ApiError';
import { HTTP_STATUS, USER_MESSAGES } from '../../constants';

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getMe(req.user!.id);
  sendResponse(res, HTTP_STATUS.OK, 'OK', { user });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateProfile(req.user!.id, req.body);
  sendResponse(res, HTTP_STATUS.OK, USER_MESSAGES.PROFILE_UPDATED, { user });
});

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No image file provided.');
  const user = await userService.updateAvatar(req.user!.id, req.file.filename);
  sendResponse(res, HTTP_STATUS.OK, USER_MESSAGES.AVATAR_UPDATED, { user });
});
