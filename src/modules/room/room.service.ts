import bcrypt from "bcrypt";
import { Op } from "sequelize";
import Room from "./model/room.model";
import RoomMember from "./model/room-member.model";
import VideoProgress from "./model/video-progress.model";
import Movie from "../movie/model/movie.model";
import User from "../user/model/user.model";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { generateRoomCode } from "../../helpers/token.helper";
import { areFriends, getFriendIds } from "../friend/friend.service";
import { notifyUser, notifyUsers } from "../notification/notification.service";
import { logActivity } from "../admin/admin.service";
import { getIo } from "../../socket/io";

const MEMBER_USER_ATTRS = ["id", "username", "displayName", "avatarUrl", "isOnline"] as const;

const roomInclude = [
  { model: User, as: "host", attributes: [...MEMBER_USER_ATTRS] },
  { model: Movie, as: "movie" },
  {
    model: RoomMember,
    as: "members",
    where: { leftAt: null, isKicked: false },
    required: false,
    include: [{ model: User, as: "user", attributes: [...MEMBER_USER_ATTRS] }],
  },
];

export function serializeRoom(room: Room) {
  const json = room.toJSON() as unknown as Record<string, unknown>;
  delete json.passwordHash;
  return { ...json, hasPassword: Boolean(room.passwordHash) };
}

interface CreateRoomInput {
  name: string;
  movieId?: string;
  privacy?: "PUBLIC" | "PRIVATE";
  password?: string;
  maxMembers?: number;
}

export async function createRoom(hostId: string, input: CreateRoomInput) {
  if (input.movieId) {
    const movie = await Movie.findByPk(input.movieId);
    if (!movie) throw ApiError.notFound("Movie not found.");
  }

  const room = await Room.create({
    name: input.name,
    code: generateRoomCode(),
    privacy: input.privacy ?? "PUBLIC",
    passwordHash: input.password
      ? await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS)
      : null,
    hostId,
    movieId: input.movieId ?? null,
    maxMembers: Math.min(Math.max(input.maxMembers ?? 25, 2), 100),
  });

  await RoomMember.create({ roomId: room.id, userId: hostId, role: "HOST" });
  await logActivity("room.created", {
    userId: hostId,
    entity: "room",
    entityId: room.id,
    metadata: { name: room.name, movieId: room.movieId },
  });

  // "X started watching Y — Join now" popup for the host's friends.
  if (room.movieId) {
    const [host, movie, friendIds] = await Promise.all([
      User.findByPk(hostId),
      Movie.findByPk(room.movieId),
      getFriendIds(hostId),
    ]);
    if (friendIds.length > 0) {
      await notifyUsers(friendIds, {
        actorId: hostId,
        type: "MOVIE_STARTED",
        title: `${host?.displayName ?? host?.username} started watching ${movie?.title}`,
        body: "Join now and watch together!",
        imageUrl: movie?.thumbnailUrl ?? null,
        data: { roomId: room.id, roomCode: room.code, movieTitle: movie?.title },
      });
    }
  }

  return getRoom(room.id);
}

export async function getRoom(roomId: string) {
  const room = await Room.findByPk(roomId, { include: roomInclude });
  if (!room) throw ApiError.notFound("Room not found.");
  return serializeRoom(room);
}

export async function listPublicRooms(page: number, limit: number) {
  const { rows, count } = await Room.findAndCountAll({
    where: { privacy: "PUBLIC", isActive: true },
    include: [
      { model: User, as: "host", attributes: [...MEMBER_USER_ATTRS] },
      { model: Movie, as: "movie" },
    ],
    order: [["createdAt", "DESC"]],
    offset: (page - 1) * limit,
    limit,
    distinct: true,
  });
  return { rooms: rows.map(serializeRoom), total: count };
}

export async function listMyRooms(userId: string) {
  const memberships = await RoomMember.findAll({
    where: { userId, isKicked: false },
    attributes: ["roomId"],
  });
  const rooms = await Room.findAll({
    where: { id: { [Op.in]: memberships.map((m) => m.roomId) }, isActive: true },
    include: [
      { model: User, as: "host", attributes: [...MEMBER_USER_ATTRS] },
      { model: Movie, as: "movie" },
    ],
    order: [["updatedAt", "DESC"]],
  });
  return rooms.map(serializeRoom);
}

export async function joinRoom(
  userId: string,
  roomIdOrCode: string,
  password?: string,
) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(roomIdOrCode);
  const room = await Room.findOne({
    where: isUuid ? { id: roomIdOrCode } : { code: roomIdOrCode.toUpperCase() },
  });
  if (!room || !room.isActive) throw ApiError.notFound("Room not found or has ended.");

  const existing = await RoomMember.findOne({ where: { roomId: room.id, userId } });
  if (existing?.isKicked) throw ApiError.forbidden("You have been removed from this room.");

  // Already an active member → idempotent re-join (page refresh etc.)
  if (existing && !existing.leftAt) return getRoom(room.id);

  // Private rooms: friends of the host or invited users pass; others need the password.
  if (room.privacy === "PRIVATE" && room.hostId !== userId) {
    const friendOfHost = await areFriends(userId, room.hostId);
    if (!friendOfHost && room.passwordHash) {
      const ok = password ? await bcrypt.compare(password, room.passwordHash) : false;
      if (!ok) throw ApiError.forbidden("Incorrect room password.");
    } else if (!friendOfHost && !room.passwordHash) {
      throw ApiError.forbidden("This room is private.");
    }
  } else if (room.passwordHash && room.hostId !== userId) {
    const ok = password ? await bcrypt.compare(password, room.passwordHash) : false;
    if (!ok) throw ApiError.forbidden("Incorrect room password.");
  }

  const activeCount = await RoomMember.count({
    where: { roomId: room.id, leftAt: null, isKicked: false },
  });
  if (activeCount >= room.maxMembers) throw ApiError.conflict("Room is full.");

  if (existing) {
    await existing.update({ leftAt: null });
  } else {
    await RoomMember.create({ roomId: room.id, userId, role: "MEMBER" });
  }
  await logActivity("room.joined", { userId, entity: "room", entityId: room.id });

  return getRoom(room.id);
}

