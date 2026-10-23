import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/source-sans-3";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./styles/index.css";
import { App } from "./App";
import { applyTheme } from "./app/theme";

applyTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
