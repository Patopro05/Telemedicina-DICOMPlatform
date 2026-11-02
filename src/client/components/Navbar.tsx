import {
  BookOpen,
  Building2,
  Download,
  FileStack,
  LogOut,
  Menu,
  Stethoscope,
  Upload,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BRAND } from '../config/branding';
import { useAuth } from '../context/AuthContext';
import { getRoleLabel } from '../lib/api';

export function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    navigate('/');
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const RoleIcon =
    user?.role === 'specialist'
      ? Stethoscope
      : user?.role === 'clinic'
        ? Building2
        : User;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            {/* Small Heart Logo from SVG */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#517327]/10 p-1.5 transition group-hover:bg-[#517327]/20">
              <img src="/imaris_heart.svg" alt="ImaRis Heart Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <span className="block text-lg font-extrabold tracking-tight text-slate-900">
                Ima<span className="text-[#517327]">Ris</span>
              </span>
              <span className="block text-[10.5px] font-medium text-slate-500">
                {BRAND.tagline}
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1.5 md:flex">
            <Link
              to="/guia-dicom"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                isActive('/guia-dicom')
                  ? 'bg-[#517327]/12 text-[#517327]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <BookOpen className="h-4 w-4 text-[#517327]" />
              Estándar DICOM y Seguridad
            </Link>

            {user && (user.role === 'patient' || user.role === 'clinic') && (
              <>
                <Link
                  to="/panel/cargar"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    isActive('/panel/cargar')
                      ? 'bg-[#517327]/12 text-[#517327]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Upload className="h-4 w-4 text-[#517327]" />
                  Carga de Archivos DICOM
                </Link>
                <Link
                  to="/panel/estudios"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    isActive('/panel/estudios')
                      ? 'bg-[#517327]/12 text-[#517327]'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <FileStack className="h-4 w-4 text-[#517327]" />
                  Mis Estudios y Diagnósticos
                </Link>
              </>
            )}

            {user && user.role === 'specialist' && (
              <Link
                to="/panel/descarga"
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  isActive('/panel/descarga') || isActive('/panel/estudios')
                    ? 'bg-[#517327]/12 text-[#517327]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Download className="h-4 w-4 text-[#517327]" />
                Descarga y Consulta de Estudios
              </Link>
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-[#517327]/5 px-3 py-1.5">
                <RoleIcon className="h-4 w-4 text-[#517327]" />
                <div className="text-left leading-tight">
                  <div className="max-w-[180px] truncate text-xs font-semibold text-slate-900">
                    {user.institutionName || user.fullName}
                  </div>
                  <div className="text-[10px] font-semibold text-[#517327]">
                    {getRoleLabel(user.role)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <LogOut className="h-3.5 w-3.5" />
                Salir
              </button>
            </>
          ) : (
            <>
              <Link
                to="/acceso"
                className="rounded-lg px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Iniciar Sesión
              </Link>
              <Link
                to="/registro"
                className="rounded-lg bg-[#3B5CA8] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#5A75BC]"
              >
                Crear Cuenta
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Abrir menú de navegación"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1.5">
            <Link
              to="/guia-dicom"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Estándar DICOM y Seguridad
            </Link>
            {user && (user.role === 'patient' || user.role === 'clinic') && (
              <>
                <Link
                  to="/panel/cargar"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Carga de Archivos DICOM
                </Link>
                <Link
                  to="/panel/estudios"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Mis Estudios y Diagnósticos
                </Link>
              </>
            )}
            {user && user.role === 'specialist' && (
              <Link
                to="/panel/descarga"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Descarga y Consulta de Estudios
              </Link>
            )}
            <div className="my-2 border-t border-slate-100" />
            {user ? (
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="rounded-lg bg-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-800"
              >
                Cerrar Sesión ({user.fullName})
              </button>
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/acceso"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 text-center text-xs font-bold text-slate-700"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  to="/registro"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 rounded-lg bg-[#3B5CA8] py-2 text-center text-xs font-bold text-white hover:bg-[#5A75BC]"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
