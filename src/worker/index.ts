import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type {
  AuditLogRecord,
  DashboardStats,
  DiagnosticReportRecord,
  DicomModality,
  DicomTagEntry,
  ReportSeverity,
  StudyDetail,
  StudyFileRecord,
  StudyPriority,
  StudyStatus,
  StudySummary,
  UserProfile,
  UserRole,
} from '../shared/types';
import { parseDicomBytes } from '../shared/dicom/dicmParser';
import { buildZipArchive } from '../shared/dicom/zipBuilder';
import {
  generateAccessionNumber,
  generateSessionToken,
  hashPassword,
  sha256Hex,
  verifyPassword,
} from './crypto';
import type { Env, Variables } from './env';
import { ensureDatabaseInitialized } from './seed';
import { loadDicomBinary, resolveDicomStorageLocation, saveDicomBinary } from './storage';

const SESSION_COOKIE_NAME = 'telemed_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

interface DbUserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  institution_name: string | null;
  clues_code: string | null;
  medical_license: string | null;
  specialty: string | null;
  phone: string | null;
  created_at: string;
}

function mapUserProfile(row: DbUserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    institutionName: row.institution_name,
    cluesCode: row.clues_code,
    medicalLicense: row.medical_license,
    specialty: row.specialty,
    phone: row.phone,
    createdAt: row.created_at,
  };
}

async function logAuditEvent(
  db: D1Database,
  user: UserProfile | null,
  action: string,
  studyId: string | null,
  details: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, study_id, details, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    )
    .bind(
      crypto.randomUUID(),
      user?.id ?? null,
      user ? user.institutionName || user.fullName : 'Sistema',
      user?.role ?? null,
      action,
      studyId,
      details,
      new Date().toISOString()
    )
    .run();
}

function canAccessStudy(
  user: UserProfile,
  study: { uploaded_by_user_id: string; patient_user_id: string | null; patient_email?: string | null }
): boolean {
  if (user.role === 'specialist') return true;
  if (study.uploaded_by_user_id === user.id) return true;
  if (study.patient_user_id && study.patient_user_id === user.id) return true;
  if (study.patient_email && study.patient_email.toLowerCase() === user.email.toLowerCase()) {
    return true;
  }
  return false;
}

// Middleware: initialize schema/seed and resolve session user on /api/*
app.use('/api/*', async (c, next) => {
  await ensureDatabaseInitialized(c.env);

  const rawToken = getCookie(c, SESSION_COOKIE_NAME);
  if (!rawToken) {
    c.set('user', null);
    await next();
    return;
  }

  const tokenHash = await sha256Hex(rawToken);
  const nowIso = new Date().toISOString();
  const row = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1 AND s.expires_at > ?2`
  )
    .bind(tokenHash, nowIso)
    .first<DbUserRow>();

  c.set('user', row ? mapUserProfile(row) : null);
  await next();
});

app.get('/api/health', (c) => {
  return c.json({
    ok: true,
    service: 'telemedicina-dicom-platform',
    storageBackend: c.env.DICOM_BUCKET ? 'cloudflare_r2' : 'cloudflare_d1_chunks',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/auth/me', (c) => {
  return c.json({ user: c.get('user') });
});

app.post('/api/auth/register', async (c) => {
  const body = await c.req.json<{
    email?: string;
    password?: string;
    fullName?: string;
    role?: UserRole;
    institutionName?: string;
    cluesCode?: string;
    medicalLicense?: string;
    specialty?: string;
    phone?: string;
  }>();

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const fullName = (body.fullName ?? '').trim();
  const role = body.role;

  if (!email || !email.includes('@')) {
    return c.json({ error: 'Ingrese un correo electrónico válido.' }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);
  }
  if (!fullName) {
    return c.json({ error: 'El nombre completo del responsable o usuario es obligatorio.' }, 400);
  }
  if (role !== 'patient' && role !== 'clinic' && role !== 'specialist') {
    return c.json({ error: 'Seleccione un tipo de cuenta válido.' }, 400);
  }
  if (role === 'clinic' && !(body.institutionName ?? '').trim()) {
    return c.json({ error: 'El nombre del hospital o clínica es obligatorio.' }, 400);
  }
  if (role === 'specialist' && !(body.medicalLicense ?? '').trim()) {
    return c.json({ error: 'La cédula profesional del especialista es obligatoria.' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?1')
    .bind(email)
    .first<{ id: string }>();
  if (existing) {
    return c.json({ error: 'Ya existe una cuenta registrada con este correo electrónico.' }, 409);
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(
    `INSERT INTO users (
      id, email, password_hash, full_name, role, institution_name,
      clues_code, medical_license, specialty, phone, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
  )
    .bind(
      userId,
      email,
      passwordHash,
      fullName,
      role,
      role === 'clinic' ? (body.institutionName ?? '').trim() : null,
      role === 'clinic' ? (body.cluesCode ?? '').trim() || null : null,
      role === 'specialist' ? (body.medicalLicense ?? '').trim() : null,
      role === 'specialist'
        ? (body.specialty ?? '').trim() || 'Radiología e Imagen Diagnóstica'
        : null,
      (body.phone ?? '').trim() || null,
      now
    )
    .run();

  // Link any previously clinic-uploaded studies matching this patient's email
  if (role === 'patient') {
    await c.env.DB.prepare(
      'UPDATE studies SET patient_user_id = ?1 WHERE LOWER(patient_email) = ?2 AND patient_user_id IS NULL'
    )
      .bind(userId, email)
      .run();
  }

  const rawToken = generateSessionToken();
  const tokenHash = await sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)'
  )
    .bind(tokenHash, userId, expiresAt, now)
    .run();

  const isSecure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  const userRow = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1')
    .bind(userId)
    .first<DbUserRow>();

  return c.json({ user: userRow ? mapUserProfile(userRow) : null }, 201);
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';

  if (!email || !password) {
    return c.json({ error: 'Ingrese su correo electrónico y contraseña.' }, 400);
  }

  const userRow = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?1')
    .bind(email)
    .first<DbUserRow>();

  if (!userRow) {
    return c.json({ error: 'Credenciales inválidas. Verifique su correo y contraseña.' }, 401);
  }

  const valid = await verifyPassword(password, userRow.password_hash);
  if (!valid) {
    return c.json({ error: 'Credenciales inválidas. Verifique su correo y contraseña.' }, 401);
  }

  const rawToken = generateSessionToken();
  const tokenHash = await sha256Hex(rawToken);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await c.env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)'
  )
    .bind(tokenHash, userRow.id, expiresAt, now)
    .run();

  const isSecure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return c.json({ user: mapUserProfile(userRow) });
});

