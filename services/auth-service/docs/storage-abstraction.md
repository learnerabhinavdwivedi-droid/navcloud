# Cloud Storage Abstraction Layer

## Unified interface
`src/storage/types.ts` defines a provider-agnostic `CloudStorageAdapter` contract:
- `uploadObject`
- `downloadObject`
- `deleteObject`
- `getMetadata`

The return types are normalized so callers can switch providers with no API changes.

## First provider: Google Drive adapter
`src/storage/googleDriveAdapter.ts` implements the contract with Drive REST APIs.

Key reliability features:
- token injection via `accessTokenProvider`
- normalized error mapping (`UNAUTHORIZED`, `NOT_FOUND`, `RATE_LIMITED`, etc.)
- missing key detection through `findFileByKey`
- deterministic metadata mapping

## Failure simulation and handling
Tests explicitly simulate:
1. revoked token (`401`) => `StorageError(code=UNAUTHORIZED)`
2. missing file from list query => `StorageError(code=NOT_FOUND)`

## Extensibility for S3/R2
`src/storage/factory.ts` introduces provider selection and currently supports `gdrive`.
`provider: s3 | r2` already exists in type contracts and returns explicit not-implemented errors.

This keeps extension low-risk: add `S3StorageAdapter` / `R2StorageAdapter` implementing `CloudStorageAdapter` and wire into the factory.
