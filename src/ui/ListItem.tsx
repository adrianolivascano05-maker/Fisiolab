import { ChevronRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

type PatientRowProps = {
  to: string;
  name: string;
  meta: string;
  /** En lugar de las iniciales (p. ej. en las citas). */
  icon?: LucideIcon;
  /** El paciente que se está viendo (la lista fija del ordenador). */
  active?: boolean;
  /** Lo más urgente de este paciente, a la derecha: su próxima cita, que debe, que está de viaje o que no tiene cita. */
  tag?: { text: string; tone: RowTagTone; /** Lo que es, para quien no ve el color («Próxima cita: »). */ label?: string };
  /** Las iniciales con un color fijo según el nombre (el mismo paciente, siempre el mismo), para reconocerlo de un vistazo. */
  tinted?: boolean;
};

export type RowTagTone = "visit" | "warning" | "travel" | "none";
const TAG: Record<RowTagTone, string> = {
  visit: "bg-kind-visit-soft text-kind-visit",
  warning: "bg-warning-soft text-warning",
  travel: "bg-kind-travel-soft text-kind-travel",
  none: "bg-done-soft text-done",
};

/** Fondos suaves para las iniciales; el texto, siempre el normal. No dicen nada del paciente: solo lo distinguen. */
const TINTS = ["bg-accent-soft", "bg-kind-travel-soft", "bg-kind-other-soft", "bg-kind-sport-soft", "bg-kind-medical-soft", "bg-warning-soft"];
/** El mismo nombre da siempre el mismo color. */
export function tintOf(name: string): number {
  let h = 0;
  for (const c of name.trim().toLowerCase()) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return h % TINTS.length;
}

/** Iniciales del nombre (sin prefijos como «Ejemplo ·» ni signos). */
export function initials(name: string) {
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
export function PatientRow({ to, name, meta, icon: Icon, active, tag, tinted }: PatientRowProps) {
  return (
    <li>
      <Link to={to} aria-current={active ? "page" : undefined} className={`flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-surface ${active ? "bg-accent-soft" : ""}`}>
        <span
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-pill text-sm font-semibold ${tinted && !Icon ? `${TINTS[tintOf(name)]} text-text` : "bg-accent-soft text-accent"}`}
        >
          {Icon ? <Icon className="size-5" /> : initials(name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">{name}</span>
          <span className="truncate text-sm text-text-muted">{meta}</span>
        </span>
        {tag && (
          <span className={`shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TAG[tag.tone]}`}>
            {tag.label && <span className="sr-only">{tag.label}</span>}
            {tag.text}
          </span>
        )}
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-chevron" />
      </Link>
    </li>
  );
}

export function List({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y divide-border card-edge rounded-lg border bg-bg shadow-card">
      {children}
    </ul>
  );
}
