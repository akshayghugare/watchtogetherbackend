import type { Server, Socket } from "socket.io";
import { Op } from "sequelize";
import CallHistory from "../modules/call/model/call-history.model";
import CallParticipant from "../modules/call/model/call-participant.model";
import User from "../modules/user/model/user.model";
import { logActivity } from "../modules/admin/admin.service";
import { logger } from "../utils/logger";

type Ack = (response: { ok: boolean; error?: string; [k: string]: unknown }) => void;

/** roomId → ongoing CallHistory id (single active call per room). */
const activeCalls = new Map<string, string>();

interface PeerInfo {
  socketId: string;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
}

async function peerInfo(io: Server, socketId: string): Promise<PeerInfo | null> {
  const s = io.sockets.sockets.get(socketId);
  if (!s) return null;
  const user = await User.findByPk(s.data.userId, {
    attributes: ["id", "username", "displayName", "avatarUrl"],
  });
  return {
    socketId,
    userId: s.data.userId,
    username: user?.displayName ?? user?.username ?? null,
    avatarUrl: user?.avatarUrl ?? null,
  };
}

async function endCallIfEmpty(io: Server, roomId: string): Promise<void> {
  const remaining = await io.in(`call:${roomId}`).fetchSockets();
  if (remaining.length > 0) return;

  const callId = activeCalls.get(roomId);
  activeCalls.delete(roomId);
  if (!callId) return;

  const call = await CallHistory.findByPk(callId);
  if (call && call.status === "ONGOING") {
    const endedAt = new Date();
    await call.update({
      status: "ENDED",
      endedAt,
      durationSec: Math.round((endedAt.getTime() - call.createdAt.getTime()) / 1000),
    });
    await CallParticipant.update(
      { leftAt: endedAt },
      { where: { callId, leftAt: { [Op.is]: null } } },
    );
    await logActivity("call.ended", { entity: "call", entityId: callId });
  }
}

/**
 * WebRTC mesh signaling: peers exchange SDP offers/answers and ICE candidates
 * through `call:signal`. Screen share travels as a normal video track, flagged
 * via `call:media-state` so remote UIs can label it.
 */
export function registerCallHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  socket.on(
    "call:join",
    async ({ roomId, type }: { roomId: string; type: "AUDIO" | "VIDEO" }, ack?: Ack) => {
      try {
        // Everyone already in the call — the newcomer initiates offers to them.
        const existing = await io.in(`call:${roomId}`).fetchSockets();
        const peers = (
          await Promise.all(existing.map((s) => peerInfo(io, s.id)))
        ).filter(Boolean) as PeerInfo[];

        await socket.join(`call:${roomId}`);
        socket.data.callRoomIds = [...new Set([...(socket.data.callRoomIds ?? []), roomId])];

        // Track the call + participant in the database.
        let callId = activeCalls.get(roomId);
        if (!callId) {
          const call = await CallHistory.create({
            roomId,
            initiatorId: userId,
            type: type === "VIDEO" ? "VIDEO" : "AUDIO",
          });
          callId = call.id;
          activeCalls.set(roomId, callId);
          await logActivity("call.started", {
            userId,
            entity: "call",
            entityId: callId,
            metadata: { roomId, type },
          });
        }
        await CallParticipant.create({ callId, userId });
        await CallHistory.increment("participantCount", { where: { id: callId } });

        const me = await peerInfo(io, socket.id);
        socket.to(`call:${roomId}`).emit("call:peer-joined", me);

        ack?.({ ok: true, peers, callId });
      } catch (err) {
        logger.error(`call:join failed: ${(err as Error).message}`);
        ack?.({ ok: false, error: "Could not join call." });
      }
    },
  );

  /** Generic relay for SDP offers/answers and ICE candidates. */
  socket.on(
    "call:signal",
    ({ targetSocketId, data }: { targetSocketId: string; data: unknown }) => {
      io.to(targetSocketId).emit("call:signal", { fromSocketId: socket.id, data });
    },
  );

  /** Mute / camera / screen-share indicators for remote UIs. */
  socket.on(
    "call:media-state",
    (state: { roomId: string; audio: boolean; video: boolean; screen: boolean }) => {
      socket.to(`call:${state.roomId}`).emit("call:media-state", {
        socketId: socket.id,
        userId,
        audio: state.audio,
        video: state.video,
        screen: state.screen,
      });
    },
  );

  const leaveCall = async (roomId: string) => {
    await socket.leave(`call:${roomId}`);
    socket.data.callRoomIds = (socket.data.callRoomIds ?? []).filter(
      (id: string) => id !== roomId,
    );
    socket.to(`call:${roomId}`).emit("call:peer-left", { socketId: socket.id, userId });

    const callId = activeCalls.get(roomId);
    if (callId) {
      await CallParticipant.update(
        { leftAt: new Date() },
        { where: { callId, userId, leftAt: { [Op.is]: null } } },
      ).catch(() => undefined);
    }
    await endCallIfEmpty(io, roomId);
  };

  socket.on("call:leave", async ({ roomId }: { roomId: string }) => {
    await leaveCall(roomId).catch((e) => logger.warn(`call:leave failed: ${e.message}`));
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.data.callRoomIds ?? []) {
      void leaveCall(roomId).catch(() => undefined);
    }
  });
}
