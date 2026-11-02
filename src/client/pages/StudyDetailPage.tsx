import {
  AlertCircle,
  Archive,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileDown,
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
import { generateDiagnosticPdfReport } from '../lib/pdfReportGenerator';

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
          `Adquisición digital en formato DICOM (${detail.modality}) evaluada en estación teleradiológica ImaRis sin pérdida.`
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
    return <div className="p-12 text-center text-xs text-slate-500">Cargando...</div>;
  }
  if (!user) {
    return <Navigate to="/acceso" replace />;
  }

  if (fetching) {
    return (
      <div className="p-16 text-center text-xs font-medium text-slate-600">
        Recuperando expediente e imágenes DICOM...
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-2xl border border-[#9C3B47]/30 bg-[#9C3B47]/10 p-6 text-sm text-[#9C3B47]">
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

  const handleDownloadPdf = () => {
    if (!study.report) return;
    generateDiagnosticPdfReport(study);
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
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#517327] hover:underline"
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
              className={`rounded-full border px-2.5 py-0.5 text-xs ${priorityInfo.badgeClass}`}
            >
              {priorityInfo.label}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs ${statusInfo.badgeClass}`}
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#3B5CA8]/30 bg-[#3B5CA8]/10 px-3.5 py-2 text-xs font-bold text-[#3B5CA8] hover:bg-[#3B5CA8]/20"
            >
              <ClipboardCheck className="h-4 w-4" />
              Marcar En Revisión Médica
            </button>
          )}

          {study.report && (
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-2 rounded-xl bg-[#517327] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#617E3C]"
            >
              <FileDown className="h-4 w-4" />
              Descargar Dictamen en PDF
            </button>
          )}

          <a
            href={`/api/studies/${encodeURIComponent(study.id)}/download-zip`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-slate-800"
          >
            <Archive className="h-4 w-4 text-[#a6cc72]" />
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
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900">Motivo Clínico e Información</h2>
            <p className="mt-2 rounded-xl bg-stone-50 p-3.5 text-xs leading-relaxed text-slate-700">
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
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Archivos Binarios DICOM Sin Pérdida ({study.files.length})
              </h2>
              <ShieldCheck className="h-4 w-4 text-[#517327]" />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Descargue cortes individuales <code>.dcm</code> verificados con SHA-256 para
              estaciones RadiAnt, 3D Slicer u Horos.
            </p>

            <div className="mt-3 max-h-60 space-y-2 overflow-y-auto pr-1">
              {study.files.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5"
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
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#3B5CA8] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#5A75BC]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    .dcm
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Trail */}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <History className="h-4 w-4 text-slate-600" />
              Bitácora de Trazabilidad y Accesos
            </div>
            <ul className="mt-3 max-h-48 space-y-2.5 overflow-y-auto text-xs">
              {study.auditLogs.map((log) => (
                <li key={log.id} className="border-l-2 border-[#517327] pl-3">
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
          {/* Formatted Diagnostic Report */}
          {study.report && (
            <div className="print-report-card rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-200 pb-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider text-[#517327] uppercase">
                    <FileText className="h-4 w-4" />
                    Dictamen Radiológico a Distancia · ImaRis
                  </div>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                    Reporte de Diagnóstico Médico — {study.accessionNumber}
                  </h2>
                </div>
                <div className="no-print flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#517327] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#617E3C]"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Exportar PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs ${
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

                <div className="rounded-xl border border-[#3B5CA8]/30 bg-[#3B5CA8]/5 p-4">
                  <h3 className="text-xs font-bold tracking-wide text-[#3B5CA8] uppercase">
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

              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-4 text-xs text-slate-600">
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
                    la bandeja teleradiológica de ImaRis. En cuanto un especialista emita el diagnóstico
                    remoto, podrá descargarlo en PDF e imprimirlo inmediatamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Specialist Remote Diagnosis Composer */}
          {isSpecialist && (
            <div className="no-print rounded-2xl border border-[#3B5CA8]/30 bg-white p-6 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#3B5CA8] uppercase">
                <Stethoscope className="h-4 w-4" />
                Módulo Exclusivo para Médico Especialista
              </div>
              <h2 className="mt-1 text-lg font-bold text-slate-900">
                {study.report
                  ? 'Actualizar Dictamen Diagnóstico Remoto'
                  : 'Emitir Diagnóstico Remoto del Estudio'}
              </h2>

              {reportSavedBanner && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#517327]/30 bg-[#517327]/10 p-3 text-xs font-semibold text-[#517327]">
                  <CheckCircle2 className="h-4 w-4 text-[#517327]" />
                  Dictamen firmado y publicado exitosamente en ImaRis para el paciente y la clínica.
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
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
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
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
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
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
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
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
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
                    className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>

                {/* Blue Submit Button */}
                <button
                  type="submit"
                  disabled={savingReport}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B5CA8] px-5 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#5A75BC] disabled:opacity-60"
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
