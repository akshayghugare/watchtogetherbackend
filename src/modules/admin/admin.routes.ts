import { Router } from "express";
import type { Request, Response } from "express";
import * as adminService from "./admin.service";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendResponse } from "../../utils/ApiResponse";
import { HTTP_STATUS } from "../../constants";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

function paging(req: Request) {
  return {
    page: Math.max(1, Number(req.query.page) || 1),
    limit: Math.min(100, Number(req.query.limit) || 20),
  };
}

router.get(
  "/stats",
  asyncHandler(async (_req: Request, res: Response) => {
    sendResponse(res, HTTP_STATUS.OK, "OK", await adminService.stats());
  }),
);

router.get(
  "/users",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = paging(req);
    const result = await adminService.listUsers(
      page,
      limit,
      req.query.search ? String(req.query.search) : undefined,
    );
    sendResponse(res, HTTP_STATUS.OK, "OK", result, {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  }),
);

router.patch(
  "/users/:userId/ban",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.setBanned(
      req.user!.id,
      req.params.userId,
      Boolean(req.body.banned),
    );
    sendResponse(res, HTTP_STATUS.OK, "User updated.", { user });
  }),
);

router.get(
  "/rooms",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = paging(req);
    const result = await adminService.listRooms(page, limit);
    sendResponse(res, HTTP_STATUS.OK, "OK", result, {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  }),
);

router.get(
  "/logs",
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = paging(req);
    const result = await adminService.listLogs(page, limit);
    sendResponse(res, HTTP_STATUS.OK, "OK", result, {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
    });
  }),
);

export default router;
