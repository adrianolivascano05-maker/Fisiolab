// Rutas de la ficha clínica (anamnesis, exploración, mediciones, cuestionarios, sesiones, informe e informe de alta).
// La ficha del paciente (/pacientes/:id) es el resumen y vive en src/pages/PatientPage.tsx.
import { lazy, Suspense } from "react";

const pages = () => import("./ClinicalPages");
const AnamnesisPage = lazy(() => pages().then((m) => ({ default: m.AnamnesisPage })));
const exploration = () => import("./ExplorationPages");
const ExplorationPage = lazy(() => exploration().then((m) => ({ default: m.ExplorationPage })));
const FindingFormPage = lazy(() => exploration().then((m) => ({ default: m.FindingFormPage })));
const MeasurementsPage = lazy(() => pages().then((m) => ({ default: m.MeasurementsPage })));
const SessionsPage = lazy(() => pages().then((m) => ({ default: m.SessionsPage })));
const SessionFormPage = lazy(() => pages().then((m) => ({ default: m.SessionFormPage })));
const QuestionnairesPage = lazy(() => pages().then((m) => ({ default: m.QuestionnairesPage })));
const QuestionnaireFormPage = lazy(() => pages().then((m) => ({ default: m.QuestionnaireFormPage })));
const ReportPage = lazy(() => import("./ReportPage").then((m) => ({ default: m.ReportPage })));
const AttendancePage = lazy(() => import("./AttendancePage").then((m) => ({ default: m.AttendancePage })));
const DischargePage = lazy(() => import("./DischargePage").then((m) => ({ default: m.DischargePage })));
const PatientPrivacyPage = lazy(() => import("../privacy/PatientPrivacyPage").then((m) => ({ default: m.PatientPrivacyPage })));
const consents = () => import("../consent/ConsentPages");
const ConsentListPage = lazy(() => consents().then((m) => ({ default: m.ConsentListPage })));
const ConsentNewPage = lazy(() => consents().then((m) => ({ default: m.ConsentNewPage })));
const ConsentViewPage = lazy(() => consents().then((m) => ({ default: m.ConsentViewPage })));
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
  { path: "/pacientes/:id/cuestionarios", element: l(<QuestionnairesPage />) },
  { path: "/pacientes/:id/cuestionarios/nuevo", element: l(<QuestionnaireFormPage />) },
  { path: "/pacientes/:id/cuestionarios/:qid", element: l(<QuestionnaireFormPage />) },
  { path: "/pacientes/:id/informe", element: l(<ReportPage />) },
  { path: "/pacientes/:id/justificante", element: l(<AttendancePage />) },
  { path: "/pacientes/:id/alta", element: l(<DischargePage />) },
  { path: "/pacientes/:id/proteccion-datos", element: l(<PatientPrivacyPage />) }, // src/privacy
  { path: "/pacientes/:id/consentimientos", element: l(<ConsentListPage />) }, // src/consent
  { path: "/pacientes/:id/consentimientos/nuevo", element: l(<ConsentNewPage />) },
  { path: "/pacientes/:id/consentimientos/:cid", element: l(<ConsentViewPage />) },
];
