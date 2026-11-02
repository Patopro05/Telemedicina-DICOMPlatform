import {
  AlertCircle,
  ArrowRight,
  Building2,
  KeyRound,
  Stethoscope,
  User,
} from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  {
    roleLabel: 'Paciente / Usuario',
    name: 'Carlos Mendoza Treviño',
    email: 'paciente@telemed.mx',
    description: 'Cargar estudios propios y consultar diagnósticos emitidos.',
    icon: User,
    accent: 'border-[#517327]/30 hover:border-[#517327] bg-[#517327]/5',
  },
  {
    roleLabel: 'Clínica / Hospital',
    name: 'Hospital Regional Monterrey',
    email: 'clinica@telemed.mx',
    description: 'Cargar series TAC/RM de pacientes con prioridad clínica.',
    icon: Building2,
    accent: 'border-[#617E3C]/30 hover:border-[#617E3C] bg-[#617E3C]/5',
  },
  {
    roleLabel: 'Médico Especialista',
    name: 'Dra. Valeria Garza Elizondo',
    email: 'especialista@telemed.mx',
    description: 'Pestaña de descarga DICOM (.dcm/.zip), visor HU y firma de diagnóstico.',
    icon: Stethoscope,
    accent: 'border-[#3B5CA8]/30 hover:border-[#3B5CA8] bg-[#3B5CA8]/5',
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectForRole = (role: string) => {
    if (role === 'specialist') {
      navigate('/panel/descarga');
    } else {
      navigate('/panel/estudios');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const logged = await login(email, password);
      redirectForRole(logged.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const logged = await login(demoEmail, 'Telemed2026!');
      redirectForRole(logged.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la sesión demostrativa.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Standard Credentials Login */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8 lg:col-span-6">
          <div className="mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#517327]/10 p-2 text-[#517327]">
              <img src="/imaris_heart.svg" alt="ImaRis Icon" className="h-full w-full object-contain" />
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900">
              Acceso a <span className="text-[#517327]">ImaRis</span>
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Ingrese con su correo electrónico y contraseña según su perfil clínico asignado.
            </p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#9C3B47]/30 bg-[#9C3B47]/10 p-3.5 text-xs font-semibold text-[#9C3B47]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#9C3B47]" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@institucion.mx"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#3B5CA8] focus:ring-2 focus:ring-[#3B5CA8]/15 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-[#3B5CA8] focus:ring-2 focus:ring-[#3B5CA8]/15 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B5CA8] px-4 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#5A75BC] disabled:opacity-60"
            >
              {submitting ? 'Verificando credenciales...' : 'Iniciar Sesión'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">
            ¿Aún no cuenta con registro?{' '}
            <Link to="/registro" className="font-bold text-[#3B5CA8] hover:underline">
              Crear cuenta nueva (Paciente, Clínica o Especialista)
            </Link>
          </p>
        </div>

        {/* One-Click Demo Access for Evaluation */}
        <div className="rounded-2xl border border-stone-200 bg-stone-100/70 p-6 sm:p-8 lg:col-span-6">
          <div className="mb-4">
            <span className="inline-block rounded-md bg-[#517327] px-2.5 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
              Acceso Rápido de Evaluación
            </span>
            <h2 className="mt-2 text-base font-bold text-slate-900">
              Cuentas Preconfiguradas con Estudios DICOM
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              Seleccione cualquiera de los tres perfiles clínicos para validar de inmediato los
              permisos de carga, descarga binaria <code>.dcm</code> y emisión de diagnóstico remoto
              (Contraseña: <code>Telemed2026!</code>).
            </p>
          </div>

          <div className="space-y-3">
            {DEMO_ACCOUNTS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.email}
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleDemoLogin(acc.email)}
                  className={`flex w-full items-start gap-3.5 rounded-xl border bg-white p-4 text-left shadow-xs transition ${acc.accent} disabled:opacity-60`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-xs ring-1 ring-stone-200">
                    <Icon className="h-5 w-5 text-slate-800" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{acc.roleLabel}</span>
                      <span className="font-mono text-[11px] text-slate-500">{acc.email}</span>
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-[#517327]">{acc.name}</div>
                    <p className="mt-1 text-xs text-slate-600">{acc.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
