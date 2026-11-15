// La Agenda en el móvil (docs/rediseno-sencilla.md, bloque 3): una tira con la semana (cuántas citas tiene cada día,
// los días cerrados rayados; se desliza para cambiar de semana) y el día como lista: las citas con su estado, los
// huecos libres a un toque y los ratos con la agenda cerrada. Sin horas vacías. La rejilla para arrastrar sigue en
// «Semana» y, si se prefiere, en el día («Ver en rejilla»).
import { CalendarOff, CalendarDays, Check, NotebookPen, Plus } from "lucide-react";
import { useRef, type TouchEvent } from "react";
import { Link } from "react-router";
import { addDays } from "../app/dates";
import { STATUS_LABELS, type AgendaItem } from "../data/appointments";
import type { Closure } from "../data/closures";
import { fits, type WaitItem } from "../data/waitlist";
import { cx } from "../ui/cx";
import { spanText, type DayRow } from "./dayRows";
import type { Staff } from "../data/schedule";

const clock = (ms: number) => new Date(ms).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const longDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
const LETTERS = ["L", "M", "X", "J", "V", "S", "D"];

/** La semana en una tira: cada día con su barra y su número de citas; el elegido, con marco; hoy, en dorado. */
export function WeekStrip({
  monday,
  selected,
  today,
  counts,
  closed,
  onPick,
  onWeek,
}: {
  monday: string;
  selected: string;
  today: string;
  counts: Map<string, number>;
  /** Los días con la agenda cerrada para todos el día entero. */
  closed: Set<string>;
  onPick: (day: string) => void;
  onWeek: (n: 1 | -1) => void;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const max = Math.max(1, ...days.map((d) => counts.get(d) ?? 0));
  return (
    <div
      role="group"
      aria-label="Días de la semana"
      data-swipe
      className="grid grid-cols-7 gap-0.5"
      onTouchStart={(e: TouchEvent) => {
        const t = e.touches[0];
        touch.current = t ? { x: t.clientX, y: t.clientY } : null;
      }}
      onTouchEnd={(e: TouchEvent) => {
        const t = e.changedTouches[0];
        const from = touch.current;
        touch.current = null;
        if (!t || !from) return;
        const dx = t.clientX - from.x;
        if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(t.clientY - from.y)) onWeek(dx < 0 ? 1 : -1);
      }}
    >
      {days.map((d, i) => {
        const n = counts.get(d) ?? 0;
        const shut = closed.has(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={d === selected}
            aria-current={d === today ? "date" : undefined}
            onClick={() => onPick(d)}
            className={cx(
              "flex min-h-14 min-w-0 flex-col items-center gap-0.5 rounded-md px-0.5 pt-1 pb-1.5 text-sm",
              shut ? "bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_4px,transparent_4px_8px)]" : "bg-bg",
              d === selected ? "ring-2 ring-accent ring-inset" : d === today ? "ring-2 ring-highlight ring-inset" : "hover:bg-surface",
            )}
          >
            <span className="sr-only">{`${longDay(d)}${d === today ? ", hoy" : ""}: ${shut ? "agenda cerrada" : n === 1 ? "1 cita" : `${n} citas`}`}</span>
            <span aria-hidden="true" className="text-xs leading-none text-text-muted">
              {LETTERS[i]}
            </span>
            <span aria-hidden="true" className={cx("nums leading-none", d === today && "font-bold")}>
              {Number(d.slice(8))}
            </span>
            {/* La barra dice cómo de lleno está el día respecto al más lleno de la semana; dentro, el número. */}
            <span aria-hidden="true" className="mt-auto flex h-3.5 w-full items-center">
              {n > 0 && (
                <span className="block h-3.5 rounded-sm bg-kind-visit-soft text-center text-[0.625rem] leading-[0.875rem] font-semibold text-kind-visit" style={{ width: `${Math.max(34, Math.round((n / max) * 100))}%` }}>
                  {n}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** El día como lista. `next`: la cita pendiente que toca ahora (lleva «Atender» a la vista). */
export function DayList({
  day,
  today,
  rows,
  staff,
  notes,
  waiting,
  canEditClosure,
  onOpen,
  onFree,
  onClosure,
  onNew,
}: {
  day: string;
  today: string;
  rows: DayRow[];
  staff: Staff[];
  notes?: Map<string, string>;
  /** La lista de espera, para decir a cuántos les encaja cada hueco. */
  waiting: WaitItem[];
  canEditClosure: (k: Closure) => boolean;
  onOpen: (a: AgendaItem) => void;
  onFree: (startIso: string) => void;
  onClosure: (k: Closure) => void;
  onNew: () => void;
}) {
  // eslint-disable-next-line react-hooks/purity -- la hora de ahora, para la línea de «ahora» y la cita que toca
  const now = Date.now();
  const isToday = day === today;
  const next = isToday ? rows.find((r): r is Extract<DayRow, { type: "visit" }> => r.type === "visit" && r.item.status === "scheduled" && r.at + r.item.minutes * 60_000 > now) : undefined;
  const nowIndex = isToday ? rows.findIndex((r) => (r.type === "visit" ? r.at + r.item.minutes * 60_000 : r.until) > now) : -1;
  if (!rows.length)
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-6 text-center">
        <p className="font-semibold">Ninguna cita este día</p>
        <button type="button" onClick={onNew} className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
          <Plus aria-hidden="true" className="size-5" /> Dar una cita
        </button>
      </div>
    );
  return (
    <ol aria-label={`Citas del ${longDay(day)}`} className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <li key={`${r.type}-${r.at}-${r.type === "visit" ? r.item.id : ""}`} className="flex flex-col gap-2">
          {i === nowIndex && nowIndex > 0 && <div role="separator" aria-label="Ahora" className="h-0.5 rounded-full bg-highlight" />}
          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-2">
            <span aria-hidden="true" className="nums pt-2.5 text-right text-sm text-text-muted">
              {clock(r.at)}
            </span>
            {r.type === "visit" ? (
              <Visit item={r.item} staff={staff} note={notes?.get(r.item.id)} atNow={next?.item.id === r.item.id} onOpen={onOpen} />
            ) : r.type === "free" ? (
              <Free at={r.at} until={r.until} minutes={r.minutes} waiting={waiting} onFree={onFree} />
            ) : canEditClosure(r.closure) ? (
              <button type="button" onClick={() => onClosure(r.closure)} className={closedClass}>
                <ClosedText r={r} />
              </button>
            ) : (
              <div className={closedClass}>
                <ClosedText r={r} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

const closedClass = "flex min-h-11 w-full items-center gap-2 rounded-md border border-border bg-[repeating-linear-gradient(135deg,var(--color-surface)_0_4px,transparent_4px_8px)] px-3 py-2 text-left text-sm";

function ClosedText({ r }: { r: Extract<DayRow, { type: "closed" }> }) {
  return (
    <>
      <CalendarOff aria-hidden="true" className="size-4 shrink-0" />
      <span>
        <span className="font-semibold">Agenda cerrada{r.closure.note ? `: ${r.closure.note}` : ""}</span> · {clock(r.at)}–{clock(r.until)}
      </span>
    </>
  );
}

function Visit({ item, staff, note, atNow, onOpen }: { item: AgendaItem; staff: Staff[]; note?: string; atNow: boolean; onOpen: (a: AgendaItem) => void }) {
  const start = Date.parse(item.startsAt);
  const time = `${clock(start)}–${clock(start + item.minutes * 60_000)}`;
  const person = item.assignedTo ? staff.find((s) => s.email === item.assignedTo) : undefined;
  const who = staff.length ? (item.assignedTo ? (person?.name ?? item.assignedTo) : "Sin asignar") : null;
  // El mismo nombre que en la rejilla, para el lector de pantalla.
  const label = `${item.name}, ${time}${who ? `, con ${who}` : ""}, ${STATUS_LABELS[item.status]}${note ? `. Su calendario: ${note}` : ""}`;
  const done = item.status === "done";
  const missed = item.status === "no_show";
  return (
    <div className={cx("flex flex-col gap-2 rounded-md border-l-4 px-3 py-2", done ? "border-done bg-done-soft" : missed ? "border-danger bg-danger-soft" : "border-accent bg-kind-visit-soft")}>
      <button type="button" aria-haspopup="dialog" onClick={() => onOpen(item)} className="flex min-h-11 w-full flex-col items-start justify-center text-left">
        <span className="sr-only">{label}</span>
        <span aria-hidden="true" className="flex w-full items-center gap-1.5 font-semibold">
          {done && <Check className="size-4 shrink-0" />}
          <span className="min-w-0 break-words">{item.name}</span>
        </span>
        <span aria-hidden="true" className="text-sm text-text-muted">
          {item.minutes} min{who ? ` · con ${who}` : ""} · {STATUS_LABELS[item.status]}
        </span>
        {note && (
          <span aria-hidden="true" className="mt-0.5 flex items-start gap-1 text-sm">
            <CalendarDays className="mt-0.5 size-4 shrink-0" /> {note}
          </span>
        )}
      </button>
      {atNow && (
        <Link
          to={`/pacientes/${item.patientId}/sesiones/nueva?hora=${encodeURIComponent(item.startsAt)}&volver=hoy`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-md bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
        >
          <NotebookPen aria-hidden="true" className="size-4" /> Atender a {item.name.split(" ")[0]}
        </Link>
      )}
    </div>
  );
}

function Free({ at, until, minutes, waiting, onFree }: { at: number; until: number; minutes: number; waiting: WaitItem[]; onFree: (startIso: string) => void }) {
  const iso = new Date(at).toISOString();
  const n = waiting.filter((w) => fits(w, iso, Math.min(minutes, 45))).length;
  return (
    <button
      type="button"
      onClick={() => onFree(iso)}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-dashed border-accent px-3 py-2 text-left text-sm text-accent hover:bg-accent-soft"
    >
      <span>
        <span className="sr-only">{`Hueco libre de ${clock(at)} a ${clock(until)}: `}</span>
        <span className="font-semibold">Libre {spanText(minutes)}</span>
        {n > 0 && <span> · {n === 1 ? "1 en espera encaja" : `${n} en espera encajan`}</span>}
      </span>
      <Plus aria-hidden="true" className="size-5 shrink-0" />
    </button>
  );
}
