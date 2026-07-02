import { z } from "zod";

export const createMovieSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(1000).optional().or(z.literal("")),
    url: z.string().trim().url("Invalid stream URL").optional().or(z.literal("")),
  }),
});

export const movieIdSchema = z.object({
  params: z.object({ movieId: z.string().uuid() }),
});
