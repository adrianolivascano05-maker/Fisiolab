// La tabla de una fase: ejercicios en filas y semanas en columnas. Las semanas ya pasadas, en gris con ✓; la de hoy,
// marcada; la de descarga, en ámbar con ↓. Con `onCell`, cada casilla se toca para cambiarla.
import { useState } from "react";
import { isAssessWeek, type Dose, type Effort, type PhaseDoc } from "../../data/cycles";
import { cx } from "../../ui/cx";
import { doseLines, Segmented } from "./parts";
import { phaseChip } from "./phaseColors";

export function PhaseTable({
  doc,
  weeks,
  deload,
  effort,
  label,
  phase,
  today,
  onCell,
}: {
  doc: PhaseDoc;
  weeks: number;
  deload: boolean;
  effort: Effort;
  label: string;
  /** La posición de la fase en el plan (para su color); sin ella, sin color. */
  phase?: number;
  /** La semana de hoy dentro de la fase (desde 0); las anteriores salen como hechas. null: ninguna. */
  today?: number | null;
  onCell?: (week: number, sessionId: string, exId: string, dose: Dose) => void;
}) {
  const withExercises = doc.sessions.filter((s) => s.exercises.length);
  const [tab, setTab] = useState(withExercises[0]?.id ?? "");
  const session = withExercises.find((s) => s.id === tab) ?? withExercises[0];
  if (!session) return null;
  const cols = Array.from({ length: weeks }, (_, i) => i);
  const isDeload = (w: number) => deload && weeks > 1 && w === weeks - 1;
  return (
    <div className="flex flex-col gap-2">
      {withExercises.length > 1 && <Segmented label="Sesión tipo" options={withExercises.map((s) => s.id)} value={session.id} onChange={setTab} render={(id) => `Sesión ${withExercises.find((s) => s.id === id)!.label}`} />}
      <div className="overflow-x-auto">
        <table aria-label={`${label}: sesión ${session.label}`} className="w-full border-separate border-spacing-0.5 text-sm">
          <thead>
            <tr>
              <th scope="col" className="text-left text-xs font-semibold tracking-wide text-text-muted uppercase">
                Ejercicio
              </th>
              {cols.map((w) => (
                <th key={w} scope="col" className="min-w-12 text-xs font-semibold">
                  {today === w ? (
                    <span className="rounded-pill bg-accent px-2 py-0.5 text-on-accent">Hoy</span>
                  ) : (
                    <span className={cx("inline-block rounded-pill px-1.5 py-0.5", isDeload(w) ? "bg-warning-soft text-warning" : phase !== undefined ? phaseChip(phase) : "text-text-muted")}>
                      S{w + 1}
                      {today !== undefined && today !== null && w < today ? " ✓" : ""}
                      {isDeload(w) ? " ↓" : ""}
                    </span>
                  )}
                  {isDeload(w) && <span className="sr-only"> (descarga)</span>}
                  {isAssessWeek(doc, w) && (
                    <span className="mt-0.5 block">
                      <span aria-hidden="true" className="rounded-pill bg-info-soft px-1.5 text-[0.6875rem] font-semibold text-info">
                        Valorar
                      </span>
                      <span className="sr-only"> (valoración)</span>
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {session.exercises.map((e) => (
              <tr key={e.id}>
                <th scope="row" className="max-w-24 text-left align-middle text-xs font-semibold">
                  {e.name}
                </th>
                {cols.map((w) => {
                  const d = doc.weeks[w]?.[session.id]?.[e.id];
                  const [a, b] = doseLines(d, effort);
                  const past = today !== undefined && today !== null && w < today;
                  const cls = cx(
                    "flex min-h-11 w-full flex-col items-center justify-center rounded-md border px-1 py-1 text-center leading-tight",
                    isDeload(w) ? "border-warning bg-warning-soft" : past ? "border-border bg-done-soft text-done" : today === w ? "border-accent bg-accent-soft" : "border-border bg-bg",
                  );
                  const body = (
                    <>
                      <span aria-hidden={onCell ? true : undefined} className="nums">
                        {a}
                      </span>
                      {b && (
                        <span aria-hidden={onCell ? true : undefined} className="nums text-xs">
                          {b}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <td key={w} className="align-middle">
                      {onCell ? (
                        <button type="button" onClick={() => onCell(w, session.id, e.id, d ?? {})} className={cx(cls, "hover:border-accent")}>
                          <span className="sr-only">{`${e.name}, semana ${w + 1}: ${[a, b].filter(Boolean).join(", ")}. Cambiar`}</span>
                          {body}
                        </button>
                      ) : (
                        <div className={cls}>{body}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">
        {today !== undefined && today !== null ? "✓ hecha · " : ""}
        {deload ? "↓ descarga" : ""}
        {doc.assess?.length ? `${deload || (today !== undefined && today !== null) ? " · " : ""}Valorar: semana de valoración` : ""}
        {onCell ? `${deload || (today !== undefined && today !== null) ? " · " : ""}Toca una casilla para cambiarla` : ""}
      </p>
    </div>
  );
}
