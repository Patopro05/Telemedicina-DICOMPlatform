import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { generateChestCtDicom } from '../src/shared/dicom/dicmGenerator';
import { sha256Hex } from '../src/worker/crypto';
import type { Env } from '../src/worker/env';
import app from '../src/worker/index';

/**
 * Lightweight D1Database adapter backed by Node 24 native in-memory SQLite
 * to run true SQL end-to-end API integration tests.
 */
function createInMemoryD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  function normalizeValue(v: unknown): null | number | bigint | string | Uint8Array {
    if (v === undefined || v === null) return null;
    if (v instanceof ArrayBuffer) return new Uint8Array(v);
    if (ArrayBuffer.isView(v)) {
      return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    }
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v as number | bigint | string;
  }

  function makeStatement(sql: string, boundValues: unknown[] = []): D1PreparedStatement {
    return {
      bind(...values: unknown[]) {
        return makeStatement(sql, values);
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...boundValues.map(normalizeValue)) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async run() {
        const stmt = sqlite.prepare(sql);
        stmt.run(...boundValues.map(normalizeValue));
        return {
          success: true,
          meta: {} as D1Meta,
          results: [],
        };
      },
      async all<T = Record<string, unknown>>() {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...boundValues.map(normalizeValue)) as T[];
        return {
          success: true,
          meta: {} as D1Meta,
          results: rows,
        };
      },
      async raw() {
        return [];
      },
    } as unknown as D1PreparedStatement;
  }

  return {
    prepare(query: string) {
      return makeStatement(query);
    },
    async batch(statements: D1PreparedStatement[]) {
      const out = [];
      for (const st of statements) {
        out.push(await st.run());
      }
      return out;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
  } as unknown as D1Database;
}

function extractSessionCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') ?? '';
  return raw.split(';')[0] ?? '';
}

