/**
 * NavCloud Premium — Auth Actions
 * Type-safe API calls for authentication.
 */

import { AuthTokensSchema, type AuthTokens, type AuthUser } from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function loginWithGoogle(): Promise<{ authUrl: string }> {
  const r = await fetch(`${API_URL}/auth/google/start`);
  if (!r.ok) throw new Error("google_auth_start_failed");
  return r.json();
}

export async function handleGoogleCallback(code: string, state: string): Promise<AuthTokens> {
  const r = await fetch(`${API_URL}/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  if (!r.ok) throw new Error("google_callback_failed");
  const data = await r.json();
  return AuthTokensSchema.parse(data);
}

export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  const r = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!r.ok) throw new Error("refresh_failed");
  const data = await r.json();
  return AuthTokensSchema.parse(data);
}

export async function getMe(token: string): Promise<AuthUser> {
  const r = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("me_failed");
  return r.json();
}

export async function logout(refreshToken: string): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
}
