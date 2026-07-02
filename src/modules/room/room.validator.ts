import { z } from "zod";

export const createRoomSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Room name is required").max(100),
    movieId: z.string().uuid().optional(),
    privacy: z.enum(["PUBLIC", "PRIVATE"]).optional(),
    password: z.string().min(4).max(64).optional().or(z.literal("")),
    maxMembers: z.coerce.number().int().min(2).max(100).optional(),
  }),
});

export const joinRoomSchema = z.object({
  body: z.object({
    roomIdOrCode: z.string().trim().min(4),
    password: z.string().optional(),
  }),
});

export const roomIdSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
});

export const kickSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({ userId: z.string().uuid() }),
});

export const transferHostSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({ newHostId: z.string().uuid() }),
});

export const changeMovieSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({ movieId: z.string().uuid() }),
});

export const inviteSchema = z.object({
  params: z.object({ roomId: z.string().uuid() }),
  body: z.object({ friendId: z.string().uuid() }),
});