app.post('/api/auth/logout', async (c) => {
  const rawToken = getCookie(c, SESSION_COOKIE_NAME);
  if (rawToken) {
    const tokenHash = await sha256Hex(rawToken);
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?1').bind(tokenHash).run();
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
  return c.json({ ok: true });
});

app.get('/api/stats', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autenticado.' }, 401);

  let whereClause = '';
  const params: string[] = [];

  if (user.role === 'patient') {
    whereClause =
      'WHERE (uploaded_by_user_id = ?1 OR patient_user_id = ?1 OR LOWER(patient_email) = ?2)';
    params.push(user.id, user.email.toLowerCase());
  } else if (user.role === 'clinic') {
    whereClause = 'WHERE uploaded_by_user_id = ?1';
    params.push(user.id);
  }

  const row = await c.env.DB.prepare(
    `SELECT
      COUNT(*) as total_studies,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_studies,
      SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) as in_review_studies,
      SUM(CASE WHEN status = 'diagnosed' THEN 1 ELSE 0 END) as diagnosed_studies,
      SUM(CASE WHEN priority IN ('urgent', 'stat') AND status != 'diagnosed' THEN 1 ELSE 0 END) as urgent_studies,
      COALESCE(SUM(total_bytes), 0) as total_bytes
     FROM studies ${whereClause}`
  )
    .bind(...params)
    .first<{
      total_studies: number;
      pending_studies: number;
      in_review_studies: number;
      diagnosed_studies: number;
      urgent_studies: number;
      total_bytes: number;
    }>();

  const stats: DashboardStats = {
    totalStudies: Number(row?.total_studies ?? 0),
    pendingStudies: Number(row?.pending_studies ?? 0),
    inReviewStudies: Number(row?.in_review_studies ?? 0),
    diagnosedStudies: Number(row?.diagnosed_studies ?? 0),
    urgentOrStatStudies: Number(row?.urgent_studies ?? 0),
    totalBytesStored: Number(row?.total_bytes ?? 0),
  };

  return c.json({ stats });
});

