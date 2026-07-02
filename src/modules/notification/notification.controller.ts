import type { Request, Response } from "express";
import * as notificationService from "./notification.service";
import { sendResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { HTTP_STATUS } from "../../constants";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 20);
  const result = await notificationService.listNotifications(req.user!.id, page, limit);
  sendResponse(res, HTTP_STATUS.OK, "OK", result, {
    page,
    limit,
    total: result.total,
    totalPages: Math.ceil(result.total / limit),
  });
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markRead(req.user!.id, req.params.id);
  sendResponse(res, HTTP_STATUS.OK, "Notification marked as read.");
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.markAllRead(req.user!.id);
  sendResponse(res, HTTP_STATUS.OK, "All notifications marked as read.");
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await notificationService.removeNotification(req.user!.id, req.params.id);
  sendResponse(res, HTTP_STATUS.OK, "Notification removed.");
});
