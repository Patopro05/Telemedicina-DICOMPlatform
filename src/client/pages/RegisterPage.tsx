import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Stethoscope,
  User,
  UserPlus,
} from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { UserRole } from '../../shared/types';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>('patient');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');

  // Clinic fields
  const [institutionName, setInstitutionName] = useState('');
  const [cluesCode, setCluesCode] = useState('');

  // Specialist fields
  const [medicalLicense, setMedicalLicense] = useState('');
  const [specialty, setSpecialty] = useState('Radiología e Imagen Diagnóstica');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const created = await register({
        role,
        fullName,
        email,
        password,
        phone,
        institutionName: role === 'clinic' ? institutionName : undefined,
        cluesCode: role === 'clinic' ? cluesCode : undefined,
        medicalLicense: role === 'specialist' ? medicalLicense : undefined,
        specialty: role === 'specialist' ? specialty : undefined,
      });

      if (created.role === 'specialist') {
        navigate('/panel/descarga');
      } else {
        navigate('/panel/cargar');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar el registro.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:p-8">
        <div className="mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#517327]/10 p-2 text-[#517327]">
            <img src="/imaris_heart.svg" alt="ImaRis Heart" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            Registro en <span className="text-[#517327]">ImaRis</span>
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            Seleccione el perfil de acceso correspondiente para configurar sus permisos de carga o
            diagnóstico remoto de estudios DICOM.
          </p>
        </div>

        {/* Role Selector */}
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setRole('patient')}
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
              role === 'patient'
                ? 'border-[#517327] bg-[#517327]/10 ring-2 ring-[#517327]/20'
                : 'border-stone-200 hover:bg-stone-50'
            }`}
          >
            <User className="h-5 w-5 text-[#517327]" />
            <span className="mt-2 text-sm font-bold text-slate-900">Paciente / Usuario</span>
            <span className="mt-0.5 text-[11px] text-slate-600">
              Carga de estudios propios y consulta de dictámenes.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRole('clinic')}
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
              role === 'clinic'
                ? 'border-[#617E3C] bg-[#617E3C]/10 ring-2 ring-[#617E3C]/20'
                : 'border-stone-200 hover:bg-stone-50'
            }`}
          >
            <Building2 className="h-5 w-5 text-[#617E3C]" />
            <span className="mt-2 text-sm font-bold text-slate-900">Clínica / Hospital</span>
            <span className="mt-0.5 text-[11px] text-slate-600">
              Carga institucional de estudios de pacientes.
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRole('specialist')}
            className={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
              role === 'specialist'
                ? 'border-[#3B5CA8] bg-[#3B5CA8]/10 ring-2 ring-[#3B5CA8]/20'
                : 'border-stone-200 hover:bg-stone-50'
            }`}
          >
            <Stethoscope className="h-5 w-5 text-[#3B5CA8]" />
            <span className="mt-2 text-sm font-bold text-slate-900">Médico Especialista</span>
            <span className="mt-0.5 text-[11px] text-slate-600">
              Descarga DICOM, visor clínico y diagnóstico remoto.
            </span>
          </button>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-[#9C3B47]/30 bg-[#9C3B47]/10 p-3.5 text-xs font-semibold text-[#9C3B47]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#9C3B47]" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                {role === 'clinic' ? 'Nombre del Responsable Sanitario *' : 'Nombre Completo *'}
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={
                  role === 'specialist' ? 'Dr. Alejandro Rivera' : 'Nombre y apellidos'
                }
                className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-[#3B5CA8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Teléfono de Contacto
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+52 81 0000 0000"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-[#3B5CA8] focus:outline-none"
              />
            </div>
          </div>

          {role === 'clinic' && (
            <div className="grid gap-4 rounded-xl border border-[#617E3C]/30 bg-[#617E3C]/5 p-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Nombre de la Clínica u Hospital *
                </label>
                <input
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="Hospital General / Clínica Imagen"
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-[#617E3C] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Clave CLUES / Registro Sanitario
                </label>
                <input
                  type="text"
                  value={cluesCode}
                  onChange={(e) => setCluesCode(e.target.value)}
                  placeholder="Ej. NLSSA012345"
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-[#617E3C] focus:outline-none"
                />
              </div>
            </div>
          )}

          {role === 'specialist' && (
            <div className="grid gap-4 rounded-xl border border-[#3B5CA8]/30 bg-[#3B5CA8]/5 p-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Cédula Profesional / Especialidad *
                </label>
                <input
                  type="text"
                  required
                  value={medicalLicense}
                  onChange={(e) => setMedicalLicense(e.target.value)}
                  placeholder="Ej. CED-7829104"
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-[#3B5CA8] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Especialidad Médica *
                </label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm focus:border-[#3B5CA8] focus:outline-none"
                >
                  <option value="Radiología e Imagen Diagnóstica">
                    Radiología e Imagen Diagnóstica
                  </option>
                  <option value="Neurorradiología">Neurorradiología</option>
                  <option value="Imagen Cardiotorácica">Imagen Cardiotorácica</option>
                  <option value="Medicina Interna / Telemedicina">
                    Medicina Interna / Telemedicina
                  </option>
                  <option value="Traumatología y Ortopedia">Traumatología y Ortopedia</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Correo Electrónico *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.mx"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-[#3B5CA8] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Contraseña (mínimo 8 caracteres) *
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="mt-1 w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-[#3B5CA8] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B5CA8] px-5 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#5A75BC] disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {submitting ? 'Registrando cuenta...' : 'Completar Registro e Ingresar'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-600">
          ¿Ya tiene una cuenta registrada?{' '}
          <Link to="/acceso" className="font-bold text-[#3B5CA8] hover:underline">
            Iniciar sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
