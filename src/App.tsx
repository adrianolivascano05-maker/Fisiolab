import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { DbGate } from "./app/DbGate";
import { SignInSetupPage } from "./cloud/AccountPages";
import { CloudGate } from "./cloud/CloudGate"; // Cuenta de Google y copia en Drive (src/cloud/README.md)
import { UpdateBanner } from "./app/pwa";
import { AppLock } from "./privacy/AppLock"; // PIN para abrir la app (src/privacy/README.md)
import { ToastProvider } from "./ui/Toast";
import { freeRoutes } from "./free/routes"; // Módulo experimental (src/free/README.md)
import { galleryRoutes } from "./gallery/routes"; // Galería de tests (src/gallery/README.md)
import { clinicalRoutes } from "./clinical/routes"; // Ficha clínica: anamnesis, exploración, mediciones y sesiones
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { JumpSetupPage } from "./pages/JumpSetupPage";
import { PatientFormPage } from "./pages/PatientFormPage";
import { PatientPage } from "./pages/PatientPage";
import { AsymmetryPage } from "./pages/AsymmetryPage";
import { PatientsPage } from "./pages/PatientsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { HelpPage } from "./pages/HelpPage";
import { ResultPage } from "./pages/ResultPage";
import { RomSetupPage } from "./pages/RomSetupPage";
import { StrengthSetupPage } from "./pages/StrengthSetupPage";
import { NordicSetupPage } from "./pages/NordicSetupPage";
import { RunningSetupPage } from "./pages/RunningSetupPage";
import { SprintSetupPage } from "./pages/SprintSetupPage";
import { RomSummaryPage } from "./pages/RomSummaryPage";
import { AccountSettingsPage, ClinicSettingsPage, DataSettingsPage, LockSettingsPage, SettingsPage } from "./pages/SettingsPage";
import { TestPickerPage } from "./pages/TestPickerPage";

