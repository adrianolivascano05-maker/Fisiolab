import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

type PatientRowProps = { to: string; name: string; meta: string };

/** Iniciales del nombre (sin prefijos como «Ejemplo ·» ni signos). */
function initials(name: string) {
  return name
    .split(" · ")
    .at(-1)!
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Fila de la lista de pacientes (S01, S23). Toda la fila es el enlace. */
export function PatientRow({ to, name, meta }: PatientRowProps) {
  return (
    <li>
      <Link to={to} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-surface">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-sm font-semibold text-accent"
        >
          {initials(name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-sm text-text-muted">{meta}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 text-text-muted" />
      </Link>
    </li>
  );
}

export function List({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y divide-border rounded-lg border border-border bg-bg">
      {children}
    </ul>
  );
}
