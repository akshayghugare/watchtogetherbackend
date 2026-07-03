import { Op } from "sequelize";
import User from "../user/model/user.model";
import Room from "../room/model/room.model";
import RoomMember from "../room/model/room-member.model";
import RoomInvite from "../room/model/room-invite.model";
import Movie from "../movie/model/movie.model";
import ChatMessage from "../chat/model/chat-message.model";
import Friendship from "../friend/model/friendship.model";
import FriendRequest from "../friend/model/friend-request.model";
import CallHistory from "../call/model/call-history.model";
import CallParticipant from "../call/model/call-participant.model";
import ActivityLog from "./model/activity-log.model";
import { ApiError } from "../../utils/ApiError";
import { getIo } from "../../socket/io";
import {
  clearScreenShare,
  getScreenShare,
  listRoomMediaStates,
  listScreenShares,
} from "../../socket/screen-share";

const PUBLIC_USER_ATTRS = [
  "id",
  "username",
  "displayName",
  "avatarUrl",
  "isOnline",
  "lastSeenAt",
] as const;

export async function logActivity(
  action: string,
  opts: {
    userId?: string | null;
    entity?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  } = {},
): Promise<void> {
  await ActivityLog.create({
    action,
    userId: opts.userId ?? null,
    entity: opts.entity ?? null,
    entityId: opts.entityId ?? null,
    metadata: opts.metadata ?? null,
    ipAddress: opts.ipAddress ?? null,
  }).catch(() => undefined); // logging must never break the request
}

/** Live playback position derived from the last persisted state. */
function livePlayback(room: Room) {
  let positionSec = room.playbackPositionSec;
  if (room.isPlaying) {
    const elapsed = (Date.now() - new Date(room.playbackUpdatedAt).getTime()) / 1000;
    positionSec += elapsed * room.playbackRate;
  }
  return { positionSec, isPlaying: room.isPlaying, playbackRate: room.playbackRate };
}

function serializeAdminRoom(room: Room) {
  const json = room.toJSON() as unknown as Record<string, unknown>;
  delete json.passwordHash;
  return { ...json, hasPassword: Boolean(room.passwordHash) };
}

/** Sockets currently inside a socket.io channel (in-process adapter count). */
function channelSize(channel: string): number {
  return getIo()?.sockets.adapter.rooms.get(channel)?.size ?? 0;
}

export async function stats() {
  const [
    users,
    onlineUsers,
    rooms,
    activeRooms,
    privateRooms,
    publicRooms,
    movies,
    messages,
    friendships,
    pendingFriendRequests,
    activeCalls,
  ] = await Promise.all([
    User.count(),
    User.count({ where: { isOnline: true } }),
    Room.count(),
    Room.count({ where: { isActive: true } }),
    Room.count({ where: { isActive: true, privacy: "PRIVATE" } }),
    Room.count({ where: { isActive: true, privacy: "PUBLIC" } }),
    Movie.count(),
    ChatMessage.count(),
    Friendship.count(),
    FriendRequest.count({ where: { status: "PENDING" } }),
    CallHistory.count({ where: { status: "ONGOING" } }),
  ]);
  return {
    users,
    onlineUsers,
    offlineUsers: users - onlineUsers,
    rooms,
    activeRooms,
    privateRooms,
    publicRooms,
    movies,
    messages,
    friendships,
    pendingFriendRequests,
    activeCalls,
    activeScreenShares: listScreenShares().length,
  };
}

export async function listUsers(page: number, limit: number, search?: string) {
  const where = search
    ? {
        [Op.or]: [
          { username: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
        ],
      }
    : {};
  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: { exclude: ["password", "emailVerifyToken", "passwordResetToken"] },
    order: [["createdAt", "DESC"]],
    offset: (page - 1) * limit,
    limit,
  });
  return { users: rows, total: count };
}

