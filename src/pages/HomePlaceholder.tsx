import { Link } from "react-router";

// Sustituido por S01 Pacientes en /replica-build.
export function HomePlaceholder() {
  return (
    <main className="mx-auto max-w-[var(--layout-content-max)] p-4">
      <h1 className="text-xl">Fisiolab · Medición</h1>
      <p className="mt-2 text-text-muted">
        La app está en construcción. <Link className="text-accent underline" to="/design">Ver el sistema de diseño</Link>
      </p>
    </main>
  );
}
