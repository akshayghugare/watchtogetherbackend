import type { Request, Response } from "express";
import * as chatService from "./chat.service";
import { sendResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/ApiError";
import { HTTP_STATUS } from "../../constants";
import { getIo } from "../../socket/io";

export const history = asyncHandler(async (req: Request, res: Response) => {
  const messages = await chatService.listMessages(req.params.roomId, req.user!.id, {
    before: req.query.before ? String(req.query.before) : undefined,
    limit: Math.min(100, Number(req.query.limit) || 50),
    search: req.query.search ? String(req.query.search) : undefined,
    pinnedOnly: req.query.pinned === "true",
  });
  sendResponse(res, HTTP_STATUS.OK, "OK", { messages });
});

/** Multipart file/image/voice-note upload → creates the message + broadcasts it. */
export const uploadFile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("No file provided.");
  const message = await chatService.createMessage(req.params.roomId, req.user!.id, {
    type: chatService.fileMessageType(req.file.mimetype),
    content: req.body.content || undefined,
    replyToId: req.body.replyToId || undefined,
    fileUrl: chatService.chatFileUrl(req.file.filename),
    fileName: req.file.originalname,
    fileSize: req.file.size,
  });
  getIo()?.to(`room:${req.params.roomId}`).emit("chat:new", message?.toJSON());
  sendResponse(res, HTTP_STATUS.CREATED, "Message sent.", { message });
});
