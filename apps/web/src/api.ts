const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function signup(email: string, password: string) {
  const r = await fetch(`${API_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return r.ok;
}

export async function login(email: string, password: string) {
  const r = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d.token as string;
}

export async function me(token: string) {
  const r = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!r.ok) return null;
  return r.json();
}
