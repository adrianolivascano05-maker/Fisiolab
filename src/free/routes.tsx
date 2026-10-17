// Punto de entrada del módulo: las rutas que App.tsx añade con una sola línea.
import { lazy, Suspense } from "react";

const FreeMeasurePage = lazy(() => import("./FreeMeasurePage").then((m) => ({ default: m.FreeMeasurePage })));
const FreeDetailPage = lazy(() => import("./FreeDetailPage").then((m) => ({ default: m.FreeDetailPage })));

export const freeRoutes = [
  { path: "/pacientes/:id/medicion-libre", element: <Suspense fallback={null}><FreeMeasurePage /></Suspense> },
  { path: "/pacientes/:id/medicion-libre/:mid", element: <Suspense fallback={null}><FreeDetailPage /></Suspense> },
];
