import { StorageError } from "./errors.js";
import { GoogleDriveStorageAdapter } from "./googleDriveAdapter.js";
import type { CloudStorageAdapter, StorageProviderName } from "./types.js";

type CreateStorageAdapterInput =
  | {
      provider: "gdrive";
      accessTokenProvider: () => Promise<string>;
      folderId?: string;
      fetchImpl?: typeof fetch;
    }
  | {
      provider: "s3" | "r2";
    };

export function createStorageAdapter(input: CreateStorageAdapterInput): CloudStorageAdapter {
  if (input.provider === "gdrive") {
    return new GoogleDriveStorageAdapter({
      accessTokenProvider: input.accessTokenProvider,
      folderId: input.folderId,
      fetchImpl: input.fetchImpl
    });
  }

  const provider: StorageProviderName = input.provider;
  throw new StorageError({
    provider,
    code: "PROVIDER_ERROR",
    message: `${provider} adapter not implemented yet` 
  });
}