app.get('/api/studies', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autenticado.' }, 401);

  const modalityFilter = c.req.query('modality') ?? '';
  const statusFilter = c.req.query('status') ?? '';
  const priorityFilter = c.req.query('priority') ?? '';
  const searchQuery = (c.req.query('q') ?? '').trim().toLowerCase();

  const conditions: string[] = [];
  const binds: unknown[] = [];

  if (user.role === 'patient') {
    conditions.push(
      `(s.uploaded_by_user_id = ? OR s.patient_user_id = ? OR LOWER(s.patient_email) = ?)`
    );
    binds.push(user.id, user.id, user.email.toLowerCase());
  } else if (user.role === 'clinic') {
    conditions.push(`s.uploaded_by_user_id = ?`);
    binds.push(user.id);
  }

  if (modalityFilter && modalityFilter !== 'ALL') {
    conditions.push(`s.modality = ?`);
    binds.push(modalityFilter);
  }
  if (statusFilter && statusFilter !== 'ALL') {
    conditions.push(`s.status = ?`);
    binds.push(statusFilter);
  }
  if (priorityFilter && priorityFilter !== 'ALL') {
    conditions.push(`s.priority = ?`);
    binds.push(priorityFilter);
  }
  if (searchQuery) {
    conditions.push(
      `(LOWER(s.patient_name) LIKE ? OR LOWER(s.accession_number) LIKE ? OR LOWER(s.patient_identifier) LIKE ? OR LOWER(s.body_part) LIKE ?)`
    );
    const pattern = `%${searchQuery}%`;
    binds.push(pattern, pattern, pattern, pattern);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      s.*,
      u.full_name AS uploader_full_name,
      u.institution_name AS uploader_institution,
      u.role AS uploader_role,
      dr.id AS report_id,
      dr.severity_level AS report_severity,
      sp.full_name AS specialist_name
    FROM studies s
    JOIN users u ON u.id = s.uploaded_by_user_id
    LEFT JOIN diagnostic_reports dr ON dr.study_id = s.id
    LEFT JOIN users sp ON sp.id = dr.specialist_user_id
    ${whereSql}
    ORDER BY
      CASE s.priority WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END ASC,
      s.created_at DESC
  `;

  const result = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all<{
      id: string;
      accession_number: string;
      uploaded_by_user_id: string;
      uploader_full_name: string;
      uploader_institution: string | null;
      uploader_role: UserRole;
      patient_user_id: string | null;
      patient_email: string | null;
      patient_name: string;
      patient_identifier: string;
      patient_birth_date: string | null;
      patient_sex: string | null;
      modality: DicomModality;
      body_part: string;
      study_date: string;
      study_instance_uid: string | null;
      priority: StudyPriority;
      status: StudyStatus;
      clinical_indication: string;
      origin_institution: string | null;
      is_anonymized: number;
      total_files: number;
      total_bytes: number;
      report_id: string | null;
      report_severity: ReportSeverity | null;
      specialist_name: string | null;
      created_at: string;
      updated_at: string;
    }>();

  const studies: StudySummary[] = (result.results ?? []).map((r) => ({
    id: r.id,
    accessionNumber: r.accession_number,
    uploadedByUserId: r.uploaded_by_user_id,
    uploaderName: r.uploader_institution || r.uploader_full_name,
    uploaderRole: r.uploader_role,
    patientUserId: r.patient_user_id,
    patientEmail: r.patient_email,
    patientName: r.patient_name,
    patientIdentifier: r.patient_identifier,
    patientBirthDate: r.patient_birth_date,
    patientSex: r.patient_sex,
    modality: r.modality,
    bodyPart: r.body_part,
    studyDate: r.study_date,
    studyInstanceUid: r.study_instance_uid,
    priority: r.priority,
    status: r.status,
    clinicalIndication: r.clinical_indication,
    originInstitution: r.origin_institution,
    isAnonymized: Boolean(r.is_anonymized),
    totalFiles: Number(r.total_files),
    totalBytes: Number(r.total_bytes),
    hasReport: Boolean(r.report_id),
    specialistName: r.specialist_name,
    severityLevel: r.report_severity,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return c.json({ studies });
});

app.post('/api/studies', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autenticado.' }, 401);
  if (user.role !== 'patient' && user.role !== 'clinic') {
    return c.json(
      { error: 'Permiso denegado: únicamente Pacientes y Clínicas/Hospitales pueden cargar estudios.' },
      403
    );
  }

  const body = await c.req.json<{
    patientName?: string;
    patientIdentifier?: string;
    patientEmail?: string;
    patientBirthDate?: string;
    patientSex?: string;
    modality?: DicomModality;
    bodyPart?: string;
    studyDate?: string;
    studyInstanceUid?: string;
    priority?: StudyPriority;
    clinicalIndication?: string;
    isAnonymized?: boolean;
  }>();

  const patientName =
    user.role === 'patient' && !body.isAnonymized
      ? (body.patientName ?? '').trim() || user.fullName
      : (body.patientName ?? '').trim();

  const patientIdentifier = (body.patientIdentifier ?? '').trim() || `ID-${Date.now().toString().slice(-6)}`;
  const clinicalIndication = (body.clinicalIndication ?? '').trim();

  if (!patientName) {
    return c.json({ error: 'El nombre o identificador del paciente es obligatorio.' }, 400);
  }
  if (!clinicalIndication) {
    return c.json({ error: 'Describa el motivo clínico o sintomatología del estudio.' }, 400);
  }

  const modality: DicomModality = body.modality ?? 'OT';
  const priority: StudyPriority =
    body.priority === 'stat' || body.priority === 'urgent' ? body.priority : 'routine';

  let linkedPatientUserId: string | null = user.role === 'patient' ? user.id : null;
  const normalizedPatientEmail =
    user.role === 'patient'
      ? user.email.toLowerCase()
      : (body.patientEmail ?? '').trim().toLowerCase() || null;

  if (!linkedPatientUserId && normalizedPatientEmail) {
    const foundPatient = await c.env.DB.prepare(
      `SELECT id FROM users WHERE email = ?1 AND role = 'patient'`
    )
      .bind(normalizedPatientEmail)
      .first<{ id: string }>();
    if (foundPatient) {
      linkedPatientUserId = foundPatient.id;
    }
  }

  const studyId = crypto.randomUUID();
  const accessionNumber = generateAccessionNumber();
  const now = new Date().toISOString();
  const originInstitution =
    user.role === 'clinic'
      ? user.institutionName || user.fullName
      : 'Carga Directa del Paciente';

  await c.env.DB.prepare(
    `INSERT INTO studies (
      id, accession_number, uploaded_by_user_id, patient_user_id, patient_email,
      patient_name, patient_identifier, patient_birth_date, patient_sex,
      modality, body_part, study_date, study_instance_uid, priority, status,
      clinical_indication, origin_institution, is_anonymized, total_files, total_bytes,
      created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 'pending', ?15, ?16, ?17, 0, 0, ?18, ?18)`
  )
    .bind(
      studyId,
      accessionNumber,
      user.id,
      linkedPatientUserId,
      normalizedPatientEmail,
      patientName,
      patientIdentifier,
      (body.patientBirthDate ?? '').trim() || null,
      (body.patientSex ?? '').trim() || null,
      modality,
      (body.bodyPart ?? '').trim() || 'Región General',
      (body.studyDate ?? '').trim() || now.slice(0, 10),
      (body.studyInstanceUid ?? '').trim() || null,
      priority,
      clinicalIndication,
      originInstitution,
      body.isAnonymized ? 1 : 0,
      now
    )
    .run();

  await logAuditEvent(
    c.env.DB,
    user,
    'STUDY_CREATED',
    studyId,
    `Expediente de estudio creado (${accessionNumber} - Modalidad ${modality})`
  );

  return c.json({ studyId, accessionNumber }, 201);
});

app.post('/api/studies/:id/files', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autenticado.' }, 401);

  const studyId = c.req.param('id');
  const study = await c.env.DB.prepare(
    'SELECT id, uploaded_by_user_id, accession_number FROM studies WHERE id = ?1'
  )
    .bind(studyId)
    .first<{ id: string; uploaded_by_user_id: string; accession_number: string }>();

  if (!study) {
    return c.json({ error: 'Estudio no encontrado.' }, 404);
  }
  if (study.uploaded_by_user_id !== user.id) {
    return c.json({ error: 'Solo el autor de la carga puede adjuntar archivos DICOM a este estudio.' }, 403);
  }

  let filename = c.req.header('X-Filename')
    ? decodeURIComponent(c.req.header('X-Filename')!)
    : 'estudio.dcm';
  let fileBytes: Uint8Array;

  const contentType = c.req.header('Content-Type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const entry = formData.get('file');
    if (!(entry instanceof File)) {
      return c.json({ error: 'No se recibió ningún archivo DICOM en la petición.' }, 400);
    }
    filename = entry.name || filename;
    fileBytes = new Uint8Array(await entry.arrayBuffer());
  } else {
    fileBytes = new Uint8Array(await c.req.arrayBuffer());
  }

  if (fileBytes.byteLength < 132) {
    return c.json({ error: 'El archivo es demasiado pequeño para ser un objeto DICOM válido.' }, 400);
  }

  let parsedMeta;
  try {
    parsedMeta = parseDicomBytes(fileBytes).metadata;
  } catch (err) {
    return c.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'El archivo subido no es un estudio DICOM válido.',
      },
      400
    );
  }

  const checksum = await sha256Hex(fileBytes);
  const fileId = crypto.randomUUID();
  const now = new Date().toISOString();
  const location = resolveDicomStorageLocation(c.env, studyId, fileId, filename);

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO study_files (
        id, study_id, filename, file_size, sha256, storage_backend, storage_key,
        sop_instance_uid, series_instance_uid, instance_number, rows, columns,
        bits_allocated, window_center, window_width, rescale_slope, rescale_intercept,
        photometric_interpretation, transfer_syntax_uid, metadata_json, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`
    ).bind(
      fileId,
      studyId,
      filename,
      fileBytes.byteLength,
      checksum,
      location.backend,
      location.storageKey,
      parsedMeta.sopInstanceUid,
      parsedMeta.seriesInstanceUid,
      parsedMeta.instanceNumber,
      parsedMeta.rows,
      parsedMeta.columns,
      parsedMeta.bitsAllocated,
      parsedMeta.windowCenter,
      parsedMeta.windowWidth,
      parsedMeta.rescaleSlope,
      parsedMeta.rescaleIntercept,
      parsedMeta.photometricInterpretation,
      parsedMeta.transferSyntaxUid,
      JSON.stringify(parsedMeta.tags),
      now
    ),
    c.env.DB.prepare(
      `UPDATE studies
       SET total_files = total_files + 1,
           total_bytes = total_bytes + ?1,
           updated_at = ?2
       WHERE id = ?3`
    ).bind(fileBytes.byteLength, now, studyId),
  ]);

  await saveDicomBinary(c.env, fileId, location, fileBytes);

  await logAuditEvent(
    c.env.DB,
    user,
    'STUDY_UPLOAD',
    studyId,
    `Archivo DICOM almacenado (${filename}, ${(fileBytes.byteLength / 1024).toFixed(1)} KB, SHA-256: ${checksum.slice(0, 12)}...)`
  );

  return c.json(
    {
      fileId,
      filename,
      fileSize: fileBytes.byteLength,
      sha256: checksum,
      storageBackend: location.backend,
    },
    201
  );
});

