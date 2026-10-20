import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { DbGate } from "./app/DbGate";
import { CloudGate } from "./cloud/CloudGate"; // Cuenta de Google y copia en Drive (src/cloud/README.md)
import { UpdateBanner } from "./app/pwa";
import { AppLock } from "./privacy/AppLock"; // PIN para abrir la app (src/privacy/README.md)
import { ToastProvider } from "./ui/Toast";
import { freeRoutes } from "./free/routes"; // Ángulos en vídeo con IA, desde Movilidad (src/free/README.md)
import { galleryRoutes } from "./gallery/routes"; // Galería de tests (src/gallery/README.md)
import { clinicalRoutes } from "./clinical/routes"; // Ficha clínica: anamnesis, exploración, mediciones y sesiones
import { PatientsPage } from "./pages/PatientsPage";

// Al abrir la app solo se carga la lista de pacientes; cada pantalla se carga al entrar en ella (el service worker
// ya las tiene guardadas, así que es inmediato también sin conexión).
const AccountSettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.AccountSettingsPage })));
const AsymmetryPage = lazy(() => import("./pages/AsymmetryPage").then((m) => ({ default: m.AsymmetryPage })));
const ClinicSettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.ClinicSettingsPage })));
const DataSettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.DataSettingsPage })));
const SchedulePage = lazy(() => import("./schedule/SchedulePage").then((m) => ({ default: m.SchedulePage })));
const TeamPage = lazy(() => import("./cloud/TeamPage").then((m) => ({ default: m.TeamPage })));
const DesignPage = lazy(() => import("./pages/DesignPage").then((m) => ({ default: m.DesignPage })));
const EvolutionPage = lazy(() => import("./pages/EvolutionPage").then((m) => ({ default: m.EvolutionPage })));
const HelpPage = lazy(() => import("./pages/HelpPage").then((m) => ({ default: m.HelpPage })));
const InstallPage = lazy(() => import("./pages/InstallPage").then((m) => ({ default: m.InstallPage })));
const JumpSetupPage = lazy(() => import("./pages/JumpSetupPage").then((m) => ({ default: m.JumpSetupPage })));
const LoadVelocityPage = lazy(() => import("./pages/LoadVelocityPage").then((m) => ({ default: m.LoadVelocityPage })));
const LockSettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.LockSettingsPage })));
const MarkPage = lazy(() => import("./pages/MarkPage").then((m) => ({ default: m.MarkPage })));
const NordicSetupPage = lazy(() => import("./pages/NordicSetupPage").then((m) => ({ default: m.NordicSetupPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const PatientFormPage = lazy(() => import("./pages/PatientFormPage").then((m) => ({ default: m.PatientFormPage })));
const PatientPage = lazy(() => import("./pages/PatientPage").then((m) => ({ default: m.PatientPage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const ResultPage = lazy(() => import("./pages/ResultPage").then((m) => ({ default: m.ResultPage })));
const RomHistoryPage = lazy(() => import("./pages/RomHistoryPage").then((m) => ({ default: m.RomHistoryPage })));
const RomMeasurePage = lazy(() => import("./pages/RomMeasurePage").then((m) => ({ default: m.RomMeasurePage })));
const RomSetupPage = lazy(() => import("./pages/RomSetupPage").then((m) => ({ default: m.RomSetupPage })));
const RomSummaryPage = lazy(() => import("./pages/RomSummaryPage").then((m) => ({ default: m.RomSummaryPage })));
const RunningSetupPage = lazy(() => import("./pages/RunningSetupPage").then((m) => ({ default: m.RunningSetupPage })));
const SensorCheckPage = lazy(() => import("./pages/SensorCheckPage").then((m) => ({ default: m.SensorCheckPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const SignInSetupPage = lazy(() => import("./cloud/AccountPages").then((m) => ({ default: m.SignInSetupPage })));
const SprintSetupPage = lazy(() => import("./pages/SprintSetupPage").then((m) => ({ default: m.SprintSetupPage })));
const StrengthSetupPage = lazy(() => import("./pages/StrengthSetupPage").then((m) => ({ default: m.StrengthSetupPage })));
const TestPickerPage = lazy(() => import("./pages/TestPickerPage").then((m) => ({ default: m.TestPickerPage })));
const ValidationPage = lazy(() => import("./pages/ValidationPage").then((m) => ({ default: m.ValidationPage })));
const VideoPage = lazy(() => import("./pages/VideoPage").then((m) => ({ default: m.VideoPage })));
const WellnessPage = lazy(() => import("./pages/WellnessPage").then((m) => ({ default: m.WellnessPage })));
const l = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

// En GitHub Pages la app vive en /Fisiolab/; en la raíz del dominio, en /.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

// Una ruta por pantalla. Las direcciones que no existen muestran «Página no encontrada».
const routes = [
  { path: "/", element: <PatientsPage /> }, // S01
  { path: "/pacientes/nuevo", element: l(<PatientFormPage />) }, // S03
  { path: "/pacientes/:id", element: l(<PatientPage />) }, // S02
  { path: "/pacientes/:id/editar", element: l(<PatientFormPage />) }, // S03
  { path: "/pacientes/:id/test", element: l(<TestPickerPage />) }, // S04
  { path: "/pacientes/:id/test/saltos", element: l(<JumpSetupPage />) }, // S05
  { path: "/pacientes/:id/test/saltos/video", element: l(<VideoPage />) }, // S06
  { path: "/pacientes/:id/test/fuerza", element: l(<StrengthSetupPage />) }, // S13
  { path: "/pacientes/:id/test/fuerza/video", element: l(<VideoPage />) }, // S06 para fuerza
  { path: "/pacientes/:id/test/sprint", element: l(<SprintSetupPage />) }, // S15-S16
  { path: "/pacientes/:id/test/sprint/video", element: l(<VideoPage />) }, // S06 para sprint y cambio de dirección
  { path: "/pacientes/:id/test/carrera", element: l(<RunningSetupPage />) }, // S18
  { path: "/pacientes/:id/test/carrera/video", element: l(<VideoPage />) }, // S06 para carrera
  { path: "/pacientes/:id/test/isquios", element: l(<NordicSetupPage />) }, // S20
  { path: "/pacientes/:id/test/isquios/video", element: l(<VideoPage />) }, // S06 para el nórdico
  { path: "/pacientes/:id/test/movilidad", element: l(<RomSetupPage />) }, // S19
  { path: "/pacientes/:id/test/movilidad/medir", element: l(<RomMeasurePage />) }, // S19
  { path: "/pacientes/:id/perfil/fv", element: l(<ProfilePage />) }, // S09
  { path: "/pacientes/:id/perfil/carga-velocidad", element: l(<LoadVelocityPage />) }, // S14
  { path: "/pacientes/:id/asimetria", element: l(<AsymmetryPage />) }, // S10
  { path: "/pacientes/:id/movilidad", element: l(<RomSummaryPage />) }, // S19
  { path: "/pacientes/:id/movilidad/:mov", element: l(<RomHistoryPage />) }, // S19
  { path: "/pacientes/:id/bienestar", element: l(<WellnessPage />) }, // S21
  { path: "/pacientes/:id/evolucion/:tipo", element: l(<EvolutionPage />) }, // S22
  ...clinicalRoutes, // Ficha clínica
  ...freeRoutes, // Ángulos en vídeo con IA (experimental)
  ...galleryRoutes, // Galería de tests de exploración
  { path: "/tests/:id/marcar", element: l(<MarkPage />) }, // S07
  { path: "/tests/:id", element: l(<ResultPage />) }, // S08
  { path: "/validacion", element: l(<ValidationPage />) },
  { path: "/validacion/sensor", element: l(<SensorCheckPage />) },
  { path: "/ajustes", element: l(<SettingsPage />) }, // S24
  { path: "/ajustes/cuenta", element: l(<AccountSettingsPage />) },
  { path: "/ajustes/clinica", element: l(<ClinicSettingsPage />) },
  { path: "/ajustes/equipo", element: l(<TeamPage />) },
  { path: "/agenda", element: l(<SchedulePage />) },
  { path: "/horario", element: <Navigate to="/agenda" replace /> },
  { path: "/ajustes/bloqueo", element: l(<LockSettingsPage />) },
  { path: "/ajustes/datos", element: l(<DataSettingsPage />) },
  { path: "/ayuda", element: l(<HelpPage />) }, // Cómo se usa
  { path: "/privacidad", element: l(<PrivacyPage />) },
  { path: "/cuenta", element: l(<SignInSetupPage />) }, // Iniciar sesión con Google (sin el ID de cliente publicado)
  { path: "/instalar", element: l(<InstallPage />) }, // Usar la app en otros dispositivos
  // Catálogo de componentes: solo al desarrollar, no en la app publicada.
  ...(import.meta.env.DEV ? [{ path: "/design", element: l(<DesignPage />) }] : []),
  { path: "*", element: l(<NotFoundPage />) },
];

/** El router se crea al entrar (después de volver de Google, con la dirección ya en su sitio). */
function Router() {
  const [router] = useState(() => createBrowserRouter(routes, { basename: BASENAME }));
  return <RouterProvider router={router} />;
}

export function App() {
  useEffect(() => {
    // Pide al navegador que no borre los datos de la app por falta de espacio o por inactividad.
    void navigator.storage?.persist?.();
  }, []);
  return (
    <ToastProvider>
      {/* El PIN va por fuera: sale al instante y la app carga por detrás mientras se teclea. */}
      <AppLock>
        <CloudGate>
          <DbGate>
            <Router />
          </DbGate>
        </CloudGate>
      </AppLock>
      <UpdateBanner />
    </ToastProvider>
  );
}
