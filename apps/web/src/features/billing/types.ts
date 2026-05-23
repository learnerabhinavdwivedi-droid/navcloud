/**
 * NavCloud Premium — Billing Feature Types
 */

import { z } from "zod";

export const PlanSchema = z.enum(["free", "pro", "enterprise"]);
export type Plan = z.infer<typeof PlanSchema>;

export const BillingDashboardSchema = z.object({
  plan: PlanSchema,
  storageBytesUsed: z.number(),
  storageBytesLimit: z.number(),
  aiCreditsUsed: z.number(),
  aiCreditsLimit: z.number(),
  subscriptionStatus: z.enum(["inactive", "active", "past_due", "canceled", "trialing"]),
  storageUsagePercent: z.number(),
  aiUsagePercent: z.number(),
});
export type BillingDashboard = z.infer<typeof BillingDashboardSchema>;

export const PlanFeatureSchema = z.object({
  name: z.string(),
  free: z.union([z.boolean(), z.string()]),
  pro: z.union([z.boolean(), z.string()]),
  enterprise: z.union([z.boolean(), z.string()]),
});
export type PlanFeature = z.infer<typeof PlanFeatureSchema>;
