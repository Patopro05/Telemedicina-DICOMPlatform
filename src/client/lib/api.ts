import type {
  DashboardStats,
  DicomModality,
  ReportSeverity,
  StudyDetail,
  StudyPriority,
  StudyStatus,
  StudySummary,
  UserProfile,
  UserRole,
} from '../../shared/types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) && !(init.body instanceof Uint8Array)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new ApiError(data.error || `Error HTTP ${response.status}`, response.status);
  }
  return data;
}

export const api = {
  getMe: () => requestJson<{ user: UserProfile | null }>('/api/auth/me'),

  login: (email: string, password: string) =>
    requestJson<{ user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    institutionName?: string;
    cluesCode?: string;
    medicalLicense?: string;
    specialty?: string;
    phone?: string;
  }) =>
    requestJson<{ user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  logout: () =>
    requestJson<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  getStats: () => requestJson<{ stats: DashboardStats }>('/api/stats'),

  getStudies: (filters?: {
    modality?: string;
    status?: string;
    priority?: string;
    q?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.modality && filters.modality !== 'ALL') params.set('modality', filters.modality);
    if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
    if (filters?.priority && filters.priority !== 'ALL') params.set('priority', filters.priority);
    if (filters?.q) params.set('q', filters.q);
    const qs = params.toString();
    return requestJson<{ studies: StudySummary[] }>(`/api/studies${qs ? `?${qs}` : ''}`);
  },

  createStudy: (payload: {
    patientName: string;
    patientIdentifier: string;
    patientEmail?: string;
    patientBirthDate?: string;
    patientSex?: string;
    modality: DicomModality;
    bodyPart: string;
    studyDate: string;
    studyInstanceUid?: string;
    priority: StudyPriority;
    clinicalIndication: string;
    isAnonymized: boolean;
  }) =>
    requestJson<{ studyId: string; accessionNumber: string }>('/api/studies', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  uploadStudyDicomFile: async (
    studyId: string,
    filename: string,
    bytes: Uint8Array
  ): Promise<{ fileId: string; sha256: string; storageBackend: string }> => {
    const exactBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;

    const response = await fetch(`/api/studies/${encodeURIComponent(studyId)}/files`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/dicom',
        'X-Filename': encodeURIComponent(filename),
      },
      body: exactBuffer,
    });

    const data = (await response.json().catch(() => ({}))) as {
      fileId: string;
      sha256: string;
      storageBackend: string;
      error?: string;
    };
    if (!response.ok) {
      throw new ApiError(data.error || 'Error al transferir el archivo DICOM.', response.status);
    }
    return data;
  },

  getStudyDetail: (studyId: string) =>
    requestJson<{ study: StudyDetail }>(`/api/studies/${encodeURIComponent(studyId)}`),

  claimStudy: (studyId: string) =>
    requestJson<{ ok: boolean }>(`/api/studies/${encodeURIComponent(studyId)}/claim`, {
      method: 'POST',
    }),

  submitDiagnosis: (
    studyId: string,
    payload: {
      technique: string;
      findings: string;
      impression: string;
      recommendations: string;
      severityLevel: ReportSeverity;
    }
  ) =>
    requestJson<{ ok: boolean }>(`/api/studies/${encodeURIComponent(studyId)}/diagnosis`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'patient':
      return 'Paciente / Usuario';
    case 'clinic':
      return 'Clínica / Hospital';
    case 'specialist':
      return 'Médico Especialista';
  }
}

export function getModalityLabel(modality: DicomModality): string {
  switch (modality) {
    case 'CT':
      return 'TAC (Tomografía Axial)';
    case 'MR':
      return 'RM (Resonancia Magnética)';
    case 'DX':
      return 'RX Digital (DX)';
    case 'CR':
      return 'Radiografía Computarizada (CR)';
    case 'US':
      return 'Ultrasonido (US)';
    case 'MG':
      return 'Mastografía (MG)';
    case 'OT':
      return 'Otra Modalidad DICOM';
  }
}

export function getPriorityMeta(priority: StudyPriority): {
  label: string;
  badgeClass: string;
} {
  switch (priority) {
    case 'stat':
      return {
        label: 'Emergencia STAT',
        badgeClass: 'bg-red-100 text-red-800 border-red-200',
      };
    case 'urgent':
      return {
        label: 'Urgente',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'routine':
      return {
        label: 'Rutina',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

export function getStatusMeta(status: StudyStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'pending':
      return {
        label: 'Pendiente de Lectura',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'in_review':
      return {
        label: 'En Revisión Médica',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
      };
    case 'diagnosed':
      return {
        label: 'Diagnosticado',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
  }
}

export function getSeverityMeta(severity: ReportSeverity): {
  label: string;
  badgeClass: string;
} {
  switch (severity) {
    case 'normal':
      return {
        label: 'Sin hallazgos patológicos agudos',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    case 'benign':
      return {
        label: 'Hallazgos benignos / incidentales',
        badgeClass: 'bg-teal-100 text-teal-800 border-teal-200',
      };
    case 'followup':
      return {
        label: 'Requiere seguimiento especializado',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    case 'critical':
      return {
        label: 'Hallazgo prioritario / Atención inmediata',
        badgeClass: 'bg-red-100 text-red-800 border-red-200',
      };
  }
}