// Las pantallas con librerías pesadas (gráficas, lector de vídeo) se cargan al entrar en ellas.
const DesignPage = lazy(() => import("./pages/DesignPage").then((m) => ({ default: m.DesignPage })));
const EvolutionPage = lazy(() => import("./pages/EvolutionPage").then((m) => ({ default: m.EvolutionPage })));
const MarkPage = lazy(() => import("./pages/MarkPage").then((m) => ({ default: m.MarkPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const ComparePage = lazy(() => import("./pages/ComparePage").then((m) => ({ default: m.ComparePage })));
const ValidationPage = lazy(() => import("./pages/ValidationPage").then((m) => ({ default: m.ValidationPage })));
const SensorCheckPage = lazy(() => import("./pages/SensorCheckPage").then((m) => ({ default: m.SensorCheckPage })));
const WellnessPage = lazy(() => import("./pages/WellnessPage").then((m) => ({ default: m.WellnessPage })));
const LoadVelocityPage = lazy(() => import("./pages/LoadVelocityPage").then((m) => ({ default: m.LoadVelocityPage })));
const RomHistoryPage = lazy(() => import("./pages/RomHistoryPage").then((m) => ({ default: m.RomHistoryPage })));
const RomMeasurePage = lazy(() => import("./pages/RomMeasurePage").then((m) => ({ default: m.RomMeasurePage })));
const VideoPage = lazy(() => import("./pages/VideoPage").then((m) => ({ default: m.VideoPage })));
const InstallPage = lazy(() => import("./pages/InstallPage").then((m) => ({ default: m.InstallPage })));
const l = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

// En GitHub Pages la app vive en /Fisiolab/; en la raíz del dominio, en /.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

// Una ruta por pantalla del recon (replica/recon.md). Las de fases posteriores muestran cuándo llegan.
const routes = [
  { path: "/", element: <PatientsPage /> }, // S01
  { path: "/pacientes/nuevo", element: <PatientFormPage /> }, // S03
  { path: "/pacientes/:id", element: <PatientPage /> }, // S02
  { path: "/pacientes/:id/editar", element: <PatientFormPage /> }, // S03
  { path: "/pacientes/:id/test", element: <TestPickerPage /> }, // S04
  { path: "/pacientes/:id/test/saltos", element: <JumpSetupPage /> }, // S05
  { path: "/pacientes/:id/test/saltos/video", element: l(<VideoPage />) }, // S06
  { path: "/pacientes/:id/test/fuerza", element: <StrengthSetupPage /> }, // S13
  { path: "/pacientes/:id/test/fuerza/video", element: l(<VideoPage />) }, // S06 para fuerza
  { path: "/pacientes/:id/test/sprint", element: <SprintSetupPage /> }, // S15-S16
  { path: "/pacientes/:id/test/sprint/video", element: l(<VideoPage />) }, // S06 para sprint y cambio de dirección
  { path: "/pacientes/:id/test/carrera", element: <RunningSetupPage /> }, // S18
  { path: "/pacientes/:id/test/carrera/video", element: l(<VideoPage />) }, // S06 para carrera
  { path: "/pacientes/:id/test/isquios", element: <NordicSetupPage /> }, // S20
  { path: "/pacientes/:id/test/isquios/video", element: l(<VideoPage />) }, // S06 para el nórdico
  { path: "/pacientes/:id/test/movilidad", element: <RomSetupPage /> }, // S19
  { path: "/pacientes/:id/test/movilidad/medir", element: l(<RomMeasurePage />) }, // S19
  { path: "/pacientes/:id/test/:categoria", element: <ComingSoonPage /> }, // S13-S21
  { path: "/pacientes/:id/perfil/fv", element: l(<ProfilePage />) }, // S09
  { path: "/pacientes/:id/perfil/carga-velocidad", element: l(<LoadVelocityPage />) }, // S14
  { path: "/pacientes/:id/asimetria", element: <AsymmetryPage /> }, // S10
  { path: "/pacientes/:id/movilidad", element: <RomSummaryPage /> }, // S19
  { path: "/pacientes/:id/movilidad/:mov", element: l(<RomHistoryPage />) }, // S19
  { path: "/pacientes/:id/bienestar", element: l(<WellnessPage />) }, // S21
  { path: "/pacientes/:id/evolucion/:tipo", element: l(<EvolutionPage />) }, // S22
  ...clinicalRoutes, // Ficha clínica
  ...freeRoutes, // Medición libre (experimental)
  ...galleryRoutes, // Galería de tests de exploración
  { path: "/tests/:id/marcar", element: l(<MarkPage />) }, // S07
  { path: "/tests/:id", element: <ResultPage /> }, // S08
  { path: "/comparar", element: l(<ComparePage />) }, // S23
  { path: "/validacion", element: l(<ValidationPage />) },
  { path: "/validacion/sensor", element: l(<SensorCheckPage />) },
  { path: "/ajustes", element: <SettingsPage /> }, // S24
  { path: "/ajustes/cuenta", element: <AccountSettingsPage /> },
  { path: "/ajustes/clinica", element: <ClinicSettingsPage /> },
  { path: "/ajustes/bloqueo", element: <LockSettingsPage /> },
  { path: "/ajustes/datos", element: <DataSettingsPage /> },
  { path: "/ayuda", element: <HelpPage /> }, // Cómo se usa
  { path: "/privacidad", element: <PrivacyPage /> },
  { path: "/cuenta", element: <SignInSetupPage /> }, // Iniciar sesión con Google (sin el ID de cliente publicado)
  { path: "/instalar", element: l(<InstallPage />) }, // Usar la app en otros dispositivos
  { path: "/design", element: l(<DesignPage />) },
  { path: "*", element: <ComingSoonPage title="Página no encontrada" /> },
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
      <CloudGate>
        <AppLock>
          <DbGate>
            <Router />
          </DbGate>
        </AppLock>
      </CloudGate>
      <UpdateBanner />
    </ToastProvider>
  );
}
