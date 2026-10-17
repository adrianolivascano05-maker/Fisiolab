import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { DbGate } from "./app/DbGate";
import { UpdateBanner } from "./app/pwa";
import { ToastProvider } from "./ui/Toast";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { JumpSetupPage } from "./pages/JumpSetupPage";
import { PatientFormPage } from "./pages/PatientFormPage";
import { PatientPage } from "./pages/PatientPage";
import { AsymmetryPage } from "./pages/AsymmetryPage";
import { PatientsPage } from "./pages/PatientsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { ResultPage } from "./pages/ResultPage";
import { RomSetupPage } from "./pages/RomSetupPage";
import { StrengthSetupPage } from "./pages/StrengthSetupPage";
import { NordicSetupPage } from "./pages/NordicSetupPage";
import { RunningSetupPage } from "./pages/RunningSetupPage";
import { SprintSetupPage } from "./pages/SprintSetupPage";
import { RomSummaryPage } from "./pages/RomSummaryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TestPickerPage } from "./pages/TestPickerPage";

// Las pantallas con librerías pesadas (gráficas, lector de vídeo) se cargan al entrar en ellas.
const DesignPage = lazy(() => import("./pages/DesignPage").then((m) => ({ default: m.DesignPage })));
const EvolutionPage = lazy(() => import("./pages/EvolutionPage").then((m) => ({ default: m.EvolutionPage })));
const MarkPage = lazy(() => import("./pages/MarkPage").then((m) => ({ default: m.MarkPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const ComparePage = lazy(() => import("./pages/ComparePage").then((m) => ({ default: m.ComparePage })));
const WellnessPage = lazy(() => import("./pages/WellnessPage").then((m) => ({ default: m.WellnessPage })));
const LoadVelocityPage = lazy(() => import("./pages/LoadVelocityPage").then((m) => ({ default: m.LoadVelocityPage })));
const RomHistoryPage = lazy(() => import("./pages/RomHistoryPage").then((m) => ({ default: m.RomHistoryPage })));
const RomMeasurePage = lazy(() => import("./pages/RomMeasurePage").then((m) => ({ default: m.RomMeasurePage })));
const VideoPage = lazy(() => import("./pages/VideoPage").then((m) => ({ default: m.VideoPage })));
const l = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

// En GitHub Pages la app vive en /Fisiolab/; en la raíz del dominio, en /.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

// Una ruta por pantalla del recon (replica/recon.md). Las de fases posteriores muestran cuándo llegan.
const router = createBrowserRouter([
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
  { path: "/tests/:id/marcar", element: l(<MarkPage />) }, // S07
  { path: "/tests/:id", element: <ResultPage /> }, // S08
  { path: "/comparar", element: l(<ComparePage />) }, // S23
  { path: "/ajustes", element: <SettingsPage /> }, // S24
  { path: "/privacidad", element: <PrivacyPage /> },
  { path: "/design", element: l(<DesignPage />) },
  { path: "*", element: <ComingSoonPage title="Página no encontrada" /> },
], { basename: BASENAME });

export function App() {
  useEffect(() => {
    // Pide al navegador que no borre los datos de la app por falta de espacio o por inactividad.
    void navigator.storage?.persist?.();
  }, []);
  return (
    <ToastProvider>
      <DbGate>
        <RouterProvider router={router} />
      </DbGate>
      <UpdateBanner />
    </ToastProvider>
  );
}
