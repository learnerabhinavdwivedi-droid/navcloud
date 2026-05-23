/**
 * NavCloud Premium — Input Atom
 * Glassmorphism-styled input with focus glow and label animation.
 */

import React, { CSSProperties } from "react";

type InputProps = {
  id: string;
  label?: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
};

export function Input({
  id, label, placeholder, type = "text", value, onChange, error, disabled, icon,
}: InputProps) {
  const [focused, setFocused] = React.useState(false);

  const containerStyle: CSSProperties = {
    display: "flex", flexDirection: "column", gap: "0.375rem", width: "100%",
  };

  const inputWrapStyle: CSSProperties = {
    display: "flex", alignItems: "center", gap: "0.5rem",
    background: "hsla(222, 25%, 10%, 0.8)",
    border: `1px solid ${error ? "hsl(0, 80%, 60%)" : focused ? "hsla(185, 90%, 55%, 0.5)" : "hsla(220, 40%, 30%, 0.2)"}`,
    borderRadius: "10px", padding: "0.625rem 0.875rem",
    transition: "all 200ms ease",
    boxShadow: focused ? "0 0 16px hsla(185, 90%, 55%, 0.15)" : "none",
  };

  const inputStyle: CSSProperties = {
    flex: 1, background: "transparent", border: "none", outline: "none",
    color: "hsl(220, 20%, 95%)", fontSize: "0.875rem",
    fontFamily: "'Inter', sans-serif",
  };

  const labelStyle: CSSProperties = {
    fontSize: "0.8125rem", fontWeight: 500, color: "hsl(220, 15%, 65%)",
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div style={containerStyle}>
      {label && <label htmlFor={id} style={labelStyle}>{label}</label>}
      <div style={inputWrapStyle}>
        {icon && <span style={{ color: "hsl(220, 15%, 45%)", display: "flex" }}>{icon}</span>}
        <input
          id={id} type={type} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)} disabled={disabled}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={inputStyle}
        />
      </div>
      {error && <span style={{ fontSize: "0.75rem", color: "hsl(0, 80%, 60%)" }}>{error}</span>}
    </div>
  );
}
