import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  FlaskConical,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { anonymizeDicomBuffer } from '../../shared/dicom/dicmAnonymizer';
import {
  generateSampleDicomByType,
  type SamplePhantomType,
} from '../../shared/dicom/dicmGenerator';
import {
  parseDicomBytes,
  renderDicomFrameToRgba,
} from '../../shared/dicom/dicmParser';
import type { DicomModality, ExtractedDicomMetadata, StudyPriority } from '../../shared/types';
import { useAuth } from '../context/AuthContext';
import { api, formatBytes } from '../lib/api';

interface StagedDicomFile {
  id: string;
  filename: string;
  rawBytes: Uint8Array;
  sha256: string;
  metadata: ExtractedDicomMetadata;
  previewDataUrl: string | null;
}

async function computeBrowserSha256(bytes: Uint8Array): Promise<string> {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildPreviewDataUrl(bytes: Uint8Array): string | null {
  try {
    const parsed = parseDicomBytes(bytes);
    const rendered = renderDicomFrameToRgba(parsed);
    const canvas = document.createElement('canvas');
    canvas.width = rendered.width;
    canvas.height = rendered.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(rendered.rgba), rendered.width, rendered.height),
      0,
      0
    );
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function UploadStudyPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stagedFiles, setStagedFiles] = useState<StagedDicomFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const [patientName, setPatientName] = useState('');
  const [patientIdentifier, setPatientIdentifier] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [patientBirthDate, setPatientBirthDate] = useState('');
  const [patientSex, setPatientSex] = useState('M');
  const [modality, setModality] = useState<DicomModality>('CT');
  const [bodyPart, setBodyPart] = useState('Tórax');
  const [studyDate, setStudyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [priority, setPriority] = useState<StudyPriority>('routine');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [anonymizePhi, setAnonymizePhi] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  useEffect(() => {
    if (user?.role === 'patient') {
      setPatientName(user.fullName);
      setPatientEmail(user.email);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">Verificando permisos de acceso...</div>
    );
  }
  if (!user) {
    return <Navigate to="/acceso" replace />;
  }
  if (user.role === 'specialist') {
    return <Navigate to="/panel/descarga" replace />;
  }

  const ingestRawFiles = async (items: Array<{ name: string; bytes: Uint8Array }>) => {
    setParseError(null);
    const newlyStaged: StagedDicomFile[] = [];

    for (const item of items) {
      try {
        const parsed = parseDicomBytes(item.bytes);
        const sha = await computeBrowserSha256(item.bytes);
        const preview = buildPreviewDataUrl(item.bytes);

        newlyStaged.push({
          id: crypto.randomUUID(),
          filename: item.name,
          rawBytes: item.bytes,
          sha256: sha,
          metadata: parsed.metadata,
          previewDataUrl: preview,
        });
      } catch (err) {
        setParseError(
          `Archivo rechazado (${item.name}): ${
            err instanceof Error
              ? err.message
              : 'Solo se admiten estudios médicos en formato binario DICOM (.dcm).'
          }`
        );
      }
    }

    if (newlyStaged.length > 0) {
      const firstMeta = newlyStaged[0].metadata;
      setModality(firstMeta.modality);
      if (firstMeta.studyDate) setStudyDate(firstMeta.studyDate);
      if (firstMeta.bodyPartExamined && firstMeta.bodyPartExamined !== 'GENERAL') {
        const mapRegion: Record<string, string> = {
          CHEST: 'Tórax',
          BRAIN: 'Encéfalo / Cráneo',
          ABDOMEN: 'Abdomen',
          SPINE: 'Columna Vertebral',
        };
        setBodyPart(mapRegion[firstMeta.bodyPartExamined] ?? firstMeta.bodyPartExamined);
      }
      if (user.role === 'clinic') {
        if (!patientName && firstMeta.patientName !== 'PACIENTE SIN NOMBRE') {
          setPatientName(firstMeta.patientName);
        }
        if (!patientIdentifier && firstMeta.patientId !== 'SIN-ID') {
          setPatientIdentifier(firstMeta.patientId);
        }
        if (!patientBirthDate && firstMeta.patientBirthDate) {
          setPatientBirthDate(firstMeta.patientBirthDate);
        }
        if (firstMeta.patientSex === 'M' || firstMeta.patientSex === 'F') {
          setPatientSex(firstMeta.patientSex);
        }
      } else if (!patientIdentifier && firstMeta.patientId !== 'SIN-ID') {
        setPatientIdentifier(firstMeta.patientId);
      }

      setStagedFiles((prev) => [...prev, ...newlyStaged]);
    }
  };

  const handleBrowserFileSelection = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const rawItems: Array<{ name: string; bytes: Uint8Array }> = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const buf = await f.arrayBuffer();
      rawItems.push({ name: f.name, bytes: new Uint8Array(buf) });
    }
    await ingestRawFiles(rawItems);
  };

  const handleGenerateSample = async (type: SamplePhantomType, mode: 'stage' | 'download') => {
    const sample = generateSampleDicomByType(type);
    if (mode === 'download') {
      const buf = sample.bytes.buffer.slice(
        sample.bytes.byteOffset,
        sample.bytes.byteOffset + sample.bytes.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([buf], { type: 'application/dicom' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sample.filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    await ingestRawFiles([{ name: sample.filename, bytes: sample.bytes }]);
    if (!clinicalIndication) {
      setClinicalIndication(
        `Evaluación diagnóstica remota de ${sample.description} generada para validación de telemedicina.`
      );
    }
  };

  const handleSubmitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stagedFiles.length === 0) {
      setParseError('Adjunte al menos un archivo DICOM (.dcm) antes de enviar el estudio.');
      return;
    }

    setParseError(null);
    setUploading(true);

    try {
      setUploadProgress('Registrando expediente clínico del estudio...');
      const effectivePatientName = anonymizePhi
        ? 'Paciente Anonimizado (PS3.15)'
        : patientName.trim();
      const effectivePatientId =
        patientIdentifier.trim() || `EXP-${Date.now().toString().slice(-6)}`;

      const { studyId } = await api.createStudy({
        patientName: effectivePatientName,
        patientIdentifier: effectivePatientId,
        patientEmail: user.role === 'clinic' ? patientEmail : user.email,
        patientBirthDate: anonymizePhi ? undefined : patientBirthDate,
        patientSex,
        modality,
        bodyPart,
        studyDate,
        studyInstanceUid: stagedFiles[0].metadata.studyInstanceUid,
        priority,
        clinicalIndication,
        isAnonymized: anonymizePhi,
      });

      for (let i = 0; i < stagedFiles.length; i++) {
        const item = stagedFiles[i];
        setUploadProgress(
          `Transfiriendo objeto DICOM ${i + 1} de ${stagedFiles.length} (${item.filename})...`
        );
        const payloadBytes = anonymizePhi
          ? anonymizeDicomBuffer(item.rawBytes, effectivePatientId)
          : item.rawBytes;

        await api.uploadStudyDicomFile(studyId, item.filename, payloadBytes);
      }

      navigate(`/panel/estudios/${studyId}`);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Error durante la carga del estudio.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-teal-700 uppercase">
            Pestaña de Carga de Archivos ({user.role === 'clinic' ? 'Unidad Hospitalaria' : 'Paciente'})
          </span>
          <h1 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Cargar Estudio de Imagen Médica DICOM
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Valide y transfiera estudios <code>.dcm</code> sin pérdida para revisión remota por
            médicos especialistas.
          </p>
        </div>
      </div>

      {/* Built-in Sample DICOM Generator Bar for Testing */}
      <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                ¿No cuenta con un archivo .dcm en su equipo en este momento?
              </h2>
              <p className="text-xs text-slate-600">
                Genere archivos DICOM reales (NEMA PS3.10 de 16 bits) para descargarlos a su
                computadora o adjuntarlos directamente a esta prueba:
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleGenerateSample('ct_chest', 'stage')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-800"
            >
              <Upload className="h-3.5 w-3.5" />
              Adjuntar Muestra TAC Tórax (16-bit HU)
            </button>
            <button
              type="button"
              onClick={() => void handleGenerateSample('mr_brain', 'stage')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-800"
            >
              <Upload className="h-3.5 w-3.5" />
              Adjuntar Muestra RM Cerebral
            </button>
            <button
              type="button"
              onClick={() => void handleGenerateSample('dx_chest', 'download')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" />
              Guardar RX_Torax.dcm en mi PC
            </button>
          </div>
        </div>
      </div>

      {parseError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <span>{parseError}</span>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmitUpload(e)} className="grid gap-8 lg:grid-cols-12">
        {/* Left Column: DICOM Dropzone & Staged Slices */}
        <div className="space-y-5 lg:col-span-7">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              void handleBrowserFileSelection(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
              dragActive
                ? 'border-teal-600 bg-teal-50'
                : 'border-slate-300 bg-white hover:border-teal-500 hover:bg-slate-50/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".dcm,.dicom,application/dicom"
              onChange={(e) => void handleBrowserFileSelection(e.target.files)}
              className="hidden"
            />
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <FileUp className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">
              Arrastre sus archivos DICOM (.dcm) aquí o haga clic para explorar
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
              Admite radiografías individuales o múltiples cortes seriados de Tomografía (TAC) y
              Resonancia Magnética (RM). Se verificará el preámbulo binario <code>DICM</code> y la
              huella SHA-256 localmente.
            </p>
          </div>

          {/* Staged Files Preview */}
          {stagedFiles.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Archivos Validados Listos para Transferencia ({stagedFiles.length})
                </h3>
                <button
                  type="button"
                  onClick={() => setStagedFiles([])}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Limpiar lista
                </button>
              </div>

              <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {stagedFiles.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    {item.previewDataUrl ? (
                      <img
                        src={item.previewDataUrl}
                        alt={item.filename}
                        className="h-14 w-14 shrink-0 rounded-lg border border-slate-800 bg-slate-950 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-teal-400">
                        {item.metadata.modality}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-xs font-bold text-slate-900">
                          {item.filename}
                        </span>
                        <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-800">
                          {item.metadata.modality}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-600">
                        {item.metadata.columns}x{item.metadata.rows} px ·{' '}
                        {item.metadata.bitsStored}-bit · {formatBytes(item.rawBytes.byteLength)}
                      </div>
                      <div className="truncate font-mono text-[10px] text-slate-400">
                        SHA-256: {item.sha256}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setStagedFiles((prev) => prev.filter((f) => f.id !== item.id))
                      }
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Quitar archivo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Client-side Privacy / Anonymizer Option */}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <input
              type="checkbox"
              checked={anonymizePhi}
              onChange={(e) => setAnonymizePhi(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Shield className="h-4 w-4 text-teal-700" />
                Aplicar Anonimización de Cabecera DICOM (Perfil NEMA PS3.15)
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Sobrescribe en su navegador las etiquetas sensibles (Nombre del Paciente, Fecha de
                Nacimiento e Institución) dentro del binario <code>.dcm</code> antes de enviarlo por
                la red, conservando intacta la matriz de píxeles diagnósticos.
              </p>
            </div>
          </label>
        </div>

        {/* Right Column: Clinical Metadata Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-5">
          <h2 className="text-base font-bold text-slate-900">Datos Clínicos del Estudio</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Los metadatos detectados en el archivo DICOM se prellenan automáticamente.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nombre del Paciente *
              </label>
              <input
                type="text"
                required={!anonymizePhi}
                disabled={anonymizePhi}
                value={anonymizePhi ? 'PACIENTE ANONIMIZADO (PS3.15)' : patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nombre completo del paciente"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  ID / Expediente Clínico *
                </label>
                <input
                  type="text"
                  required
                  value={patientIdentifier}
                  onChange={(e) => setPatientIdentifier(e.target.value)}
                  placeholder="Ej. EXP-88412"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Sexo</label>
                <select
                  value={patientSex}
                  onChange={(e) => setPatientSex(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="M">Masculino (M)</option>
                  <option value="F">Femenino (F)</option>
                  <option value="O">Otro / No especificado</option>
                </select>
              </div>
            </div>

            {user.role === 'clinic' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Correo del Paciente (opcional, para vincular a su cuenta)
                </label>
                <input
                  type="email"
                  value={patientEmail}
                  onChange={(e) => setPatientEmail(e.target.value)}
                  placeholder="paciente@correo.mx"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Modalidad DICOM *
                </label>
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value as DicomModality)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="CT">TAC (CT)</option>
                  <option value="MR">Resonancia Magnética (MR)</option>
                  <option value="DX">Radiografía Digital (DX)</option>
                  <option value="CR">Radiografía Computarizada (CR)</option>
                  <option value="US">Ultrasonido (US)</option>
                  <option value="MG">Mastografía (MG)</option>
                  <option value="OT">Otra Modalidad (OT)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Prioridad Clínica *
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as StudyPriority)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="routine">Rutina</option>
                  <option value="urgent">Urgente</option>
                  <option value="stat">Emergencia STAT</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Región Anatómica *
                </label>
                <input
                  type="text"
                  required
                  value={bodyPart}
                  onChange={(e) => setBodyPart(e.target.value)}
                  placeholder="Ej. Tórax, Cráneo, Columna"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Fecha de Adquisición *
                </label>
                <input
                  type="date"
                  required
                  value={studyDate}
                  onChange={(e) => setStudyDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Indicación Clínica / Cuadro Sintomático *
              </label>
              <textarea
                rows={3}
                required
                value={clinicalIndication}
                onChange={(e) => setClinicalIndication(e.target.value)}
                placeholder="Describa síntomas relevantes, antecedentes quirúrgicos o sospecha diagnóstica para el médico especialista..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || stagedFiles.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {uploading
                ? uploadProgress || 'Transfiriendo estudio...'
                : `Transferir Estudio DICOM (${stagedFiles.length} ${
                    stagedFiles.length === 1 ? 'archivo' : 'archivos'
                  })`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