app.get('/api/studies/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autenticado.' }, 401);

  const studyId = c.req.param('id');
  const row = await c.env.DB.prepare(
    `SELECT
      s.*,
      u.full_name AS uploader_full_name,
      u.institution_name AS uploader_institution,
      u.role AS uploader_role
     FROM studies s
     JOIN users u ON u.id = s.uploaded_by_user_id
     WHERE s.id = ?1`
  )
    .bind(studyId)
    .first<{
      id: string;
      accession_number: string;
      uploaded_by_user_id: string;
      uploader_full_name: string;
      uploader_institution: string | null;
      uploader_role: UserRole;
      patient_user_id: string | null;
      patient_email: string | null;
      patient_name: string;
      patient_identifier: string;
      patient_birth_date: string | null;
      patient_sex: string | null;
      modality: DicomModality;
      body_part: string;
      study_date: string;
      study_instance_uid: string | null;
      priority: StudyPriority;
      status: StudyStatus;
      clinical_indication: string;
      origin_institution: string | null;
      is_anonymized: number;
      total_files: number;
      total_bytes: number;
      created_at: string;
      updated_at: string;
    }>();

  if (!row) {
    return c.json({ error: 'Estudio no encontrado.' }, 404);
  }
  if (!canAccessStudy(user, row)) {
    return c.json({ error: 'No cuenta con autorización para consultar este estudio.' }, 403);
  }

  const fileRows = await c.env.DB.prepare(
    `SELECT * FROM study_files WHERE study_id = ?1 ORDER BY instance_number ASC, created_at ASC`
  )
    .bind(studyId)
    .all<{
      id: string;
      study_id: string;
      filename: string;
      file_size: number;
      sha256: string;
      sop_instance_uid: string | null;
      series_instance_uid: string | null;
      instance_number: number;
      rows: number | null;
      columns: number | null;
      bits_allocated: number | null;
      window_center: number | null;
      window_width: number | null;
      rescale_slope: number | null;
      rescale_intercept: number | null;
      photometric_interpretation: string | null;
      transfer_syntax_uid: string | null;
      metadata_json: string | null;
      created_at: string;
    }>();

  const files: StudyFileRecord[] = (fileRows.results ?? []).map((f) => {
    let tags: DicomTagEntry[] = [];
    if (f.metadata_json) {
      try {
        tags = JSON.parse(f.metadata_json) as DicomTagEntry[];
      } catch {
        tags = [];
      }
    }
    return {
      id: f.id,
      studyId: f.study_id,
      filename: f.filename,
      fileSize: Number(f.file_size),
      sha256: f.sha256,
      sopInstanceUid: f.sop_instance_uid,
      seriesInstanceUid: f.series_instance_uid,
      instanceNumber: Number(f.instance_number),
      rows: f.rows,
      columns: f.columns,
      bitsAllocated: f.bits_allocated,
      windowCenter: f.window_center,
      windowWidth: f.window_width,
      rescaleSlope: f.rescale_slope,
      rescaleIntercept: f.rescale_intercept,
      photometricInterpretation: f.photometric_interpretation,
      transferSyntaxUid: f.transfer_syntax_uid,
      tags,
      createdAt: f.created_at,
    };
  });

  const reportRow = await c.env.DB.prepare(
    `SELECT dr.*, u.full_name AS specialist_name, u.medical_license, u.specialty
     FROM diagnostic_reports dr
     JOIN users u ON u.id = dr.specialist_user_id
     WHERE dr.study_id = ?1`
  )
    .bind(studyId)
    .first<{
      id: string;
      study_id: string;
      specialist_user_id: string;
      specialist_name: string;
      medical_license: string | null;
      specialty: string | null;
      technique: string;
      findings: string;
      impression: string;
      recommendations: string;
      severity_level: ReportSeverity;
      signed_at: string;
      updated_at: string;
    }>();

  const report: DiagnosticReportRecord | null = reportRow
    ? {
        id: reportRow.id,
        studyId: reportRow.study_id,
        specialistUserId: reportRow.specialist_user_id,
        specialistName: reportRow.specialist_name,
        specialistLicense: reportRow.medical_license,
        specialistSpecialty: reportRow.specialty,
        technique: reportRow.technique,
        findings: reportRow.findings,
        impression: reportRow.impression,
        recommendations: reportRow.recommendations,
        severityLevel: reportRow.severity_level,
        signedAt: reportRow.signed_at,
        updatedAt: reportRow.updated_at,
      }
    : null;

  const auditRows = await c.env.DB.prepare(
    `SELECT * FROM audit_logs WHERE study_id = ?1 ORDER BY created_at DESC LIMIT 30`
  )
    .bind(studyId)
    .all<{
      id: string;
      actor_user_id: string | null;
      actor_name: string | null;
      actor_role: string | null;
      action: string;
      study_id: string | null;
      details: string | null;
      created_at: string;
    }>();

  const auditLogs: AuditLogRecord[] = (auditRows.results ?? []).map((a) => ({
    id: a.id,
    actorUserId: a.actor_user_id,
    actorName: a.actor_name,
    actorRole: a.actor_role,
    action: a.action,
    studyId: a.study_id,
    details: a.details,
    createdAt: a.created_at,
  }));

  const detail: StudyDetail = {
    id: row.id,
    accessionNumber: row.accession_number,
    uploadedByUserId: row.uploaded_by_user_id,
    uploaderName: row.uploader_institution || row.uploader_full_name,
    uploaderRole: row.uploader_role,
    patientUserId: row.patient_user_id,
    patientEmail: row.patient_email,
    patientName: row.patient_name,
    patientIdentifier: row.patient_identifier,
    patientBirthDate: row.patient_birth_date,
    patientSex: row.patient_sex,
    modality: row.modality,
    bodyPart: row.body_part,
    studyDate: row.study_date,
    studyInstanceUid: row.study_instance_uid,
    priority: row.priority,
    status: row.status,
    clinicalIndication: row.clinical_indication,
    originInstitution: row.origin_institution,
    isAnonymized: Boolean(row.is_anonymized),
    totalFiles: Number(row.total_files),
    totalBytes: Number(row.total_bytes),
    hasReport: Boolean(report),
    specialistName: report?.specialistName ?? null,
    severityLevel: report?.severityLevel ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    files,
    report,
    auditLogs,
  };

  return c.json({ study: detail });
});

