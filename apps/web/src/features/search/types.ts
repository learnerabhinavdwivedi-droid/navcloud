/**
 * NavCloud Premium — Semantic Search Types
 */

import { z } from "zod";

export const SearchQuerySchema = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
  threshold: z.number().min(0).max(1).default(0.7),
  maxResults: z.number().int().positive().default(20),
  fileType: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

export const SearchResultSchema = z.object({
  id: z.string(),
  fileId: z.string(),
  fileName: z.string(),
  fileType: z.string(),
  filePath: z.string().optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.unknown()).optional(),
  similarity: z.number(),
});
export type SearchResult = z.infer<typeof SearchResultSchema>;

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  query: z.string(),
  totalResults: z.number(),
  searchTimeMs: z.number(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
