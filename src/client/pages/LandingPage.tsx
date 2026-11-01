import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileCheck2,
  Lock,
  ShieldCheck,
  Stethoscope,
  Upload,
  UserCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LandingPage() {
  const { user } = useAuth();

  const primaryActionLink = user
    ? user.role === 'specialist'
      ? '/panel/descarga'
      : '/panel/cargar'
    : '/acceso';

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-teal-950 via-slate-900 to-slate-900 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1 text-xs font-semibold text-teal-300">
                <Activity className="h-3.5 w-3.5" />
                Estándar Internacional ISO 12052 / NEMA PS3 (DICOM)
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:leading-[1.15]">
                Plataforma Web de Teleradiología y Diagnóstico Remoto{' '}
                <span className="text-teal-400">DICOM</span>
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Intercambio clínico sin pérdida de estudios de Tomografía Axial Computarizada (TAC),
                Resonancia Magnética (RM) y Radiografía Digital entre pacientes, unidades
                hospitalarias y médicos especialistas para emisión oportuna de diagnósticos a
                distancia.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={primaryActionLink}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:bg-teal-400"
                >
                  {user ? 'Ir a mi Panel Clínico' : 'Acceder a la Plataforma'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {!user && (
                  <Link
                    to="/registro"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Registrar Usuario / Unidad Médica
                  </Link>
                )}
                <Link
                  to="/guia-dicom"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-teal-300 hover:text-teal-200"
                >
                  Explorar Modalidades DICOM
                </Link>
              </div>
            </div>

            {/* Workflow Summary Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold tracking-wider text-teal-400 uppercase">
                    Flujo Clínico de Telemedicina
                  </span>
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                    Verificación SHA-256
                  </span>
                </div>
                <ol className="space-y-4">
                  <li className="flex gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        1. Carga de Estudios (.dcm)
                      </div>
                      <p className="text-xs leading-relaxed text-slate-400">
                        Pacientes, clínicas y hospitales suben archivos DICOM individuales o series
                        multicorte con validación de cabecera y anonimización opcional PS3.15.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        2. Consulta y Descarga para Especialistas
                      </div>
                      <p className="text-xs leading-relaxed text-slate-400">
                        El especialista descarga los objetos binarios originales (.dcm o paquete
                        .zip) o inspecciona Unidades Hounsfield directamente en el visor web 16-bit.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                      <FileCheck2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        3. Dictamen Diagnóstico Remoto
                      </div>
                      <p className="text-xs leading-relaxed text-slate-400">
                        Emisión estructurada de hallazgos, impresión diagnóstica y recomendaciones
                        firmadas con cédula profesional, disponibles al instante para consulta e
                        impresión.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Three User Profiles Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
            Estructura de Acceso Basada en Roles Clínicos
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            Control estricto de permisos mediante autenticación cifrada y segregación de vistas para
            cada actor del ecosistema de salud a distancia.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Pacientes y Usuarios</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Acceso a la pestaña de carga para compartir estudios realizados en gabinetes externos
              y seguimiento en tiempo real del dictamen emitido por el especialista.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                Pestaña exclusiva de carga de archivos .dcm
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                Opción de anonimización de metadatos personales
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-600" />
                Consulta e impresión de reporte médico firmado
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Clínicas y Hospitales</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Unidades médicas rurales o urbanas que requieren interconsulta radiológica remota
              clasificando estudios por prioridad clínica (Rutina, Urgente o STAT).
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sky-600" />
                Registro institucional con clave sanitaria / CLUES
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sky-600" />
                Carga de series multicorte TAC y Resonancia Magnética
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sky-600" />
                Vinculación automática con el expediente del paciente
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Stethoscope className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Médicos Especialistas</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Radiólogos y especialistas acreditados con acceso a la bandeja de descarga sin pérdida,
              estación de visualización 16-bit y emisión de diagnósticos remotos.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                Pestaña de descarga directa (.dcm individual o .zip)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                Ajuste de ventanas HU (Pulmón, Hueso, Cerebro)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                Emisión y actualización de dictámenes diagnósticos
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Security & Integrity Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-slate-50 p-8">
          <div className="grid items-center gap-6 md:grid-cols-12">
            <div className="md:col-span-8">
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wide text-teal-800 uppercase">
                <ShieldCheck className="h-4 w-4" />
                Integridad Diagnóstica y Protección de Datos
              </div>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Preservación Binaria Sin Pérdida y Controles de Acceso
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                A diferencia de imágenes comprimidas convencionales (JPEG/PNG) que descartan rango
                dinámico, esta plataforma conserva el flujo binario DICOM de 12 y 16 bits intacto,
                verificando cada carga y descarga con huellas criptográficas SHA-256 bajo transporte
                cifrado HTTPS/TLS 1.3 y sesiones protegidas PBKDF2-SHA256.
              </p>
            </div>
            <div className="flex md:col-span-4 md:justify-end">
              <Link
                to="/guia-dicom"
                className="inline-flex items-center gap-2 rounded-xl border border-teal-700 bg-white px-5 py-3 text-sm font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50"
              >
                <Lock className="h-4 w-4" />
                Ver Revisión Técnica DICOM
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
