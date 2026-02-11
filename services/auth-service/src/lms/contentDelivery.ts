import crypto from "crypto";
import type { StorageProviderName } from "../storage/types.js";

export type LessonContentRef = {
  provider: StorageProviderName;
  key: string;
  fileId: string;
  contentType: string;
  size: number;
};

export type SignedUrlInput = {
  userId: string;
  lessonId: string;
  content: LessonContentRef;
  expiresInSeconds: number;
};

export function buildSignedLessonContentUrl(
  baseUrl: string,
  signingSecret: string,
  now: () => Date,
  input: SignedUrlInput
): { url: string; expiresAt: string } {
  const expiresAtEpoch = Math.floor(now().getTime() / 1000) + input.expiresInSeconds;
  const exp = String(expiresAtEpoch);
  const provider = input.content.provider;
  const key = encodeURIComponent(input.content.key);
  const payload = `${provider}:${input.content.key}:${input.lessonId}:${input.userId}:${exp}`;
  const sig = crypto.createHmac("sha256", signingSecret).update(payload).digest("hex");

  const url = `${baseUrl.replace(/\/$/, "")}/${provider}/${key}?fileId=${encodeURIComponent(
    input.content.fileId
  )}&lessonId=${encodeURIComponent(input.lessonId)}&uid=${encodeURIComponent(input.userId)}&exp=${exp}&sig=${sig}`;

  return {
    url,
    expiresAt: new Date(expiresAtEpoch * 1000).toISOString()
  };
}

export function verifySignedLessonContentUrl(
  signingSecret: string,
  now: () => Date,
  params: {
    provider: StorageProviderName;
    key: string;
    lessonId: string;
    userId: string;
    exp: string;
    sig: string;
  }
): boolean {
  const expNum = Number(params.exp);
  if (!Number.isFinite(expNum)) return false;
  if (expNum <= Math.floor(now().getTime() / 1000)) return false;

  const payload = `${params.provider}:${params.key}:${params.lessonId}:${params.userId}:${params.exp}`;
  const expected = crypto.createHmac("sha256", signingSecret).update(payload).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.sig));
  } catch {
    return false;
  }
}
