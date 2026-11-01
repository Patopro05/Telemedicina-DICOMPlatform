import {
  Activity,
  CheckCircle2,
  Database,
  FileCode2,
  KeyRound,
  Layers,
  Lock,
  Network,
  ShieldAlert,
} from 'lucide-react';
import { useState } from 'react';

interface ModalityDetail {
  code: string;
  title: string;
  bitDepth: string;
  typicalSize: string;
  clinicalUse: string;
  dicomImportance: string;
  keyTags: string[];
}

const MODALITIES: ModalityDetail[] = [
  {
    code: 'CT',
    title: 'Tomografía Axial Computarizada (TAC)',
    bitDepth: '12 a 16 bits con signo (-1024 a +3071 Unidades Hounsfield)',
    typicalSize: '512 x 512 px por corte (50 a 400 cortes por serie)',
    clinicalUse:
      'Evaluación torácica de nódulos pulmonares, traumatismo craneoencefálico, estudios vasculares y estadificación oncológica.',
    dicomImportance:
      'Almacena la pendiente e intercepto de reescalado (RescaleSlope / RescaleIntercept) que transforman valores crudos del detector en Unidades Hounsfield (HU) calibradas físicamente respecto a la densidad del agua (0 HU) y aire (-1000 HU).',
    keyTags: [
      '(0008,0060) Modality = CT',
      '(0028,1052) RescaleIntercept',
      '(0028,1053) RescaleSlope',
      '(0018,0050) SliceThickness',
    ],
  },
  {
    code: 'MR',
    title: 'Resonancia Magnética (RM)',
    bitDepth: '12 a 16 bits sin signo (alta diferenciación de tejidos blandos)',
    typicalSize: '256 x 256 o 512 x 512 px (múltiples secuencias T1, T2, FLAIR, DWI)',
    clinicalUse:
      'Neuroimagen cerebral y medular, patología musculoesquelética, lesiones desmielinizantes e isquemia aguda.',
    dicomImportance:
      'Registra tiempos de repetición (TR), tiempos de eco (TE), intensidad del campo magnético (1.5T / 3.0T) y vectores espaciales 3D (ImagePositionPatient) indispensables para correlacionar planos axiales, sagitales y coronales.',
    keyTags: [
      '(0008,0060) Modality = MR',
      '(0018,0080) RepetitionTime (TR)',
      '(0018,0081) EchoTime (TE)',
      '(0020,0032) ImagePositionPatient',
    ],
  },
  {
    code: 'DX / CR',
    title: 'Radiografía Digital y Computarizada (RX)',
    bitDepth: '10 a 14 bits almacenados en palabras de 16 bits',
    typicalSize: '2048 x 2048 hasta 3000 x 3000 px (8 a 25 MB por proyección)',
    clinicalUse:
      'Valoración cardiopulmonar inicial (tele de tórax PA/AP), fracturas óseas, patología articular y abdomen agudo.',
    dicomImportance:
      'Preserva simultáneamente la latitud de exposición para visualizar tanto el parénquima pulmonar radiolúcido como las estructuras mediastínicas y óseas radiopacas mediante ajuste dinámico de ventana.',
    keyTags: [
      '(0008,0060) Modality = DX / CR',
      '(0028,0030) PixelSpacing (calibración en mm)',
      '(0028,0004) MONOCHROME1 / MONOCHROME2',
      '(0018,0060) KVP',
    ],
  },
  {
    code: 'US / MG',
    title: 'Ultrasonido (US) y Mastografía Digital (MG)',
    bitDepth: '8-bit RGB Doppler o 12-16 bit monocromático de ultra-alta resolución',
    typicalSize: 'Secuencias multiframe (cine) o matrices mamográficas de 50 micras',
    clinicalUse:
      'Obstetricia, ecocardiografía Doppler en tiempo real y detección temprana de microcalcificaciones mamarias.',
    dicomImportance:
      'Soporta secuencias dinámicas multiframe (NumberOfFrames) y metadatos geométricos exactos del transductor o compresión mamográfica para lectura diagnóstica certificada.',
    keyTags: [
      '(0008,0060) Modality = US / MG',
      '(0028,0008) NumberOfFrames',
      '(0028,0002) SamplesPerPixel',
      '(0018,1110) DistanceSourceToDetector',
    ],
  },
];

