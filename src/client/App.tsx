import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { AuthProvider } from './context/AuthContext';
import { DicomGuidePage } from './pages/DicomGuidePage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StudiesListPage } from './pages/StudiesListPage';
import { StudyDetailPage } from './pages/StudyDetailPage';
import { UploadStudyPage } from './pages/UploadStudyPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="flex min-h-screen flex-col bg-slate-50">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/guia-dicom" element={<DicomGuidePage />} />
              <Route path="/acceso" element={<LoginPage />} />
              <Route path="/registro" element={<RegisterPage />} />
              <Route path="/panel/cargar" element={<UploadStudyPage />} />
              <Route path="/panel/estudios" element={<StudiesListPage />} />
              <Route path="/panel/descarga" element={<StudiesListPage />} />
              <Route path="/panel/estudios/:id" element={<StudyDetailPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="no-print border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
            <div className="mx-auto max-w-7xl px-4">
              TeleMed DICOM · Plataforma de Diagnóstico Médico a Distancia (Estándar ISO 12052 / NEMA
              PS3) · Materia: Telemedicina
            </div>
          </footer>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
