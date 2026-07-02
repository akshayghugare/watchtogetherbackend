import { Op } from "sequelize";
import User from "../user/model/user.model";
import Room from "../room/model/room.model";
import Movie from "../movie/model/movie.model";
import ChatMessage from "../chat/model/chat-message.model";
import ActivityLog from "./model/activity-log.model";
import { ApiError } from "../../utils/ApiError";

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

export async function stats() {
  const [users, rooms, activeRooms, movies, messages] = await Promise.all([
    User.count(),
    Room.count(),
    Room.count({ where: { isActive: true } }),
    Movie.count(),
    ChatMessage.count(),
  ]);
  return { users, rooms, activeRooms, movies, messages };
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

export async function listRooms(page: number, limit: number) {
  const { rows, count } = await Room.findAndCountAll({
    include: [
      { model: User, as: "host", attributes: ["id", "username", "displayName"] },
      { model: Movie, as: "movie", attributes: ["id", "title"] },
    ],
    order: [["createdAt", "DESC"]],
    offset: (page - 1) * limit,
    limit,
  });
  return { rooms: rows, total: count };
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
