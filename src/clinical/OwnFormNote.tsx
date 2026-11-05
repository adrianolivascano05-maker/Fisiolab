// La etiqueta fija de los cuestionarios propios («Cuestionario propio de la clínica · no validado», que no se puede
// quitar) y su nota para el profesional (un texto fijo de la clínica, con su nombre y la fecha). La app nunca lo
// evalúa ni lo enseña según el resultado: sale siempre igual.
import { OWN_LABEL } from "./forms/own";
import type { QuestionnaireKind } from "./questionnaires";
import { cx } from "../ui/cx";

export function OwnLabel({ className }: { className?: string }) {
  return <span className={cx("inline-block rounded-pill border border-border-input px-2 py-0.5 text-xs font-semibold text-text-muted", className)}>{OWN_LABEL}</span>;
}

/** «Nota para el profesional (Clínica Aurora, 5 nov 2026): …». */
export function ownNoteText(k: Pick<QuestionnaireKind, "note" | "noteClinic" | "noteAt">): string | null {
  if (!k.note) return null;
  const day = k.noteAt ? new Date(`${k.noteAt}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Madrid" }) : "";
  const who = [k.noteClinic, day].filter(Boolean).join(", ");
  return `Nota para el profesional${who ? ` (${who})` : ""}: ${k.note}`;
}

export function OwnNote({ kind, className }: { kind: Pick<QuestionnaireKind, "note" | "noteClinic" | "noteAt">; className?: string }) {
  const text = ownNoteText(kind);
  return text ? <p className={cx("rounded-md bg-surface p-2 text-sm whitespace-pre-line", className)}>{text}</p> : null;
}