describe('End-to-End Clinical API, RBAC & Lossless DICOM Storage', () => {
  it('enforces 3-role RBAC, stores/downloads lossless .dcm with SHA-256 match, and emits remote diagnosis', async () => {
    const env: Env = {
      DB: createInMemoryD1(),
      ASSETS: {
        fetch: async () => new Response('<html></html>', { status: 200 }),
      } as unknown as Fetcher,
    };

    // 1. Health check triggers automatic schema + seed initialization
    const healthRes = await app.request('http://localhost/api/health', {}, env);
    expect(healthRes.status).toBe(200);

    // 2. Register a new Hospital/Clinic account
    const clinicRegRes = await app.request(
      'http://localhost/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'clinic',
          fullName: 'Ing. Fernando Coord',
          institutionName: 'Clínica Universitaria Norte',
          cluesCode: 'NLSSA099881',
          email: 'norte@clinica.mx',
          password: 'PasswordSeguro123!',
        }),
      },
      env
    );
    expect(clinicRegRes.status).toBe(201);
    const clinicCookie = extractSessionCookie(clinicRegRes);
    expect(clinicCookie).toContain('telemed_session=');

    // 3. Clinic creates a new Urgent CT study linked to patient@nuevo.mx
    const createStudyRes = await app.request(
      'http://localhost/api/studies',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clinicCookie,
        },
        body: JSON.stringify({
          patientName: 'María López Hernández',
          patientIdentifier: 'EXP-2026-501',
          patientEmail: 'maria@paciente.mx',
          modality: 'CT',
          bodyPart: 'Tórax',
          studyDate: '2026-11-01',
          priority: 'urgent',
          clinicalIndication: 'Control tomográfico de nódulo pulmonar.',
          isAnonymized: false,
        }),
      },
      env
    );
    expect(createStudyRes.status).toBe(201);
    const { studyId } = (await createStudyRes.json()) as { studyId: string };

    // 4. Upload real 16-bit CT .dcm binary
    const ctDicom = generateChestCtDicom(1);
    const expectedSha = await sha256Hex(ctDicom.bytes);
    const bodyBuf = ctDicom.bytes.buffer.slice(
      ctDicom.bytes.byteOffset,
      ctDicom.bytes.byteOffset + ctDicom.bytes.byteLength
    ) as ArrayBuffer;

    const uploadRes = await app.request(
      `http://localhost/api/studies/${studyId}/files`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/dicom',
          'X-Filename': encodeURIComponent(ctDicom.filename),
          Cookie: clinicCookie,
        },
        body: bodyBuf,
      },
      env
    );
    expect(uploadRes.status).toBe(201);
    const uploadedMeta = (await uploadRes.json()) as { fileId: string; sha256: string };
    expect(uploadedMeta.sha256).toBe(expectedSha);

    // 5. RBAC Check: Clinic CANNOT emit a medical diagnosis (403)
    const forbiddenDiag = await app.request(
      `http://localhost/api/studies/${studyId}/diagnosis`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: clinicCookie,
        },
        body: JSON.stringify({
          findings: 'Intento no autorizado',
          impression: 'No permitido',
        }),
      },
      env
    );
    expect(forbiddenDiag.status).toBe(403);

    // 6. Specialist logs in via pre-seeded account
    const specLogin = await app.request(
      'http://localhost/api/auth/login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'especialista@telemed.mx',
          password: 'Telemed2026!',
        }),
      },
      env
    );
    expect(specLogin.status).toBe(200);
    const specCookie = extractSessionCookie(specLogin);

    // 7. RBAC Check: Specialist CANNOT upload studies (403)
    const forbiddenUpload = await app.request(
      'http://localhost/api/studies',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: specCookie,
        },
        body: JSON.stringify({
          patientName: 'Test',
          clinicalIndication: 'Test',
        }),
      },
      env
    );
    expect(forbiddenUpload.status).toBe(403);

    // 8. Specialist downloads lossless .dcm file and verifies exact SHA-256 byte integrity
    const downloadRes = await app.request(
      `http://localhost/api/studies/${studyId}/files/${uploadedMeta.fileId}/download`,
      {
        headers: { Cookie: specCookie },
      },
      env
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get('X-Content-SHA256')).toBe(expectedSha);
    const downloadedBytes = new Uint8Array(await downloadRes.arrayBuffer());
    expect(await sha256Hex(downloadedBytes)).toBe(expectedSha);

    // 9. Specialist emits remote diagnostic report
    const emitRes = await app.request(
      `http://localhost/api/studies/${studyId}/diagnosis`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: specCookie,
        },
        body: JSON.stringify({
          technique: 'TAC de tórax simple en formato DICOM 16-bit.',
          findings: 'Nódulo pulmonar solitario bien delimitado de 14 mm en LID sin adenopatías.',
          impression: 'Nódulo pulmonar en lóbulo inferior derecho categoría Lung-RADS 4A.',
          recommendations: 'Seguimiento con PET-CT o valoración neumológica en 3 meses.',
          severityLevel: 'followup',
        }),
      },
      env
    );
    expect(emitRes.status).toBe(200);

    // 10. Patient Maria registers with maria@paciente.mx and automatically receives linked study + report!
    const mariaReg = await app.request(
      'http://localhost/api/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'patient',
          fullName: 'María López Hernández',
          email: 'maria@paciente.mx',
          password: 'MariaPassword123!',
        }),
      },
      env
    );
    expect(mariaReg.status).toBe(201);
    const mariaCookie = extractSessionCookie(mariaReg);

    const mariaDetailRes = await app.request(
      `http://localhost/api/studies/${studyId}`,
      { headers: { Cookie: mariaCookie } },
      env
    );
    expect(mariaDetailRes.status).toBe(200);
    const { study: mariaStudy } = (await mariaDetailRes.json()) as {
      study: { status: string; report: { impression: string } | null };
    };
    expect(mariaStudy.status).toBe('diagnosed');
    expect(mariaStudy.report?.impression).toContain('Lung-RADS 4A');

    // 11. DICOMweb Interoperability: QIDO-RS, STOW-RS, and WADO-RS
    // 11a. QIDO-RS: Query studies
    const qidoRes = await app.request('http://localhost/api/dicomweb/studies', {}, env);
    expect(qidoRes.status).toBe(200);
    expect(qidoRes.headers.get('content-type')).toContain('application/dicom+json');
    const qidoStudies = (await qidoRes.json()) as Array<Record<string, unknown>>;
    expect(qidoStudies.length).toBeGreaterThan(0);

    // 11b. STOW-RS: Store a new synthetic CT slice via direct DICOMweb POST
    const ctSample = generateChestCtDicom(2);
    const dicomwebCtBytes = ctSample.bytes;
    const dicomwebCtChecksum = await sha256Hex(dicomwebCtBytes);
    const stowBodyBuf = dicomwebCtBytes.buffer.slice(
      dicomwebCtBytes.byteOffset,
      dicomwebCtBytes.byteOffset + dicomwebCtBytes.byteLength
    ) as ArrayBuffer;

    const stowRes = await app.request(
      'http://localhost/api/dicomweb/studies',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/dicom',
        },
        body: stowBodyBuf,
      },
      env
    );
    expect(stowRes.status).toBe(201);
    const stowBody = (await stowRes.json()) as {
      studyInstanceUid: string;
      seriesInstanceUid: string;
      sopInstanceUid: string;
      retrieveUrl: string;
    };
    expect(stowBody.studyInstanceUid).toBeDefined();
    expect(stowBody.sopInstanceUid).toBeDefined();

    // 11c. WADO-RS: Retrieve the exact binary instance and confirm lossless byte-for-byte SHA-256 integrity
    const wadoRes = await app.request(
      `http://localhost${stowBody.retrieveUrl}`,
      {},
      env
    );
    expect(wadoRes.status).toBe(200);
    expect(wadoRes.headers.get('content-type')).toBe('application/dicom');
    const retrievedWadoBytes = new Uint8Array(await wadoRes.arrayBuffer());
    const retrievedWadoChecksum = await sha256Hex(retrievedWadoBytes);
    expect(retrievedWadoChecksum).toBe(dicomwebCtChecksum);
    expect(retrievedWadoBytes.byteLength).toBe(dicomwebCtBytes.byteLength);
  });
});
