import type { Request, Response } from "express";
import * as roomService from "./room.service";
import { sendResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { HTTP_STATUS } from "../../constants";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const room = await roomService.createRoom(req.user!.id, {
    ...req.body,
    password: req.body.password || undefined,
  });
  sendResponse(res, HTTP_STATUS.CREATED, "Room created.", { room });
});

export const listPublic = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Number(req.query.limit) || 12);
  const { rooms, total } = await roomService.listPublicRooms(page, limit);
  sendResponse(res, HTTP_STATUS.OK, "OK", { rooms }, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
});

export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const rooms = await roomService.listMyRooms(req.user!.id);
  sendResponse(res, HTTP_STATUS.OK, "OK", { rooms });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const room = await roomService.getRoom(req.params.roomId);
  sendResponse(res, HTTP_STATUS.OK, "OK", { room });
});

export const join = asyncHandler(async (req: Request, res: Response) => {
  const room = await roomService.joinRoom(
    req.user!.id,
    req.body.roomIdOrCode,
    req.body.password,
  );
  sendResponse(res, HTTP_STATUS.OK, "Joined room.", { room });
});

export const leave = asyncHandler(async (req: Request, res: Response) => {
  await roomService.leaveRoom(req.user!.id, req.params.roomId);
  sendResponse(res, HTTP_STATUS.OK, "Left room.");
});

export const kick = asyncHandler(async (req: Request, res: Response) => {
  await roomService.kickMember(req.user!.id, req.params.roomId, req.body.userId);
  sendResponse(res, HTTP_STATUS.OK, "Member kicked.");
});

export const transferHost = asyncHandler(async (req: Request, res: Response) => {
  await roomService.transferHost(req.user!.id, req.params.roomId, req.body.newHostId);
  sendResponse(res, HTTP_STATUS.OK, "Host transferred.");
});

export const invite = asyncHandler(async (req: Request, res: Response) => {
  await roomService.inviteToRoom(req.user!.id, req.params.roomId, req.body.friendId);
  sendResponse(res, HTTP_STATUS.OK, "Invitation sent.");
});

export const end = asyncHandler(async (req: Request, res: Response) => {
  await roomService.endRoom(req.user!.id, req.params.roomId);
  sendResponse(res, HTTP_STATUS.OK, "Room ended.");
});

export const myProgress = asyncHandler(async (req: Request, res: Response) => {
  const positionSec = await roomService.getProgress(req.user!.id, req.params.roomId);
  sendResponse(res, HTTP_STATUS.OK, "OK", { positionSec });
});
