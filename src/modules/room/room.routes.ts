import { Router } from "express";
import * as controller from "./room.controller";
import {
  changeMovieSchema,
  createRoomSchema,
  inviteSchema,
  joinRoomSchema,
  kickSchema,
  roomIdSchema,
  transferHostSchema,
} from "./room.validator";
import { validate } from "../../middleware/validate.middleware";
import { requireAuth } from "../../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", controller.listPublic);
router.get("/mine", controller.listMine);
router.post("/", validate(createRoomSchema), controller.create);
router.post("/join", validate(joinRoomSchema), controller.join);
router.get("/:roomId", validate(roomIdSchema), controller.getOne);
router.post("/:roomId/leave", validate(roomIdSchema), controller.leave);
router.post("/:roomId/kick", validate(kickSchema), controller.kick);
router.post("/:roomId/transfer-host", validate(transferHostSchema), controller.transferHost);
router.post("/:roomId/invite", validate(inviteSchema), controller.invite);
router.patch("/:roomId/movie", validate(changeMovieSchema), controller.changeMovie);
router.post("/:roomId/end", validate(roomIdSchema), controller.end);
router.get("/:roomId/progress", validate(roomIdSchema), controller.myProgress);

export default router;
