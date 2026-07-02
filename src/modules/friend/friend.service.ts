import { Op } from "sequelize";
import sequelize from "../../config/db";
import User from "../user/model/user.model";
import FriendRequest from "./model/friend-request.model";
import Friendship from "./model/friendship.model";
import { ApiError } from "../../utils/ApiError";
import { notifyUser } from "../notification/notification.service";

const PUBLIC_USER_ATTRS = [
  "id",
  "username",
  "displayName",
  "avatarUrl",
  "bio",
  "isOnline",
  "lastSeenAt",
] as const;

function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function areFriends(userId: string, otherId: string): Promise<boolean> {
  const [userAId, userBId] = orderPair(userId, otherId);
  const row = await Friendship.findOne({ where: { userAId, userBId } });
  return Boolean(row);
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await Friendship.findAll({
    where: { [Op.or]: [{ userAId: userId }, { userBId: userId }] },
    attributes: ["userAId", "userBId"],
  });
  return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
}

export async function listFriends(userId: string) {
  const ids = await getFriendIds(userId);
  if (ids.length === 0) return [];
  return User.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: [...PUBLIC_USER_ATTRS],
    order: [
      ["isOnline", "DESC"],
      ["username", "ASC"],
    ],
  });
}

/** Search users by username/display name, annotated with relationship status. */
export async function searchUsers(userId: string, query: string) {
  const users = await User.findAll({
    where: {
      id: { [Op.ne]: userId },
      isBanned: false,
      [Op.or]: [
        { username: { [Op.iLike]: `%${query}%` } },
        { displayName: { [Op.iLike]: `%${query}%` } },
      ],
    },
    attributes: [...PUBLIC_USER_ATTRS],
    limit: 20,
  });
  if (users.length === 0) return [];

  const ids = users.map((u) => u.id);
  const [friendIds, pending] = await Promise.all([
    getFriendIds(userId),
    FriendRequest.findAll({
      where: {
        status: "PENDING",
        [Op.or]: [
          { senderId: userId, receiverId: { [Op.in]: ids } },
          { receiverId: userId, senderId: { [Op.in]: ids } },
        ],
      },
    }),
  ]);

  const friendSet = new Set(friendIds);
  return users.map((u) => {
    const req = pending.find((p) => p.senderId === u.id || p.receiverId === u.id);
    let relation: "NONE" | "FRIENDS" | "REQUEST_SENT" | "REQUEST_RECEIVED" = "NONE";
    if (friendSet.has(u.id)) relation = "FRIENDS";
    else if (req) relation = req.senderId === userId ? "REQUEST_SENT" : "REQUEST_RECEIVED";
    return { ...u.toJSON(), relation, requestId: req?.id ?? null };
  });
}

export async function sendRequest(senderId: string, receiverId: string) {
  if (senderId === receiverId) throw ApiError.badRequest("You cannot add yourself.");

  const receiver = await User.findByPk(receiverId);
  if (!receiver || receiver.isBanned) throw ApiError.notFound("User not found.");
  if (await areFriends(senderId, receiverId)) {
    throw ApiError.conflict("You are already friends.");
  }

  const existing = await FriendRequest.findOne({
    where: {
      status: "PENDING",
      [Op.or]: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    },
  });
  if (existing) {
    throw ApiError.conflict(
      existing.senderId === senderId
        ? "Friend request already sent."
        : "This user has already sent you a request — accept it instead.",
    );
  }

  // Reuse a previously rejected/cancelled row to respect the unique index.
  const [request] = await FriendRequest.upsert(
    { senderId, receiverId, status: "PENDING" },
    { conflictFields: ["sender_id", "receiver_id"] as never },
  );

  const sender = await User.findByPk(senderId);
  await notifyUser(receiverId, {
    actorId: senderId,
    type: "FRIEND_REQUEST",
    title: `${sender?.displayName ?? sender?.username} sent you a friend request`,
    data: { requestId: request.id },
  });

  return request;
}

export async function respondToRequest(
  userId: string,
  requestId: string,
  action: "accept" | "reject",
) {
  const request = await FriendRequest.findByPk(requestId, {
    include: [{ model: User, as: "sender", attributes: [...PUBLIC_USER_ATTRS] }],
  });
  if (!request || request.status !== "PENDING") throw ApiError.notFound("Request not found.");
  if (request.receiverId !== userId) throw ApiError.forbidden("This request is not for you.");

  if (action === "reject") {
    await request.update({ status: "REJECTED" });
    return null;
  }

  const [userAId, userBId] = orderPair(request.senderId, request.receiverId);
  await sequelize.transaction(async (t) => {
    await request.update({ status: "ACCEPTED" }, { transaction: t });
    await Friendship.findOrCreate({ where: { userAId, userBId }, transaction: t });
  });

  const receiver = await User.findByPk(userId);
  await notifyUser(request.senderId, {
    actorId: userId,
    type: "FRIEND_ACCEPTED",
    title: `${receiver?.displayName ?? receiver?.username} accepted your friend request`,
    data: {},
  });

  return request.sender;
}

export async function cancelRequest(userId: string, requestId: string) {
  const request = await FriendRequest.findByPk(requestId);
  if (!request || request.status !== "PENDING") throw ApiError.notFound("Request not found.");
  if (request.senderId !== userId) throw ApiError.forbidden("You did not send this request.");
  await request.update({ status: "CANCELLED" });
}

export async function listRequests(userId: string) {
  const [incoming, outgoing] = await Promise.all([
    FriendRequest.findAll({
      where: { receiverId: userId, status: "PENDING" },
      include: [{ model: User, as: "sender", attributes: [...PUBLIC_USER_ATTRS] }],
      order: [["createdAt", "DESC"]],
    }),
    FriendRequest.findAll({
      where: { senderId: userId, status: "PENDING" },
      include: [{ model: User, as: "receiver", attributes: [...PUBLIC_USER_ATTRS] }],
      order: [["createdAt", "DESC"]],
    }),
  ]);
  return { incoming, outgoing };
}

export async function removeFriend(userId: string, friendId: string) {
  const [userAId, userBId] = orderPair(userId, friendId);
  const deleted = await Friendship.destroy({ where: { userAId, userBId } });
  if (!deleted) throw ApiError.notFound("You are not friends with this user.");
  // Allow future re-requests despite the unique (sender, receiver) index.
  await FriendRequest.destroy({
    where: {
      [Op.or]: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId },
      ],
    },
  });
}
