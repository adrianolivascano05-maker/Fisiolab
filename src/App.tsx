import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { ToastProvider } from "./ui/Toast";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { JumpSetupPage } from "./pages/JumpSetupPage";
import { PatientFormPage } from "./pages/PatientFormPage";
import { PatientPage } from "./pages/PatientPage";
import { PatientsPage } from "./pages/PatientsPage";
import { ResultPage } from "./pages/ResultPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TestPickerPage } from "./pages/TestPickerPage";

// Las pantallas con librerías pesadas (gráficas, lector de vídeo) se cargan al entrar en ellas.
const DesignPage = lazy(() => import("./pages/DesignPage").then((m) => ({ default: m.DesignPage })));
const EvolutionPage = lazy(() => import("./pages/EvolutionPage").then((m) => ({ default: m.EvolutionPage })));
const MarkPage = lazy(() => import("./pages/MarkPage").then((m) => ({ default: m.MarkPage })));
const VideoPage = lazy(() => import("./pages/VideoPage").then((m) => ({ default: m.VideoPage })));
const l = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

// Una ruta por pantalla del recon (replica/recon.md). Las de fases posteriores muestran cuándo llegan.
const router = createBrowserRouter([
  { path: "/", element: <PatientsPage /> }, // S01
  { path: "/pacientes/nuevo", element: <PatientFormPage /> }, // S03
  { path: "/pacientes/:id", element: <PatientPage /> }, // S02
  { path: "/pacientes/:id/editar", element: <PatientFormPage /> }, // S03
  { path: "/pacientes/:id/test", element: <TestPickerPage /> }, // S04
  { path: "/pacientes/:id/test/saltos", element: <JumpSetupPage /> }, // S05
  { path: "/pacientes/:id/test/saltos/video", element: l(<VideoPage />) }, // S06
  { path: "/pacientes/:id/test/:categoria", element: <ComingSoonPage /> }, // S13-S21
  { path: "/pacientes/:id/perfil/:tipo", element: <ComingSoonPage title="Perfil" phase={2} /> }, // S09, S14
  { path: "/pacientes/:id/asimetria", element: <ComingSoonPage title="Asimetría" phase={2} /> }, // S10
  { path: "/pacientes/:id/bienestar", element: <ComingSoonPage title="Bienestar" phase={3} /> }, // S21
  { path: "/pacientes/:id/evolucion/:tipo", element: l(<EvolutionPage />) }, // S22
  { path: "/tests/:id/marcar", element: l(<MarkPage />) }, // S07
  { path: "/tests/:id", element: <ResultPage /> }, // S08
  { path: "/comparar", element: <ComingSoonPage title="Comparar pacientes" phase={4} /> }, // S23
  { path: "/ajustes", element: <SettingsPage /> }, // S24
  { path: "/design", element: l(<DesignPage />) },
  { path: "*", element: <ComingSoonPage title="Página no encontrada" /> },
]);

export function App() {
  useEffect(() => {
    // Pide al navegador que no borre los datos de la app por falta de espacio o por inactividad.
    void navigator.storage?.persist?.();
  }, []);
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
