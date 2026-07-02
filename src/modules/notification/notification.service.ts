import Notification, { type NotificationType } from "./model/notification.model";
import User from "../user/model/user.model";
import { getIo } from "../../socket/io";

interface NotifyInput {
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  imageUrl?: string | null;
  data?: Record<string, unknown>;
}

const ACTOR_ATTRS = ["id", "username", "displayName", "avatarUrl"] as const;

/** Persists a notification and pushes it to the recipient in realtime. */
export async function notifyUser(recipientId: string, input: NotifyInput): Promise<Notification> {
  const notification = await Notification.create({
    recipientId,
    actorId: input.actorId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    imageUrl: input.imageUrl ?? null,
    data: input.data ?? null,
  });

  const withActor = await Notification.findByPk(notification.id, {
    include: [{ model: User, as: "actor", attributes: [...ACTOR_ATTRS] }],
  });

  getIo()?.to(`user:${recipientId}`).emit("notification", withActor?.toJSON());
  return notification;
}

export async function notifyUsers(recipientIds: string[], input: NotifyInput): Promise<void> {
  await Promise.all(recipientIds.map((id) => notifyUser(id, input)));
}

export async function listNotifications(userId: string, page: number, limit: number) {
  const { rows, count } = await Notification.findAndCountAll({
    where: { recipientId: userId },
    include: [{ model: User, as: "actor", attributes: [...ACTOR_ATTRS] }],
    order: [["createdAt", "DESC"]],
    offset: (page - 1) * limit,
    limit,
  });
  const unreadCount = await Notification.count({ where: { recipientId: userId, isRead: false } });
  return { notifications: rows, total: count, unreadCount };
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  await Notification.update(
    { isRead: true },
    { where: { id: notificationId, recipientId: userId } },
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await Notification.update({ isRead: true }, { where: { recipientId: userId, isRead: false } });
}

export async function removeNotification(userId: string, notificationId: string): Promise<void> {
  await Notification.destroy({ where: { id: notificationId, recipientId: userId } });
}
