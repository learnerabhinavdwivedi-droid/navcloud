/**
 * NavCloud Premium — AI Embeddings Service
 * Generates vector embeddings using Gemini text-embedding-004 for semantic search.
 */

import { z } from "zod";

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_EMBEDDING_MODEL = "text-embedding-004";
const GEMINI_EMBEDDING_DIMENSIONS = 768;
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const EmbeddingConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default(GEMINI_EMBEDDING_MODEL),
  dimensions: z.number().int().positive().default(GEMINI_EMBEDDING_DIMENSIONS),
});
export type EmbeddingConfig = z.input<typeof EmbeddingConfigSchema>;

// ============================================================================
// Types
// ============================================================================

export type EmbeddingResult = {
  embedding: number[];
  dimensions: number;
  model: string;
  tokenCount: number;
};

export type BatchEmbeddingResult = {
  embeddings: EmbeddingResult[];
  totalTokens: number;
};

// ============================================================================
// Gemini Embedding Client
// ============================================================================

export class GeminiEmbeddingClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(config: EmbeddingConfig) {
    const parsed = EmbeddingConfigSchema.parse(config);
    this.apiKey = parsed.apiKey;
    this.model = parsed.model;
    this.dimensions = parsed.dimensions;
  }

  /**
   * Generate a single embedding for a text input.
   * Used for search queries and individual file content.
   */
  async embed(text: string): Promise<EmbeddingResult> {
    if (!text || text.trim().length === 0) {
      throw new Error("embed_empty_text: cannot embed empty text");
    }

    const url = `${GEMINI_API_BASE}/models/${this.model}:embedContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: {
          parts: [{ text: text.slice(0, 10000) }], // Gemini limit
        },
        outputDimensionality: this.dimensions,
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "unknown");
      throw new Error(`gemini_embedding_failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      embedding: { values: number[] };
      metadata?: { billableCharacterCount?: number };
    };

    return {
      embedding: data.embedding.values,
      dimensions: data.embedding.values.length,
      model: this.model,
      tokenCount: data.metadata?.billableCharacterCount ?? text.length,
    };
  }

  /**
   * Generate embeddings for multiple texts in a single batch request.
   * Used for bulk processing during file ingestion.
   */
  async batchEmbed(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return { embeddings: [], totalTokens: 0 };
    }

    const url = `${GEMINI_API_BASE}/models/${this.model}:batchEmbedContents?key=${this.apiKey}`;
    const requests = texts.map((text) => ({
      model: `models/${this.model}`,
      content: {
        parts: [{ text: text.slice(0, 10000) }],
      },
      outputDimensionality: this.dimensions,
    }));

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "unknown");
      throw new Error(`gemini_batch_embedding_failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      embeddings: Array<{ values: number[] }>;
    };

    let totalTokens = 0;
    const embeddings: EmbeddingResult[] = data.embeddings.map((emb, idx) => {
      const tokenCount = texts[idx]?.length ?? 0;
      totalTokens += tokenCount;
      return {
        embedding: emb.values,
        dimensions: emb.values.length,
        model: this.model,
        tokenCount,
      };
    });

    return { embeddings, totalTokens };
  }
}
