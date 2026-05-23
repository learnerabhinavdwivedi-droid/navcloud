/**
 * NavCloud Premium — Subscription/Billing Validators
 * Schemas for Stripe integration and usage-based billing.
 */

import { z } from "zod";

// ============================================================================
// Billing Account
// ============================================================================

export const BillingAccountSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  plan: z.enum(["free", "pro", "enterprise"]),
  storageBytesUsed: z.number().int().nonnegative(),
  storageBytesLimit: z.number().int().nonnegative(),
  aiCreditsUsed: z.number().int().nonnegative(),
  aiCreditsLimit: z.number().int(),
  subscriptionStatus: z.enum(["inactive", "active", "past_due", "canceled", "trialing"]),
  billingCycleStart: z.string().nullable(),
  billingCycleEnd: z.string().nullable(),
});
export type BillingAccount = z.infer<typeof BillingAccountSchema>;

// ============================================================================
// Usage Events
// ============================================================================

export const UsageEventTypeSchema = z.enum([
  "storage_upload",
  "storage_delete",
  "ai_tag",
  "ai_search",
  "ai_summary",
  "ai_embed",
  "preview_generate",
]);
export type UsageEventType = z.infer<typeof UsageEventTypeSchema>;

export const UsageUnitSchema = z.enum(["bytes", "credits", "queries", "operations"]);
export type UsageUnit = z.infer<typeof UsageUnitSchema>;

export const RecordUsageEventSchema = z.object({
  userId: z.string().min(1),
  eventType: UsageEventTypeSchema,
  quantity: z.number().int().positive(),
  unit: UsageUnitSchema,
  metadata: z.record(z.unknown()).optional(),
});
export type RecordUsageEvent = z.infer<typeof RecordUsageEventSchema>;

// ============================================================================
// Billing Dashboard Response
// ============================================================================

export const BillingDashboardSchema = z.object({
  plan: z.enum(["free", "pro", "enterprise"]),
  storageBytesUsed: z.number().int().nonnegative(),
  storageBytesLimit: z.number().int().nonnegative(),
  aiCreditsUsed: z.number().int().nonnegative(),
  aiCreditsLimit: z.number().int(),
  subscriptionStatus: z.enum(["inactive", "active", "past_due", "canceled", "trialing"]),
  storageUsagePercent: z.number().nonnegative(),
  aiUsagePercent: z.number().nonnegative(),
  recentEvents: z.array(
    z.object({
      eventType: UsageEventTypeSchema,
      quantity: z.number(),
      unit: UsageUnitSchema,
      createdAt: z.string(),
    })
  ).optional(),
});
export type BillingDashboard = z.infer<typeof BillingDashboardSchema>;

// ============================================================================
// Stripe Webhook Event
// ============================================================================

export const StripeWebhookPayloadSchema = z.object({
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.unknown()),
  }),
});
export type StripeWebhookPayload = z.infer<typeof StripeWebhookPayloadSchema>;

// ============================================================================
// Plan Upgrade Request
// ============================================================================

export const PlanUpgradeRequestSchema = z.object({
  plan: z.enum(["pro", "enterprise"]),
  paymentMethodId: z.string().min(1).optional(),
});
export type PlanUpgradeRequest = z.infer<typeof PlanUpgradeRequestSchema>;
