/**
 * NavCloud Premium — Auth Validators
 * Centralized Zod schemas for all auth-related request/response validation.
 * Replaces all inline z.object() calls and eliminates `any` types.
 */

import { z } from "zod";

// ============================================================================
// Shared Primitives
// ============================================================================

export const RoleSchema = z.enum(["Admin", "Instructor", "Student"]);
export type Role = z.infer<typeof RoleSchema>;

export const SubscriptionPlanSchema = z.enum(["free", "pro", "enterprise"]);
export type SubscriptionPlan = z.infer<typeof SubscriptionPlanSchema>;

export const UUIDSchema = z.string().uuid();
export const EmailSchema = z.string().email().transform((v) => v.toLowerCase());
export const NonEmptyString = z.string().min(1);

// ============================================================================
// JWT Token Payloads
// ============================================================================

export const AccessTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  role: RoleSchema,
  tokenVersion: z.number().int().positive(),
  type: z.literal("access"),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().optional(),
  iat: z.number().optional(),
});
export type AccessTokenPayload = z.infer<typeof AccessTokenPayloadSchema>;

export const RefreshTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  sid: z.string().min(1),
  tokenVersion: z.number().int().positive(),
  type: z.literal("refresh"),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  exp: z.number().optional(),
  iat: z.number().optional(),
});
export type RefreshTokenPayload = z.infer<typeof RefreshTokenPayloadSchema>;

// ============================================================================
// User Model
// ============================================================================

export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  tokenVersion: z.number().int().positive(),
});
export type User = z.infer<typeof UserSchema>;

export const UserPublicSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleSchema,
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

// ============================================================================
// Auth Request Schemas
// ============================================================================

export const GoogleCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
export type GoogleCallbackQuery = z.infer<typeof GoogleCallbackQuerySchema>;

export const RefreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;

export const LogoutRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutRequest = z.infer<typeof LogoutRequestSchema>;

// ============================================================================
// Auth Response Schemas
// ============================================================================

export const AuthResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
  user: UserPublicSchema,
  subscription: z.object({
    plan: SubscriptionPlanSchema,
  }),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const MeResponseSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleSchema,
  subscription: z.object({
    plan: SubscriptionPlanSchema,
  }),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

// ============================================================================
// Subscription Schemas
// ============================================================================

export const SubscriptionRecordSchema = z.object({
  userId: z.string().min(1),
  plan: SubscriptionPlanSchema,
  updatedAt: z.string(),
});
export type SubscriptionRecord = z.infer<typeof SubscriptionRecordSchema>;

export const UpdatePlanRequestSchema = z.object({
  userId: z.string().min(1),
  plan: SubscriptionPlanSchema,
});
export type UpdatePlanRequest = z.infer<typeof UpdatePlanRequestSchema>;

export const PlanLimitsSchema = z.object({
  maxCreatedCourses: z.number().int().nonnegative(),
  maxActiveEnrollments: z.number().int().nonnegative(),
  maxOwnedStorageBytes: z.number().int().nonnegative(),
});
export type PlanLimits = z.infer<typeof PlanLimitsSchema>;

export const SubscriptionStatusSchema = z.object({
  plan: SubscriptionPlanSchema,
  limits: PlanLimitsSchema,
  usage: z.object({
    createdCourses: z.number().int().nonnegative(),
    activeEnrollments: z.number().int().nonnegative(),
    ownedStorageBytes: z.number().int().nonnegative(),
  }),
  softLimit: z.object({
    createdCoursesExceededBy: z.number().int().nonnegative(),
    activeEnrollmentsExceededBy: z.number().int().nonnegative(),
    ownedStorageBytesExceededBy: z.number().int().nonnegative(),
  }),
});
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

// ============================================================================
// Refresh Session
// ============================================================================

export const RefreshSessionSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  tokenHash: z.string().min(1),
  expiresAt: z.date(),
  revokedAt: z.date().nullable(),
});
export type RefreshSession = z.infer<typeof RefreshSessionSchema>;

// ============================================================================
// Authenticated Request Context
// ============================================================================

export const AuthContextSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  role: RoleSchema,
  tokenVersion: z.number().int().positive(),
  type: z.literal("access"),
});
export type AuthContext = z.infer<typeof AuthContextSchema>;
