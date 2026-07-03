import type { Server, Socket } from "socket.io";
import { Op } from "sequelize";
import CallHistory from "../modules/call/model/call-history.model";
import CallParticipant from "../modules/call/model/call-participant.model";
import Room from "../modules/room/model/room.model";
import RoomMember from "../modules/room/model/room-member.model";
import User from "../modules/user/model/user.model";
import { logActivity } from "../modules/admin/admin.service";
import {
  clearMediaState,
  clearScreenShare,
  getScreenShare,
  setMediaState,
  setScreenShare,
} from "./screen-share";
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
        // Only active members of an active room may enter the call mesh.
        const [room, member] = await Promise.all([
          Room.findByPk(roomId),
          RoomMember.findOne({ where: { roomId, userId, leftAt: null, isKicked: false } }),
        ]);
        if (!room || !room.isActive || !member) {
          ack?.({ ok: false, error: "You are not authorized to join this call." });
          return;
        }

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
    async (state: { roomId: string; audio: boolean; video: boolean; screen: boolean }) => {
      // Only sockets that actually joined the call may broadcast media state.
      if (!(socket.data.callRoomIds ?? []).includes(state.roomId)) return;

      const payload = {
        socketId: socket.id,
        userId,
        audio: Boolean(state.audio),
        video: Boolean(state.video),
        screen: Boolean(state.screen),
      };
      setMediaState({ roomId: state.roomId, ...payload });
      socket.to(`call:${state.roomId}`).emit("call:media-state", payload);

      // Keep the room-wide screen-share state in sync so every room member
      // (even outside the call) can switch to the screen-share view.
      const current = getScreenShare(state.roomId);
      if (payload.screen && current?.socketId !== socket.id) {
        const user = await User.findByPk(userId, {
          attributes: ["id", "username", "displayName"],
        }).catch(() => null);
        const info = {
          roomId: state.roomId,
          userId,
          socketId: socket.id,
          username: user?.displayName ?? user?.username ?? null,
          startedAt: new Date(),
        };
        setScreenShare(info);
        io.to(`room:${state.roomId}`).emit("screen:share-state", {
          roomId: state.roomId,
          sharing: true,
          userId: info.userId,
          username: info.username,
        });
      } else if (!payload.screen && current?.socketId === socket.id) {
        clearScreenShare(state.roomId);
        io.to(`room:${state.roomId}`).emit("screen:share-state", {
          roomId: state.roomId,
          sharing: false,
          userId,
          username: null,
        });
      }
    },
  );

  const leaveCall = async (roomId: string) => {
    await socket.leave(`call:${roomId}`);
    socket.data.callRoomIds = (socket.data.callRoomIds ?? []).filter(
      (id: string) => id !== roomId,
    );
    socket.to(`call:${roomId}`).emit("call:peer-left", { socketId: socket.id, userId });

    clearMediaState(socket.id);
    // A presenter leaving ends the room's screen share for everyone.
    if (getScreenShare(roomId)?.socketId === socket.id) {
      clearScreenShare(roomId);
      io.to(`room:${roomId}`).emit("screen:share-state", {
        roomId,
        sharing: false,
        userId,
        username: null,
      });
    }

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
