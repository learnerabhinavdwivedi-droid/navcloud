export type StorageProviderName = "gdrive" | "s3" | "r2";

export type UploadInput = {
  key: string;
  content: string | Buffer;
  contentType: string;
};

export type UploadResult = {
  provider: StorageProviderName;
  key: string;
  fileId: string;
  size: number;
};

export type DownloadResult = {
  provider: StorageProviderName;
  key: string;
  fileId: string;
  content: Buffer;
  contentType: string;
};

export type DeleteResult = {
  provider: StorageProviderName;
  key: string;
  deleted: boolean;
};

export type ObjectMetadata = {
  provider: StorageProviderName;
  key: string;
  fileId: string;
  contentType: string;
  size: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CloudStorageAdapter = {
  readonly provider: StorageProviderName;
  uploadObject(input: UploadInput): Promise<UploadResult>;
  downloadObject(key: string): Promise<DownloadResult>;
  deleteObject(key: string): Promise<DeleteResult>;
  getMetadata(key: string): Promise<ObjectMetadata>;
};
