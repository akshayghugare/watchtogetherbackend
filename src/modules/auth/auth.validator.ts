import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number');

const email = z.string().trim().toLowerCase().email('Invalid email address');

const username = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be at most 30 characters')
  .regex(/^[a-zA-Z0-9_.]+$/, 'Username may only contain letters, numbers, "_" and "."');

export const registerSchema = z.object({
  body: z.object({
    username,
    email,
    password,
    displayName: z.string().trim().min(1).max(60).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1, 'Password is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email }),
});

export const resetPasswordSchema = z.object({
  params: z.object({ token: z.string().min(32) }),
  body: z.object({ password }),
});

export const verifyEmailSchema = z.object({
  params: z.object({ token: z.string().min(32) }),
});

export const resendVerificationSchema = z.object({
  body: z.object({ email }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: password,
    })
    .refine((v) => v.currentPassword !== v.newPassword, {
      message: 'New password must be different from the current password',
      path: ['newPassword'],
    }),
});
