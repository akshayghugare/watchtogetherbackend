import { Op } from "sequelize";
import ChatMessage, { type MessageType } from "./model/chat-message.model";
import MessageReaction from "./model/message-reaction.model";
import RoomMember from "../room/model/room-member.model";
import User from "../user/model/user.model";
import { ApiError } from "../../utils/ApiError";
import { localFileUrl } from "../../middleware/upload.middleware";

const SENDER_ATTRS = ["id", "username", "displayName", "avatarUrl"] as const;

const messageInclude = [
  { model: User, as: "sender", attributes: [...SENDER_ATTRS] },
  {
    model: ChatMessage,
    as: "replyTo",
    include: [{ model: User, as: "sender", attributes: [...SENDER_ATTRS] }],
  },
  {
    model: MessageReaction,
    as: "reactions",
    include: [{ model: User, as: "user", attributes: [...SENDER_ATTRS] }],
  },
];

export async function assertMember(roomId: string, userId: string): Promise<void> {
  const member = await RoomMember.findOne({
    where: { roomId, userId, leftAt: null, isKicked: false },
  });
  if (!member) throw ApiError.forbidden("You are not a member of this room.");
}

export async function getMessageWithRelations(messageId: string) {
  return ChatMessage.findByPk(messageId, { include: messageInclude });
}

interface SendMessageInput {
  type?: MessageType;
  content?: string;
  replyToId?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

export async function createMessage(roomId: string, senderId: string, input: SendMessageInput) {
  await assertMember(roomId, senderId);

  if (!input.content?.trim() && !input.fileUrl) {
    throw ApiError.badRequest("Message cannot be empty.");
  }
  if (input.replyToId) {
    const parent = await ChatMessage.findOne({ where: { id: input.replyToId, roomId } });
    if (!parent) throw ApiError.notFound("Message being replied to was not found.");
  }

  const message = await ChatMessage.create({
    roomId,
    senderId,
    type: input.type ?? "TEXT",
    content: input.content?.trim() || null,
    replyToId: input.replyToId ?? null,
    fileUrl: input.fileUrl ?? null,
    fileName: input.fileName ?? null,
    fileSize: input.fileSize ?? null,
  });

  return getMessageWithRelations(message.id);
}

export function fileMessageType(mimetype: string): MessageType {
  if (mimetype === "image/gif") return "GIF";
  if (mimetype.startsWith("image/")) return "IMAGE";
  if (mimetype.startsWith("video/")) return "VIDEO";
  if (mimetype.startsWith("audio/")) return "VOICE_NOTE";
  return "FILE";
}

export function chatFileUrl(filename: string): string {
  return localFileUrl("chat", filename);
}

export async function listMessages(
  roomId: string,
  userId: string,
  opts: { before?: string; limit: number; search?: string; pinnedOnly?: boolean },
) {
  await assertMember(roomId, userId);

  const where: Record<string, unknown> = { roomId };
  if (opts.before) where.createdAt = { [Op.lt]: new Date(opts.before) };
  if (opts.search) where.content = { [Op.iLike]: `%${opts.search}%` };
  if (opts.pinnedOnly) where.isPinned = true;

  const rows = await ChatMessage.findAll({
    where,
    include: messageInclude,
    order: [["createdAt", "DESC"]],
    limit: opts.limit,
  });
  return rows.reverse(); // chronological for the client
}

export async function editMessage(userId: string, messageId: string, content: string) {
  const message = await ChatMessage.findByPk(messageId);
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found.");
  if (message.senderId !== userId) throw ApiError.forbidden("You can only edit your own messages.");
  await message.update({ content: content.trim(), isEdited: true });
  return getMessageWithRelations(messageId);
}

export async function deleteMessage(userId: string, messageId: string) {
  const message = await ChatMessage.findByPk(messageId);
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found.");

  const membership = await RoomMember.findOne({
    where: { roomId: message.roomId, userId, leftAt: null },
  });
  const isHost = membership?.role === "HOST";
  if (message.senderId !== userId && !isHost) {
    throw ApiError.forbidden("You can only delete your own messages.");
  }
  await message.update({ content: null, fileUrl: null, isDeleted: true, isPinned: false });
  return message;
}

export async function togglePin(userId: string, messageId: string) {
  const message = await ChatMessage.findByPk(messageId);
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found.");
  await assertMember(message.roomId, userId);
  await message.update({ isPinned: !message.isPinned });
  return getMessageWithRelations(messageId);
}

export async function toggleReaction(userId: string, messageId: string, emoji: string) {
  const message = await ChatMessage.findByPk(messageId);
  if (!message || message.isDeleted) throw ApiError.notFound("Message not found.");
  await assertMember(message.roomId, userId);

  const existing = await MessageReaction.findOne({ where: { messageId, userId, emoji } });
  if (existing) {
    await existing.destroy();
  } else {
    await MessageReaction.create({ messageId, userId, emoji });
  }
  return getMessageWithRelations(messageId);
}
