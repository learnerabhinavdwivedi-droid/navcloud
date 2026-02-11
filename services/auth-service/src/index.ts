import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { z } from "zod";
import { LmsCoreStore, LmsModelError } from "./lms/models.js";
import { buildSignedLessonContentUrl, verifySignedLessonContentUrl } from "./lms/contentDelivery.js";

export type Role = "Admin" | "Instructor" | "Student";

type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
  tokenVersion: number;
};

type SubscriptionPlan = "free" | "pro" | "enterprise";
type PlanLimits = {
  maxCreatedCourses: number;
  maxActiveEnrollments: number;
  maxOwnedStorageBytes: number;
};

type SubscriptionRecord = {
  userId: string;
  plan: SubscriptionPlan;
  updatedAt: string;
};

type RefreshSession = {
  sessionId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

type GoogleProfile = { email: string; name: string };
type GoogleClient = {
  getAuthorizationUrl: (state: string) => string;
  exchangeCodeForProfile: (code: string) => Promise<GoogleProfile>;
};

type AuthDeps = {
  now: () => Date;
  randomId: () => string;
  google: GoogleClient;
};

const envSchema = z.object({
  PORT: z.string().default("4000"),
  APP_BASE_URL: z.string().url().default("http://localhost:4000"),
  CLIENT_REDIRECT_URL: z.string().url().default("http://localhost:5173"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default("navcloud-auth"),
  JWT_AUDIENCE: z.string().default("navcloud"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().url(),
  GOOGLE_ADMIN_EMAILS: z.string().default(""),
  GOOGLE_INSTRUCTOR_EMAILS: z.string().default(""),
  DELIVERY_BASE_URL: z.string().url().default("https://files.navcloud.example/content"),
  DELIVERY_SIGNING_SECRET: z.string().min(32),
  DELIVERY_URL_TTL_SECONDS: z.coerce.number().int().positive().max(300).default(120)
});

export type Env = z.infer<typeof envSchema>;

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function parseEmailList(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
}

function roleForEmail(email: string, adminEmails: Set<string>, instructorEmails: Set<string>): Role {
  const normalized = email.toLowerCase();
  if (adminEmails.has(normalized)) return "Admin";
  if (instructorEmails.has(normalized)) return "Instructor";
  return "Student";
}

function createGoogleClient(env: Env): GoogleClient {
  const scope = encodeURIComponent("openid email"); // minimal scopes

  return {
    getAuthorizationUrl: (state: string) => {
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        response_type: "code",
        scope,
        state,
        access_type: "offline",
        prompt: "consent"
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    },
    exchangeCodeForProfile: async (code: string): Promise<GoogleProfile> => {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: env.GOOGLE_REDIRECT_URI,
          grant_type: "authorization_code"
        })
      });

      if (!tokenResponse.ok) {
        throw new Error("google_token_exchange_failed");
      }

      const tokenPayload = (await tokenResponse.json()) as { id_token?: string; access_token?: string };
      if (!tokenPayload.id_token && !tokenPayload.access_token) {
        throw new Error("google_missing_tokens");
      }

      const userInfoResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: {
          Authorization: `Bearer ${tokenPayload.access_token ?? ""}`
        }
      });

      if (!userInfoResponse.ok) {
        throw new Error("google_userinfo_failed");
      }

      const userInfo = (await userInfoResponse.json()) as { email?: string; name?: string };
      if (!userInfo.email) {
        throw new Error("google_missing_email");
      }

      return {
        email: userInfo.email,
        name: userInfo.name ?? userInfo.email
      };
    }
  };
}

