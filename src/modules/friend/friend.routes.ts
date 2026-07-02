import { Router } from "express";
import * as controller from "./friend.controller";
import {
  friendIdSchema,
  requestIdSchema,
  searchUsersSchema,
  sendRequestSchema,
} from "./friend.validator";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", controller.list);
router.get("/search", validate(searchUsersSchema), controller.search);
router.get("/requests", controller.listRequests);
router.post("/requests", validate(sendRequestSchema), controller.sendRequest);
router.post("/requests/:requestId/accept", validate(requestIdSchema), controller.acceptRequest);
router.post("/requests/:requestId/reject", validate(requestIdSchema), controller.rejectRequest);
router.delete("/requests/:requestId", validate(requestIdSchema), controller.cancelRequest);
router.delete("/:friendId", validate(friendIdSchema), controller.remove);

export default router;
