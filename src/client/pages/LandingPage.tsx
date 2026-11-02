import {
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
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-stone-200 bg-gradient-to-b from-[#223110] via-[#151e0a] to-slate-950 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#617E3C]/40 bg-[#517327]/25 px-3.5 py-1 text-xs font-semibold text-[#a6cc72]">
                <img src="/imaris_heart.svg" alt="Heart Icon" className="h-4 w-4 object-contain inline" />
                Estándar Internacional ISO 12052 / NEMA PS3 (DICOM)
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:leading-[1.15]">
                Plataforma Web de Teleradiología{' '}
                <span className="text-[#a6cc72]">ImaRis</span>
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-stone-300 sm:text-lg">
                Intercambio clínico sin pérdida de estudios de Tomografía Axial Computarizada (TAC),
                Resonancia Magnética (RM) y Radiografía Digital entre pacientes, unidades
                hospitalarias y médicos especialistas para emisión oportuna de diagnósticos a
                distancia.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={primaryActionLink}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#3B5CA8] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#3B5CA8]/25 transition hover:bg-[#5A75BC]"
                >
                  {user ? 'Ir a mi Panel Clínico' : 'Acceder a la Plataforma'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                {!user && (
                  <Link
                    to="/registro"
                    className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-900/80 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    Registrar Usuario / Unidad Médica
                  </Link>
                )}
                <Link
                  to="/guia-dicom"
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-[#a6cc72] hover:text-white"
                >
                  Explorar Modalidades DICOM
                </Link>
              </div>
            </div>

            {/* Visual Brand & Workflow Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between border-b border-stone-800 pb-3">
                  <div className="flex items-center gap-2">
                    <img src="/imaris_heart.svg" alt="ImaRis Icon" className="h-6 w-6 object-contain" />
                    <span className="text-xs font-bold tracking-wider text-[#a6cc72] uppercase">
                      Flujo Clínico ImaRis
                    </span>
                  </div>
                  <span className="rounded bg-[#517327]/25 px-2 py-0.5 text-[11px] font-semibold text-[#a6cc72]">
                    Integridad SHA-256
                  </span>
                </div>
                <ol className="space-y-4">
                  <li className="flex gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#517327]/25 text-[#a6cc72]">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        1. Carga de Estudios (.dcm)
                      </div>
                      <p className="text-xs leading-relaxed text-stone-400">
                        Pacientes, clínicas y hospitales suben archivos DICOM individuales o series
                        multicorte con validación de cabecera y anonimización opcional PS3.15.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3B5CA8]/25 text-[#8aa5e8]">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        2. Consulta y Descarga para Especialistas
                      </div>
                      <p className="text-xs leading-relaxed text-stone-400">
                        El especialista descarga los objetos binarios originales (.dcm o paquete
                        .zip) o inspecciona Unidades Hounsfield directamente en el visor web 16-bit.
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#617E3C]/25 text-[#a6cc72]">
                      <FileCheck2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">
                        3. Dictamen Diagnóstico Remoto
                      </div>
                      <p className="text-xs leading-relaxed text-stone-400">
                        Emisión estructurada de hallazgos, impresión diagnóstica y recomendaciones
                        firmadas con cédula profesional, disponibles para descarga en PDF.
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
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#517327]/10 text-[#517327]">
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Pacientes y Usuarios</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Acceso a la pestaña de carga para compartir estudios realizados en gabinetes externos
              y seguimiento en tiempo real del dictamen emitido por el especialista.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#517327]" />
                Pestaña exclusiva de carga de archivos .dcm
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#517327]" />
                Opción de anonimización de metadatos personales
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#517327]" />
                Descarga de dictamen médico en PDF
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#617E3C]/10 text-[#617E3C]">
              <Building2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Clínicas y Hospitales</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Unidades médicas rurales o urbanas que requieren interconsulta radiológica remota
              clasificando estudios por prioridad clínica (Rutina, Urgente o STAT).
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#617E3C]" />
                Registro institucional con clave sanitaria / CLUES
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#617E3C]" />
                Carga de series multicorte TAC y Resonancia Magnética
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#617E3C]" />
                Vinculación automática con el expediente del paciente
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#3B5CA8]/10 text-[#3B5CA8]">
              <Stethoscope className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Médicos Especialistas</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Radiólogos y especialistas acreditados con acceso a la bandeja de descarga sin pérdida,
              estación de visualización 16-bit y emisión de diagnósticos remotos.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#3B5CA8]" />
                Pestaña de descarga directa (.dcm individual o .zip)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#3B5CA8]" />
                Ajuste de ventanas HU (Pulmón, Hueso, Cerebro)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#3B5CA8]" />
                Emisión y exportación de dictámenes diagnósticos en PDF
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Security & Integrity Banner */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#617E3C]/30 bg-gradient-to-r from-[#517327]/10 via-[#617E3C]/5 to-slate-50 p-8">
          <div className="grid items-center gap-6 md:grid-cols-12">
            <div className="md:col-span-8">
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wide text-[#517327] uppercase">
                <ShieldCheck className="h-4 w-4" />
                Integridad Diagnóstica y Protección de Datos
              </div>
              <h3 className="mt-1 text-xl font-bold text-slate-900">
                Preservación Binaria Sin Pérdida y Controles de Acceso
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                A diferencia de imágenes comprimidas convencionales (JPEG/PNG) que descartan rango
                dinámico, ImaRis conserva el flujo binario DICOM de 12 y 16 bits intacto,
                verificando cada carga y descarga con huellas criptográficas SHA-256 bajo transporte
                cifrado HTTPS/TLS 1.3 y sesiones protegidas PBKDF2-SHA256.
              </p>
            </div>
            <div className="flex md:col-span-4 md:justify-end">
              <Link
                to="/guia-dicom"
                className="inline-flex items-center gap-2 rounded-xl border border-[#517327] bg-white px-5 py-3 text-sm font-semibold text-[#517327] shadow-xs transition hover:bg-[#517327]/10"
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
