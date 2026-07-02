import type { Server, Socket } from "socket.io";
import User from "../modules/user/model/user.model";
import { getFriendIds } from "../modules/friend/friend.service";
import { logger } from "../utils/logger";

/** userId → live socket ids (multi-tab / multi-device aware). */
const onlineSockets = new Map<string, Set<string>>();

export function isUserOnline(userId: string): boolean {
  return (onlineSockets.get(userId)?.size ?? 0) > 0;
}

export async function handleConnect(io: Server, socket: Socket): Promise<void> {
  const userId = socket.data.userId as string;
  const sockets = onlineSockets.get(userId) ?? new Set<string>();
  const wasOffline = sockets.size === 0;
  sockets.add(socket.id);
  onlineSockets.set(userId, sockets);

  if (wasOffline) {
    await User.update({ isOnline: true }, { where: { id: userId } }).catch((e) =>
      logger.warn(`presence online update failed: ${e.message}`),
    );
    const friendIds = await getFriendIds(userId).catch(() => [] as string[]);
    for (const friendId of friendIds) {
      io.to(`user:${friendId}`).emit("presence:online", { userId });
    }
  }
}

export async function handleDisconnect(io: Server, socket: Socket): Promise<void> {
  const userId = socket.data.userId as string;
  const sockets = onlineSockets.get(userId);
  if (!sockets) return;
  sockets.delete(socket.id);

  if (sockets.size === 0) {
    onlineSockets.delete(userId);
    const lastSeenAt = new Date();
    await User.update({ isOnline: false, lastSeenAt }, { where: { id: userId } }).catch((e) =>
      logger.warn(`presence offline update failed: ${e.message}`),
    );
    const friendIds = await getFriendIds(userId).catch(() => [] as string[]);
    for (const friendId of friendIds) {
      io.to(`user:${friendId}`).emit("presence:offline", { userId, lastSeenAt });
    }
  }
}
