// El plan por ciclos dentro de una sesión (docs/ciclos.md): la línea con la fase y la semana bajo el título y, en
// Tratamiento, lo que toca hoy para marcarlo de un toque. Lo marcado se escribe solo en el texto de Tratamiento con un
// formato fijo; si el fisio cambia ese texto a mano, la app ya no lo vuelve a tocar. Sin plan, solo sale el botón
// «Organizar por ciclos» y la sesión queda como siempre.
import { Check, ChevronRight, Layers, Plus, X } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { dayOf } from "../../app/dates";
import { useAsync } from "../../app/useAsync";
import {
  doseText,
  isAssessWeek,
  loadDone,
  loadPlan,
  nextTreatment,
  phaseAt,
  sessionEpisode,
  sessionFor,
  sessionsBeforeInWeek,
  treatmentText,
  weekIndexOf,
  type DoneDoc,
  type DoneItem,
  type Dose,
} from "../../data/cycles";
import { getDb } from "../../data/db";
import { currentEpisode } from "../../data/episodes";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { DoseInputs, effortLabel, PhaseBar, Segmented } from "./parts";
import { phaseChip } from "./phaseColors";

/** Lo del plan en una sesión: qué toca, lo marcado y lo que se guarda con ella. */
export function useSessionCycles({ patientId, sid, when, treatment, setTreatment }: { patientId: string; sid?: string; when: string; treatment: string; setTreatment: (t: string) => void }) {
  const at = when && !Number.isNaN(Date.parse(when)) ? new Date(when).toISOString() : null;
  const info = useAsync(
    async () => {
      const db = getDb();
      const episode = (sid && (await sessionEpisode(db, sid))) || (await currentEpisode(db, patientId));
      const [loaded, done] = await Promise.all([loadPlan(db, patientId, episode), sid ? loadDone(db, patientId, sid) : null]);
      const nth = loaded && at ? await sessionsBeforeInWeek(db, patientId, episode, at, sid) : 0;
      return { episode, loaded, done, nth };
    },
    [patientId, sid, at],
    { tables: ["settings", "sessions"] },
  );
  const loaded = info.data?.loaded ?? null;
  const week = loaded && at ? weekIndexOf(loaded.plan, dayOf(at)) : -1;
  const pos = loaded ? phaseAt(loaded.plan, week) : null;
  const ref = pos ? loaded!.plan.phases[pos.index]! : null;
  const doc = ref ? loaded!.phases[ref.id] : undefined;

  // Lo marcado: lo que se cambie aquí o, si no se ha tocado nada, lo guardado con la sesión (al cambiarla).
  type Marks = { chosen: string | null; items: DoneItem[]; extra: DoneDoc["extra"]; auto: string };
  const [local, setLocal] = useState<Marks | null>(null);
  const saved = info.data?.done;
  const marks: Marks = local ?? (saved ? { chosen: saved.sessionTplId, items: saved.items, extra: saved.extra, auto: saved.auto } : { chosen: null, items: [], extra: [], auto: "" });
  const { chosen, items, extra } = marks;
  const setChosen = (v: string) => setLocal({ ...marks, chosen: v, items: [] });

  const tpl = doc ? (doc.sessions.find((s) => s.id === chosen && s.exercises.length) ?? sessionFor(doc, info.data?.nth ?? 0)) : null;
  const planned: Record<string, Dose> = tpl && pos ? (doc!.weeks[pos.week]?.[tpl.id] ?? {}) : {};
  const effort = loaded?.plan.effort ?? "rpe";

  /** Cambia lo marcado y, si el texto de Tratamiento sigue siendo el de la app, lo vuelve a escribir. */
  const update = (nextItems: DoneItem[], nextExtra: DoneDoc["extra"] = extra, base: Marks = marks) => {
    let auto = base.auto;
    if (tpl) {
      const generated = treatmentText(tpl, planned, { items: nextItems, extra: nextExtra }, effort);
      const next = nextTreatment(treatment, auto, generated);
      if (next !== null) {
        auto = next;
        setTreatment(next);
      }
    }
    setLocal({ ...base, items: nextItems, extra: nextExtra, auto });
  };

  const done: DoneDoc | null =
    tpl && pos && ref && (items.length || extra.length) ? { v: 1, phaseId: ref.id, week: pos.week, sessionTplId: tpl.id, items, extra, auto: marks.auto } : null;
  return { ready: info.data !== undefined, episode: info.data?.episode ?? null, loaded, week, pos, ref, doc, tpl, planned, effort, items, extra, update, setChosen, done };
}

export type SessionCycles = ReturnType<typeof useSessionCycles>;

/** El enlace al plan, con la vuelta a esta sesión. */
function usePlanLink(patientId: string, episode: string | null, path = "") {
  const { pathname, search } = useLocation();
  return `/pacientes/${patientId}/ciclos${path}?motivo=${encodeURIComponent(episode ?? "")}&volver=${encodeURIComponent(pathname + search)}`;
}

