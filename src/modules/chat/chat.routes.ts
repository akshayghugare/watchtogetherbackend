import { Router } from "express";
import * as controller from "./chat.controller";
import { requireAuth } from "../../middleware/auth.middleware";
import { chatFileUpload } from "../../middleware/upload.middleware";

const router = Router();

router.use(requireAuth);

// Realtime send/edit/delete/react/typing happen over Socket.io (chat:* events);
// REST covers history/search/pins and multipart file uploads.
router.get("/:roomId/messages", controller.history);
router.post("/:roomId/messages/file", chatFileUpload.single("file"), controller.uploadFile);

export default router;
