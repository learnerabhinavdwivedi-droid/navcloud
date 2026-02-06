import React, { useState } from "react";
import { login, me, signup } from "./api";

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSignup() {
    setError(null);
    const ok = await signup(email, password);
    if (!ok) setError("signup_failed");
  }
  async function onLogin() {
    setError(null);
    const t = await login(email, password);
    if (!t) setError("login_failed");
    else setToken(t);
  }
  async function onMe() {
    setError(null);
    if (!token) return;
    const p = await me(token);
    setProfile(p);
  }
  return (
    <div style={{ maxWidth: 360, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>NavCloud</h1>
      <input placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={onSignup}>Sign up</button>
        <button onClick={onLogin}>Login</button>
        <button onClick={onMe} disabled={!token}>Me</button>
      </div>
      {error && <div>{error}</div>}
      {token && <div>token set</div>}
      {profile && <pre>{JSON.stringify(profile, null, 2)}</pre>}
    </div>
  );
}