app.get('/api/studies/:id/files/:fileId/download', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autenticado.' }, 401);

  const studyId = c.req.param('id');
  const fileId = c.req.param('fileId');
  const isInlinePreview = c.req.query('inline') === '1';

  const study = await c.env.DB.prepare(
    'SELECT id, uploaded_by_user_id, patient_user_id, patient_email, accession_number FROM studies WHERE id = ?1'
  )
    .bind(studyId)
    .first<{
      id: string;
      uploaded_by_user_id: string;
      patient_user_id: string | null;
      patient_email: string | null;
      accession_number: string;
    }>();

  if (!study) return c.json({ error: 'Estudio no encontrado.' }, 404);
  if (!canAccessStudy(user, study)) {
    return c.json({ error: 'No autorizado para descargar este archivo DICOM.' }, 403);
  }

  const fileRow = await c.env.DB.prepare(
    'SELECT * FROM study_files WHERE id = ?1 AND study_id = ?2'
  )
    .bind(fileId, studyId)
    .first<{
      id: string;
      filename: string;
      sha256: string;
      storage_backend: 'r2' | 'd1_chunks';
      storage_key: string;
    }>();

  if (!fileRow) return c.json({ error: 'Archivo DICOM no encontrado.' }, 404);

  const binary = await loadDicomBinary(
    c.env,
    fileRow.id,
    fileRow.storage_backend,
    fileRow.storage_key
  );
  if (!binary) {
    return c.json({ error: 'El objeto binario DICOM no pudo recuperarse del almacenamiento.' }, 404);
  }

  if (!isInlinePreview) {
    await logAuditEvent(
      c.env.DB,
      user,
      'DICOM_DOWNLOAD',
      studyId,
      `Descarga íntegra de objeto DICOM (${fileRow.filename})`
    );
  }

  const safeFilename = fileRow.filename.replace(/["\r\n]/g, '_');
  const disposition = isInlinePreview
    ? `inline; filename="${safeFilename}"`
    : `attachment; filename="${safeFilename}"`;

  const responseBuffer = binary.buffer.slice(
    binary.byteOffset,
    binary.byteOffset + binary.byteLength
  ) as ArrayBuffer;

  return new Response(responseBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/dicom',
      'Content-Disposition': disposition,
      'Content-Length': String(binary.byteLength),
      'X-Content-SHA256': fileRow.sha256,
      'Cache-Control': 'private, max-age=300',
    },
  });
});

