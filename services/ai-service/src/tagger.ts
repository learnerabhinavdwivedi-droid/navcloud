/**
 * NavCloud Premium — AI File Tagger
 * Uses Gemini 1.5 Flash to auto-tag files with semantic metadata.
 * Extracts 5 semantic tags + 1-sentence summary per file.
 */

import { z } from "zod";

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_FLASH_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const TaggerConfigSchema = z.object({
  apiKey: z.string().min(1),
  model: z.string().default(GEMINI_FLASH_MODEL),
  maxTagCount: z.number().int().positive().default(5),
});
export type TaggerConfig = z.input<typeof TaggerConfigSchema>;

// ============================================================================
// Types
// ============================================================================

export type FileAnalysis = {
  summary: string;
  tags: string[];
  category: string;
  confidence: number;
  metadata: Record<string, string>;
};

// ============================================================================
// Structured output schema for Gemini
// ============================================================================

const FILE_ANALYSIS_PROMPT = `You are an AI file analyst for a premium cloud storage platform. 
Analyze the given file content and return a structured analysis.

RULES:
1. Generate exactly 5 semantic tags that describe the file's content and purpose.
2. Write a single, concise sentence summarizing the file.
3. Categorize the file into one of: document, image, video, audio, code, spreadsheet, presentation, archive, other.
4. Extract any notable metadata (dates, names, organizations, amounts).
5. Rate your confidence from 0.0 to 1.0.

Respond ONLY with valid JSON matching this schema:
{
  "summary": "One sentence summary of the file content.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category": "document",
  "confidence": 0.85,
  "metadata": { "key": "value" }
}`;

// ============================================================================
// Gemini File Tagger
// ============================================================================

export class GeminiFileTagger {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTagCount: number;

  constructor(config: TaggerConfig) {
    const parsed = TaggerConfigSchema.parse(config);
    this.apiKey = parsed.apiKey;
    this.model = parsed.model;
    this.maxTagCount = parsed.maxTagCount;
  }

  /**
   * Analyze a file's text content and generate semantic tags + summary.
   */
  async analyzeFile(input: {
    fileName: string;
    fileType: string;
    textContent: string;
  }): Promise<FileAnalysis> {
    const userPrompt = `File: "${input.fileName}" (${input.fileType})

Content excerpt:
---
${input.textContent.slice(0, 8000)}
---

Analyze this file and respond with the structured JSON analysis.`;

    const url = `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: FILE_ANALYSIS_PROMPT },
              { text: userPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "unknown");
      throw new Error(`gemini_tagger_failed: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content: { parts: Array<{ text: string }> };
      }>;
    };

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new Error("gemini_tagger_empty_response");
    }

    try {
      const parsed = JSON.parse(rawText) as FileAnalysis;

      // Enforce tag count limit
      if (parsed.tags && parsed.tags.length > this.maxTagCount) {
        parsed.tags = parsed.tags.slice(0, this.maxTagCount);
      }

      // Normalize tags to lowercase
      parsed.tags = (parsed.tags ?? []).map((t) => t.toLowerCase().trim());

      return parsed;
    } catch {
      throw new Error(`gemini_tagger_parse_failed: ${rawText.slice(0, 200)}`);
    }
  }

  /**
   * Generate tags for a file based only on its name and type
   * (lightweight fallback when content extraction fails).
   */
  async analyzeFileByName(fileName: string, fileType: string): Promise<FileAnalysis> {
    return this.analyzeFile({
      fileName,
      fileType,
      textContent: `[File content not available. Analyze based on filename and type only.]`,
    });
  }
}