export async function leaveRoom(userId: string, roomId: string) {
  const member = await RoomMember.findOne({ where: { roomId, userId, leftAt: null } });
  if (!member) throw ApiError.notFound("You are not in this room.");
  await member.update({ leftAt: new Date() });
  await logActivity("room.left", { userId, entity: "room", entityId: roomId });

  // Host leaving hands the room to the longest-standing member, or ends it.
  const room = await Room.findByPk(roomId);
  if (room && room.hostId === userId) {
    const nextHost = await RoomMember.findOne({
      where: { roomId, leftAt: null, isKicked: false },
      order: [["createdAt", "ASC"]],
    });
    if (nextHost) {
      await transferHostInternal(room, nextHost.userId);
    } else {
      await room.update({ isActive: false, endedAt: new Date(), isPlaying: false });
    }
  }
}

export async function kickMember(hostId: string, roomId: string, targetUserId: string) {
  const room = await Room.findByPk(roomId);
  if (!room) throw ApiError.notFound("Room not found.");
  if (room.hostId !== hostId) throw ApiError.forbidden("Only the host can kick members.");
  if (targetUserId === hostId) throw ApiError.badRequest("You cannot kick yourself.");

  const member = await RoomMember.findOne({ where: { roomId, userId: targetUserId } });
  if (!member || member.leftAt) throw ApiError.notFound("Member not found in this room.");

  await member.update({ isKicked: true, leftAt: new Date() });
  await logActivity("room.member_kicked", {
    userId: hostId,
    entity: "room",
    entityId: roomId,
    metadata: { targetUserId },
  });
  getIo()?.to(`user:${targetUserId}`).emit("room:kicked", { roomId });
}

async function transferHostInternal(room: Room, newHostId: string) {
  await RoomMember.update({ role: "MEMBER" }, { where: { roomId: room.id, role: "HOST" } });
  await RoomMember.update(
    { role: "HOST" },
    { where: { roomId: room.id, userId: newHostId } },
  );
  await room.update({ hostId: newHostId });
  getIo()?.to(`room:${room.id}`).emit("room:host-changed", { roomId: room.id, newHostId });
}

export async function transferHost(hostId: string, roomId: string, newHostId: string) {
  const room = await Room.findByPk(roomId);
  if (!room) throw ApiError.notFound("Room not found.");
  if (room.hostId !== hostId) throw ApiError.forbidden("Only the host can transfer hosting.");

  const target = await RoomMember.findOne({
    where: { roomId, userId: newHostId, leftAt: null, isKicked: false },
  });
  if (!target) throw ApiError.notFound("Target member is not in this room.");

  await transferHostInternal(room, newHostId);
  await notifyUser(newHostId, {
    actorId: hostId,
    type: "HOST_TRANSFERRED",
    title: `You are now the host of ${room.name}`,
    data: { roomId },
  });
}

export async function inviteToRoom(userId: string, roomId: string, friendId: string) {
  const room = await Room.findByPk(roomId, { include: [{ model: Movie, as: "movie" }] });
  if (!room || !room.isActive) throw ApiError.notFound("Room not found.");

  const member = await RoomMember.findOne({ where: { roomId, userId, leftAt: null } });
  if (!member) throw ApiError.forbidden("You are not in this room.");
  if (!(await areFriends(userId, friendId))) {
    throw ApiError.forbidden("You can only invite friends.");
  }

  const inviter = await User.findByPk(userId);
  await notifyUser(friendId, {
    actorId: userId,
    type: "MOVIE_INVITATION",
    title: `${inviter?.displayName ?? inviter?.username} invited you to ${room.name}`,
    body: room.movie ? `Watching: ${room.movie.title}` : undefined,
    imageUrl: room.movie?.thumbnailUrl ?? null,
    data: { roomId: room.id, roomCode: room.code },
  });
}

export async function endRoom(hostId: string, roomId: string) {
  const room = await Room.findByPk(roomId);
  if (!room) throw ApiError.notFound("Room not found.");
  if (room.hostId !== hostId) throw ApiError.forbidden("Only the host can end the room.");
  await room.update({ isActive: false, endedAt: new Date(), isPlaying: false });
  getIo()?.to(`room:${roomId}`).emit("room:ended", { roomId });
}

export async function saveProgress(userId: string, roomId: string, positionSec: number) {
  const [row] = await VideoProgress.findOrCreate({
    where: { userId, roomId },
    defaults: { userId, roomId, positionSec },
  });
  if (row.positionSec !== positionSec) await row.update({ positionSec });
}

export async function getProgress(userId: string, roomId: string) {
  const row = await VideoProgress.findOne({ where: { userId, roomId } });
  return row?.positionSec ?? 0;
}