app.get('/api/studies/:id/download-zip', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autenticado.' }, 401);

  const studyId = c.req.param('id');
  const study = await c.env.DB.prepare(
    'SELECT * FROM studies WHERE id = ?1'
  )
    .bind(studyId)
    .first<{
      id: string;
      accession_number: string;
      uploaded_by_user_id: string;
      patient_user_id: string | null;
      patient_email: string | null;
      patient_name: string;
      modality: string;
      study_date: string;
    }>();

  if (!study) return c.json({ error: 'Estudio no encontrado.' }, 404);
  if (!canAccessStudy(user, study)) {
    return c.json({ error: 'No autorizado para descargar este estudio.' }, 403);
  }

  const fileRows = await c.env.DB.prepare(
    'SELECT * FROM study_files WHERE study_id = ?1 ORDER BY instance_number ASC'
  )
    .bind(studyId)
    .all<{
      id: string;
      filename: string;
      file_size: number;
      sha256: string;
      storage_backend: 'r2' | 'd1_chunks';
      storage_key: string;
    }>();

  const files = fileRows.results ?? [];
  if (files.length === 0) {
    return c.json({ error: 'Este estudio no contiene archivos DICOM para empaquetar.' }, 404);
  }

  const zipEntries = [];
  const manifestLines = [
    '====================================================================',
    'TELEMED DICOM - MANIFIESTO DE INTEGRIDAD DE ESTUDIO DE IMAGEN MEDICA',
    '====================================================================',
    `Numero de Acceso : ${study.accession_number}`,
    `Paciente         : ${study.patient_name}`,
    `Modalidad DICOM  : ${study.modality}`,
    `Fecha Estudio    : ${study.study_date}`,
    `Descargado por   : ${user.fullName} (${user.role})`,
    `Fecha Descarga   : ${new Date().toISOString()}`,
    '',
    'SUMAS DE VERIFICACION CRIPTOGRAFICA (SHA-256):',
  ];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const bytes = await loadDicomBinary(c.env, f.id, f.storage_backend, f.storage_key);
    if (!bytes) continue;

    const entryName = `${study.accession_number}/${String(i + 1).padStart(3, '0')}_${f.filename}`;
    zipEntries.push({
      filename: entryName,
      data: bytes,
    });
    manifestLines.push(`${f.sha256}  ${entryName} (${f.file_size} bytes)`);
  }

  manifestLines.push('');
  manifestLines.push(
    'Los archivos .dcm incluidos conservan su estructura binaria original NEMA PS3.10 sin perdida.'
  );

  zipEntries.push({
    filename: `${study.accession_number}/MANIFIESTO_SHA256.txt`,
    data: new TextEncoder().encode(manifestLines.join('\r\n')),
  });

  const zipBytes = buildZipArchive(zipEntries);

  await logAuditEvent(
    c.env.DB,
    user,
    'SERIES_ZIP_DOWNLOAD',
    studyId,
    `Descarga de paquete completo ZIP (${files.length} cortes DICOM - ${study.accession_number})`
  );

  const zipBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength
  ) as ArrayBuffer;

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${study.accession_number}_${study.modality}_DICOM.zip"`,
      'Content-Length': String(zipBytes.byteLength),
    },
  });
});

