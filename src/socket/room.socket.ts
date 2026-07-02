import type { Server, Socket } from "socket.io";
import { Op } from "sequelize";
import Room from "../modules/room/model/room.model";
import RoomMember from "../modules/room/model/room-member.model";
import User from "../modules/user/model/user.model";
import Movie from "../modules/movie/model/movie.model";
import Notification from "../modules/notification/model/notification.model";
import { saveProgress } from "../modules/room/room.service";
import { getFriendIds } from "../modules/friend/friend.service";
import { notifyUsers } from "../modules/notification/notification.service";
import { logger } from "../utils/logger";

type Ack = (response: { ok: boolean; error?: string; [k: string]: unknown }) => void;

/**
 * Live playback position derived from the last persisted state — the single
 * source of truth for late joiners and drift correction.
 */
export function livePosition(room: Room): number {
  if (!room.isPlaying) return room.playbackPositionSec;
  const elapsed = (Date.now() - new Date(room.playbackUpdatedAt).getTime()) / 1000;
  return room.playbackPositionSec + elapsed * room.playbackRate;
}

function playbackState(room: Room) {
  return {
    positionSec: livePosition(room),
    isPlaying: room.isPlaying,
    playbackRate: room.playbackRate,
    serverTime: Date.now(), // client compensates network latency with this
  };
}

async function requireActiveMember(roomId: string, userId: string): Promise<Room | null> {
  const [room, member] = await Promise.all([
    Room.findByPk(roomId),
    RoomMember.findOne({ where: { roomId, userId, leftAt: null, isKicked: false } }),
  ]);
  if (!room || !room.isActive || !member) return null;
  return room;
}

/** Rooms whose "movie started" popup already went out (per server run). */
const startNotifiedRooms = new Set<string>();

async function notifyFriendsOnFirstPlay(room: Room, hostId: string): Promise<void> {
  if (startNotifiedRooms.has(room.id)) return;
  startNotifiedRooms.add(room.id);

  // Skip if a MOVIE_STARTED notification for this room already exists (e.g. sent at creation).
  const already = await Notification.findOne({
    where: { type: "MOVIE_STARTED", data: { roomId: room.id } as never },
  }).catch(() => null);
  if (already) return;

  const [host, movie, friendIds, activeMembers] = await Promise.all([
    User.findByPk(hostId),
    room.movieId ? Movie.findByPk(room.movieId) : null,
    getFriendIds(hostId),
    RoomMember.findAll({ where: { roomId: room.id, leftAt: null }, attributes: ["userId"] }),
  ]);
  const inRoom = new Set(activeMembers.map((m) => m.userId));
  const recipients = friendIds.filter((id) => !inRoom.has(id));
  if (recipients.length === 0) return;

  await notifyUsers(recipients, {
    actorId: hostId,
    type: "MOVIE_STARTED",
    title: `${host?.displayName ?? host?.username} started watching ${movie?.title ?? "a movie"}`,
    body: "Join now and watch together!",
    imageUrl: movie?.thumbnailUrl ?? null,
    data: { roomId: room.id, roomCode: room.code, movieTitle: movie?.title },
  });
}

