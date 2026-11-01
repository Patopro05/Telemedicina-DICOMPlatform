export type UserRole = 'patient' | 'clinic' | 'specialist';

export type StudyPriority = 'routine' | 'urgent' | 'stat';
export type StudyStatus = 'pending' | 'in_review' | 'diagnosed';
export type DicomModality = 'CT' | 'MR' | 'DX' | 'CR' | 'US' | 'MG' | 'OT';
export type ReportSeverity = 'normal' | 'benign' | 'followup' | 'critical';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  institutionName?: string | null;
  cluesCode?: string | null;
  medicalLicense?: string | null;
  specialty?: string | null;
  phone?: string | null;
  createdAt: string;
}

export interface DicomTagEntry {
  tag: string;
  vr: string;
  name: string;
  value: string;
}

export interface ExtractedDicomMetadata {
  isValidDicom: boolean;
  hasDicmPreamble: boolean;
  transferSyntaxUid: string;
  modality: DicomModality;
  patientName: string;
  patientId: string;
  patientBirthDate: string;
  patientSex: string;
  studyDate: string;
  studyDescription: string;
  seriesDescription: string;
  bodyPartExamined: string;
  institutionName: string;
  manufacturer: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  sopInstanceUid: string;
  instanceNumber: number;
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored: number;
  pixelRepresentation: number;
  samplesPerPixel: number;
  photometricInterpretation: string;
  windowCenter: number | null;
  windowWidth: number | null;
  rescaleSlope: number;
  rescaleIntercept: number;
  pixelSpacing: string;
  sliceThickness: string;
  numberOfFrames: number;
  tags: DicomTagEntry[];
}

export interface StudyFileRecord {
  id: string;
  studyId: string;
  filename: string;
  fileSize: number;
  sha256: string;
  sopInstanceUid?: string | null;
  seriesInstanceUid?: string | null;
  instanceNumber: number;
  rows?: number | null;
  columns?: number | null;
  bitsAllocated?: number | null;
  windowCenter?: number | null;
  windowWidth?: number | null;
  rescaleSlope?: number | null;
  rescaleIntercept?: number | null;
  photometricInterpretation?: string | null;
  transferSyntaxUid?: string | null;
  tags?: DicomTagEntry[];
  createdAt: string;
}

export interface DiagnosticReportRecord {
  id: string;
  studyId: string;
  specialistUserId: string;
  specialistName: string;
  specialistLicense?: string | null;
  specialistSpecialty?: string | null;
  technique: string;
  findings: string;
  impression: string;
  recommendations: string;
  severityLevel: ReportSeverity;
  signedAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  actorUserId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  studyId?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface StudySummary {
  id: string;
  accessionNumber: string;
  uploadedByUserId: string;
  uploaderName: string;
  uploaderRole: UserRole;
  patientUserId?: string | null;
  patientEmail?: string | null;
  patientName: string;
  patientIdentifier: string;
  patientBirthDate?: string | null;
  patientSex?: string | null;
  modality: DicomModality;
  bodyPart: string;
  studyDate: string;
  studyInstanceUid?: string | null;
  priority: StudyPriority;
  status: StudyStatus;
  clinicalIndication: string;
  originInstitution?: string | null;
  isAnonymized: boolean;
  totalFiles: number;
  totalBytes: number;
  hasReport: boolean;
  specialistName?: string | null;
  severityLevel?: ReportSeverity | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyDetail extends StudySummary {
  files: StudyFileRecord[];
  report: DiagnosticReportRecord | null;
  auditLogs: AuditLogRecord[];
}

export interface DashboardStats {
  totalStudies: number;
  pendingStudies: number;
  inReviewStudies: number;
  diagnosedStudies: number;
  urgentOrStatStudies: number;
  totalBytesStored: number;
}
