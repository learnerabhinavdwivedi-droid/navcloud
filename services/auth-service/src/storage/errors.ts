export type StorageErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "PROVIDER_ERROR";

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly provider: string;
  readonly status?: number;
  readonly causeDetails?: unknown;

  constructor(params: {
    code: StorageErrorCode;
    provider: string;
    message: string;
    status?: number;
    causeDetails?: unknown;
  }) {
    super(params.message);
    this.code = params.code;
    this.provider = params.provider;
    this.status = params.status;
    this.causeDetails = params.causeDetails;
  }
}

export function mapHttpError(provider: string, status: number, details?: unknown): StorageError {
  if (status === 401 || status === 403) {
    return new StorageError({
      code: "UNAUTHORIZED",
      provider,
      status,
      message: `${provider} authorization failed`,
      causeDetails: details
    });
  }

  if (status === 404) {
    return new StorageError({
      code: "NOT_FOUND",
      provider,
      status,
      message: `${provider} file not found`,
      causeDetails: details
    });
  }

  if (status === 429) {
    return new StorageError({
      code: "RATE_LIMITED",
      provider,
      status,
      message: `${provider} rate limited`,
      causeDetails: details
    });
  }

  if (status >= 400 && status < 500) {
    return new StorageError({
      code: "INVALID_REQUEST",
      provider,
      status,
      message: `${provider} request rejected`,
      causeDetails: details
    });
  }

  return new StorageError({
    code: "PROVIDER_ERROR",
    provider,
    status,
    message: `${provider} internal error`,
    causeDetails: details
  });
}