export async function getUserDetails(userId: string) {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ["password", "emailVerifyToken", "passwordResetToken"] },
  });
  if (!user) throw ApiError.notFound("User not found.");

  const friendRows = await Friendship.findAll({
    where: { [Op.or]: [{ userAId: userId }, { userBId: userId }] },
    attributes: ["userAId", "userBId"],
  });
  const friendIds = friendRows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));

  const [friends, incoming, outgoing, hostedRooms] = await Promise.all([
    friendIds.length > 0
      ? User.findAll({
          where: { id: { [Op.in]: friendIds } },
          attributes: [...PUBLIC_USER_ATTRS],
          order: [["isOnline", "DESC"], ["username", "ASC"]],
        })
      : [],
    FriendRequest.findAll({
      where: { receiverId: userId, status: "PENDING" },
      include: [{ model: User, as: "sender", attributes: [...PUBLIC_USER_ATTRS] }],
    }),
    FriendRequest.findAll({
      where: { senderId: userId, status: "PENDING" },
      include: [{ model: User, as: "receiver", attributes: [...PUBLIC_USER_ATTRS] }],
    }),
    Room.count({ where: { hostId: userId } }),
  ]);

  return { user, friends, friendRequests: { incoming, outgoing }, hostedRooms };
}

export async function setBanned(adminId: string, userId: string, banned: boolean) {
  if (adminId === userId) throw ApiError.badRequest("You cannot ban yourself.");
  const user = await User.findByPk(userId);
  if (!user) throw ApiError.notFound("User not found.");
  await user.update({ isBanned: banned });
  await logActivity(banned ? "user.banned" : "user.unbanned", {
    userId: adminId,
    entity: "user",
    entityId: userId,
  });
  return user.toSafeJSON();
}

export async function listRooms(
  page: number,
  limit: number,
  filters: { privacy?: "PUBLIC" | "PRIVATE"; active?: boolean } = {},
) {
  const where: Record<string, unknown> = {};
  if (filters.privacy) where.privacy = filters.privacy;
  if (filters.active !== undefined) where.isActive = filters.active;

  const { rows, count } = await Room.findAndCountAll({
    where,
    include: [
      { model: User, as: "host", attributes: [...PUBLIC_USER_ATTRS] },
      { model: Movie, as: "movie", attributes: ["id", "title", "thumbnailUrl"] },
      {
        model: RoomMember,
        as: "members",
        where: { leftAt: null, isKicked: false },
        required: false,
        include: [{ model: User, as: "user", attributes: [...PUBLIC_USER_ATTRS] }],
      },
      {
        model: RoomInvite,
        as: "invites",
        required: false,
        include: [{ model: User, as: "user", attributes: [...PUBLIC_USER_ATTRS] }],
      },
    ],
    order: [["createdAt", "DESC"]],
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });

  const rooms = rows.map((room) => ({
    ...serializeAdminRoom(room),
    playback: livePlayback(room),
    connectedCount: channelSize(`room:${room.id}`),
    callCount: channelSize(`call:${room.id}`),
    screenShare: getScreenShare(room.id) ?? null,
  }));
  return { rooms, total: count };
}

export async function getRoomDetails(roomId: string) {
  const room = await Room.findByPk(roomId, {
    include: [
      { model: User, as: "host", attributes: [...PUBLIC_USER_ATTRS] },
      { model: Movie, as: "movie" },
      {
        model: RoomMember,
        as: "members",
        required: false,
        include: [{ model: User, as: "user", attributes: [...PUBLIC_USER_ATTRS] }],
      },
      {
        model: RoomInvite,
        as: "invites",
        required: false,
        include: [{ model: User, as: "user", attributes: [...PUBLIC_USER_ATTRS] }],
      },
    ],
  });
  if (!room) throw ApiError.notFound("Room not found.");

  const io = getIo();
  const roomSockets = io ? await io.in(`room:${roomId}`).fetchSockets() : [];
  const connectedUserIds = [...new Set(roomSockets.map((s) => s.data.userId as string))];
  const callSockets = io ? await io.in(`call:${roomId}`).fetchSockets() : [];
  const callUserIds = [...new Set(callSockets.map((s) => s.data.userId as string))];
  const mediaStates = listRoomMediaStates(roomId);

  const allLiveIds = [...new Set([...connectedUserIds, ...callUserIds])];
  const [liveUsers, chatMessageCount, ongoingCall] = await Promise.all([
    allLiveIds.length > 0
      ? User.findAll({
          where: { id: { [Op.in]: allLiveIds } },
          attributes: [...PUBLIC_USER_ATTRS],
        })
      : [],
    ChatMessage.count({ where: { roomId } }),
    CallHistory.findOne({ where: { roomId, status: "ONGOING" } }),
  ]);
  const userById = new Map(liveUsers.map((u) => [u.id, u.toJSON()]));

  return {
    room: serializeAdminRoom(room),
    playback: livePlayback(room),
    status: room.isActive ? "ACTIVE" : "ENDED",
    connectedUsers: connectedUserIds.map((id) => userById.get(id) ?? { id }),
    callParticipants: callUserIds.map((id) => {
      const media = mediaStates.find((m) => m.userId === id);
      return {
        user: userById.get(id) ?? { id },
        audio: media?.audio ?? false,
        video: media?.video ?? false,
        screen: media?.screen ?? false,
      };
    }),
    chatMessageCount,
    ongoingCall,
    screenShare: getScreenShare(roomId) ?? null,
  };
}

