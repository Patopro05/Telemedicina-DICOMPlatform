import type { Env } from './env';

/**
 * 700 KB chunk size keeps each bound BLOB statement comfortably below
 * Cloudflare D1's 1 MB SQL statement ceiling when R2 is not bound.
 */
const D1_CHUNK_SIZE = 700 * 1024;

export interface DicomStorageLocation {
  backend: 'r2' | 'd1_chunks';
  storageKey: string;
}

export function resolveDicomStorageLocation(
  env: Env,
  studyId: string,
  fileId: string,
  filename: string
): DicomStorageLocation {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `studies/${studyId}/${fileId}_${safeName}`;
  return {
    backend: env.DICOM_BUCKET ? 'r2' : 'd1_chunks',
    storageKey,
  };
}

/**
 * Persists the binary DICOM payload. Note: When using `d1_chunks`, the parent
 * `study_files` record must be inserted first to satisfy the foreign key constraint.
 */
export async function saveDicomBinary(
  env: Env,
  fileId: string,
  location: DicomStorageLocation,
  bytes: Uint8Array
): Promise<void> {
  if (location.backend === 'r2' && env.DICOM_BUCKET) {
    const exactBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    await env.DICOM_BUCKET.put(location.storageKey, exactBuffer, {
      httpMetadata: {
        contentType: 'application/dicom',
      },
    });
    return;
  }

  const totalChunks = Math.max(1, Math.ceil(bytes.byteLength / D1_CHUNK_SIZE));
  for (let idx = 0; idx < totalChunks; idx++) {
    const start = idx * D1_CHUNK_SIZE;
    const end = Math.min(bytes.byteLength, start + D1_CHUNK_SIZE);
    const slice = bytes.slice(start, end);
    const chunkBuffer = slice.buffer.slice(
      slice.byteOffset,
      slice.byteOffset + slice.byteLength
    ) as ArrayBuffer;

    await env.DB.prepare(
      'INSERT OR REPLACE INTO file_chunks (file_id, chunk_index, data) VALUES (?1, ?2, ?3)'
    )
      .bind(fileId, idx, chunkBuffer)
      .run();
  }
}

export async function loadDicomBinary(
  env: Env,
  fileId: string,
  backend: 'r2' | 'd1_chunks',
  storageKey: string
): Promise<Uint8Array | null> {
  if (backend === 'r2' && env.DICOM_BUCKET) {
    const obj = await env.DICOM_BUCKET.get(storageKey);
    if (!obj) return null;
    const buf = await obj.arrayBuffer();
    return new Uint8Array(buf);
  }

  const rows = await env.DB.prepare(
    'SELECT chunk_index, data FROM file_chunks WHERE file_id = ?1 ORDER BY chunk_index ASC'
  )
    .bind(fileId)
    .all<{ chunk_index: number; data: ArrayBuffer | Uint8Array | number[] }>();

  if (!rows.results || rows.results.length === 0) {
    return null;
  }

  const parts: Uint8Array[] = rows.results.map((row) => {
    if (row.data instanceof Uint8Array) {
      return row.data;
    }
    if (row.data instanceof ArrayBuffer) {
      return new Uint8Array(row.data);
    }
    if (ArrayBuffer.isView(row.data)) {
      const view = row.data as ArrayBufferView;
      return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    if (Array.isArray(row.data)) {
      return new Uint8Array(row.data);
    }
    return new Uint8Array(0);
  });

  const totalLength = parts.reduce((acc, part) => acc + part.byteLength, 0);
  const assembled = new Uint8Array(totalLength);
  let cursor = 0;
  for (const part of parts) {
    assembled.set(part, cursor);
    cursor += part.byteLength;
  }
  return assembled;
}
