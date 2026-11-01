-- TeleMed DICOM Platform - Relational Schema (Cloudflare D1 / SQLite)

CREATE TABLE IF NOT EXISTS users (
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
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS studies (
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
);

CREATE INDEX IF NOT EXISTS idx_studies_uploaded_by ON studies(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_studies_patient_user ON studies(patient_user_id);
CREATE INDEX IF NOT EXISTS idx_studies_status ON studies(status);
CREATE INDEX IF NOT EXISTS idx_studies_modality ON studies(modality);

CREATE TABLE IF NOT EXISTS study_files (
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
);

CREATE INDEX IF NOT EXISTS idx_study_files_study ON study_files(study_id, instance_number);

CREATE TABLE IF NOT EXISTS file_chunks (
  file_id TEXT NOT NULL REFERENCES study_files(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (file_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS diagnostic_reports (
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
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  study_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_study ON audit_logs(study_id);
