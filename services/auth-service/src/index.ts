import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { z } from "zod";
import bcrypt from "bcryptjs";

const app = express();
app.use(cors());
app.use(express.json());

const users = new Map<string, { email: string; passwordHash: string; role: string; tenant: string }>();

const envSchema = z.object({
  PORT: z.string().default("4000"),
  JWT_SECRET: z.string()
});
const env = envSchema.parse({
  PORT: process.env.PORT,
  JWT_SECRET: process.env.JWT_SECRET
});

function signToken(payload: object) {
  return jwt.sign(payload as any, env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}

function authMiddleware(req: any, res: any, next: any) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}

app.post("/signup", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.string().default("student"),
    tenant: z.string().default("default")
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const { email, password, role, tenant } = parsed.data;
  if (users.has(email)) return res.status(409).json({ error: "exists" });
  const passwordHash = await bcrypt.hash(password, 10);
  users.set(email, { email, passwordHash, role, tenant });
  res.json({ ok: true });
});

app.post("/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const { email, password } = parsed.data;
  const user = users.get(email);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "invalid_credentials" });
  const token = signToken({ email: user.email, role: user.role, tenant: user.tenant });
  res.json({ token });
});

app.get("/me", authMiddleware, (req, res) => {
  const email = (req as any).user.email;
  const user = users.get(email);
  if (!user) return res.status(404).json({ error: "not_found" });
  res.json({ email: user.email, role: user.role, tenant: user.tenant });
});

app.listen(Number(env.PORT), () => {});