export function DicomGuidePage() {
  const [selectedCode, setSelectedCode] = useState<string>('CT');
  const current = MODALITIES.find((m) => m.code === selectedCode) ?? MODALITIES[0];

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-3xl space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
          <Activity className="h-3.5 w-3.5" />
          Fundamento Técnico en Telemedicina
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Estándar DICOM y Arquitectura de Seguridad Médica
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          DICOM (<em>Digital Imaging and Communications in Medicine</em>, norma ISO 12052) unifica
          en un mismo contenedor binario la matriz de píxeles sin pérdida diagnóstica junto con el
          diccionario clínico estandarizado del paciente, equipo de adquisición y protocolo médico.
        </p>
      </div>

      {/* Interactive Modality Tabs */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">
          Modalidades de Imagen Médica Soportadas
        </h2>
        <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {MODALITIES.map((m) => (
            <button
              key={m.code}
              type="button"
              onClick={() => setSelectedCode(m.code)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                selectedCode === m.code
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {m.code} — {m.title.split('(')[0].trim()}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <h3 className="text-xl font-bold text-slate-900">{current.title}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Profundidad Radiométrica
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{current.bitDepth}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-500 uppercase">
                  Dimensiones / Volumen
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {current.typicalSize}
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Aplicación Clínica en Telemedicina</h4>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{current.clinicalUse}</p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Por qué el formato DICOM es indispensable en esta modalidad
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                {current.dicomImportance}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 text-slate-100 lg:col-span-4">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-teal-400 uppercase">
              <FileCode2 className="h-4 w-4" />
              Etiquetas Críticas (Grupo, Elemento)
            </div>
            <ul className="mt-4 space-y-2.5 font-mono text-xs">
              {current.keyTags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200"
                >
                  {tag}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">
              Convertir un archivo DICOM a JPEG de 8 bits reduce 4,096–65,536 niveles de densidad a
              solo 256 tonos e invalida el ventaneo diagnóstico remoto.
            </p>
          </div>
        </div>
      </section>

      {/* Why DICOM in Transmission & Storage */}
      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Layers className="h-7 w-7 text-teal-700" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            Jerarquía Paciente - Estudio - Serie - Instancia
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Mediante identificadores únicos universales (<code>StudyInstanceUID</code>,{' '}
            <code>SeriesInstanceUID</code>, <code>SOPInstanceUID</code>), DICOM impide mezclar
            cortes tomográficos entre pacientes distintos durante la transmisión remota.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Network className="h-7 w-7 text-sky-700" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            Interoperabilidad PACS y Estaciones Clínicas
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Los objetos <code>.dcm</code> descargados desde nuestra plataforma cumplen con NEMA
            PS3.10 (<em>Explicit VR Little Endian</em>), permitiendo abrirlos en 3D Slicer, Horos,
            OsiriX o RadiAnt sin conversión.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Database className="h-7 w-7 text-indigo-700" />
          <h3 className="mt-3 text-base font-bold text-slate-900">
            Integridad Binaria Verificada (SHA-256)
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Cada corte cargado calcula su huella criptográfica SHA-256 y la incluye en el manifiesto
            de descarga, garantizando que ni un solo bit de la matriz diagnóstica fue alterado en
            tránsito.
          </p>
        </div>
      </section>

      {/* Security & Privacy Architecture Section (Instruction 3) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-teal-700 uppercase">
          <Lock className="h-4 w-4" />
          Arquitectura de Privacidad, Cifrado y Permisos de Acceso
        </div>
        <h2 className="mt-1 text-xl font-bold text-slate-900">
          Protocolos Implementados vs. Infraestructura Hospitalaria Certificada
        </h2>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              <KeyRound className="h-4 w-4 text-emerald-700" />
              Controles Activos en Producción (Sin Costo Adicional)
            </div>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Cifrado en Tránsito TLS 1.3 (HTTPS):</strong> Toda transferencia de
                  archivos DICOM y credenciales viaja cifrada extremo a extremo en la red global de
                  Cloudflare.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Derivación de Contraseñas PBKDF2-SHA256:</strong> 100,000 iteraciones con
                  sal criptográfica aleatoria de 128 bits y cookies de sesión{' '}
                  <code>HttpOnly / SameSite=Lax</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Control de Acceso Basado en Roles (RBAC):</strong> Segregación estricta en
                  el servidor que restringe la carga a Pacientes/Clínicas y reserva la bandeja global
                  y firma diagnóstica a Médicos Especialistas.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Anonimización Cliente DICOM PS3.15:</strong> Opción en el navegador para
                  depurar etiquetas identificables <code>(0010,0010)</code> y{' '}
                  <code>(0008,0080)</code> antes de transmitir el archivo.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Escalamiento Hospitalario Regulado (Servicios Empresariales con Costo)
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Para operación clínica comercial a gran escala bajo normativas como{' '}
              <strong>NOM-024-SSA3-2012</strong> (México) o <strong>HIPAA</strong> (EE. UU.), se
              integran capas empresariales adicionales:
            </p>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-700">
              <li>
                • <strong>Gestión de Llaves Dedicadas (KMS / CloudHSM):</strong> Cifrado en reposo
                AES-256-GCM con rotación automática de llaves administradas por el hospital.
              </li>
              <li>
                • <strong>Convenios BAA y Nube Médica Dedicada:</strong> Instancias certificadas ISO
                27001 / SOC2 Tipo II y servidores VNA/DICOMweb empresariales.
              </li>
              <li>
                • <strong>Firma Electrónica Avanzada (e.firma / FIEL):</strong> Sellado de tiempo
                legal en dictámenes radiológicos e interoperabilidad HL7 FHIR.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
