/**
 * NavCloud Premium — AI Service Entry Point
 * Orchestrates the file processing pipeline:
 * 1. Extract text from uploaded file
 * 2. Generate AI summary + tags via Gemini Flash
 * 3. Generate vector embedding via Gemini Embedding
 * 4. Store everything in Supabase (file_embeddings table)
 */

import { z } from "zod";
import { GeminiEmbeddingClient } from "./embeddings.js";
import { GeminiFileTagger } from "./tagger.js";
import { GeminiSummarizer } from "./summarizer.js";

// ============================================================================
// Configuration
// ============================================================================

export const AIServiceConfigSchema = z.object({
  geminiApiKey: z.string().min(1),
  supabaseUrl: z.string().url(),
  supabaseServiceKey: z.string().min(1),
});
export type AIServiceConfig = z.infer<typeof AIServiceConfigSchema>;

// ============================================================================
// Types
// ============================================================================

export type ProcessFileInput = {
  fileId: string;
  userId: string;
  fileName: string;
  fileType: string;
  filePath?: string;
  textContent: string;
};

export type ProcessFileResult = {
  fileId: string;
  summary: string;
  tags: string[];
  category: string;
  embeddingDimensions: number;
  processingTimeMs: number;
};

// ============================================================================
// AI Service Orchestrator
// ============================================================================

export class AIFileProcessor {
  private readonly embedder: GeminiEmbeddingClient;
  private readonly tagger: GeminiFileTagger;
  private readonly summarizer: GeminiSummarizer;
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;

  constructor(config: AIServiceConfig) {
    const parsed = AIServiceConfigSchema.parse(config);

    this.embedder = new GeminiEmbeddingClient({ apiKey: parsed.geminiApiKey });
    this.tagger = new GeminiFileTagger({ apiKey: parsed.geminiApiKey });
    this.summarizer = new GeminiSummarizer({ apiKey: parsed.geminiApiKey });
    this.supabaseUrl = parsed.supabaseUrl;
    this.supabaseKey = parsed.supabaseServiceKey;
  }

  /**
   * Full processing pipeline for a newly uploaded file.
   * Runs tagger, summarizer, and embedder in parallel for maximum throughput.
   */
  async processFile(input: ProcessFileInput): Promise<ProcessFileResult> {
    const startTime = Date.now();

    // Run AI tasks in parallel for speed
    const [analysis, embedding] = await Promise.all([
      this.tagger.analyzeFile({
        fileName: input.fileName,
        fileType: input.fileType,
        textContent: input.textContent,
      }),
      this.embedder.embed(
        `${input.fileName} ${input.textContent.slice(0, 8000)}`
      ),
    ]);

    // Store results in Supabase
    await this.storeEmbedding({
      fileId: input.fileId,
      userId: input.userId,
      fileName: input.fileName,
      fileType: input.fileType,
      filePath: input.filePath,
      summary: analysis.summary,
      tags: analysis.tags,
      embedding: embedding.embedding,
      metadata: analysis.metadata,
    });

    return {
      fileId: input.fileId,
      summary: analysis.summary,
      tags: analysis.tags,
      category: analysis.category,
      embeddingDimensions: embedding.dimensions,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Perform semantic search across a user's files.
   */
  async semanticSearch(input: {
    query: string;
    userId: string;
    threshold?: number;
    maxResults?: number;
    fileType?: string;
    tags?: string[];
  }): Promise<unknown[]> {
    // Generate embedding for the search query
    const queryEmbedding = await this.embedder.embed(input.query);

    // Call the Supabase RPC function
    const response = await fetch(`${this.supabaseUrl}/rest/v1/rpc/search_files_semantic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.supabaseKey}`,
        apikey: this.supabaseKey,
      },
      body: JSON.stringify({
        query_embedding: queryEmbedding.embedding,
        match_user_id: input.userId,
        match_threshold: input.threshold ?? 0.7,
        match_count: input.maxResults ?? 20,
        filter_file_type: input.fileType ?? null,
        filter_tags: input.tags ?? null,
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "unknown");
      throw new Error(`semantic_search_failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Store file embedding and metadata in Supabase.
   */
  private async storeEmbedding(input: {
    fileId: string;
    userId: string;
    fileName: string;
    fileType: string;
    filePath?: string;
    summary: string;
    tags: string[];
    embedding: number[];
    metadata: Record<string, string>;
  }): Promise<void> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/file_embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.supabaseKey}`,
        apikey: this.supabaseKey,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        file_id: input.fileId,
        user_id: input.userId,
        file_name: input.fileName,
        file_type: input.fileType,
        file_path: input.filePath,
        summary: input.summary,
        tags: input.tags,
        embedding: `[${input.embedding.join(",")}]`,
        metadata: input.metadata,
        processing_status: "completed",
        processed_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "unknown");
      throw new Error(`store_embedding_failed: ${response.status} ${error}`);
    }
  }
}