/**
 * Hard-stop a room: notify everyone, stop screen sharing, close the call
 * session, disconnect all sockets and mark the room terminated.
 */
export async function terminateRoom(adminId: string, roomId: string) {
  const room = await Room.findByPk(roomId);
  if (!room) throw ApiError.notFound("Room not found.");
  if (room.isActive) {
    await room.update({ isActive: false, endedAt: new Date(), isPlaying: false });
  }

  const io = getIo();

  const share = clearScreenShare(roomId);
  if (share) {
    io?.to(share.socketId).emit("screen:force-stop", { roomId });
    io?.to(`room:${roomId}`).emit("screen:share-state", {
      roomId,
      sharing: false,
      userId: share.userId,
      username: null,
    });
  }

  io?.to(`room:${roomId}`).emit("room:ended", { roomId, terminated: true });
  io?.in(`room:${roomId}`).socketsLeave(`room:${roomId}`);
  io?.in(`call:${roomId}`).socketsLeave(`call:${roomId}`);

  const ongoing = await CallHistory.findOne({ where: { roomId, status: "ONGOING" } });
  if (ongoing) {
    const endedAt = new Date();
    await ongoing.update({
      status: "ENDED",
      endedAt,
      durationSec: Math.round((endedAt.getTime() - ongoing.createdAt.getTime()) / 1000),
    });
    await CallParticipant.update(
      { leftAt: endedAt },
      { where: { callId: ongoing.id, leftAt: { [Op.is]: null } } },
    );
  }

  await logActivity("admin.room.terminated", {
    userId: adminId,
    entity: "room",
    entityId: roomId,
  });
}

export async function deleteRoom(adminId: string, roomId: string) {
  const room = await Room.findByPk(roomId);
  if (!room) throw ApiError.notFound("Room not found.");
  if (room.isActive) await terminateRoom(adminId, roomId);
  await room.destroy();
  await logActivity("admin.room.deleted", {
    userId: adminId,
    entity: "room",
    entityId: roomId,
    metadata: { name: room.name },
  });
}

export async function forceStopScreenShare(adminId: string, roomId: string) {
  const share = getScreenShare(roomId);
  if (!share) throw ApiError.notFound("No active screen share in this room.");

  const io = getIo();
  io?.to(share.socketId).emit("screen:force-stop", { roomId });
  clearScreenShare(roomId);
  io?.to(`room:${roomId}`).emit("screen:share-state", {
    roomId,
    sharing: false,
    userId: share.userId,
    username: null,
  });

  await logActivity("admin.screen_share.stopped", {
    userId: adminId,
    entity: "room",
    entityId: roomId,
    metadata: { targetUserId: share.userId },
  });
}

export async function listActiveScreenShares() {
  const shares = listScreenShares();
  if (shares.length === 0) return [];
  const rooms = await Room.findAll({
    where: { id: { [Op.in]: shares.map((s) => s.roomId) } },
    attributes: ["id", "name", "code", "privacy"],
  });
  const roomById = new Map(rooms.map((r) => [r.id, r.toJSON()]));
  return shares.map((s) => ({ ...s, room: roomById.get(s.roomId) ?? null }));
}

export async function listLogs(page: number, limit: number) {
  const { rows, count } = await ActivityLog.findAndCountAll({
    include: [{ model: User, as: "user", attributes: ["id", "username"] }],
    order: [["createdAt", "DESC"]],
    offset: (page - 1) * limit,
    limit,
  });
  return { logs: rows, total: count };
}