export function registerRoomHandlers(io: Server, socket: Socket): void {
  const userId = socket.data.userId as string;

  /** Enter the live room channel; ack carries the current playback state. */
  socket.on("room:join", async ({ roomId }: { roomId: string }, ack?: Ack) => {
    try {
      const room = await requireActiveMember(roomId, userId);
      if (!room) {
        ack?.({ ok: false, error: "You are not a member of this room." });
        return;
      }
      await socket.join(`room:${roomId}`);
      socket.data.roomIds = [...new Set([...(socket.data.roomIds ?? []), roomId])];

      const user = await User.findByPk(userId, {
        attributes: ["id", "username", "displayName", "avatarUrl", "isOnline"],
      });
      socket.to(`room:${roomId}`).emit("room:member-joined", { user: user?.toJSON() });

      ack?.({ ok: true, playback: playbackState(room) });
    } catch (err) {
      logger.error(`room:join failed: ${(err as Error).message}`);
      ack?.({ ok: false, error: "Could not join room." });
    }
  });

  socket.on("room:leave", async ({ roomId }: { roomId: string }) => {
    await socket.leave(`room:${roomId}`);
    socket.data.roomIds = (socket.data.roomIds ?? []).filter((id: string) => id !== roomId);
    socket.to(`room:${roomId}`).emit("room:member-left", { userId });
  });

  /** Explicit late-joiner / drift-recovery state request. */
  socket.on("playback:state", async ({ roomId }: { roomId: string }, ack?: Ack) => {
    const room = await requireActiveMember(roomId, userId);
    if (!room) {
      ack?.({ ok: false, error: "Not a member." });
      return;
    }
    ack?.({ ok: true, playback: playbackState(room) });
  });

  // ── Host playback controls — broadcast to every member instantly ──

  const hostControl =
    (
      apply: (room: Room, payload: { positionSec?: number; rate?: number }) => Promise<void>,
      event: string,
    ) =>
    async (payload: { roomId: string; positionSec?: number; rate?: number }, ack?: Ack) => {
      try {
        const room = await Room.findByPk(payload.roomId);
        if (!room || !room.isActive) {
          ack?.({ ok: false, error: "Room not found." });
          return;
        }
        if (room.hostId !== userId) {
          ack?.({ ok: false, error: "Only the host controls playback." });
          return;
        }
        await apply(room, payload);
        io.to(`room:${payload.roomId}`).emit(event, {
          ...playbackState(room),
          positionSec: room.playbackPositionSec,
        });
        ack?.({ ok: true });

        if (event === "playback:play") {
          void notifyFriendsOnFirstPlay(room, userId);
        }
      } catch (err) {
        logger.error(`${event} failed: ${(err as Error).message}`);
        ack?.({ ok: false, error: "Playback update failed." });
      }
    };

  socket.on(
    "playback:play",
    hostControl(async (room, p) => {
      await room.update({
        isPlaying: true,
        playbackPositionSec: p.positionSec ?? room.playbackPositionSec,
        playbackUpdatedAt: new Date(),
      });
    }, "playback:play"),
  );

  socket.on(
    "playback:pause",
    hostControl(async (room, p) => {
      await room.update({
        isPlaying: false,
        playbackPositionSec: p.positionSec ?? livePosition(room),
        playbackUpdatedAt: new Date(),
      });
    }, "playback:pause"),
  );

  socket.on(
    "playback:seek",
    hostControl(async (room, p) => {
      await room.update({
        playbackPositionSec: p.positionSec ?? 0,
        playbackUpdatedAt: new Date(),
      });
    }, "playback:seek"),
  );

  socket.on(
    "playback:rate",
    hostControl(async (room, p) => {
      await room.update({
        playbackPositionSec: livePosition(room),
        playbackRate: Math.min(Math.max(p.rate ?? 1, 0.25), 3),
        playbackUpdatedAt: new Date(),
      });
    }, "playback:rate"),
  );

  /**
   * Host heartbeat (~5s): re-anchors the authoritative position so drift
   * never accumulates; members correct themselves if they diverge >2s.
   */
  socket.on("playback:tick", async ({ roomId, positionSec }: { roomId: string; positionSec: number }) => {
    const room = await Room.findByPk(roomId);
    if (!room || room.hostId !== userId || !room.isActive) return;
    await room.update({ playbackPositionSec: positionSec, playbackUpdatedAt: new Date() });
    socket.to(`room:${roomId}`).emit("playback:sync", {
      positionSec,
      isPlaying: room.isPlaying,
      playbackRate: room.playbackRate,
      serverTime: Date.now(),
    });
  });

  /** Personal resume position ("continue watching"). */
  socket.on("progress:save", async ({ roomId, positionSec }: { roomId: string; positionSec: number }) => {
    if (typeof positionSec !== "number" || positionSec < 0) return;
    await saveProgress(userId, roomId, positionSec).catch(() => undefined);
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.data.roomIds ?? []) {
      socket.to(`room:${roomId}`).emit("room:member-left", { userId });
    }
  });
}

export async function getRoomWithMovie(roomId: string) {
  return Room.findOne({
    where: { id: roomId, isActive: true, movieId: { [Op.ne]: null } },
    include: [{ model: Movie, as: "movie" }],
  });
}
