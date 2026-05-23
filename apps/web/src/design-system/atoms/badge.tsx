/**
 * NavCloud Premium — Badge Atom
 * Small labeled pills for tags, status indicators, and plan badges.
 */

import React, { CSSProperties, ReactNode } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "info";

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  glow?: boolean;
};

const colorMap: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  default: { bg: "hsla(220, 25%, 18%, 0.8)", text: "hsl(220, 15%, 70%)", border: "hsla(220, 30%, 30%, 0.3)" },
  accent:  { bg: "hsla(185, 90%, 55%, 0.12)", text: "hsl(185, 90%, 55%)", border: "hsla(185, 90%, 55%, 0.25)" },
  success: { bg: "hsla(155, 75%, 50%, 0.12)", text: "hsl(155, 75%, 55%)", border: "hsla(155, 75%, 50%, 0.25)" },
  warning: { bg: "hsla(40, 95%, 60%, 0.12)", text: "hsl(40, 95%, 60%)", border: "hsla(40, 95%, 60%, 0.25)" },
  danger:  { bg: "hsla(0, 80%, 60%, 0.12)", text: "hsl(0, 80%, 65%)", border: "hsla(0, 80%, 60%, 0.25)" },
  info:    { bg: "hsla(205, 85%, 60%, 0.12)", text: "hsl(205, 85%, 65%)", border: "hsla(205, 85%, 60%, 0.25)" },
};

export function Badge({ children, variant = "default", size = "sm", glow = false }: BadgeProps) {
  const colors = colorMap[variant];
  const style: CSSProperties = {
    display: "inline-flex", alignItems: "center",
    padding: size === "sm" ? "0.15rem 0.5rem" : "0.25rem 0.625rem",
    fontSize: size === "sm" ? "0.6875rem" : "0.75rem",
    fontWeight: 500, fontFamily: "'Inter', sans-serif",
    borderRadius: "100px", lineHeight: 1.4,
    background: colors.bg, color: colors.text,
    border: `1px solid ${colors.border}`,
    boxShadow: glow ? `0 0 12px ${colors.border}` : "none",
    whiteSpace: "nowrap",
  };

  return <span style={style}>{children}</span>;
}
