/**
 * NavCloud Premium — NeuralLoader Component
 * An AI-themed loading animation that pulses with neural network aesthetics.
 * Used during AI processing (tagging, embedding, search).
 */

import React, { CSSProperties } from "react";

type NeuralLoaderProps = {
  size?: "sm" | "md" | "lg";
  label?: string;
  variant?: "pulse" | "orbit" | "wave";
};

const sizeMap = {
  sm: { container: 32, dot: 4, fontSize: "0.75rem" },
  md: { container: 48, dot: 6, fontSize: "0.875rem" },
  lg: { container: 72, dot: 8, fontSize: "1rem" },
};

export function NeuralLoader({ size = "md", label, variant = "pulse" }: NeuralLoaderProps) {
  const dims = sizeMap[size];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
      }}
      role="status"
      aria-label={label ?? "Loading"}
    >
      <div
        style={{
          width: dims.container,
          height: dims.container,
          position: "relative",
        }}
      >
        {variant === "pulse" && <PulseVariant size={dims.container} dotSize={dims.dot} />}
        {variant === "orbit" && <OrbitVariant size={dims.container} dotSize={dims.dot} />}
        {variant === "wave" && <WaveVariant dotSize={dims.dot} />}
      </div>
      {label && (
        <span
          style={{
            fontSize: dims.fontSize,
            color: "hsl(220, 15%, 65%)",
            fontFamily: "var(--nc-font-body, 'Inter', sans-serif)",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </span>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes nc-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes nc-orbit {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes nc-wave-dot {
          0%, 80%, 100% { transform: scaleY(0.4); opacity: 0.3; }
          40% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes nc-glow-pulse {
          0%, 100% { box-shadow: 0 0 8px hsla(185, 90%, 55%, 0.3); }
          50% { box-shadow: 0 0 20px hsla(185, 90%, 55%, 0.6); }
        }
      `}</style>
    </div>
  );
}

function PulseVariant({ size, dotSize }: { size: number; dotSize: number }) {
  const center = size / 2;
  const ringStyle = (delay: number, scale: number): CSSProperties => ({
    position: "absolute",
    top: center - dotSize * scale,
    left: center - dotSize * scale,
    width: dotSize * scale * 2,
    height: dotSize * scale * 2,
    borderRadius: "50%",
    border: "1.5px solid hsl(185, 90%, 55%)",
    animation: `nc-pulse 2s ease-in-out ${delay}s infinite`,
    opacity: 0.6,
  });

  return (
    <>
      <div style={ringStyle(0, 1)} />
      <div style={ringStyle(0.4, 1.8)} />
      <div style={ringStyle(0.8, 2.6)} />
      {/* Center dot */}
      <div
        style={{
          position: "absolute",
          top: center - dotSize / 2,
          left: center - dotSize / 2,
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          background: "hsl(185, 90%, 55%)",
          animation: "nc-glow-pulse 2s ease-in-out infinite",
        }}
      />
    </>
  );
}

function OrbitVariant({ size, dotSize }: { size: number; dotSize: number }) {
  const orbitRadius = size / 2 - dotSize;

  return (
    <div
      style={{
        width: size,
        height: size,
        position: "relative",
        animation: "nc-orbit 3s linear infinite",
      }}
    >
      {[0, 120, 240].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const x = size / 2 + orbitRadius * Math.cos(rad) - dotSize / 2;
        const y = size / 2 + orbitRadius * Math.sin(rad) - dotSize / 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: y,
              left: x,
              width: dotSize,
              height: dotSize,
              borderRadius: "50%",
              background: `hsl(${185 + i * 20}, 85%, ${55 + i * 5}%)`,
              boxShadow: `0 0 12px hsla(${185 + i * 20}, 85%, 55%, 0.5)`,
            }}
          />
        );
      })}
    </div>
  );
}

function WaveVariant({ dotSize }: { dotSize: number }) {
  return (
    <div style={{ display: "flex", gap: dotSize * 0.8, alignItems: "center", height: dotSize * 4 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            width: dotSize,
            height: dotSize * 3,
            borderRadius: dotSize,
            background: `linear-gradient(180deg, hsl(185, 90%, 55%), hsl(220, 75%, 55%))`,
            animation: `nc-wave-dot 1.2s ease-in-out ${i * 0.1}s infinite`,
            transformOrigin: "center",
          }}
        />
      ))}
    </div>
  );
}
