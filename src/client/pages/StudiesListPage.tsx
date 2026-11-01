import {
  Activity,
  Archive,
  Clock,
  Eye,
  FileCheck2,
  Filter,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { DashboardStats, StudySummary } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import {
  api,
  formatBytes,
  getModalityLabel,
  getPriorityMeta,
  getStatusMeta,
} from '../lib/api';

export function StudiesListPage() {
  const { user, loading } = useAuth();

  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [fetching, setFetching] = useState(true);

  const [modality, setModality] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [priority, setPriority] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setFetching(true);
    try {
      const [studiesRes, statsRes] = await Promise.all([
        api.getStudies({
          modality,
          status,
          priority,
          q: searchQuery,
        }),
        api.getStats(),
      ]);
      setStudies(studiesRes.studies);
      setStats(statsRes.stats);
    } finally {
      setFetching(false);
    }
  }, [modality, status, priority, searchQuery]);

  useEffect(() => {
    if (user) {
      void loadData();
    }
  }, [user, loadData]);

  if (loading) {
    return <div className="p-12 text-center text-sm text-slate-500">Cargando expediente...</div>;
  }
  if (!user) {
    return <Navigate to="/acceso" replace />;
  }

  const isSpecialist = user.role === 'specialist';

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-teal-700 uppercase">
            {isSpecialist
              ? 'Pestaña de Descarga y Consulta para Médicos Especialistas'
              : user.role === 'clinic'
                ? `Panel Institucional · ${user.institutionName || user.fullName}`
                : 'Portal del Paciente · Seguimiento de Estudios'}
          </span>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {isSpecialist
              ? 'Bandeja Teleradiológica y Descarga de Estudios DICOM'
              : 'Mis Estudios de Imagen y Diagnósticos Remotos'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {isSpecialist
              ? 'Descargue los objetos binarios DICOM (.dcm / paquete .zip) para estación PACS externa o emita su dictamen remoto en el visor integrado.'
              : 'Consulte el estado de revisión de sus archivos DICOM y acceda a los dictámenes firmados por médicos especialistas.'}
          </p>
        </div>

        {!isSpecialist && (
          <Link
            to="/panel/cargar"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"
          >
            <Plus className="h-4 w-4" />
            Cargar Nuevo Estudio DICOM
          </Link>
        )}
      </div>

      {/* Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Estudios Totales</span>
              <Activity className="h-4 w-4 text-teal-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900">{stats.totalStudies}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Volumen: {formatBytes(stats.totalBytesStored)}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Pendientes de Lectura</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-700">
              {stats.pendingStudies + stats.inReviewStudies}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {stats.inReviewStudies} actualmente en revisión
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Diagnósticos Emitidos</span>
              <FileCheck2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-700">
              {stats.diagnosedStudies}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Dictámenes firmados listos</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>Prioridad Urgente / STAT</span>
              <ShieldCheck className="h-4 w-4 text-red-600" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-red-700">
              {stats.urgentOrStatStudies}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Atención prioritaria abierta</div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por paciente, folio ACC, expediente o región..."
              className="w-full rounded-xl border border-slate-300 py-2 pr-3 pl-9 text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 md:col-span-2">
            <Filter className="hidden h-4 w-4 shrink-0 text-slate-400 lg:block" />
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="ALL">Todas las Modalidades</option>
              <option value="CT">TAC (CT)</option>
              <option value="MR">Resonancia (MR)</option>
              <option value="DX">Radiografía (DX)</option>
              <option value="CR">Radiografía (CR)</option>
              <option value="US">Ultrasonido (US)</option>
              <option value="MG">Mastografía (MG)</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="pending">Pendientes de Lectura</option>
              <option value="in_review">En Revisión Médica</option>
              <option value="diagnosed">Diagnosticados</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
            >
              <option value="ALL">Cualquier Prioridad</option>
              <option value="stat">Emergencia STAT</option>
              <option value="urgent">Urgente</option>
              <option value="routine">Rutina</option>
            </select>
          </div>
        </div>
      </div>

      {/* Studies Table / Cards */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {fetching ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Consultando estudios DICOM almacenados...
          </div>
        ) : studies.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No se encontraron estudios con los criterios seleccionados.
            </p>
            {!isSpecialist && (
              <Link
                to="/panel/cargar"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:underline"
              >
                <Plus className="h-4 w-4" />
                Subir mi primer estudio en formato DICOM
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wide text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3.5">Folio / Fecha</th>
                  <th className="px-4 py-3.5">Paciente y Origen</th>
                  <th className="px-4 py-3.5">Modalidad y Región</th>
                  <th className="px-4 py-3.5">Prioridad / Estado</th>
                  <th className="px-4 py-3.5 text-right">Acciones y Descarga DICOM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {studies.map((st) => {
                  const priorityInfo = getPriorityMeta(st.priority);
                  const statusInfo = getStatusMeta(st.status);

                  return (
                    <tr key={st.id} className="transition hover:bg-slate-50/80">
                      <td className="px-4 py-4 align-top whitespace-nowrap">
                        <div className="font-mono text-xs font-bold text-teal-800">
                          {st.accessionNumber}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500">{st.studyDate}</div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {st.totalFiles} {st.totalFiles === 1 ? 'corte' : 'cortes'} ·{' '}
                          {formatBytes(st.totalBytes)}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="font-bold text-slate-900">{st.patientName}</div>
                        <div className="text-xs text-slate-600">
                          ID: <span className="font-mono">{st.patientIdentifier}</span>
                          {st.isAnonymized && (
                            <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              PS3.15 Anónimo
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500">
                          Origen: {st.originInstitution || st.uploaderName}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top">
                        <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-teal-300">
                          {st.modality}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-800">
                          {st.bodyPart}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {getModalityLabel(st.modality)}
                        </div>
                      </td>

                      <td className="px-4 py-4 align-top whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1.5">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${priorityInfo.badgeClass}`}
                          >
                            {priorityInfo.label}
                          </span>
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusInfo.badgeClass}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right align-top whitespace-nowrap">
                        <div className="inline-flex flex-wrap justify-end gap-2">
                          <a
                            href={`/api/studies/${encodeURIComponent(st.id)}/download-zip`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-teal-600 hover:text-teal-800"
                            title="Descargar paquete ZIP con archivos DICOM originales y manifiesto SHA-256"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            Descargar ZIP (.dcm)
                          </a>

                          <Link
                            to={`/panel/estudios/${st.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-teal-800"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {isSpecialist
                              ? st.hasReport
                                ? 'Ver / Editar Dictamen'
                                : 'Visor y Emitir Diagnóstico'
                              : st.hasReport
                                ? 'Ver Diagnóstico Médico'
                                : 'Abrir Estudio'}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
