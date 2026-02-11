import { StorageError, mapHttpError } from "./errors.js";
import type {
  CloudStorageAdapter,
  DeleteResult,
  DownloadResult,
  ObjectMetadata,
  StorageProviderName,
  UploadInput,
  UploadResult
} from "./types.js";

type FetchLike = typeof fetch;

type GoogleDriveAdapterOptions = {
  accessTokenProvider: () => Promise<string>;
  folderId?: string;
  fetchImpl?: FetchLike;
};

const provider: StorageProviderName = "gdrive";
const DRIVE_FILES_API = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

function toBase64(content: string | Buffer): string {
  if (typeof content === "string") {
    return Buffer.from(content).toString("base64");
  }
  return content.toString("base64");
}

async function parseResponseBody(response: Response): Promise<any> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function queryForKey(key: string, folderId?: string): string {
  const clauses = [`name='${key.replace(/'/g, "\\'")}'`, "trashed=false"];
  if (folderId) clauses.push(`'${folderId}' in parents`);
  return clauses.join(" and ");
}

async function ensureOk(response: Response): Promise<void> {
  if (!response.ok) {
    const details = await parseResponseBody(response).catch(() => undefined);
    throw mapHttpError("gdrive", response.status, details);
  }
}

export class GoogleDriveStorageAdapter implements CloudStorageAdapter {
  readonly provider: StorageProviderName = provider;
  private readonly accessTokenProvider: () => Promise<string>;
  private readonly folderId?: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: GoogleDriveAdapterOptions) {
    this.accessTokenProvider = options.accessTokenProvider;
    this.folderId = options.folderId;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.accessTokenProvider();
    if (!token || token.trim().length === 0) {
      throw new StorageError({
        provider,
        code: "UNAUTHORIZED",
        message: "Missing Google Drive access token"
      });
    }
    return { Authorization: `Bearer ${token}` };
  }

  private async findFileByKey(key: string): Promise<{ id: string; name: string; mimeType: string; size?: string; createdTime?: string; modifiedTime?: string; } | null> {
    const headers = await this.authHeaders();
    const query = new URLSearchParams({
      q: queryForKey(key, this.folderId),
      fields: "files(id,name,mimeType,size,createdTime,modifiedTime)",
      pageSize: "1"
    });

    const response = await this.fetchImpl(`${DRIVE_FILES_API}?${query.toString()}`, {
      headers
    });
    await ensureOk(response);

    const payload = (await response.json()) as { files?: Array<any> };
    if (!payload.files || payload.files.length === 0) return null;
    return payload.files[0];
  }

  async uploadObject(input: UploadInput): Promise<UploadResult> {
    const headers = await this.authHeaders();

    const metadata: Record<string, unknown> = { name: input.key };
    if (this.folderId) metadata.parents = [this.folderId];

    const multipartBoundary = "navcloud_boundary";
    const body =
      `--${multipartBoundary}\r\n` +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      `${JSON.stringify(metadata)}\r\n` +
      `--${multipartBoundary}\r\n` +
      `Content-Type: ${input.contentType}\r\n` +
      "Content-Transfer-Encoding: base64\r\n\r\n" +
      `${toBase64(input.content)}\r\n` +
      `--${multipartBoundary}--`;

    const response = await this.fetchImpl(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,size`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": `multipart/related; boundary=${multipartBoundary}`
      },
      body
    });

    await ensureOk(response);
    const payload = (await response.json()) as { id: string; size?: string };

    return {
      provider,
      key: input.key,
      fileId: payload.id,
      size: Number(payload.size ?? Buffer.byteLength(input.content))
    };
  }

  async downloadObject(key: string): Promise<DownloadResult> {
    const file = await this.findFileByKey(key);
    if (!file) {
      throw new StorageError({
        provider,
        code: "NOT_FOUND",
        message: `File not found for key: ${key}`
      });
    }

    const headers = await this.authHeaders();
    const response = await this.fetchImpl(`${DRIVE_FILES_API}/${file.id}?alt=media`, { headers });
    await ensureOk(response);

    const arrayBuffer = await response.arrayBuffer();
    return {
      provider,
      key,
      fileId: file.id,
      content: Buffer.from(arrayBuffer),
      contentType: file.mimeType || "application/octet-stream"
    };
  }

  async deleteObject(key: string): Promise<DeleteResult> {
    const file = await this.findFileByKey(key);
    if (!file) {
      return { provider, key, deleted: false };
    }

    const headers = await this.authHeaders();
    const response = await this.fetchImpl(`${DRIVE_FILES_API}/${file.id}`, {
      method: "DELETE",
      headers
    });

    await ensureOk(response);
    return { provider, key, deleted: true };
  }

  async getMetadata(key: string): Promise<ObjectMetadata> {
    const file = await this.findFileByKey(key);
    if (!file) {
      throw new StorageError({
        provider,
        code: "NOT_FOUND",
        message: `File not found for key: ${key}`
      });
    }

    return {
      provider,
      key,
      fileId: file.id,
      contentType: file.mimeType || "application/octet-stream",
      size: Number(file.size ?? 0),
      createdAt: file.createdTime,
      updatedAt: file.modifiedTime
    };
  }
}
