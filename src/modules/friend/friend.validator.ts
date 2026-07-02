import { z } from "zod";

export const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().trim().min(1, "Search query is required").max(50),
  }),
});

export const sendRequestSchema = z.object({
  body: z.object({ receiverId: z.string().uuid() }),
});

export const requestIdSchema = z.object({
  params: z.object({ requestId: z.string().uuid() }),
});

export const friendIdSchema = z.object({
  params: z.object({ friendId: z.string().uuid() }),
});
