/**
 * NavCloud Premium — Drive Feature Types
 * Zod schemas for file management.
 */

import { z } from "zod";

export const FileItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.number(),
  path: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
  similarity: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  processingStatus: z.enum(["pending", "processing", "completed", "failed"]).default("pending"),
});
export type FileItem = z.infer<typeof FileItemSchema>;

export const UploadProgressSchema = z.object({
  fileId: z.string(),
  fileName: z.string(),
  progress: z.number().min(0).max(100),
  status: z.enum(["uploading", "processing", "completed", "failed"]),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type UploadProgress = z.infer<typeof UploadProgressSchema>;

export const LiveFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().default("📁"),
  ruleType: z.enum(["tag_match", "content_match", "type_match", "date_range", "composite"]),
  ruleConfig: z.record(z.unknown()),
  matchedFilesCount: z.number().default(0),
  isActive: z.boolean().default(true),
});
export type LiveFolder = z.infer<typeof LiveFolderSchema>;
