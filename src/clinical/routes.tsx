// Rutas de la ficha clínica (anamnesis, exploración, mediciones, cuestionarios, sesiones e informe).
// La ficha del paciente (/pacientes/:id) es el resumen y vive en src/pages/PatientPage.tsx.
import { lazy, Suspense } from "react";

const pages = () => import("./ClinicalPages");
const AnamnesisPage = lazy(() => pages().then((m) => ({ default: m.AnamnesisPage })));
const ExplorationPage = lazy(() => pages().then((m) => ({ default: m.ExplorationPage })));
const FindingFormPage = lazy(() => pages().then((m) => ({ default: m.FindingFormPage })));
const MeasurementsPage = lazy(() => pages().then((m) => ({ default: m.MeasurementsPage })));
const SessionsPage = lazy(() => pages().then((m) => ({ default: m.SessionsPage })));
const SessionFormPage = lazy(() => pages().then((m) => ({ default: m.SessionFormPage })));
const QuestionnaireFormPage = lazy(() => pages().then((m) => ({ default: m.QuestionnaireFormPage })));
const ReportPage = lazy(() => import("./ReportPage").then((m) => ({ default: m.ReportPage })));
const l = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

export const clinicalRoutes = [
  { path: "/pacientes/:id/anamnesis", element: l(<AnamnesisPage />) },
  { path: "/pacientes/:id/exploracion", element: l(<ExplorationPage />) },
  { path: "/pacientes/:id/exploracion/nuevo", element: l(<FindingFormPage />) },
  { path: "/pacientes/:id/exploracion/:fid", element: l(<FindingFormPage />) },
  { path: "/pacientes/:id/mediciones", element: l(<MeasurementsPage />) },
  { path: "/pacientes/:id/sesiones", element: l(<SessionsPage />) },
  { path: "/pacientes/:id/sesiones/nueva", element: l(<SessionFormPage />) },
  { path: "/pacientes/:id/sesiones/:sid", element: l(<SessionFormPage />) },
  { path: "/pacientes/:id/cuestionarios/nuevo", element: l(<QuestionnaireFormPage />) },
  { path: "/pacientes/:id/cuestionarios/:qid", element: l(<QuestionnaireFormPage />) },
  { path: "/pacientes/:id/informe", element: l(<ReportPage />) },
];
