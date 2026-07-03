import bcrypt from "bcrypt";
import { Op } from "sequelize";
import Room from "./model/room.model";
import RoomMember from "./model/room-member.model";
import RoomInvite from "./model/room-invite.model";
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
  {
    model: RoomInvite,
    as: "invites",
    required: false,
    include: [{ model: User, as: "user", attributes: [...MEMBER_USER_ATTRS] }],
  },
];

/**
 * Room access rule: the host, invited users and admins always pass.
 * PUBLIC rooms additionally open up to the host's friends; PRIVATE rooms
 * never do. Users with no relation to the host can't access anything.
 */
export async function canAccessRoom(
  room: Room,
  userId: string,
  role?: string,
): Promise<boolean> {
  if (room.hostId === userId || role === "ADMIN") return true;
  const [invite, member] = await Promise.all([
    RoomInvite.findOne({ where: { roomId: room.id, userId } }),
    RoomMember.findOne({ where: { roomId: room.id, userId, isKicked: false } }),
  ]);
  if (invite || member) return true;
  if (room.privacy === "PUBLIC") return areFriends(userId, room.hostId);
  return false;
}

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
  invitedUserIds?: string[];
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

  const [host, movie, friendIds] = await Promise.all([
    User.findByPk(hostId),
    room.movieId ? Movie.findByPk(room.movieId) : null,
    getFriendIds(hostId),
  ]);

  // Persist the invite allowlist — only friends of the host can be invited.
  const friendSet = new Set(friendIds);
  const invitedIds = [...new Set(input.invitedUserIds ?? [])].filter(
    (id) => id !== hostId && friendSet.has(id),
  );
  if (invitedIds.length > 0) {
    await RoomInvite.bulkCreate(
      invitedIds.map((userId) => ({ roomId: room.id, userId, invitedById: hostId })),
      { ignoreDuplicates: true },
    );
    await notifyUsers(invitedIds, {
      actorId: hostId,
      type: "ROOM_INVITE",
      title: `${host?.displayName ?? host?.username} invited you to ${room.name}`,
      body: movie ? `Watching: ${movie.title}` : "Join and watch together!",
      imageUrl: movie?.thumbnailUrl ?? null,
      data: { roomId: room.id, roomCode: room.code, movieTitle: movie?.title },
    });
  }

  // "X started watching Y — Join now" popup. Private rooms must stay invisible
  // to everyone but the invited users, so only public rooms broadcast to all
  // friends (invited ones were already notified above).
  if (room.movieId && room.privacy === "PUBLIC") {
    const recipients = friendIds.filter((id) => !invitedIds.includes(id));
    if (recipients.length > 0) {
      await notifyUsers(recipients, {
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

export async function getRoom(roomId: string, viewer?: { id: string; role: string }) {
  const room = await Room.findByPk(roomId, { include: roomInclude });
  if (!room) throw ApiError.notFound("Room not found.");
  // Unauthorized users must not learn anything about a private room.
  if (viewer && !(await canAccessRoom(room, viewer.id, viewer.role))) {
    throw ApiError.notFound("Room not found.");
  }
  return serializeRoom(room);
}

/**
 * Rooms the user is allowed to discover: rooms they host, rooms they were
 * invited to and public rooms hosted by their friends. Admins see every
 * active room. Filtering happens at the query level — unauthorized rooms
 * never leave the DB.
 */
export async function listPublicRooms(
  page: number,
  limit: number,
  viewer: { id: string; role: string },
) {
  let visibleWhere: Record<string, unknown> = { isActive: true };
  if (viewer.role !== "ADMIN") {
    const [invites, friendIds] = await Promise.all([
      RoomInvite.findAll({ where: { userId: viewer.id }, attributes: ["roomId"] }),
      getFriendIds(viewer.id),
    ]);
    visibleWhere = {
      isActive: true,
      [Op.or]: [
        { hostId: viewer.id },
        { id: { [Op.in]: invites.map((i) => i.roomId) } },
        { privacy: "PUBLIC", hostId: { [Op.in]: friendIds } },
      ],
    };
  }

  const { rows, count } = await Room.findAndCountAll({
    where: visibleWhere,
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
  role?: string,
) {
  const isUuid = /^[0-9a-f-]{36}$/i.test(roomIdOrCode);
  const room = await Room.findOne({
    where: isUuid ? { id: roomIdOrCode } : { code: roomIdOrCode.toUpperCase() },
  });
  if (!room || !room.isActive) throw ApiError.notFound("Room not found or has ended.");

  const isAdmin = role === "ADMIN";
  const existing = await RoomMember.findOne({ where: { roomId: room.id, userId } });
  if (existing?.isKicked && !isAdmin) {
    throw ApiError.forbidden("You have been removed from this room.");
  }

  // Already an active member → idempotent re-join (page refresh etc.)
  if (existing && !existing.leftAt && !existing.isKicked) return getRoom(room.id);

  if (room.hostId !== userId && !isAdmin) {
    const invite = await RoomInvite.findOne({ where: { roomId: room.id, userId } });
    if (room.privacy === "PRIVATE") {
      // Private rooms: invited users only — a password never substitutes
      // for an invitation.
      if (!invite) throw ApiError.forbidden("You are not authorized to join this room.");
    } else {
      // Public rooms: the host's friends and invited users only — strangers
      // are rejected even with the room code.
      if (!invite && !(await areFriends(userId, room.hostId))) {
        throw ApiError.forbidden("You are not authorized to join this room.");
      }
      if (room.passwordHash) {
        const ok = password ? await bcrypt.compare(password, room.passwordHash) : false;
        if (!ok) throw ApiError.forbidden("Incorrect room password.");
      }
    }
  }

  const activeCount = await RoomMember.count({
    where: { roomId: room.id, leftAt: null, isKicked: false },
  });
  if (activeCount >= room.maxMembers && !isAdmin) throw ApiError.conflict("Room is full.");

  if (existing) {
    await existing.update({ leftAt: null, isKicked: false });
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

export async function kickMember(
  actorId: string,
  roomId: string,
  targetUserId: string,
  opts: { asAdmin?: boolean } = {},
) {
  const room = await Room.findByPk(roomId);
  if (!room) throw ApiError.notFound("Room not found.");
  if (!opts.asAdmin && room.hostId !== actorId) {
    throw ApiError.forbidden("Only the host can kick members.");
  }
  if (targetUserId === actorId) throw ApiError.badRequest("You cannot kick yourself.");

  const member = await RoomMember.findOne({ where: { roomId, userId: targetUserId } });
  if (!member || member.leftAt) throw ApiError.notFound("Member not found in this room.");

  await member.update({ isKicked: true, leftAt: new Date() });
  await logActivity(opts.asAdmin ? "admin.room.member_kicked" : "room.member_kicked", {
    userId: actorId,
    entity: "room",
    entityId: roomId,
    metadata: { targetUserId },
  });
  const io = getIo();
  io?.to(`user:${targetUserId}`).emit("room:kicked", { roomId });
  // Force the kicked user's sockets out of the live channels immediately.
  io?.in(`user:${targetUserId}`).socketsLeave([`room:${roomId}`, `call:${roomId}`]);
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
  // Access to a private room is granted only by its host.
  if (room.privacy === "PRIVATE" && room.hostId !== userId) {
    throw ApiError.forbidden("Only the host can invite people to a private room.");
  }
  if (!(await areFriends(userId, friendId))) {
    throw ApiError.forbidden("You can only invite friends.");
  }

  // Persist the invite so the room becomes visible/joinable for the friend.
  await RoomInvite.findOrCreate({
    where: { roomId, userId: friendId },
    defaults: { roomId, userId: friendId, invitedById: userId },
  });

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

/** Host swaps the room's video mid-session; playback resets to a paused start. */
export async function changeRoomMovie(hostId: string, roomId: string, movieId: string) {
  const room = await Room.findByPk(roomId);
  if (!room || !room.isActive) throw ApiError.notFound("Room not found or has ended.");
  if (room.hostId !== hostId) throw ApiError.forbidden("Only the host can change the video.");

  const movie = await Movie.findByPk(movieId);
  if (!movie) throw ApiError.notFound("Movie not found.");

  await room.update({
    movieId,
    playbackPositionSec: 0,
    isPlaying: false,
    playbackRate: 1,
    playbackUpdatedAt: new Date(),
  });
  await logActivity("room.movie_changed", {
    userId: hostId,
    entity: "room",
    entityId: roomId,
    metadata: { movieId, title: movie.title },
  });

  getIo()?.to(`room:${roomId}`).emit("room:movie-changed", {
    roomId,
    movieId,
    movieTitle: movie.title,
  });
  return getRoom(roomId);
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
