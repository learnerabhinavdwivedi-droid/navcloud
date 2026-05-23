/**
 * NavCloud Premium — Auth Feature Types
 * Zod schemas for frontend auth validation.
 */

import { z } from "zod";

export const LoginFormSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginForm = z.infer<typeof LoginFormSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["Admin", "Instructor", "Student"]),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal("Bearer"),
  user: AuthUserSchema,
  subscription: z.object({ plan: z.enum(["free", "pro", "enterprise"]) }),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
