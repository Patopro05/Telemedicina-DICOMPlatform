import type { Env } from './env';
import { hashPassword, sha256Hex } from './crypto';
import {
  generateBrainMrDicom,
  generateChestCtDicom,
  generateChestXrayDicom,
} from '../shared/dicom/dicmGenerator';
import { parseDicomBytes } from '../shared/dicom/dicmParser';
import { resolveDicomStorageLocation, saveDicomBinary } from './storage';

let initializedInIsolate = false;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('patient', 'clinic', 'specialist')),
    institution_name TEXT,
    clues_code TEXT,
    medical_license TEXT,
    specialty TEXT,
    phone TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS studies (
    id TEXT PRIMARY KEY,
    accession_number TEXT NOT NULL UNIQUE,
    uploaded_by_user_id TEXT NOT NULL REFERENCES users(id),
    patient_user_id TEXT REFERENCES users(id),
    patient_email TEXT,
    patient_name TEXT NOT NULL,
    patient_identifier TEXT NOT NULL,
    patient_birth_date TEXT,
    patient_sex TEXT,
    modality TEXT NOT NULL,
    body_part TEXT NOT NULL,
    study_date TEXT NOT NULL,
    study_instance_uid TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('routine', 'urgent', 'stat')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_review', 'diagnosed')),
    clinical_indication TEXT NOT NULL,
    origin_institution TEXT,
    is_anonymized INTEGER NOT NULL DEFAULT 0,
    total_files INTEGER NOT NULL DEFAULT 0,
    total_bytes INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_studies_uploaded_by ON studies(uploaded_by_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_studies_patient_user ON studies(patient_user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_studies_status ON studies(status)`,
  `CREATE INDEX IF NOT EXISTS idx_studies_modality ON studies(modality)`,
  `CREATE TABLE IF NOT EXISTS study_files (
    id TEXT PRIMARY KEY,
    study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    storage_backend TEXT NOT NULL CHECK (storage_backend IN ('r2', 'd1_chunks')),
    storage_key TEXT NOT NULL,
    sop_instance_uid TEXT,
    series_instance_uid TEXT,
    instance_number INTEGER NOT NULL DEFAULT 1,
    rows INTEGER,
    columns INTEGER,
    bits_allocated INTEGER,
    window_center REAL,
    window_width REAL,
    rescale_slope REAL,
    rescale_intercept REAL,
    photometric_interpretation TEXT,
    transfer_syntax_uid TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_study_files_study ON study_files(study_id, instance_number)`,
  `CREATE TABLE IF NOT EXISTS file_chunks (
    file_id TEXT NOT NULL REFERENCES study_files(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    data BLOB NOT NULL,
    PRIMARY KEY (file_id, chunk_index)
  )`,
  `CREATE TABLE IF NOT EXISTS diagnostic_reports (
    id TEXT PRIMARY KEY,
    study_id TEXT NOT NULL UNIQUE REFERENCES studies(id) ON DELETE CASCADE,
    specialist_user_id TEXT NOT NULL REFERENCES users(id),
    technique TEXT NOT NULL,
    findings TEXT NOT NULL,
    impression TEXT NOT NULL,
    recommendations TEXT NOT NULL,
    severity_level TEXT NOT NULL CHECK (severity_level IN ('normal', 'benign', 'followup', 'critical')),
    signed_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT REFERENCES users(id),
    actor_name TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    study_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_study ON audit_logs(study_id)`,
];

async function insertSeedDicomFile(
  env: Env,
  studyId: string,
  fileId: string,
  filename: string,
  bytes: Uint8Array,
  createdAt: string
): Promise<void> {
  const parsed = parseDicomBytes(bytes);
  const meta = parsed.metadata;
  const checksum = await sha256Hex(bytes);
  const location = resolveDicomStorageLocation(env, studyId, fileId, filename);

  await env.DB.prepare(
    `INSERT INTO study_files (
      id, study_id, filename, file_size, sha256, storage_backend, storage_key,
      sop_instance_uid, series_instance_uid, instance_number, rows, columns,
      bits_allocated, window_center, window_width, rescale_slope, rescale_intercept,
      photometric_interpretation, transfer_syntax_uid, metadata_json, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`
  )
    .bind(
      fileId,
      studyId,
      filename,
      bytes.byteLength,
      checksum,
      location.backend,
      location.storageKey,
      meta.sopInstanceUid,
      meta.seriesInstanceUid,
      meta.instanceNumber,
      meta.rows,
      meta.columns,
      meta.bitsAllocated,
      meta.windowCenter,
      meta.windowWidth,
      meta.rescaleSlope,
      meta.rescaleIntercept,
      meta.photometricInterpretation,
      meta.transferSyntaxUid,
      JSON.stringify(meta.tags),
      createdAt
    )
    .run();

  await saveDicomBinary(env, fileId, location, bytes);
}

export async function ensureDatabaseInitialized(env: Env): Promise<void> {
  if (initializedInIsolate) return;

  for (const sql of SCHEMA_STATEMENTS) {
    await env.DB.prepare(sql).run();
  }

  const existing = await env.DB.prepare('SELECT COUNT(*) as total FROM users').first<{
    total: number;
  }>();

  if ((existing?.total ?? 0) > 0) {
    initializedInIsolate = true;
    return;
  }

  const now = new Date().toISOString();
  const demoPasswordHash = await hashPassword('Telemed2026!');

  const patientId = 'usr-demo-patient-01';
  const clinicId = 'usr-demo-clinic-01';
  const specialistId = 'usr-demo-specialist-01';

  // Seed 3 canonical clinical actors
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role, phone, created_at)
       VALUES (?1, ?2, ?3, ?4, 'patient', ?5, ?6)`
    ).bind(
      patientId,
      'paciente@telemed.mx',
      demoPasswordHash,
      'Carlos Mendoza Treviño',
      '+52 81 1234 5678',
      now
    ),
    env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role, institution_name, clues_code, phone, created_at)
       VALUES (?1, ?2, ?3, ?4, 'clinic', ?5, ?6, ?7, ?8)`
    ).bind(
      clinicId,
      'clinica@telemed.mx',
      demoPasswordHash,
      'Coordinación de Imagenología',
      'Hospital Regional de Telemedicina Monterrey',
      'NLSSA001842',
      '+52 81 8345 9000',
      now
    ),
    env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role, medical_license, specialty, phone, created_at)
       VALUES (?1, ?2, ?3, ?4, 'specialist', ?5, ?6, ?7, ?8)`
    ).bind(
      specialistId,
      'especialista@telemed.mx',
      demoPasswordHash,
      'Dra. Valeria Garza Elizondo',
      'CED-PROF-8941205',
      'Radiología e Imagen Diagnóstica',
      '+52 81 9988 7766',
      now
    ),
  ]);

  // Seed Study 1: Urgent Chest CT uploaded by Hospital/Clinic (Pending Diagnosis)
  const ctSample = generateChestCtDicom(1);
  const studyCtId = 'std-demo-ct-01';
  await env.DB.prepare(
    `INSERT INTO studies (
      id, accession_number, uploaded_by_user_id, patient_user_id, patient_email,
      patient_name, patient_identifier, patient_birth_date, patient_sex,
      modality, body_part, study_date, study_instance_uid, priority, status,
      clinical_indication, origin_institution, is_anonymized, total_files, total_bytes,
      created_at, updated_at
    ) VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?5, ?6, ?7, 'CT', 'Tórax', '2026-10-28', ?8, 'urgent', 'pending', ?9, ?10, 0, 1, ?11, ?12, ?12)`
  )
    .bind(
      studyCtId,
      'ACC-2026-CT01',
      clinicId,
      'Roberto Garza Martínez',
      'EXP-NL-88412',
      '1971-04-15',
      'M',
      '1.2.826.0.1.3680043.10.2026.100',
      'Tos persistente de 5 semanas y disnea de medianos esfuerzos. Descartar nódulo pulmonar solitario en lóbulo inferior derecho.',
      'Hospital Regional de Telemedicina Monterrey',
      ctSample.bytes.byteLength,
      now
    )
    .run();

  await insertSeedDicomFile(
    env,
    studyCtId,
    'fil-demo-ct-01',
    ctSample.filename,
    ctSample.bytes,
    now
  );

  // Seed Study 2: Multi-slice Brain MRI T2 Series (3 slices) uploaded by Clinic (In Review)
  const mrSlice1 = generateBrainMrDicom(1);
  const mrSlice2 = generateBrainMrDicom(2);
  const mrSlice3 = generateBrainMrDicom(3);
  const mrTotalBytes =
    mrSlice1.bytes.byteLength + mrSlice2.bytes.byteLength + mrSlice3.bytes.byteLength;
  const studyMrId = 'std-demo-mr-02';

  await env.DB.prepare(
    `INSERT INTO studies (
      id, accession_number, uploaded_by_user_id, patient_user_id, patient_email,
      patient_name, patient_identifier, patient_birth_date, patient_sex,
      modality, body_part, study_date, study_instance_uid, priority, status,
      clinical_indication, origin_institution, is_anonymized, total_files, total_bytes,
      created_at, updated_at
    ) VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?5, ?6, ?7, 'MR', 'Encéfalo / Cráneo', '2026-10-30', ?8, 'stat', 'in_review', ?9, ?10, 0, 3, ?11, ?12, ?12)`
  )
    .bind(
      studyMrId,
      'ACC-2026-MR02',
      clinicId,
      'Elena Villarreal Sánchez',
      'EXP-NL-91204',
      '1986-09-22',
      'F',
      '1.2.826.0.1.3680043.10.2026.200',
      'Cefalea hemicraneal súbita y parestesias transitorias en miembro superior derecho. Serie multicorte ponderada en T2.',
      'Hospital Regional de Telemedicina Monterrey',
      mrTotalBytes,
      now
    )
    .run();

  await insertSeedDicomFile(env, studyMrId, 'fil-demo-mr-01', mrSlice1.filename, mrSlice1.bytes, now);
  await insertSeedDicomFile(env, studyMrId, 'fil-demo-mr-02', mrSlice2.filename, mrSlice2.bytes, now);
  await insertSeedDicomFile(env, studyMrId, 'fil-demo-mr-03', mrSlice3.filename, mrSlice3.bytes, now);

  // Seed Study 3: Digital Chest X-Ray uploaded directly by Patient Carlos Mendoza (Already Diagnosed!)
  const dxSample = generateChestXrayDicom();
  const studyDxId = 'std-demo-dx-03';
  await env.DB.prepare(
    `INSERT INTO studies (
      id, accession_number, uploaded_by_user_id, patient_user_id, patient_email,
      patient_name, patient_identifier, patient_birth_date, patient_sex,
      modality, body_part, study_date, study_instance_uid, priority, status,
      clinical_indication, origin_institution, is_anonymized, total_files, total_bytes,
      created_at, updated_at
    ) VALUES (?1, ?2, ?3, ?3, 'paciente@telemed.mx', ?4, ?5, ?6, ?7, 'DX', 'Tórax', '2026-10-25', ?8, 'routine', 'diagnosed', ?9, ?10, 0, 1, ?11, ?12, ?12)`
  )
    .bind(
      studyDxId,
      'ACC-2026-DX03',
      patientId,
      'Carlos Mendoza Treviño',
      'EXP-NL-77319',
      '1992-11-04',
      'M',
      '1.2.826.0.1.3680043.10.2026.300',
      'Valoración cardiopulmonar preventiva posterior a cuadro respiratorio estacional resuelto.',
      'Carga Directa del Paciente (Unidad San Pedro)',
      dxSample.bytes.byteLength,
      now
    )
    .run();

  await insertSeedDicomFile(
    env,
    studyDxId,
    'fil-demo-dx-01',
    dxSample.filename,
    dxSample.bytes,
    now
  );

  await env.DB.prepare(
    `INSERT INTO diagnostic_reports (
      id, study_id, specialist_user_id, technique, findings, impression,
      recommendations, severity_level, signed_at, updated_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'normal', ?8, ?8)`
  )
    .bind(
      'rep-demo-dx-01',
      studyDxId,
      specialistId,
      'Radiografía digital tele de tórax en proyección posteroanterior adquirida en inspiración máxima, formato DICOM 12-bit sin compresión con pérdida.',
      'Tejidos blandos de la pared torácica y estructuras óseas (clavículas, arcos costales y columna dorsal) íntegros, sin trazos de fractura ni lesiones líticas. Hemidiafragmas bien definidos con ángulos costofrénicos y cardiofrénicos libres. Parénquima pulmonar bilateral adecuadamente neumatizado, sin infiltrados alveolares ni consolidaciones. Silueta cardiomediastínica con índice cardiotorácico conservado (< 0.50).',
      'Estudio radiográfico de tórax dentro de parámetros anatómicos normales, sin evidencia de patología pleuropulmonar aguda.',
      'Continuar seguimiento clínico habitual con su médico tratante. No requiere estudios de imagen adicionales en este momento.',
      now
    )
    .run();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, study_id, details, created_at)
       VALUES ('aud-01', ?1, 'Hospital Regional de Telemedicina Monterrey', 'clinic', 'STUDY_UPLOAD', ?2, 'Carga inicial de estudio TAC 16-bit (ACC-2026-CT01)', ?3)`
    ).bind(clinicId, studyCtId, now),
    env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, study_id, details, created_at)
       VALUES ('aud-02', ?1, 'Hospital Regional de Telemedicina Monterrey', 'clinic', 'STUDY_UPLOAD', ?2, 'Carga de serie multicorte RM Cerebral T2 (3 archivos DICOM)', ?3)`
    ).bind(clinicId, studyMrId, now),
    env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, study_id, details, created_at)
       VALUES ('aud-03', ?1, 'Carlos Mendoza Treviño', 'patient', 'STUDY_UPLOAD', ?2, 'Carga directa de Radiografía Digital PA de Tórax', ?3)`
    ).bind(patientId, studyDxId, now),
    env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, study_id, details, created_at)
       VALUES ('aud-04', ?1, 'Dra. Valeria Garza Elizondo', 'specialist', 'REPORT_SIGNED', ?2, 'Dictamen radiológico remoto emitido y firmado electrónicamente', ?3)`
    ).bind(specialistId, studyDxId, now),
  ]);

  initializedInIsolate = true;
}
