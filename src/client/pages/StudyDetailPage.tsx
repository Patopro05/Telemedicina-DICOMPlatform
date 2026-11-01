import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileText,
  History,
  Printer,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import type { ReportSeverity, StudyDetail } from '../../shared/types';
import { DicomWorkstation } from '../components/DicomWorkstation';
import { useAuth } from '../context/AuthContext';
import {
  api,
  formatBytes,
  getModalityLabel,
  getPriorityMeta,
  getSeverityMeta,
  getStatusMeta,
} from '../lib/api';

export function StudyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();

  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Specialist report form state
  const [technique, setTechnique] = useState('');
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [severityLevel, setSeverityLevel] = useState<ReportSeverity>('normal');
  const [savingReport, setSavingReport] = useState(false);
  const [reportSavedBanner, setReportSavedBanner] = useState(false);

  const loadStudy = useCallback(async () => {
    if (!id) return;
    setFetching(true);
    setError(null);
    try {
      const { study: detail } = await api.getStudyDetail(id);
      setStudy(detail);
      if (detail.report) {
        setTechnique(detail.report.technique);
        setFindings(detail.report.findings);
        setImpression(detail.report.impression);
        setRecommendations(detail.report.recommendations);
        setSeverityLevel(detail.report.severityLevel);
      } else {
        setTechnique(
          `Adquisición digital en formato DICOM (${detail.modality}) evaluada en estación teleradiológica sin pérdida.`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el estudio.');
    } finally {
      setFetching(false);
    }
  }, [id]);

  useEffect(() => {
    if (user && id) {
      void loadStudy();
    }
  }, [user, id, loadStudy]);

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500">Cargando...</div>;
  }
  if (!user) {
    return <Navigate to="/acceso" replace />;
  }

  if (fetching) {
    return (
      <div className="p-16 text-center text-sm font-medium text-slate-600">
        Recuperando expediente e imágenes DICOM...
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
          {error || 'Estudio no disponible.'}
        </div>
      </div>
    );
  }

  const isSpecialist = user.role === 'specialist';
  const backPath = isSpecialist ? '/panel/descarga' : '/panel/estudios';
  const priorityInfo = getPriorityMeta(study.priority);
  const statusInfo = getStatusMeta(study.status);

  const handleClaimStudy = async () => {
    await api.claimStudy(study.id);
    await loadStudy();
  };

  const handleSubmitDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReport(true);
    setReportSavedBanner(false);
    try {
      await api.submitDiagnosis(study.id, {
        technique,
        findings,
        impression,
        recommendations,
        severityLevel,
      });
      await loadStudy();
      setReportSavedBanner(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el diagnóstico.');
    } finally {
      setSavingReport(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Breadcrumb & Study Summary Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to={backPath}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al listado de estudios
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {study.patientName}{' '}
              <span className="font-mono text-base font-semibold text-slate-500">
                ({study.accessionNumber})
              </span>
            </h1>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${priorityInfo.badgeClass}`}
            >
              {priorityInfo.label}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.badgeClass}`}
            >
              {statusInfo.label}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            {getModalityLabel(study.modality)} · Región: <strong>{study.bodyPart}</strong> · Origen:{' '}
            {study.originInstitution || study.uploaderName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSpecialist && study.status === 'pending' && (
            <button
              type="button"
              onClick={() => void handleClaimStudy()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100"
            >
              <ClipboardCheck className="h-4 w-4" />
              Marcar En Revisión Médica
            </button>
          )}
          <a
            href={`/api/studies/${encodeURIComponent(study.id)}/download-zip`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800"
          >
            <Archive className="h-4 w-4 text-teal-400" />
            Descargar Serie Completa ZIP ({study.files.length}{' '}
            {study.files.length === 1 ? 'archivo .dcm' : 'archivos .dcm'})
          </a>
        </div>
      </div>

      {/* Interactive 16-bit DICOM Workstation */}
      <div className="no-print">
        <DicomWorkstation
          studyId={study.id}
          patientName={study.patientName}
          patientIdentifier={study.patientIdentifier}
          modality={study.modality}
          studyDate={study.studyDate}
          files={study.files}
        />
      </div>

      {/* Clinical Indication + Lossless Files + Remote Diagnostic Report */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Clinical Context & Lossless DICOM Downloads */}
        <div className="no-print space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900">Motivo Clínico e Información</h2>
            <p className="mt-2 rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
              {study.clinicalIndication}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-500">Expediente Paciente</dt>
                <dd className="font-mono font-semibold text-slate-900">
                  {study.patientIdentifier}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Fecha de Estudio</dt>
                <dd className="font-semibold text-slate-900">{study.studyDate}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Sexo / Nacimiento</dt>
                <dd className="font-semibold text-slate-900">
                  {study.patientSex || 'N/E'}{' '}
                  {study.patientBirthDate ? `· ${study.patientBirthDate}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Tamaño Total</dt>
                <dd className="font-semibold text-slate-900">{formatBytes(study.totalBytes)}</dd>
              </div>
            </dl>
          </div>

          {/* Individual Lossless DICOM Slice Download Box */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Archivos Binarios DICOM Sin Pérdida ({study.files.length})
              </h2>
              <ShieldCheck className="h-4 w-4 text-teal-700" />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Descargue cortes individuales <code>.dcm</code> verificados con SHA-256 para
              estaciones RadiAnt, 3D Slicer u Horos.
            </p>

            <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
              {study.files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-slate-900">{f.filename}</div>
                    <div className="text-[11px] text-slate-500">
                      Corte #{f.instanceNumber} · {f.columns}x{f.rows} · {formatBytes(f.fileSize)}
                    </div>
                    <div className="truncate font-mono text-[10px] text-slate-400">
                      SHA-256: {f.sha256.slice(0, 20)}...
                    </div>
                  </div>
                  <a
                    href={`/api/studies/${encodeURIComponent(study.id)}/files/${encodeURIComponent(
                      f.id
                    )}/download`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-teal-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    .dcm
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <History className="h-4 w-4 text-slate-600" />
              Bitácora de Trazabilidad y Accesos
            </div>
            <ul className="mt-3 max-h-48 space-y-2.5 overflow-y-auto text-xs">
              {study.auditLogs.map((log) => (
                <li key={log.id} className="border-l-2 border-teal-500 pl-3">
                  <div className="font-semibold text-slate-800">{log.details || log.action}</div>
                  <div className="text-[11px] text-slate-500">
                    {log.actorName} · {new Date(log.createdAt).toLocaleString('es-MX')}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Column: Signed Diagnostic Report Viewer & Specialist Composer */}
        <div className="space-y-6 lg:col-span-7">
          {/* Formatted Printable Diagnostic Report (if emitted) */}
          {study.report && (
            <div className="print-report-card rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-emerald-700 uppercase">
                    <FileText className="h-4 w-4" />
                    Dictamen Radiológico a Distancia
                  </div>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                    Reporte de Diagnóstico Médico — {study.accessionNumber}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Dictamen
                </button>
              </div>

              <div className="mt-4">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                    getSeverityMeta(study.report.severityLevel).badgeClass
                  }`}
                >
                  Clasificación: {getSeverityMeta(study.report.severityLevel).label}
                </span>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-800">
                <div>
                  <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                    Técnica de Adquisición y Lectura
                  </h3>
                  <p className="mt-1 whitespace-pre-line">{study.report.technique}</p>
                </div>

                <div>
                  <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                    Hallazgos Radiológicos
                  </h3>
                  <p className="mt-1 whitespace-pre-line">{study.report.findings}</p>
                </div>

                <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
                  <h3 className="text-xs font-bold tracking-wide text-teal-900 uppercase">
                    Impresión Diagnóstica (Conclusión)
                  </h3>
                  <p className="mt-1 font-semibold whitespace-pre-line text-slate-900">
                    {study.report.impression}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                    Recomendaciones Clínicas
                  </h3>
                  <p className="mt-1 whitespace-pre-line">{study.report.recommendations}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
                <div>
                  <div className="font-bold text-slate-900">{study.report.specialistName}</div>
                  <div>
                    {study.report.specialistSpecialty || 'Médico Especialista'} · Cédula:{' '}
                    <span className="font-mono">{study.report.specialistLicense || 'Acreditada'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div>Firmado electrónicamente:</div>
                  <div className="font-medium text-slate-800">
                    {new Date(study.report.signedAt).toLocaleString('es-MX')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pending state notice for Patient or Clinic */}
          {!study.report && !isSpecialist && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <h3 className="text-base font-bold text-amber-950">
                    Estudio en Espera de Dictamen por Médico Especialista
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                    Sus archivos DICOM se encuentran almacenados de forma íntegra y disponibles en
                    la bandeja teleradiológica. En cuanto un especialista emita el diagnóstico
                    remoto, aparecerá automáticamente en esta sección listo para consulta e
                    impresión.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Specialist Remote Diagnosis Composer */}
          {isSpecialist && (
            <div className="no-print rounded-2xl border border-indigo-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-indigo-700 uppercase">
                <Stethoscope className="h-4 w-4" />
                Módulo Exclusivo para Médico Especialista
              </div>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                {study.report
                  ? 'Actualizar Dictamen Diagnóstico Remoto'
                  : 'Emitir Diagnóstico Remoto del Estudio'}
              </h2>

              {reportSavedBanner && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Dictamen firmado y publicado exitosamente para el paciente y la unidad médica.
                </div>
              )}

              <form onSubmit={(e) => void handleSubmitDiagnosis(e)} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Clasificación Clínica de Hallazgos *
                  </label>
                  <select
                    value={severityLevel}
                    onChange={(e) => setSeverityLevel(e.target.value as ReportSeverity)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="normal">Normal / Sin hallazgos patológicos agudos</option>
                    <option value="benign">Hallazgos benignos o crónicos estables</option>
                    <option value="followup">Anormalidad que requiere seguimiento clínico</option>
                    <option value="critical">
                      Hallazgo crítico / Comunicación médica prioritaria
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Técnica de Imagen Evaluada
                  </label>
                  <textarea
                    rows={2}
                    value={technique}
                    onChange={(e) => setTechnique(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Descripción Detallada de Hallazgos Radiológicos *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    placeholder="Describa sistemáticamente las estructuras anatómicas, densidades HU o intensidades de señal observadas..."
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Impresión Diagnóstica / Conclusión *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={impression}
                    onChange={(e) => setImpression(e.target.value)}
                    placeholder="Síntesis diagnóstica precisa..."
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Recomendaciones y Conducta Sugerida
                  </label>
                  <textarea
                    rows={2}
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                    placeholder="Estudios complementarios o seguimiento clínico sugerido..."
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingReport}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-800 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {savingReport
                    ? 'Firmando y guardando dictamen...'
                    : 'Firmar y Emitir Diagnóstico Remoto'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
