import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { verifyAccessToken } from "../utils/jwt";
import { setIo } from "./io";
import { handleConnect, handleDisconnect } from "./presence";
import { registerRoomHandlers } from "./room.socket";
import { registerChatHandlers } from "./chat.socket";
import { registerCallHandlers } from "./call.socket";

export let io: Server;

/**
 * Socket.io bootstrap with JWT handshake auth.
 * Channels: `user:<id>` (personal), `room:<id>` (watch room), `call:<roomId>` (WebRTC).
 */
export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    pingTimeout: 20000,
    pingInterval: 10000,
  });
  setIo(io);

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string | undefined) ??
        socket.handshake.headers.authorization?.slice(7);
      if (!token) throw new Error("Missing auth token");
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    logger.debug(`Socket connected: ${socket.id} (user ${socket.data.userId})`);

    // Personal room — lets the server target a user across all their tabs/devices.
    socket.join(`user:${socket.data.userId}`);

    void handleConnect(io, socket);
    registerRoomHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerCallHandlers(io, socket);

    socket.on("disconnect", () => {
      void handleDisconnect(io, socket);
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info("✅ Socket.io initialized");
  return io;
}
