/**
 * NavCloud Premium — NavButton Component
 * Premium button with gradient fills, glow effects, and micro-animations.
 */

import React, { CSSProperties, ReactNode } from "react";

type NavButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type NavButtonSize = "sm" | "md" | "lg";

type NavButtonProps = {
  children: ReactNode;
  variant?: NavButtonVariant;
  size?: NavButtonSize;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  id?: string;
  type?: "button" | "submit" | "reset";
};

const sizeStyles: Record<NavButtonSize, CSSProperties> = {
  sm: { padding: "0.4rem 0.9rem", fontSize: "0.8125rem", gap: "0.35rem" },
  md: { padding: "0.625rem 1.25rem", fontSize: "0.875rem", gap: "0.5rem" },
  lg: { padding: "0.875rem 1.75rem", fontSize: "1rem", gap: "0.6rem" },
};

const variants: Record<NavButtonVariant, { base: CSSProperties; hover: CSSProperties }> = {
  primary: {
    base: {
      background: "linear-gradient(135deg, hsl(220, 75%, 55%), hsl(240, 70%, 50%))",
      color: "#fff",
      border: "1px solid hsla(220, 80%, 60%, 0.3)",
      boxShadow: "0 2px 12px hsla(220, 80%, 50%, 0.3)",
    },
    hover: { boxShadow: "0 4px 20px hsla(220, 80%, 50%, 0.45)", transform: "translateY(-1px)" },
  },
  secondary: {
    base: {
      background: "hsla(222, 25%, 14%, 0.8)",
      color: "hsl(220, 20%, 90%)",
      border: "1px solid hsla(220, 40%, 30%, 0.3)",
    },
    hover: { background: "hsla(222, 25%, 18%, 0.9)", border: "1px solid hsla(185, 60%, 50%, 0.2)" },
  },
  ghost: {
    base: { background: "transparent", color: "hsl(220, 15%, 65%)", border: "1px solid transparent" },
    hover: { background: "hsla(220, 25%, 15%, 0.5)", color: "hsl(220, 20%, 90%)" },
  },
  danger: {
    base: {
      background: "linear-gradient(135deg, hsl(0, 70%, 45%), hsl(350, 75%, 40%))",
      color: "#fff",
      border: "1px solid hsla(0, 80%, 50%, 0.3)",
    },
    hover: { boxShadow: "0 4px 20px hsla(0, 80%, 45%, 0.4)", transform: "translateY(-1px)" },
  },
  accent: {
    base: {
      background: "linear-gradient(135deg, hsl(185, 80%, 45%), hsl(200, 85%, 50%))",
      color: "hsl(220, 30%, 8%)",
      border: "1px solid hsla(185, 90%, 55%, 0.3)",
      fontWeight: 600,
    },
    hover: { boxShadow: "0 4px 24px hsla(185, 90%, 55%, 0.5)", transform: "translateY(-1px)" },
  },
};

export function NavButton({
  children, variant = "primary", size = "md", onClick,
  disabled = false, loading = false, icon, fullWidth = false, id, type = "button",
}: NavButtonProps) {
  const [hovered, setHovered] = React.useState(false);
  const v = variants[variant];

  const style: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Inter', sans-serif", fontWeight: 500, lineHeight: 1,
    borderRadius: "10px", cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1, transition: "all 200ms ease",
    userSelect: "none", whiteSpace: "nowrap",
    width: fullWidth ? "100%" : undefined,
    ...sizeStyles[size], ...v.base,
    ...(hovered && !disabled ? v.hover : {}),
  };

  return (
    <button id={id} type={type} style={style} onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      disabled={disabled || loading} aria-busy={loading}>
      {loading ? <Spinner /> : icon ? <span style={{ display: "flex" }}>{icon}</span> : null}
      {children}
      <style>{`@keyframes nc-spin{to{transform:rotate(360deg)}}`}</style>
    </button>
  );
}

function Spinner() {
  return (
    <span style={{
      width: "1em", height: "1em", border: "2px solid currentColor",
      borderTopColor: "transparent", borderRadius: "50%",
      animation: "nc-spin 0.6s linear infinite",
    }} />
  );
}
