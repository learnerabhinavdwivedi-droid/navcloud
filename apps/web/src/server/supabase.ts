/**
 * NavCloud Premium — Supabase Client
 * Typed Supabase client initialization for frontend.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/**
 * Lightweight Supabase REST client (no SDK dependency).
 * Uses native fetch for maximum performance.
 */
export class SupabaseClient {
  private readonly url: string;
  private readonly anonKey: string;
  private accessToken: string | null = null;

  constructor(config?: Partial<SupabaseConfig>) {
    this.url = config?.url || SUPABASE_URL;
    this.anonKey = config?.anonKey || SUPABASE_ANON_KEY;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: this.anonKey,
    };
    if (this.accessToken) {
      h.Authorization = `Bearer ${this.accessToken}`;
    }
    return h;
  }

  /**
   * Call a Supabase RPC (Remote Procedure Call) function.
   */
  async rpc<T = unknown>(functionName: string, params?: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.url}/rest/v1/rpc/${functionName}`, {
      method: "POST",
      headers: this.headers(),
      body: params ? JSON.stringify(params) : undefined,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "unknown");
      throw new Error(`supabase_rpc_${functionName}_failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Query a table with optional filters.
   */
  async from<T = unknown>(
    table: string,
    options?: { select?: string; filter?: Record<string, string>; limit?: number; order?: string }
  ): Promise<T[]> {
    const params = new URLSearchParams();
    if (options?.select) params.set("select", options.select);
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.order) params.set("order", options.order);
    if (options?.filter) {
      for (const [key, value] of Object.entries(options.filter)) {
        params.set(key, value);
      }
    }

    const response = await fetch(`${this.url}/rest/v1/${table}?${params.toString()}`, {
      headers: this.headers(),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "unknown");
      throw new Error(`supabase_query_${table}_failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Insert a row into a table.
   */
  async insert<T = unknown>(table: string, data: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${this.url}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...this.headers(), Prefer: "return=representation" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "unknown");
      throw new Error(`supabase_insert_${table}_failed: ${response.status} ${error}`);
    }

    const rows = await response.json();
    return Array.isArray(rows) ? rows[0] : rows;
  }
}

/** Singleton Supabase client instance */
export const supabase = new SupabaseClient();
