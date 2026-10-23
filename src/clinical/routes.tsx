// Rutas de la ficha clínica (anamnesis, valoración: exploración, cuestionarios y mediciones; sesiones, informe e informe de alta).
// La ficha del paciente (/pacientes/:id) es el resumen y vive en src/pages/PatientPage.tsx.
import { lazy, Suspense } from "react";
import { Navigate, useParams } from "react-router";

const pages = () => import("./ClinicalPages");
const AnamnesisPage = lazy(() => pages().then((m) => ({ default: m.AnamnesisPage })));
const exploration = () => import("./ExplorationPages");
const AssessmentPage = lazy(() => exploration().then((m) => ({ default: m.AssessmentPage })));
const FindingFormPage = lazy(() => exploration().then((m) => ({ default: m.FindingFormPage })));
const SessionsPage = lazy(() => pages().then((m) => ({ default: m.SessionsPage })));
const SessionFormPage = lazy(() => pages().then((m) => ({ default: m.SessionFormPage })));
const QuestionnaireFormPage = lazy(() => pages().then((m) => ({ default: m.QuestionnaireFormPage })));
const ReportPage = lazy(() => import("./ReportPage").then((m) => ({ default: m.ReportPage })));
const ReferralPage = lazy(() => import("./ReferralPage").then((m) => ({ default: m.ReferralPage })));
const AttendancePage = lazy(() => import("./AttendancePage").then((m) => ({ default: m.AttendancePage })));
const ExercisesPage = lazy(() => import("./ExercisesPage").then((m) => ({ default: m.ExercisesPage })));
const ReceiptPage = lazy(() => import("./ReceiptPage").then((m) => ({ default: m.ReceiptPage })));
const BillingPage = lazy(() => import("./BillingPage").then((m) => ({ default: m.BillingPage })));
const DischargePage = lazy(() => import("./DischargePage").then((m) => ({ default: m.DischargePage })));
const PatientPrivacyPage = lazy(() => import("../privacy/PatientPrivacyPage").then((m) => ({ default: m.PatientPrivacyPage })));
const consents = () => import("../consent/ConsentPages");
const ConsentListPage = lazy(() => consents().then((m) => ({ default: m.ConsentListPage })));
const ConsentNewPage = lazy(() => consents().then((m) => ({ default: m.ConsentNewPage })));
const ConsentViewPage = lazy(() => consents().then((m) => ({ default: m.ConsentViewPage })));
const SendFormsPage = lazy(() => import("../patientForm/SendFormsPage").then((m) => ({ default: m.SendFormsPage })));
const l = (el: React.ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

function ToAssessment({ block }: { block: string }) {
  const { id = "" } = useParams();
  return <Navigate to={{ pathname: `/pacientes/${id}/valoracion`, hash: block }} replace />;
}

export const clinicalRoutes = [
  { path: "/pacientes/:id/anamnesis", element: l(<AnamnesisPage />) },
  { path: "/pacientes/:id/formularios", element: l(<SendFormsPage />) },
  { path: "/pacientes/:id/valoracion", element: l(<AssessmentPage />) },
  // Las direcciones de antes (Exploración, Mediciones y Cuestionarios eran pestañas): abren Valoración en su bloque.
  { path: "/pacientes/:id/exploracion", element: <ToAssessment block="exploracion" /> },
  { path: "/pacientes/:id/exploracion/nuevo", element: l(<FindingFormPage />) },
  { path: "/pacientes/:id/exploracion/:fid", element: l(<FindingFormPage />) },
  { path: "/pacientes/:id/mediciones", element: <ToAssessment block="mediciones" /> },
  { path: "/pacientes/:id/sesiones", element: l(<SessionsPage />) },
  { path: "/pacientes/:id/sesiones/nueva", element: l(<SessionFormPage />) },
  { path: "/pacientes/:id/sesiones/:sid", element: l(<SessionFormPage />) },
  { path: "/pacientes/:id/cuestionarios", element: <ToAssessment block="cuestionarios" /> },
  { path: "/pacientes/:id/cuestionarios/nuevo", element: l(<QuestionnaireFormPage />) },
  { path: "/pacientes/:id/cuestionarios/:qid", element: l(<QuestionnaireFormPage />) },
  { path: "/pacientes/:id/informe", element: l(<ReportPage />) },
  { path: "/pacientes/:id/justificante", element: l(<AttendancePage />) },
  { path: "/pacientes/:id/derivacion", element: l(<ReferralPage />) },
  { path: "/pacientes/:id/alta", element: l(<DischargePage />) },
  { path: "/pacientes/:id/cobros", element: l(<BillingPage />) },
  { path: "/pacientes/:id/recibo/:pid", element: l(<ReceiptPage />) },
  { path: "/pacientes/:id/ejercicios", element: l(<ExercisesPage />) },
  { path: "/pacientes/:id/proteccion-datos", element: l(<PatientPrivacyPage />) }, // src/privacy
  { path: "/pacientes/:id/consentimientos", element: l(<ConsentListPage />) }, // src/consent
  { path: "/pacientes/:id/consentimientos/nuevo", element: l(<ConsentNewPage />) },
  { path: "/pacientes/:id/consentimientos/:cid", element: l(<ConsentViewPage />) },
];
