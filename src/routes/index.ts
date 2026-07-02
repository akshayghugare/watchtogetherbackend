import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/user/user.routes";
import friendRoutes from "../modules/friend/friend.routes";
import movieRoutes from "../modules/movie/movie.routes";
import roomRoutes from "../modules/room/room.routes";
import chatRoutes from "../modules/chat/chat.routes";
import notificationRoutes from "../modules/notification/notification.routes";
import adminRoutes from "../modules/admin/admin.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "OK", uptime: process.uptime() });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/friends", friendRoutes);
router.use("/movies", movieRoutes);
router.use("/rooms", roomRoutes);
router.use("/chat", chatRoutes);
router.use("/notifications", notificationRoutes);
router.use("/admin", adminRoutes);

export default router;
