// Punto de entrada del módulo: las rutas que App.tsx añade con una sola línea. La Biblioteca (antes «Guía de tests»,
// en /exploracion) junta los tests de exploración, los cuestionarios y las mediciones; las direcciones antiguas
// llevan a las nuevas.
import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

const pages = () => import("./GalleryPages");
const library = () => import("./LibraryPages");
const GalleryHome = lazy(() => pages().then((m) => ({ default: m.GalleryHome })));
const GalleryRegion = lazy(() => pages().then((m) => ({ default: m.GalleryRegion })));
const GalleryTest = lazy(() => pages().then((m) => ({ default: m.GalleryTest })));
const QuestionnaireShelf = lazy(() => library().then((m) => ({ default: m.QuestionnaireShelf })));
const QuestionnaireCard = lazy(() => library().then((m) => ({ default: m.QuestionnaireCard })));
const MeasurementShelf = lazy(() => library().then((m) => ({ default: m.MeasurementShelf })));
const QuestionnaireLicensesPage = lazy(() => import("../pages/QuestionnaireLicensesPage").then((m) => ({ default: m.QuestionnaireLicensesPage })));

const s = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

/** /exploracion/… → /biblioteca/… (con la misma búsqueda, p. ej. ?paciente=). */
function FromOldGuide() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={{ pathname: pathname.replace(/^\/exploracion/, "/biblioteca"), search, hash }} replace />;
}

export const galleryRoutes = [
  { path: "/biblioteca", element: s(<GalleryHome />) },
  { path: "/biblioteca/cuestionarios", element: s(<QuestionnaireShelf />) },
  { path: "/biblioteca/cuestionarios/permisos", element: s(<QuestionnaireLicensesPage />) },
  { path: "/biblioteca/cuestionarios/:id", element: s(<QuestionnaireCard />) },
  { path: "/biblioteca/mediciones", element: s(<MeasurementShelf />) },
  { path: "/biblioteca/:region", element: s(<GalleryRegion />) },
  { path: "/biblioteca/:region/:test", element: s(<GalleryTest />) },
  { path: "/exploracion/*", element: <FromOldGuide /> },
  { path: "/exploracion", element: <FromOldGuide /> },
  { path: "/ajustes/cuestionarios", element: <Navigate to="/biblioteca/cuestionarios/permisos" replace /> },
];
