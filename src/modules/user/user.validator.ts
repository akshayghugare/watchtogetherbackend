import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z
    .object({
      displayName: z.string().trim().min(1).max(60).optional(),
      bio: z.string().trim().max(300).optional().or(z.literal('')),
      username: z
        .string()
        .trim()
        .min(3)
        .max(30)
        .regex(/^[a-zA-Z0-9_.]+$/, 'Username may only contain letters, numbers, "_" and "."')
        .optional(),
    })
    .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' }),
});