export function createAuthApp(env: Env, deps: AuthDeps) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const usersByEmail = new Map<string, User>();
  const usersById = new Map<string, User>();
  const subscriptionsByUserId = new Map<string, SubscriptionRecord>();
  const refreshSessions = new Map<string, RefreshSession>();
  const oauthStates = new Map<string, Date>();

  const adminEmails = parseEmailList(env.GOOGLE_ADMIN_EMAILS);
  const instructorEmails = parseEmailList(env.GOOGLE_INSTRUCTOR_EMAILS);

  const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
    free: {
      maxCreatedCourses: 2,
      maxActiveEnrollments: 5,
      maxOwnedStorageBytes: 50 * 1024 * 1024
    },
    pro: {
      maxCreatedCourses: 20,
      maxActiveEnrollments: 100,
      maxOwnedStorageBytes: 5 * 1024 * 1024 * 1024
    },
    enterprise: {
      maxCreatedCourses: Number.MAX_SAFE_INTEGER,
      maxActiveEnrollments: Number.MAX_SAFE_INTEGER,
      maxOwnedStorageBytes: Number.MAX_SAFE_INTEGER
    }
  };

  function getOrCreateSubscription(userId: string): SubscriptionRecord {
    const existing = subscriptionsByUserId.get(userId);
    if (existing) return existing;

    const created: SubscriptionRecord = {
      userId,
      plan: "free",
      updatedAt: deps.now().toISOString()
    };
    subscriptionsByUserId.set(userId, created);
    return created;
  }

  function signAccessToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
        type: "access"
      },
      env.JWT_ACCESS_SECRET,
      {
        algorithm: "HS256",
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        expiresIn: env.ACCESS_TOKEN_TTL_SECONDS
      }
    );
  }

  function issueRefreshToken(user: User): { token: string; session: RefreshSession } {
    const sessionId = deps.randomId();
    const expiresAt = new Date(deps.now().getTime() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
    const token = jwt.sign(
      {
        sub: user.id,
        sid: sessionId,
        tokenVersion: user.tokenVersion,
        type: "refresh"
      },
      env.JWT_REFRESH_SECRET,
      {
        algorithm: "HS256",
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        expiresIn: env.REFRESH_TOKEN_TTL_SECONDS
      }
    );

    const session: RefreshSession = {
      sessionId,
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt,
      revokedAt: null
    };

    refreshSessions.set(sessionId, session);
    return { token, session };
  }

  function toAuthResponse(user: User) {
    const subscription = getOrCreateSubscription(user.id);
    const accessToken = signAccessToken(user);
    const refresh = issueRefreshToken(user);
    return {
      accessToken,
      refreshToken: refresh.token,
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      tokenType: "Bearer",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      subscription: {
        plan: subscription.plan
      }
    };
  }

  function getSubscriptionStatus(userId: string) {
    const subscription = getOrCreateSubscription(userId);
    const limits = PLAN_LIMITS[subscription.plan];
    const usage = lmsStore.getUserUsageSnapshot(userId);

    return {
      plan: subscription.plan,
      limits,
      usage,
      softLimit: {
        createdCoursesExceededBy: Math.max(usage.createdCourses - limits.maxCreatedCourses, 0),
        activeEnrollmentsExceededBy: Math.max(usage.activeEnrollments - limits.maxActiveEnrollments, 0),
        ownedStorageBytesExceededBy: Math.max(usage.ownedStorageBytes - limits.maxOwnedStorageBytes, 0)
      }
    };
  }

  function withSoftLimitMeta(body: Record<string, unknown>, userId: string): Record<string, unknown> {
    const status = getSubscriptionStatus(userId);
    const softLimitExceeded =
      status.softLimit.createdCoursesExceededBy > 0 ||
      status.softLimit.activeEnrollmentsExceededBy > 0 ||
      status.softLimit.ownedStorageBytesExceededBy > 0;

    return {
      ...body,
      subscription: {
        plan: status.plan,
        softLimitExceeded,
        softLimit: status.softLimit
      }
    };
  }

  type AuthedRequest = any;

  function authenticate(req: AuthedRequest, res: any, next: any) {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ error: "missing_token" });

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ["HS256"],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE
      }) as any;

      if (decoded.type !== "access") {
        return res.status(401).json({ error: "invalid_token_type" });
      }

      const user = usersById.get(decoded.sub);
      if (!user || user.tokenVersion !== decoded.tokenVersion) {
        return res.status(401).json({ error: "stale_token" });
      }

      req.auth = decoded;
      return next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: "token_expired" });
      }
      return res.status(401).json({ error: "invalid_token" });
    }
  }

  function authorize(roles: Role[]) {
    return (req: AuthedRequest, res: any, next: any) => {
      if (!req.auth) return res.status(401).json({ error: "missing_auth_context" });
      if (!roles.includes(req.auth.role)) return res.status(403).json({ error: "forbidden" });
      return next();
    };
  }

  app.get("/auth/google/start", (_req, res) => {
    const state = deps.randomId();
    oauthStates.set(state, deps.now());
    const authUrl = deps.google.getAuthorizationUrl(state);
    res.json({ authUrl, scope: "openid email", state });
  });

  app.get("/auth/google/callback", async (req, res) => {
    const schema = z.object({ code: z.string().min(1), state: z.string().min(1) });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "invalid_callback_params" });

    const issuedAt = oauthStates.get(parsed.data.state);
    if (!issuedAt) return res.status(400).json({ error: "invalid_state" });

    oauthStates.delete(parsed.data.state);

    if (deps.now().getTime() - issuedAt.getTime() > 10 * 60 * 1000) {
      return res.status(400).json({ error: "expired_state" });
    }

    try {
      const profile = await deps.google.exchangeCodeForProfile(parsed.data.code);
      const normalizedEmail = profile.email.toLowerCase();

      let user = usersByEmail.get(normalizedEmail);
      if (!user) {
        user = {
          id: deps.randomId(),
          email: normalizedEmail,
          name: profile.name,
          role: roleForEmail(normalizedEmail, adminEmails, instructorEmails),
          createdAt: deps.now(),
          updatedAt: deps.now(),
          tokenVersion: 1
        };
        usersByEmail.set(normalizedEmail, user);
        usersById.set(user.id, user);
        getOrCreateSubscription(user.id);
      } else {
        user.updatedAt = deps.now();
      }

      const payload = toAuthResponse(user);
      return res.json(payload);
    } catch {
      return res.status(401).json({ error: "google_auth_failed" });
    }
  });

  app.post("/auth/refresh", (req, res) => {
    const schema = z.object({ refreshToken: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    try {
      const decoded = jwt.verify(parsed.data.refreshToken, env.JWT_REFRESH_SECRET, {
        algorithms: ["HS256"],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE
      }) as any;

      if (decoded.type !== "refresh") return res.status(401).json({ error: "invalid_token_type" });

      const session = refreshSessions.get(decoded.sid);
      if (!session || session.revokedAt || session.expiresAt.getTime() <= deps.now().getTime()) {
        return res.status(401).json({ error: "refresh_session_invalid" });
      }

      if (session.userId !== decoded.sub || session.tokenHash !== sha256(parsed.data.refreshToken)) {
        return res.status(401).json({ error: "refresh_session_mismatch" });
      }

      const user = usersById.get(decoded.sub);
      if (!user || user.tokenVersion !== decoded.tokenVersion) {
        return res.status(401).json({ error: "stale_refresh_token" });
      }

      session.revokedAt = deps.now();
      const payload = toAuthResponse(user);
      return res.json(payload);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: "refresh_token_expired" });
      }
      return res.status(401).json({ error: "invalid_refresh_token" });
    }
  });

  app.post("/auth/logout", (req, res) => {
    const schema = z.object({ refreshToken: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    try {
      const decoded = jwt.verify(parsed.data.refreshToken, env.JWT_REFRESH_SECRET, {
        algorithms: ["HS256"],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE
      }) as any;

      if (decoded.type !== "refresh") return res.status(401).json({ error: "invalid_token_type" });

      const session = refreshSessions.get(decoded.sid);
      if (session && !session.revokedAt) {
        session.revokedAt = deps.now();
      }

      return res.json({ ok: true });
    } catch {
      return res.status(401).json({ error: "invalid_refresh_token" });
    }
  });

  app.get("/auth/me", authenticate, (req: AuthedRequest, res) => {
    const user = usersById.get(req.auth!.sub);
    if (!user) return res.status(404).json({ error: "not_found" });

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscription: {
        plan: getOrCreateSubscription(user.id).plan
      }
    });
  });

  app.get("/subscription/me", authenticate, (req: AuthedRequest, res) => {
    return res.json(getSubscriptionStatus(req.auth.sub));
  });

  app.post("/subscription/plan", authenticate, authorize(["Admin"]), (req: any, res: any) => {
    const schema = z.object({ userId: z.string().min(1), plan: z.enum(["free", "pro", "enterprise"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    if (!usersById.has(parsed.data.userId)) {
      return res.status(404).json({ error: "not_found" });
    }

    const next: SubscriptionRecord = {
      userId: parsed.data.userId,
      plan: parsed.data.plan,
      updatedAt: deps.now().toISOString()
    };
    subscriptionsByUserId.set(parsed.data.userId, next);
    return res.json(next);
  });

  app.get("/rbac/admin", authenticate, authorize(["Admin"]), (_req, res) => {
    res.json({ ok: true, area: "admin" });
  });

  app.get("/rbac/instructor", authenticate, authorize(["Admin", "Instructor"]), (_req, res) => {
    res.json({ ok: true, area: "instructor" });
  });

  app.get("/rbac/student", authenticate, authorize(["Admin", "Instructor", "Student"]), (_req, res) => {
    res.json({ ok: true, area: "student" });
  });


  const lmsStore = new LmsCoreStore(() => deps.now().toISOString());

  function canInstructorManageCourse(userId: string, courseId: string): boolean {
    return lmsStore.getCourse(courseId).createdBy === userId;
  }

  function lmsRoleGuard(roles: Role[]) {
    return (req: any, res: any, next: any) => {
      if (!req.auth || !roles.includes(req.auth.role)) return res.status(403).json({ error: "forbidden" });
      return next();
    };
  }

  function handleLmsError(res: any, error: unknown) {
    if (error instanceof LmsModelError) {
      if (error.code === "ACCESS_DENIED") return res.status(403).json({ error: error.code, message: error.message });
      if (error.code === "NOT_FOUND") return res.status(404).json({ error: error.code, message: error.message });
      if (error.code === "DUPLICATE") return res.status(409).json({ error: error.code, message: error.message });
      return res.status(400).json({ error: error.code, message: error.message });
    }
    return res.status(500).json({ error: "internal_error" });
  }

  app.post("/lms/courses", authenticate, lmsRoleGuard(["Admin", "Instructor"]), (req: any, res: any) => {
    const schema = z.object({ id: z.string().min(1), title: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    try {
      const course = lmsStore.createCourse({ ...parsed.data, createdBy: req.auth.sub });
      return res.status(201).json(withSoftLimitMeta({ ...course }, req.auth.sub));
    } catch (error) {
      return handleLmsError(res, error);
    }
  });

  app.post("/lms/modules", authenticate, lmsRoleGuard(["Admin", "Instructor"]), (req: any, res: any) => {
    const schema = z.object({ id: z.string().min(1), courseId: z.string().min(1), title: z.string().min(1), position: z.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    try {
      if (req.auth.role === "Instructor" && !canInstructorManageCourse(req.auth.sub, parsed.data.courseId)) {
        return res.status(403).json({ error: "forbidden" });
      }
      const row = lmsStore.createModule(parsed.data);
      return res.status(201).json(row);
    } catch (error) {
      return handleLmsError(res, error);
    }
  });

  app.post("/lms/lessons", authenticate, lmsRoleGuard(["Admin", "Instructor"]), (req: any, res: any) => {
    const schema = z.object({ id: z.string().min(1), moduleId: z.string().min(1), title: z.string().min(1), position: z.number().int().positive() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    try {
      if (req.auth.role === "Instructor") {
        const courseId = lmsStore.getCourseIdForModule(parsed.data.moduleId);
        if (!canInstructorManageCourse(req.auth.sub, courseId)) {
          return res.status(403).json({ error: "forbidden" });
        }
      }
      const row = lmsStore.createLesson(parsed.data);
      return res.status(201).json(row);
    } catch (error) {
      return handleLmsError(res, error);
    }
  });

  app.post("/lms/enrollments", authenticate, lmsRoleGuard(["Admin", "Instructor", "Student"]), (req: any, res: any) => {
    const schema = z.object({ id: z.string().min(1), courseId: z.string().min(1), userId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    if (req.auth.role === "Student" && req.auth.sub !== parsed.data.userId) {
      return res.status(403).json({ error: "forbidden" });
    }

    try {
      const row = lmsStore.enrollStudent(parsed.data);
      return res.status(201).json(withSoftLimitMeta({ ...row }, parsed.data.userId));
    } catch (error) {
      return handleLmsError(res, error);
    }
  });

  app.patch("/lms/progress", authenticate, lmsRoleGuard(["Student"]), (req: any, res: any) => {
    const schema = z.object({ enrollmentId: z.string().min(1), lessonId: z.string().min(1), status: z.enum(["not_started", "in_progress", "completed"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    try {
      const row = lmsStore.markLessonProgress({ ...parsed.data, actorUserId: req.auth.sub });
      return res.json(row);
    } catch (error) {
      return handleLmsError(res, error);
    }
  });

  app.get("/lms/enrollments/:enrollmentId/completion", authenticate, (req: any, res: any) => {
    try {
      const enrollment = lmsStore.getEnrollment(req.params.enrollmentId);
      if (req.auth.role === "Student" && enrollment.userId !== req.auth.sub) {
        return res.status(403).json({ error: "forbidden" });
      }
      if (req.auth.role === "Instructor" && !canInstructorManageCourse(req.auth.sub, enrollment.courseId)) {
        return res.status(403).json({ error: "forbidden" });
      }

      const completion = lmsStore.getCourseCompletionPercent(req.params.enrollmentId);
      return res.json({ enrollmentId: req.params.enrollmentId, completion });
    } catch (error) {
      return handleLmsError(res, error);
    }
  });

  app.put("/lms/lessons/:lessonId/content", authenticate, lmsRoleGuard(["Admin", "Instructor"]), (req: any, res: any) => {
    const schema = z.object({
      provider: z.enum(["gdrive", "s3", "r2"]),
      key: z.string().min(1),
      fileId: z.string().min(1),
      contentType: z.string().min(1),
      size: z.number().int().nonnegative()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    try {
      if (req.auth.role === "Instructor") {
        const courseId = lmsStore.getCourseIdForLesson(req.params.lessonId);
        if (!canInstructorManageCourse(req.auth.sub, courseId)) {
          return res.status(403).json({ error: "forbidden" });
        }
      }
      const metadata = lmsStore.attachLessonContent({ lessonId: req.params.lessonId, ...parsed.data });
      return res.status(201).json(withSoftLimitMeta({ ...metadata }, req.auth.sub));
    } catch (error) {
      return handleLmsError(res, error);
    }
  });

  app.get("/lms/lessons/:lessonId/content-url", authenticate, (req: any, res: any) => {
    const allowed = lmsStore.canUserAccessLessonContent({
      lessonId: req.params.lessonId,
      userId: req.auth.sub,
      role: req.auth.role
    });

    if (!allowed) {
      return res.status(403).json({ error: "forbidden" });
    }

    try {
      const metadata = lmsStore.getLessonContent(req.params.lessonId);
      const signed = buildSignedLessonContentUrl(env.DELIVERY_BASE_URL, env.DELIVERY_SIGNING_SECRET, deps.now, {
        userId: req.auth.sub,
        lessonId: req.params.lessonId,
        content: metadata,
        expiresInSeconds: env.DELIVERY_URL_TTL_SECONDS
      });

      return res.json({
        provider: metadata.provider,
        key: metadata.key,
        contentType: metadata.contentType,
        size: metadata.size,
        url: signed.url,
        expiresAt: signed.expiresAt,
        expiresInSeconds: env.DELIVERY_URL_TTL_SECONDS
      });
    } catch (error) {
      return handleLmsError(res, error);
    }
  });

  app.post("/lms/content-url/verify", authenticate, (req: any, res: any) => {
    const schema = z.object({
      provider: z.enum(["gdrive", "s3", "r2"]),
      key: z.string().min(1),
      lessonId: z.string().min(1),
      userId: z.string().min(1),
      exp: z.string().min(1),
      sig: z.string().min(1)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_input" });

    if (req.auth.role === "Student" && req.auth.sub !== parsed.data.userId) {
      return res.status(403).json({ error: "forbidden" });
    }

    const valid = verifySignedLessonContentUrl(env.DELIVERY_SIGNING_SECRET, deps.now, parsed.data);
    return res.json({ valid });
  });


  app.get("/lms/instructor/dashboard/:courseId", authenticate, lmsRoleGuard(["Admin", "Instructor"]), (req: any, res: any) => {
    try {
      const dashboard = lmsStore.getInstructorDashboard({
        courseId: req.params.courseId,
        userId: req.auth.sub,
        role: req.auth.role
      });
      return res.json(dashboard);
    } catch (error) {
      return handleLmsError(res, error);
    }
  });

  return app;
}

export function parseEnv(input: NodeJS.ProcessEnv): Env {
  return envSchema.parse(input);
}

if (process.env.NODE_ENV !== "test") {
  const env = parseEnv(process.env);
  const app = createAuthApp(env, {
    now: () => new Date(),
    randomId: () => crypto.randomUUID(),
    google: createGoogleClient(env)
  });

  app.listen(Number(env.PORT), () => undefined);
}
