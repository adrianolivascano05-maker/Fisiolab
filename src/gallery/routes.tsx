// Punto de entrada del módulo: las rutas que App.tsx añade con una sola línea.
import { lazy, Suspense } from "react";

const pages = () => import("./GalleryPages");
const GalleryHome = lazy(() => pages().then((m) => ({ default: m.GalleryHome })));
const GalleryRegion = lazy(() => pages().then((m) => ({ default: m.GalleryRegion })));
const GalleryTest = lazy(() => pages().then((m) => ({ default: m.GalleryTest })));

export const galleryRoutes = [
  { path: "/exploracion", element: <Suspense fallback={null}><GalleryHome /></Suspense> },
  { path: "/exploracion/:region", element: <Suspense fallback={null}><GalleryRegion /></Suspense> },
  { path: "/exploracion/:region/:test", element: <Suspense fallback={null}><GalleryTest /></Suspense> },
];
