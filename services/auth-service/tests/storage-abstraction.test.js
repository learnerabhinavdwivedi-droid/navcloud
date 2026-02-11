import test from 'node:test';
import assert from 'node:assert/strict';

const { GoogleDriveStorageAdapter, StorageError, createStorageAdapter } = await import('../dist/storage/index.js');

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

test('google drive adapter handles revoked token and missing file errors', async () => {
  const revoked = new GoogleDriveStorageAdapter({
    accessTokenProvider: async () => 'revoked-token',
    fetchImpl: async () => jsonResponse(401, { error: { message: 'Invalid Credentials' } })
  });

  await assert.rejects(() => revoked.getMetadata('lesson.pdf'), (error) => {
    assert.ok(error instanceof StorageError);
    assert.equal(error.code, 'UNAUTHORIZED');
    return true;
  });

  const missing = new GoogleDriveStorageAdapter({
    accessTokenProvider: async () => 'ok-token',
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes('/drive/v3/files?')) {
        return jsonResponse(200, { files: [] });
      }
      return new Response('unused', { status: 500 });
    }
  });

  await assert.rejects(() => missing.downloadObject('does-not-exist'), (error) => {
    assert.ok(error instanceof StorageError);
    assert.equal(error.code, 'NOT_FOUND');
    return true;
  });
});

test('google drive adapter supports upload/get/download/delete and maps payload', async () => {
  const content = Buffer.from('course-material');
  const adapter = new GoogleDriveStorageAdapter({
    accessTokenProvider: async () => 'valid-token',
    fetchImpl: async (url, options = {}) => {
      const target = String(url);

      if (target.startsWith('https://www.googleapis.com/upload/drive/v3/files')) {
        return jsonResponse(200, { id: 'file-1', size: String(content.length) });
      }

      if (target.includes('/drive/v3/files?')) {
        return jsonResponse(200, {
          files: [
            {
              id: 'file-1',
              name: 'course.pdf',
              mimeType: 'application/pdf',
              size: String(content.length),
              createdTime: '2026-01-01T00:00:00Z',
              modifiedTime: '2026-01-02T00:00:00Z'
            }
          ]
        });
      }

      if (target.endsWith('/drive/v3/files/file-1?alt=media')) {
        return new Response(content, { status: 200, headers: { 'Content-Type': 'application/pdf' } });
      }

      if (target.endsWith('/drive/v3/files/file-1') && options.method === 'DELETE') {
        return new Response('', { status: 200 });
      }

      return new Response('unexpected', { status: 500 });
    }
  });

  const uploaded = await adapter.uploadObject({
    key: 'course.pdf',
    content,
    contentType: 'application/pdf'
  });
  assert.equal(uploaded.provider, 'gdrive');
  assert.equal(uploaded.fileId, 'file-1');

  const metadata = await adapter.getMetadata('course.pdf');
  assert.equal(metadata.fileId, 'file-1');
  assert.equal(metadata.contentType, 'application/pdf');

  const downloaded = await adapter.downloadObject('course.pdf');
  assert.equal(downloaded.content.toString(), 'course-material');

  const deleted = await adapter.deleteObject('course.pdf');
  assert.equal(deleted.deleted, true);
});

test('factory is extensible and clearly rejects unimplemented providers', async () => {
  const gdrive = createStorageAdapter({
    provider: 'gdrive',
    accessTokenProvider: async () => 'token',
    fetchImpl: async () => jsonResponse(200, { files: [] })
  });

  assert.equal(gdrive.provider, 'gdrive');

  assert.throws(() => createStorageAdapter({ provider: 's3' }), (error) => {
    assert.ok(error instanceof StorageError);
    assert.equal(error.provider, 's3');
    return true;
  });

  assert.throws(() => createStorageAdapter({ provider: 'r2' }), (error) => {
    assert.ok(error instanceof StorageError);
    assert.equal(error.provider, 'r2');
    return true;
  });
});
