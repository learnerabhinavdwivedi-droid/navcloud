/**
 * NavCloud Premium — GlassCard Component
 * A glassmorphism container with frosted glass effect, gradient borders,
 * and subtle hover micro-animations.
 */

import React, { CSSProperties, ReactNode } from "react";

export type GlassCardVariant = "default" | "elevated" | "interactive" | "accent";

type GlassCardProps = {
  children: ReactNode;
  variant?: GlassCardVariant;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  glow?: boolean;
  id?: string;
};

const variantStyles: Record<GlassCardVariant, CSSProperties> = {
  default: {
    background: "hsla(222, 30%, 10%, 0.65)",
    border: "1px solid hsla(220, 40%, 30%, 0.2)",
  },
  elevated: {
    background: "hsla(222, 30%, 12%, 0.75)",
    border: "1px solid hsla(220, 40%, 35%, 0.25)",
    boxShadow: "0 8px 32px hsla(0, 0%, 0%, 0.35)",
  },
  interactive: {
    background: "hsla(222, 30%, 10%, 0.65)",
    border: "1px solid hsla(220, 40%, 30%, 0.2)",
    cursor: "pointer",
  },
  accent: {
    background: "hsla(185, 30%, 12%, 0.6)",
    border: "1px solid hsla(185, 60%, 50%, 0.2)",
  },
};

const baseStyle: CSSProperties = {
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  borderRadius: "14px",
  padding: "1.5rem",
  position: "relative",
  overflow: "hidden",
  transition: "all 250ms cubic-bezier(0.4, 0, 0.2, 1)",
};

const shineOverlay: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(135deg, hsla(0, 0%, 100%, 0.06) 0%, hsla(0, 0%, 100%, 0.01) 50%, transparent 100%)",
  pointerEvents: "none",
  borderRadius: "inherit",
};

export function GlassCard({
  children,
  variant = "default",
  className,
  style,
  onClick,
  glow = false,
  id,
}: GlassCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const combinedStyle: CSSProperties = {
    ...baseStyle,
    ...variantStyles[variant],
    ...(glow
      ? { boxShadow: "0 0 40px hsla(185, 90%, 55%, 0.15)" }
      : {}),
    ...(isHovered && variant === "interactive"
      ? {
          border: "1px solid hsla(185, 60%, 50%, 0.3)",
          transform: "translateY(-2px)",
          boxShadow: "0 12px 40px hsla(0, 0%, 0%, 0.4)",
        }
      : {}),
    ...style,
  };

  return (
    <div
      id={id}
      className={className}
      style={combinedStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div style={shineOverlay} aria-hidden="true" />
      {children}
    </div>
  );
}
