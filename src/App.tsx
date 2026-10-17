import { createBrowserRouter, RouterProvider } from "react-router";
import { ToastProvider } from "./ui/Toast";
import { DesignPage } from "./pages/DesignPage";
import { HomePlaceholder } from "./pages/HomePlaceholder";

const router = createBrowserRouter([
  { path: "/", element: <HomePlaceholder /> },
  { path: "/design", element: <DesignPage /> },
]);

export function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
