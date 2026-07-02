import type { Request, Response } from "express";
import * as friendService from "./friend.service";
import { sendResponse } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { HTTP_STATUS } from "../../constants";

export const search = asyncHandler(async (req: Request, res: Response) => {
  const users = await friendService.searchUsers(req.user!.id, String(req.query.q));
  sendResponse(res, HTTP_STATUS.OK, "OK", { users });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const friends = await friendService.listFriends(req.user!.id);
  sendResponse(res, HTTP_STATUS.OK, "OK", { friends });
});

export const listRequests = asyncHandler(async (req: Request, res: Response) => {
  const requests = await friendService.listRequests(req.user!.id);
  sendResponse(res, HTTP_STATUS.OK, "OK", requests);
});

export const sendRequest = asyncHandler(async (req: Request, res: Response) => {
  const request = await friendService.sendRequest(req.user!.id, req.body.receiverId);
  sendResponse(res, HTTP_STATUS.CREATED, "Friend request sent.", { request });
});

export const acceptRequest = asyncHandler(async (req: Request, res: Response) => {
  const friend = await friendService.respondToRequest(req.user!.id, req.params.requestId, "accept");
  sendResponse(res, HTTP_STATUS.OK, "Friend request accepted.", { friend });
});

export const rejectRequest = asyncHandler(async (req: Request, res: Response) => {
  await friendService.respondToRequest(req.user!.id, req.params.requestId, "reject");
  sendResponse(res, HTTP_STATUS.OK, "Friend request rejected.");
});

export const cancelRequest = asyncHandler(async (req: Request, res: Response) => {
  await friendService.cancelRequest(req.user!.id, req.params.requestId);
  sendResponse(res, HTTP_STATUS.OK, "Friend request cancelled.");
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await friendService.removeFriend(req.user!.id, req.params.friendId);
  sendResponse(res, HTTP_STATUS.OK, "Friend removed.");
});