/** Bajo el título de la sesión: la barra de fases y «Fase 1 · Adaptación · semana 2 de 4». Al tocarla, el plan. */
export function PlanLine({ patientId, c }: { patientId: string; c: SessionCycles }) {
  const to = usePlanLink(patientId, c.episode);
  if (!c.loaded) return null;
  const plan = c.loaded.plan;
  const assess = !!c.pos && isAssessWeek(c.doc, c.pos.week);
  return (
    <>
    <Link to={to} className="-mx-1 flex flex-col gap-1.5 rounded-md px-1 py-1.5 hover:bg-surface">
      <PhaseBar plan={plan} week={c.week} />
      <span className="flex min-h-6 items-center justify-between gap-2 text-sm">
        <span className="min-w-0">
          {c.pos && c.ref ? (
            <>
              <span className={cx("rounded-pill px-2 py-0.5 font-semibold", phaseChip(c.pos.index))}>
                Fase {c.pos.index + 1} · {c.ref.name}
              </span>{" "}
              · semana {c.pos.week + 1} de {c.pos.weeks}
              {c.pos.deload && <span className="ml-1.5 rounded-pill bg-warning-soft px-2 text-xs font-semibold text-text">descarga</span>}
              {assess && <span className="ml-1.5 rounded-pill bg-info-soft px-2 text-xs font-semibold text-info">valoración</span>}
            </>
          ) : c.week < 0 ? (
            "Plan por ciclos: aún no ha empezado"
          ) : (
            "Plan por ciclos: terminado"
          )}
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
      </span>
    </Link>
    {/* Semana de valoración (la marca el fisio en la semana): lo de valorar, a mano. */}
    {assess && (
      <nav aria-label="Semana de valoración" className="flex flex-wrap gap-1.5">
        {[
          { to: `/pacientes/${patientId}/test`, label: "Nueva medición" },
          { to: `/pacientes/${patientId}/cuestionarios/nuevo`, label: "Pasar un cuestionario" },
          { to: `/pacientes/${patientId}/exploracion/nuevo`, label: "Registrar un test" },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="inline-flex min-h-11 items-center rounded-pill border border-info bg-info-soft px-3 text-sm font-semibold text-info hover:underline">
            {l.label}
          </Link>
        ))}
      </nav>
    )}
    </>
  );
}

/** Sin plan en este motivo: el botón discreto para organizarlo. */
export function OrganizeButton({ patientId, c }: { patientId: string; c: SessionCycles }) {
  const to = usePlanLink(patientId, c.episode, "/nuevo");
  if (!c.ready || c.loaded) return null;
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 rounded-lg border border-dashed border-border-input px-3 py-2 hover:bg-surface">
      <Layers aria-hidden="true" className="size-5 shrink-0 text-accent" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">Organizar por ciclos</span>
        <span className="text-sm text-text-muted">Macro, meso y microciclos con sus ejercicios</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
    </Link>
  );
}