app.post('/api/studies/:id/claim', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autenticado.' }, 401);
  if (user.role !== 'specialist') {
    return c.json({ error: 'Solo médicos especialistas pueden tomar estudios en revisión.' }, 403);
  }

  const studyId = c.req.param('id');
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `UPDATE studies SET status = 'in_review', updated_at = ?1 WHERE id = ?2 AND status = 'pending'`
  )
    .bind(now, studyId)
    .run();

  await logAuditEvent(
    c.env.DB,
    user,
    'STUDY_IN_REVIEW',
    studyId,
    `Estudio asignado en revisión diagnóstica por ${user.fullName}`
  );

  return c.json({ ok: true });
});

app.post('/api/studies/:id/diagnosis', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'No autenticado.' }, 401);
  if (user.role !== 'specialist') {
    return c.json(
      { error: 'Permiso denegado: únicamente los Médicos Especialistas pueden emitir diagnósticos.' },
      403
    );
  }

  const studyId = c.req.param('id');
  const study = await c.env.DB.prepare('SELECT id, accession_number FROM studies WHERE id = ?1')
    .bind(studyId)
    .first<{ id: string; accession_number: string }>();

  if (!study) return c.json({ error: 'Estudio no encontrado.' }, 404);

  const body = await c.req.json<{
    technique?: string;
    findings?: string;
    impression?: string;
    recommendations?: string;
    severityLevel?: ReportSeverity;
  }>();

  const technique = (body.technique ?? '').trim();
  const findings = (body.findings ?? '').trim();
  const impression = (body.impression ?? '').trim();
  const recommendations = (body.recommendations ?? '').trim();
  const severity: ReportSeverity =
    body.severityLevel === 'benign' ||
    body.severityLevel === 'followup' ||
    body.severityLevel === 'critical'
      ? body.severityLevel
      : 'normal';

  if (!findings || !impression) {
    return c.json(
      { error: 'Los campos de Hallazgos Radiológicos e Impresión Diagnóstica son obligatorios.' },
      400
    );
  }

  const now = new Date().toISOString();
  const existing = await c.env.DB.prepare(
    'SELECT id FROM diagnostic_reports WHERE study_id = ?1'
  )
    .bind(studyId)
    .first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE diagnostic_reports
       SET specialist_user_id = ?1,
           technique = ?2,
           findings = ?3,
           impression = ?4,
           recommendations = ?5,
           severity_level = ?6,
           updated_at = ?7
       WHERE id = ?8`
    )
      .bind(
        user.id,
        technique || 'Protocolo estándar de evaluación teleradiológica DICOM.',
        findings,
        impression,
        recommendations || 'Correlacionar con evolución clínica.',
        severity,
        now,
        existing.id
      )
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO diagnostic_reports (
        id, study_id, specialist_user_id, technique, findings, impression,
        recommendations, severity_level, signed_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`
    )
      .bind(
        crypto.randomUUID(),
        studyId,
        user.id,
        technique || 'Protocolo estándar de evaluación teleradiológica DICOM.',
        findings,
        impression,
        recommendations || 'Correlacionar con evolución clínica.',
        severity,
        now
      )
      .run();
  }

  await c.env.DB.prepare(`UPDATE studies SET status = 'diagnosed', updated_at = ?1 WHERE id = ?2`)
    .bind(now, studyId)
    .run();

  await logAuditEvent(
    c.env.DB,
    user,
    'REPORT_SIGNED',
    studyId,
    `Dictamen diagnóstico remoto firmado por ${user.fullName} (${user.medicalLicense ?? 'Especialista'})`
  );

  return c.json({ ok: true });
});

// Serve static SPA bundle and fallback client-side routes to /index.html
app.all('*', async (c) => {
  if (!c.env.ASSETS) {
    return c.text('Static assets binding not configured.', 404);
  }
  const assetResponse = await c.env.ASSETS.fetch(c.req.raw);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }
  const indexUrl = new URL('/index.html', c.req.url);
  return c.env.ASSETS.fetch(new Request(indexUrl.toString(), c.req.raw));
});

export default app;
