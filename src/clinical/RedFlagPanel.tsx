// Las alarmas de la anamnesis (src/clinical/redFlags.ts): los cuadros que forman las banderas rojas, con su
// urgencia, qué preguntar para profundizar y su fuente, y las banderas por confirmar (las marcó el paciente o salen
// en lo escrito). Al editar se ven mientras se escribe y cada una se marca en un toque.
import { Check, FileText } from "lucide-react";
import { Link } from "react-router";
import type { Answers } from "../data/clinical";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { redFlagReview, type FlagHit } from "./redFlags";

const origin = (h: FlagHit) => (h.from === "paciente" ? "La marcó el paciente en su formulario." : h.from === "texto" ? `En «${h.field}»: «${h.quote}»` : "");

export function RedFlagPanel({
  answers,
  birthDate,
  labelOf,
  patientId,
  onMark,
}: {
  answers: Answers;
  birthDate: string | null;
  labelOf: (fieldId: string) => string;
  patientId: string;
  /** Al editar: marcar una bandera por confirmar en «Banderas rojas». */
  onMark?: (label: string) => void;
}) {
  const { hits, patterns } = redFlagReview(answers, birthDate, labelOf);
  if (!hits.length) return null;
  const pending = hits.filter((h) => h.from !== "marcada");
  const marked = hits.filter((h) => h.from === "marcada");
  return (
    <section id="alarmas" aria-labelledby="h-alarmas" className="flex flex-col gap-3 rounded-lg border-2 border-danger/40 bg-bg p-4">
      <h3 id="h-alarmas" className="text-lg text-danger">
        Alarmas: {patterns.length ? `${patterns.length === 1 ? "1 cuadro" : `${patterns.length} cuadros`} a descartar` : `${hits.length === 1 ? "1 bandera roja" : `${hits.length} banderas rojas`}`}
      </h3>
      {patterns.map(({ pattern: p, flags }) => (
        <article key={p.id} aria-label={p.name} className={cx("flex flex-col gap-2 rounded-md p-3", p.urgency === "urgente" ? "bg-danger-soft" : "bg-warning-soft")}>
          <p className="flex flex-wrap items-baseline gap-2">
            <span className={cx("rounded-pill px-2 py-0.5 text-xs font-bold uppercase", p.urgency === "urgente" ? "bg-danger text-on-accent" : "bg-bg text-text ring-1 ring-warning")}>
              {p.urgency === "urgente" ? "Urgente" : "Preferente"}
            </span>
            <span className="font-semibold">{p.name}</span>
          </p>
          <p className="text-sm">{p.why}</p>
          {flags.length > 0 && <p className="text-sm text-text-muted">Por: {flags.map((f) => hits.find((h) => h.flag.id === f)!.flag.label.toLowerCase()).join("; ")}.</p>}
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">Qué preguntar para profundizar</summary>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
              {p.ask.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </details>
          <p className="text-xs text-text-muted">
            {p.urgency === "urgente" ? "Si se confirma: que le vea un médico hoy (urgencias). " : "Si se confirma: que le vea su médico pronto, antes de seguir. "}
            {p.source ? (
              <>
                Fuente:{" "}
                <a className="font-semibold text-accent underline" href={`https://doi.org/${p.source.doi}`} target="_blank" rel="noreferrer">
                  {p.source.cite}
                </a>
                .
              </>
            ) : (
              "Orientativo."
            )}
          </p>
        </article>
      ))}
      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Por confirmar al preguntar</p>
          <ul className="flex flex-col gap-2">
            {pending.map((h) => (
              <li key={h.flag.id} className="flex items-start justify-between gap-2 rounded-md bg-surface p-2">
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{h.flag.label}</span>
                  <span className="text-xs text-text-muted">{origin(h)}</span>
                </span>
                {onMark && (
                  <Button size="sm" variant="secondary" icon={<Check aria-hidden="true" className="size-4" />} onClick={() => onMark(h.flag.label)}>
                    Confirmar<span className="sr-only">: {h.flag.label}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {marked.length > 0 && <p className="text-sm">Confirmadas: {marked.map((h) => h.flag.label).join(" · ")}.</p>}
      <p className="text-xs text-text-muted">Ayuda a no pasar nada por alto; no es un diagnóstico. Decidir si derivar es tuyo.</p>
      {!onMark && (
        <Link to={`/pacientes/${patientId}/derivacion`} className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold text-accent">
          <FileText aria-hidden="true" className="size-4" /> Carta de derivación a su médico
        </Link>
      )}
    </section>
  );
}
