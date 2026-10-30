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
import { PatientsLayout } from "./app/PatientsLayout";
import { RouteError } from "./app/RouteError";
import { RouteFallback } from "./app/RouteFallback";
import { useDesktop } from "./app/useMediaQuery";
import { FormInboxGate } from "./patientForm/FormInboxGate"; // Respuestas de los pacientes a sus formularios, solo con clínica en el servidor
import { DocSync } from "./documents/DocsAutoSync"; // Archivos del paciente: subir lo pendiente y borrar lo borrado (src/documents)

// Al abrir la app solo se carga la lista de pacientes; cada pantalla se carga al entrar en ella (el service worker
// ya las tiene guardadas, así que es inmediato también sin conexión).
const AccountSettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.AccountSettingsPage })));
const LostChangesPage = lazy(() => import("./cloud/LostChangesPage").then((m) => ({ default: m.LostChangesPage })));
const AsymmetryPage = lazy(() => import("./pages/AsymmetryPage").then((m) => ({ default: m.AsymmetryPage })));
const ClinicSettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.ClinicSettingsPage })));
const DataSettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.DataSettingsPage })));
const StatsPage = lazy(() => import("./pages/StatsPage").then((m) => ({ default: m.StatsPage })));
const CustomFieldsPage = lazy(() => import("./pages/CustomFieldsPage").then((m) => ({ default: m.CustomFieldsPage })));
const ExerciseLibraryPage = lazy(() => import("./pages/ExerciseLibraryPage").then((m) => ({ default: m.ExerciseLibraryPage })));
const ClinicBillingPage = lazy(() => import("./pages/ClinicBillingPage").then((m) => ({ default: m.ClinicBillingPage })));
const ImportPatientsPage = lazy(() => import("./pages/ImportPatientsPage").then((m) => ({ default: m.ImportPatientsPage })));
const ProviderPage = lazy(() => import("./cloud/ProviderPage").then((m) => ({ default: m.ProviderPage })));
const SchedulePage = lazy(() => import("./schedule/SchedulePage").then((m) => ({ default: m.SchedulePage })));
const RemindersPage = lazy(() => import("./schedule/RemindersPage").then((m) => ({ default: m.RemindersPage })));
const OutboxPage = lazy(() => import("./schedule/OutboxPage").then((m) => ({ default: m.OutboxPage })));
const WaitlistPage = lazy(() => import("./schedule/WaitlistPage").then((m) => ({ default: m.WaitlistPage })));
const DebtorsPage = lazy(() => import("./schedule/DebtorsPage").then((m) => ({ default: m.DebtorsPage })));
const TeamPage = lazy(() => import("./cloud/TeamPage").then((m) => ({ default: m.TeamPage })));
const DesignPage = lazy(() => import("./pages/DesignPage").then((m) => ({ default: m.DesignPage })));
const EvolutionPage = lazy(() => import("./pages/EvolutionPage").then((m) => ({ default: m.EvolutionPage })));
const HelpPage = lazy(() => import("./pages/HelpPage").then((m) => ({ default: m.HelpPage })));
const LicensesPage = lazy(() => import("./pages/LicensesPage").then((m) => ({ default: m.LicensesPage })));
const ReportProblemPage = lazy(() => import("./pages/ReportProblemPage").then((m) => ({ default: m.ReportProblemPage })));
const InstallPage = lazy(() => import("./pages/InstallPage").then((m) => ({ default: m.InstallPage })));
const JumpSetupPage = lazy(() => import("./pages/JumpSetupPage").then((m) => ({ default: m.JumpSetupPage })));
const LoadVelocityPage = lazy(() => import("./pages/LoadVelocityPage").then((m) => ({ default: m.LoadVelocityPage })));
const LockSettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.LockSettingsPage })));
const AppearancePage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.AppearancePage })));
const BrandPage = lazy(() => import("./brand/BrandPage").then((m) => ({ default: m.BrandPage })));
const MessagesPage = lazy(() => import("./messages/MessagesPage").then((m) => ({ default: m.MessagesPage })));
const MarkPage = lazy(() => import("./pages/MarkPage").then((m) => ({ default: m.MarkPage })));
const NordicSetupPage = lazy(() => import("./pages/NordicSetupPage").then((m) => ({ default: m.NordicSetupPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const PatientFormPage = lazy(() => import("./pages/PatientFormPage").then((m) => ({ default: m.PatientFormPage })));
const PatientPage = lazy(() => import("./pages/PatientPage").then((m) => ({ default: m.PatientPage })));
const DesktopHome = lazy(() => import("./pages/DesktopHome").then((m) => ({ default: m.DesktopHome })));
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
// Lo que abre el paciente con su enlace: sin la base, sin PIN y sin cuenta.
const PublicFormPage = lazy(() => import("./patientForm/PublicFormPage").then((m) => ({ default: m.PublicFormPage })));
// Compartir → OmniClin (Android): archivos que llegan de otra app para la ficha de un paciente.
const SharedFilesPage = lazy(() => import("./documents/SharedFilesPage").then((m) => ({ default: m.SharedFilesPage })));
const OldLinkPage = lazy(() => import("./app/OldLinkPage").then((m) => ({ default: m.OldLinkPage })));
const OpenEncryptedPage = lazy(() => import("./export/OpenEncrypted").then((m) => ({ default: m.OpenEncryptedPage })));
const ToBillPage = lazy(() => import("./invoices/ToBillPage").then((m) => ({ default: m.ToBillPage })));
const IssuedInvoicesPage = lazy(() => import("./invoices/IssuedInvoicesPage").then((m) => ({ default: m.IssuedInvoicesPage })));
const InvoicePage = lazy(() => import("./invoices/InvoicePage").then((m) => ({ default: m.InvoicePage })));
/** Mientras llega el código de una pantalla: la barra y un esqueleto gris, no una pantalla en blanco. */
const l = (el: ReactNode) => <Suspense fallback={<RouteFallback />}>{el}</Suspense>;

// En GitHub Pages la app vive en /Fisiolab/; en la raíz del dominio, en /.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

// Una ruta por pantalla. Las direcciones que no existen muestran «Página no encontrada».
const routes = [
  { path: "/", element: <HomeRoute /> }, // S01 (en el ordenador, lo de hoy junto a la lista)
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
  ...galleryRoutes, // Biblioteca: tests de exploración, cuestionarios y mediciones
  { path: "/tests/:id/marcar", element: l(<MarkPage />) }, // S07
  { path: "/tests/:id", element: l(<ResultPage />) }, // S08
  { path: "/compartir", element: l(<SharedFilesPage />) }, // src/documents
  { path: "/validacion", element: l(<ValidationPage />) },
  { path: "/validacion/sensor", element: l(<SensorCheckPage />) },
  { path: "/ajustes", element: l(<SettingsPage />) }, // S24
  { path: "/ajustes/cuenta", element: l(<AccountSettingsPage />) },
  { path: "/ajustes/sustituidos", element: l(<LostChangesPage />) }, // Cambios sustituidos (src/data/conflicts.ts)
  { path: "/ajustes/clinica", element: l(<ClinicSettingsPage />) },
  { path: "/ajustes/equipo", element: l(<TeamPage />) },
  { path: "/ajustes/proveedor", element: l(<ProviderPage />) },
  { path: "/agenda", element: l(<SchedulePage />) },
  { path: "/agenda/recordatorios", element: l(<RemindersPage />) },
  { path: "/agenda/envios", element: l(<OutboxPage />) }, // Bandeja de envíos por WhatsApp
  { path: "/agenda/espera", element: l(<WaitlistPage />) },
  { path: "/agenda/cobros", element: l(<DebtorsPage />) },
  { path: "/horario", element: <Navigate to="/agenda" replace /> },
  { path: "/ajustes/bloqueo", element: l(<LockSettingsPage />) },
  { path: "/ajustes/aspecto", element: l(<AppearancePage />) },
  { path: "/ajustes/marca", element: l(<BrandPage />) },
  { path: "/ajustes/mensajes", element: l(<MessagesPage />) },
  { path: "/ajustes/datos", element: l(<DataSettingsPage />) },
  { path: "/ajustes/importar", element: l(<ImportPatientsPage />) },
  { path: "/ajustes/estadisticas", element: l(<StatsPage />) },
  { path: "/ajustes/cobros", element: l(<ClinicBillingPage />) },
  { path: "/ajustes/ejercicios", element: l(<ExerciseLibraryPage />) },
  { path: "/ajustes/anamnesis", element: l(<CustomFieldsPage />) },
  { path: "/ajustes/reservas", element: <Navigate to="/ajustes" replace /> }, // La reserva online ya no existe
  { path: "/facturas", element: l(<ToBillPage />) }, // Para facturar: los cobros en Excel para el programa de facturación de la clínica
  { path: "/facturas/emitidas", element: l(<IssuedInvoicesPage />) }, // Las hechas con la app antes del 24-10-2026, solo lectura
  { path: "/facturas/nueva", element: <Navigate to="/facturas" replace /> }, // La app ya no hace facturas
  { path: "/facturas/:id", element: l(<InvoicePage />) },
  { path: "/ayuda", element: l(<HelpPage />) }, // Cómo se usa
  { path: "/ayuda/fallos", element: l(<ReportProblemPage />) }, // Algo no funciona: problemas frecuentes e informe de fallo
  { path: "/ayuda/licencias", element: l(<LicensesPage />) }, // Licencias de terceros (sale del build)
  { path: "/privacidad", element: l(<PrivacyPage />) },
  { path: "/cuenta", element: l(<SignInSetupPage />) }, // Iniciar sesión con Google (sin el ID de cliente publicado)
  { path: "/instalar", element: l(<InstallPage />) }, // Usar la app en otros dispositivos
  // Catálogo de componentes: solo al desarrollar, no en la app publicada.
  ...(import.meta.env.DEV ? [{ path: "/design", element: l(<DesignPage />) }] : []),
  { path: "*", element: l(<NotFoundPage />) },
];

/** El inicio: la lista de pacientes en el móvil; en el ordenador, lo de hoy (la lista ya está al lado). */
function HomeRoute() {
  return useDesktop() ? l(<DesktopHome />) : <PatientsPage />;
}

/** Las pantallas de la sección Pacientes (el inicio, las fichas y las mediciones) van dentro del panel del ordenador. */
const inPatients = (r: { path?: string }) => r.path === "/" || /^\/(pacientes|tests)(\/|$)/.test(r.path ?? "");
// Si una pantalla falla, sale RouteError (con el informe de fallo) en vez de quedarse en blanco.
const tree = [{ errorElement: <RouteError />, children: [{ element: <PatientsLayout />, children: routes.filter(inPatients) }, ...routes.filter((r) => !inPatients(r))] }];

/** El router se crea al entrar (después de volver de Google, con la dirección ya en su sitio). */
function Router() {
  const [router] = useState(() => createBrowserRouter(tree, { basename: BASENAME }));
  return <RouterProvider router={router} />;
}

/**
 * Las páginas que se abren sin cuenta: el formulario del paciente (…/formulario/<id>#<clave>) y «Abrir una copia
 * cifrada» (/abrir-copia, también sin conexión). Van sin la base, sin PIN y sin la app. Los enlaces antiguos de la
 * reserva por internet y para anular una cita dicen que se hable con la clínica.
 */
const PUBLIC_PAGES = { formulario: PublicFormPage, reservar: OldLinkPage, cita: OldLinkPage, "abrir-copia": OpenEncryptedPage };
const publicPage = () => {
  const first = location.pathname.slice((BASENAME === "/" ? "" : BASENAME).length).split("/")[1] ?? "";
  return Object.hasOwn(PUBLIC_PAGES, first) ? PUBLIC_PAGES[first as keyof typeof PUBLIC_PAGES] : null;
};

export function App() {
  const [Public] = useState(publicPage);
  useEffect(() => {
    // Pide al navegador que no borre los datos de la app por falta de espacio o por inactividad.
    if (!Public) void navigator.storage?.persist?.();
  }, [Public]);
  if (Public) {
    return (
      <ToastProvider>
        <Suspense fallback={null}>
          <Public />
        </Suspense>
      </ToastProvider>
    );
  }
  return (
    <ToastProvider>
      {/* El PIN va por fuera: sale al instante y la app carga por detrás mientras se teclea. */}
      <AppLock>
        <CloudGate>
          <DbGate>
            <Router />
            <FormInboxGate />
            <DocSync />
          </DbGate>
        </CloudGate>
      </AppLock>
      <UpdateBanner />
    </ToastProvider>
  );
}