/** «Tratamiento · hoy toca»: la sesión tipo de esta semana, para marcar de un toque lo hecho. */
export function TodayToca({ c }: { c: SessionCycles }) {
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const { doc, tpl, planned, effort, items, extra, update } = c;
  if (!doc || !tpl) return null;
  const options = doc.sessions.filter((s) => s.exercises.length);
  const itemOf = (id: string) => items.find((i) => i.exId === id);
  const setItem = (exId: string, it: DoneItem | null) => update(it ? [...items.filter((i) => i.exId !== exId), it] : items.filter((i) => i.exId !== exId));
  const scale = effort === "rir" ? [0, 1, 2, 3, 4, 5] : [6, 7, 8, 9, 10];

  return (
    <section aria-labelledby="hoy-toca" className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id="hoy-toca" className="text-base font-semibold">
          Tratamiento · hoy toca
        </h3>
        {options.length > 1 && (
          <button type="button" aria-expanded={picking} onClick={() => setPicking(!picking)} className="inline-flex min-h-11 items-center px-1 text-sm font-semibold text-accent">
            Sesión {tpl.label} · cambiar
          </button>
        )}
      </div>
      {picking && (
        <Segmented
          label="Qué sesión tipo"
          options={options.map((s) => s.id)}
          value={tpl.id}
          onChange={(v) => {
            c.setChosen(v);
            setPicking(false);
          }}
          render={(v) => `Sesión ${options.find((s) => s.id === v)!.label}`}
        />
      )}
      <Button variant="secondary" block onClick={() => update(tpl.exercises.map((e) => ({ exId: e.id, state: "done" as const })))}>
        Todo hecho como estaba
      </Button>
      <ul className="flex flex-col gap-2">
        {tpl.exercises.map((e) => {
          const it = itemOf(e.id);
          const plan = planned[e.id] ?? {};
          const real = it?.state === "changed" && it.real ? it.real : null;
          const editing = open === e.id;
          return (
            <li key={e.id} className={cx("flex flex-col gap-2 rounded-md border px-3 py-2", editing ? "border-accent" : "border-border")}>
              <div className="flex items-center gap-2">
                <button type="button" aria-expanded={editing} onClick={() => setOpen(editing ? null : e.id)} className="flex min-h-11 min-w-0 flex-1 flex-col items-start text-left">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-semibold">{e.name}</span>
                    <span className={cx("rounded-pill px-2 text-xs font-semibold", it?.state === "changed" ? "bg-info-soft text-info" : it ? "bg-success-soft text-success" : "bg-surface text-text-muted")}>
                      {it?.state === "changed" ? "Cambiado" : it ? "✓ Hecho" : "Pendiente"}
                    </span>
                  </span>
                  <span className="text-sm text-text-muted">{real ? `Hecho: ${doseText(real, effort, e.timeUnit)}` : doseText(plan, effort, e.timeUnit) || "Sin parámetros"}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={!!it}
                  onClick={() => setItem(e.id, it ? null : { exId: e.id, state: "done" })}
                  className={cx("inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md border px-3 text-sm font-semibold", it ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg text-accent")}
                >
                  {it && <Check aria-hidden="true" className="size-4" />} Hecho<span className="sr-only">: {e.name}</span>
                </button>
              </div>
              {editing && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-text-muted">Previsto: {doseText(plan, effort, e.timeUnit) || "—"}</p>
                  <DoseInputs
                    ex={{ ...e, params: e.params.filter((p) => p !== "effort") }}
                    dose={real ?? plan}
                    effort={effort}
                    onChange={(d) => setItem(e.id, { exId: e.id, state: "changed", real: { ...d, effort: (real ?? plan).effort } })}
                  />
                  {effort !== "none" && (
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-text-muted">Esfuerzo que ha notado ({effortLabel(effort)})</span>
                      <div role="group" aria-label={`Esfuerzo de ${e.name}`} className="flex flex-wrap gap-1.5">
                        {scale.map((n) => {
                          const on = (real ?? plan).effort === n && !!real;
                          return (
                            <button
                              key={n}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setItem(e.id, { exId: e.id, state: "changed", real: { ...(real ?? plan), effort: n } })}
                              className={cx("nums min-h-11 min-w-11 flex-1 rounded-md border text-base font-semibold", on ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg")}
                            >
                              {n}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {extra.length > 0 && (
        <ul aria-label="Añadido hoy" className="flex flex-col gap-1">
          {extra.map((x, i) => (
            <li key={`${x.name}-${i}`} className="flex items-center justify-between gap-2 text-sm">
              <span>{x.name}</span>
              <button type="button" aria-label={`Quitar «${x.name}»`} onClick={() => update(items, extra.filter((_, j) => j !== i))} className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-semibold">Añadir algo de hoy</span>
          <input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && adding.trim()) {
                e.preventDefault();
                update(items, [...extra, { name: adding.trim() }]);
                setAdding("");
              }
            }}
            placeholder="Un ejercicio más o lo que sea"
            className="h-11 w-full rounded-md border border-border-input bg-bg px-3"
          />
        </label>
        <Button
          variant="secondary"
          icon={<Plus aria-hidden="true" className="size-5" />}
          disabled={!adding.trim()}
          onClick={() => {
            update(items, [...extra, { name: adding.trim() }]);
            setAdding("");
          }}
        >
          Añadir
        </Button>
      </div>
      <p className="text-xs text-text-muted">Lo marcado se escribe solo en Tratamiento. Si cambias ese texto a mano, la app ya no lo toca.</p>
    </section>
  );
}

/** En Sesiones y en el Resumen: el plan del motivo que se ve, si lo tiene, con un toque al plan. */
export function PlanCard({ patientId }: { patientId: string }) {
  const { pathname, search } = useLocation();
  const info = useAsync(
    async () => {
      const episode = await currentEpisode(getDb(), patientId);
      return { episode, loaded: await loadPlan(getDb(), patientId, episode), today: dayOf(new Date()) };
    },
    [patientId],
    { tables: ["settings"] },
  );
  const loaded = info.data?.loaded;
  if (!loaded) return null;
  const plan = loaded.plan;
  const week = weekIndexOf(plan, info.data!.today);
  const pos = phaseAt(plan, week);
  const total = plan.phases.reduce((n, p) => n + p.weeks, 0);
  return (
    <Link
      to={`/pacientes/${patientId}/ciclos?motivo=${encodeURIComponent(info.data!.episode)}&volver=${encodeURIComponent(pathname + search)}`}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg px-3 py-2 hover:bg-surface"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 font-semibold">
          <Layers aria-hidden="true" className="size-5 shrink-0 text-accent" />
          <span className="truncate">Plan por ciclos{plan.goal ? `: ${plan.goal}` : ""}</span>
        </span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
      </span>
      <PhaseBar plan={plan} week={week} />
      <span className="text-sm text-text-muted">
        {pos ? (
          <>
            <span className={cx("rounded-pill px-2 py-0.5 font-semibold", phaseChip(pos.index))}>
              Fase {pos.index + 1} · {plan.phases[pos.index]!.name}
            </span>{" "}
            · semana {week + 1} de {total}
          </>
        ) : week < 0 ? (
          "Aún no ha empezado"
        ) : (
          "Terminado"
        )}
      </span>
    </Link>
  );
}
