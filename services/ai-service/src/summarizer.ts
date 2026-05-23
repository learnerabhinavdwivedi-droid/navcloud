/**
 * NavCloud Premium — AI Summarizer
 * Generates concise, human-readable summaries of file content
 * for instant preview in the drive dashboard.
 */

import { z } from "zod";

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_FLASH_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const SummarizerConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default(GEMINI_FLASH_MODEL),
});
export type SummarizerConfig = z.input<typeof SummarizerConfigSchema>;

// ============================================================================
// Types
// ============================================================================

export type FileSummary = {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  readTimeSeconds: number;
};

// ============================================================================
// Gemini Summarizer
// ============================================================================

export class GeminiSummarizer {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: SummarizerConfig) {
    const parsed = SummarizerConfigSchema.parse(config);
    this.apiKey = parsed.apiKey;
    this.model = parsed.model;
  }

  /**
   * Generate a concise summary of file content.
   */
  async summarize(input: {
    fileName: string;
    fileType: string;
    textContent: string;
  }): Promise<FileSummary> {
    const prompt = `Summarize this file in exactly one sentence. Also extract 3 key points as brief phrases.

File: "${input.fileName}" (${input.fileType})

Content:
---
${input.textContent.slice(0, 12000)}
---

Respond with valid JSON only:
{
  "summary": "One sentence summary.",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "wordCount": 1234,
  "readTimeSeconds": 60
}`;

    const url = `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 256,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "unknown");
      throw new Error(`gemini_summarizer_failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content: { parts: Array<{ text: string }> };
      }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("gemini_summarizer_empty_response");
    }

    try {
      return JSON.parse(rawText) as FileSummary;
    } catch {
      // Fallback: use the raw text as the summary
      return {
        summary: rawText.slice(0, 200),
        keyPoints: [],
        wordCount: input.textContent.split(/\s+/).length,
        readTimeSeconds: Math.ceil(input.textContent.split(/\s+/).length / 4),
      };
    }
  }
}
