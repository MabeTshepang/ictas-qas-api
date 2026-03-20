import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).regex(/[A-Z]/, "Must contain an uppercase letter"),
});
export const createUserSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email(),
  password: z.string().min(8).optional(), 
  role: z.enum(['ADMIN', 'USER', 'MODERATOR']),
  tenantId: z.string().min(1).optional(), 
});
