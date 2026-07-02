import type { Server, Socket } from "socket.io";
import * as chatService from "../modules/chat/chat.service";
import User from "../modules/user/model/user.model";
import { logger } from "../utils/logger";

type Ack = (response: { ok: boolean; error?: string; [k: string]: unknown }) => void;

export function registerChatHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  socket.on(
    "chat:send",
    async (
      payload: { roomId: string; content?: string; replyToId?: string },
      ack?: Ack,
    ) => {
      try {
        const message = await chatService.createMessage(payload.roomId, userId, {
          content: payload.content,
          replyToId: payload.replyToId,
        });
        io.to(`room:${payload.roomId}`).emit("chat:new", message?.toJSON());
        ack?.({ ok: true, message: message?.toJSON() });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    },
  );

  socket.on(
    "chat:edit",
    async (payload: { messageId: string; content: string }, ack?: Ack) => {
      try {
        const message = await chatService.editMessage(userId, payload.messageId, payload.content);
        if (message) io.to(`room:${message.roomId}`).emit("chat:updated", message.toJSON());
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    },
  );

  socket.on("chat:delete", async (payload: { messageId: string }, ack?: Ack) => {
    try {
      const message = await chatService.deleteMessage(userId, payload.messageId);
      io.to(`room:${message.roomId}`).emit("chat:deleted", {
        messageId: message.id,
        roomId: message.roomId,
      });
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message });
    }
  });

  socket.on(
    "chat:react",
    async (payload: { messageId: string; emoji: string }, ack?: Ack) => {
      try {
        const message = await chatService.toggleReaction(userId, payload.messageId, payload.emoji);
        if (message) io.to(`room:${message.roomId}`).emit("chat:updated", message.toJSON());
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    },
  );

  socket.on("chat:pin", async (payload: { messageId: string }, ack?: Ack) => {
    try {
      const message = await chatService.togglePin(userId, payload.messageId);
      if (message) io.to(`room:${message.roomId}`).emit("chat:updated", message.toJSON());
      ack?.({ ok: true });
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("chat:typing", async ({ roomId, isTyping }: { roomId: string; isTyping: boolean }) => {
    try {
      const user = await User.findByPk(userId, { attributes: ["id", "username", "displayName"] });
      socket.to(`room:${roomId}`).emit("chat:typing", {
        userId,
        username: user?.displayName ?? user?.username,
        isTyping: Boolean(isTyping),
      });
    } catch (err) {
      logger.debug(`chat:typing failed: ${(err as Error).message}`);
    }
  });
}
