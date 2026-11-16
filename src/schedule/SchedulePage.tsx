// Agenda: las citas como en Google Calendar, por día, 3 días (solo en pantallas anchas) o semana, y en una clínica también los turnos de cada
// persona y una columna por persona en la vista de un día. Las citas se arrastran para moverlas (de hora, de día o
// de persona) y se puede deshacer; tocar un hueco da una cita o pone un turno. Sirve igual a quien trabaja solo (sin
// equipo, solo sus citas) que a una clínica con mucha gente (filtro por persona). En una clínica va en la base
// compartida: cada compañero ve los cambios de los demás en su dispositivo, solo.
import { useTeamMode } from "../cloud/teamMode";
import { CalendarClock, CalendarOff, ChevronLeft, ChevronRight, CopyPlus, Plus, TriangleAlert, Undo2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { bumpData } from "../app/dataVersion";
import { Page } from "../app/Page";
import { pendingAccounts } from "../data/billing";
import { dueReviews } from "../data/clinical";
import { useAsync } from "../app/useAsync";
import { AppointmentSheet } from "../clinical/AppointmentSheet";
import { fmtVisit } from "../clinical/calendar";
import { addDays, localInput, todayDay } from "../clinical/pageKit";
import { useCloud, useSyncState } from "../cloud/cloudContext";
import { agenda, updateAppointment, type AgendaItem } from "../data/appointments";
import { closuresBetween, type Closure } from "../data/closures";
import { dayOf } from "../app/dates";
import { dayNotes, eventName, eventsAtVisit, eventsOfPatients, listPatientEvents } from "../data/patientEvents";
import { closedAt } from "../clinical/AppointmentForm";
import { getDb } from "../data/db";
import { copyWeekForward, shiftsBetween, staffColor, type Shift } from "../data/schedule";
import { Button, IconButton } from "../ui/Button";
import { cx } from "../ui/cx";
import { SelectField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { AgendaGrid, type Move } from "./AgendaGrid";
import { TodayView } from "./TodayView";
import { DayList, WeekStrip } from "./DayList";
import { countByDay, dayRows } from "./dayRows";
import { listWaitlist } from "../data/waitlist";
import { LayoutGrid, List } from "lucide-react";
import { atMinutes, dayColumns, personColumns, type Column } from "./layout";
import { ShiftSheet } from "./ShiftSheet";
import { ClosureSheet } from "./ClosureSheet";
import { useMediaQuery } from "../app/useMediaQuery";
import { staffName, useStaff } from "./useStaff";

type View = "today" | "day" | "3days" | "week";
const VIEWS: { id: View; label: string; days: number }[] = [
  { id: "today", label: "Hoy", days: 1 },
  { id: "day", label: "Día", days: 1 },
  { id: "3days", label: "3 días", days: 3 },
  { id: "week", label: "Semana", days: 7 },
];
/** v2: con la vista «Hoy» (lista del día), que es la primera en el móvil. */
const VIEW_KEY = "fisiolab.agenda.view.v2";
/** En el móvil no caben tres días con su nombre: «3 días», solo en pantallas anchas (desde 640 px). */
const NARROW = "(max-width: 639px)";
/** Desde aquí, la Agenda enseña «Hoy» al lado de la rejilla (las mismas clases `min-[1440px]:`). */
const HOY_ASIDE = "(min-width: 1440px)";

/** El lunes (AAAA-MM-DD) de la semana de `day`. */
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00`).getDay() + 6) % 7));
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", o);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** La vista de la última vez; la primera, la lista de hoy en el móvil y la semana en el ordenador. */
function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY) as View | null;
    if (v && VIEWS.some((x) => x.id === v)) return v;
  } catch {
    /* sin almacenamiento */
  }
  return window.innerWidth >= 900 ? "week" : "today";
}

type Creating = { kind: "appointment" | "shift"; start: string; person?: string | null };

/** En el móvil, el día se ve en lista; quien prefiera la rejilla (para arrastrar), lo deja dicho aquí. */
const DAY_GRID_KEY = "fisiolab.agenda.dayGrid";
const HELP_KEY = "fisiolab.agendaHelp.seen";
function markHelpSeen() {
  try {
    localStorage.setItem(HELP_KEY, "1");
  } catch {
    /* sin almacenamiento: volverá a salir abierta */
  }
}

export function SchedulePage() {
  const [helpSeen] = useState(() => {
    try {
      const seen = localStorage.getItem(HELP_KEY) === "1";
      if (!seen) markHelpSeen(); // la próxima vez, plegada
      return seen;
    } catch {
      return false;
    }
  });
  const cloud = useCloud();
  const toast = useToast();
  const sync = useSyncState();
  const staff = useStaff();
  const { team } = useTeamMode();
  const me = cloud?.account.email.trim().toLowerCase() ?? "";
  const admin = cloud?.clinic?.role === "admin";
  const today = todayDay();
  // ?vista=hoy: la lista de hoy (desde la franja «Hoy» de Pacientes o al volver de atender una cita).
  // ?dia=AAAA-MM-DD: abrir la rejilla en ese día (al dar una cita desde la lista de espera, la nueva se ve al llegar).
  const [params] = useSearchParams();
  const [view, setView] = useState<View>(() => {
    if (params.get("vista") === "hoy") return "today";
    const v = savedView();
    return v === "today" && /^\d{4}-\d{2}-\d{2}$/.test(params.get("dia") ?? "") ? "day" : v;
  });
  const [anchor, setAnchor] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(params.get("dia") ?? "") ? params.get("dia")! : today));
  const narrow = useMediaQuery(NARROW);
  // En pantallas anchas, lo de hoy (citas, pendiente, mañana, lista de espera) a la derecha de la rejilla.
  const hoyAside = useMediaQuery(HOY_ASIDE);
  const views = narrow ? VIEWS.filter((v) => v.id !== "3days") : VIEWS;
  // Las vistas de rejilla, en orden: el pellizco pasa de una a otra.
  const gridViews = views.filter((v) => v.id !== "today");
  // «3 días» guardada de una pantalla ancha: en el móvil, el día.
  useEffect(() => {
    if (narrow && view === "3days") setView("day");
  }, [narrow, view]);
  const [who, setWho] = useState("");
  const [creating, setCreating] = useState<Creating | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  /** El cierre que se pone (con su día y, desde la columna de una persona, de quién) o el que se cambia. */
  const [closing, setClosing] = useState<{ closure: Closure | null; day: string; person?: string | null } | null>(null);
  const [managing, setManaging] = useState<AgendaItem | null>(null);
  /** «Movida · …» con «Deshacer»; `warn`: si a donde se ha llevado cae en algo suyo o con la agenda cerrada. */
  const [undo, setUndo] = useState<{ text: string; warn?: string; back: () => Promise<void> } | null>(null);
  const [copying, setCopying] = useState(false);
  const [dayGrid, setDayGrid] = useState(() => {
    try {
      return localStorage.getItem(DAY_GRID_KEY) === "1";
    } catch {
      return false;
    }
  });

  const span = VIEWS.find((v) => v.id === view)!.days;
  const first = view === "week" ? mondayOf(anchor) : anchor;
  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDays(first, i)), [first, span]);
  const from = new Date(`${days[0]}T00:00:00`).toISOString();
  const to = new Date(`${addDays(days.at(-1)!, 1)}T00:00:00`).toISOString();
  const data = useAsync(
    async () => {
      const [shifts, appointments, closures] = await Promise.all([shiftsBetween(getDb(), from, to), agenda(getDb(), from, to), closuresBetween(getDb(), from, to)]);
      // Lo de su calendario el día de cada cita (una consulta para todos): un viaje, una operación reciente, un partido
      // cerca. En el bloque de la cita, una marca; en su nombre para el lector de pantalla y al pasar el ratón, el texto.
      const events = await eventsOfPatients(getDb(), [...new Set(appointments.map((a) => a.patientId))]);
      const notes = new Map<string, string>();
      const today = todayDay();
      for (const a of appointments) {
        if (a.status === "cancelled") continue;
        const text = dayNotes(events.get(a.patientId) ?? [], dayOf(a.startsAt), today);
        if (text) notes.set(a.id, text);
      }
      return { shifts, appointments, closures, notes };
    },
    [from, to],
    { tables: ["appointments", "patients", "schedule", "sessions", "waitlist", "events"] },
  );

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* sin almacenamiento */
    }
  }, [view]);

  // Con la agenda a la vista, lo que cambian los compañeros se enseña solo (si no se está escribiendo nada).
  const newData = !!sync?.newData;
  const sheetOpen = !!(creating || editingShift || managing || closing);
  useEffect(() => {
    if (newData && !sheetOpen && cloud) {
      cloud.sync.seenNewData();
      bumpData();
    }
  }, [newData, sheetOpen, cloud]);

  // El aviso de «Deshacer» se va solo.
  useEffect(() => {
    if (!undo) return;
    // Con un aviso, más tiempo para leerlo.
    const t = setTimeout(() => setUndo(null), undo.warn ? 20_000 : 10_000);
    return () => clearTimeout(t);
  }, [undo]);

  // En el móvil, el día: la tira de la semana arriba y, debajo, la lista (o la rejilla, si se prefiere).
  const phoneDay = narrow && view === "day";
  const monday = mondayOf(anchor);
  const week = useAsync(
    async () => {
      if (!phoneDay) return null;
      const a = new Date(`${monday}T00:00:00`).toISOString();
      const b = new Date(`${addDays(monday, 7)}T00:00:00`).toISOString();
      const [items, shut, waiting] = await Promise.all([agenda(getDb(), a, b), closuresBetween(getDb(), a, b), listWaitlist(getDb())]);
      return { items, shut, waiting };
    },
    [phoneDay, monday],
    { tables: ["appointments", "patients", "schedule", "waitlist"] },
  );
  // En el día de hoy (la lista del móvil): cuánto hay pendiente (reevaluaciones y cobros), para ir a «Hoy» con un toque.
  const pendingToday = useAsync(
    async () => {
      if (!phoneDay || anchor !== today) return 0;
      const [reviews, debtors] = await Promise.all([dueReviews(getDb(), today), pendingAccounts(getDb(), today)]);
      return reviews.length + debtors.length;
    },
    [phoneDay, anchor, today],
    { tables: ["appointments", "patients", "sessions", "payments"] },
  );
  const filter = who === "-" ? null : who || undefined;
  const shifts = useMemo(() => (data.data?.shifts ?? []).filter((s) => filter === undefined || s.staffEmail === filter), [data.data, filter]);
  const appointments = useMemo(() => (data.data?.appointments ?? []).filter((a) => filter === undefined || a.assignedTo === filter), [data.data, filter]);
  // Los cierres de toda la clínica, siempre; los de una persona, en su columna o viendo solo a esa persona.
  const closures = useMemo(
    () => (data.data?.closures ?? []).filter((k) => !team || k.staffEmail === "" || (team && view === "day" && who === "") || k.staffEmail === filter),
    [data.data, team, view, who, filter],
  );
  const canEditClosure = (k: Closure) => !team || admin || k.staffEmail === me;
  // En el día de una clínica, una columna por persona: quien trabaja o tiene citas ese día (y tú), y «sin asignar».
  const byPerson = team && view === "day" && who === "";
  const columns: Column[] = useMemo(() => {
    if (!byPerson) return dayColumns(days, filter);
    const busy = new Set<string | null>([...shifts.map((s) => s.staffEmail), ...appointments.map((a) => a.assignedTo)]);
    const people: (string | null)[] = staff.map((s) => s.email).filter((e) => busy.has(e) || e === me);
    for (const e of busy) if (e && !people.includes(e)) people.push(e);
    if (busy.has(null)) people.push(null);
    return personColumns(days[0]!, people.length ? people : [me]);
  }, [byPerson, days, filter, shifts, appointments, staff, me]);

  const step = (n: number) => setAnchor(addDays(anchor, n * (view === "week" ? 7 : span)));
  const title =
    span === 1
      ? cap(fmt(days[0]!, { weekday: "long", day: "numeric", month: "long" }))
      : `${fmt(days[0]!, { day: "numeric", month: "short" })} – ${fmt(days.at(-1)!, { day: "numeric", month: "short", year: "numeric" })}`;
  const showsToday = days.includes(today);
  const firstDay = showsToday ? today : days[0]!;
  const noun = view === "week" ? "Semana" : view === "day" ? "Día" : "Días";

  async function onMove({ item, column, minutes }: Move) {
    const startsAt = atMinutes(column.day, minutes);
    const person = column.person !== undefined && column.person !== item.assignedTo ? { assignedTo: column.person } : {};
    const before = { startsAt: item.startsAt, assignedTo: item.assignedTo, status: item.status };
    try {
      await updateAppointment(getDb(), item.id, { startsAt, ...person });
      bumpData("appointments");
      const withWhom = "assignedTo" in person ? `, con ${staffName(staff, column.person ?? null)}` : "";
      // Lo que se dice al dar o cambiar la cita en su hoja, aquí en el aviso de «Deshacer»: si ese día tiene algo en su
      // calendario (un viaje, una prueba…) o la agenda está cerrada a esa hora.
      const assigned = "assignedTo" in person ? (person.assignedTo ?? null) : (item.assignedTo ?? null);
      const [evs, shut] = await Promise.all([listPatientEvents(getDb(), item.patientId), closedAt(startsAt, item.minutes, staff.length > 0, assigned)]);
      const hits = [...new Set(eventsAtVisit(evs, startsAt, item.minutes).map((o) => eventName(o.event)))];
      const warn = [hits.length ? `Ese día tiene en su calendario: ${hits.join(", ")}` : "", shut ? `La agenda está cerrada${shut.note ? ` (${shut.note})` : ""}` : ""]
        .filter(Boolean)
        .join(" · ");
      setUndo({
        text: `${item.name}: ${fmtVisit(startsAt)}${withWhom}`,
        warn: warn || undefined,
        back: async () => {
          await updateAppointment(getDb(), item.id, before);
          bumpData("appointments");
        },
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    }
  }

  const header = (c: Column) => {
    if (byPerson) {
      const p = staff.find((s) => s.email === c.person);
      return { title: c.person === null ? "Sin asignar" : `${p?.name ?? c.person}${c.person === me ? " (tú)" : ""}`, color: c.person ? staffColor(p) : undefined };
    }
    return {
      title: cap(fmt(c.day, { weekday: "short" })),
      subtitle: fmt(c.day, { day: "numeric" }),
      today: c.day === today,
    };
  };
  /**
   * Pellizco en la rejilla: juntando los dedos se ven más días (día → 3 días, en pantallas anchas → semana); separándolos, menos. Se centra
   * en el día que queda entre los dedos (si no se sabe, el de en medio de lo que se ve).
   */
  const zoom = (by: 1 | -1, c: Column | undefined) => {
    const next = gridViews[gridViews.findIndex((v) => v.id === view) + by];
    if (!next) return;
    const focus = c?.day ?? days[Math.floor(days.length / 2)]!;
    setAnchor(next.id === "3days" ? addDays(focus, -1) : focus);
    setView(next.id);
  };

  return (
    <Page
      title="Agenda"
      large={false}
      wide
      action={
        <button
          type="button"
          onClick={() => setCreating({ kind: "appointment", start: atMinutes(firstDay, 10 * 60) })}
          className="tap inline-flex items-center justify-center gap-1 rounded-md px-1 font-semibold text-accent hover:bg-surface"
        >
          <Plus aria-hidden="true" className="size-6" /> Nueva cita
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Vista" className="flex rounded-md border border-border p-0.5">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              className={cx("tap rounded px-2.5 text-sm", view === v.id ? "bg-accent font-semibold text-on-accent" : "text-text hover:bg-surface")}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === "today" && (
          <h2 className="text-base font-semibold" aria-live="polite">
            {cap(fmt(today, { weekday: "long", day: "numeric", month: "long" }))}
          </h2>
        )}
      </div>
      {view === "today" ? (
        <TodayView onOpen={setManaging} />
      ) : (
      <div className={cx("flex flex-col gap-4", hoyAside && "grid grid-cols-[minmax(0,1fr)_21rem] items-start gap-6")}>
      <div className="flex min-w-0 flex-col gap-4">
      {/* Una sola fila: ‹ fecha › y «Ir a hoy». La fecha, si no cabe, en dos líneas. */}
        <div className="flex items-center gap-1">
        <IconButton label={`${noun} anterior${view === "3days" ? "es" : ""}`} onClick={() => step(-1)}>
          <ChevronLeft aria-hidden="true" className="size-6" />
        </IconButton>
        <div className="relative flex min-h-11 min-w-0 flex-1 items-center justify-center">
          <h2 className="text-center text-sm leading-tight font-semibold sm:text-base" aria-live="polite">
            {title}
          </h2>
          {/* Tocar la fecha abre el calendario del sistema para ir a cualquier día. */}
          <input
            type="date"
            aria-label="Ir a una fecha"
            value={anchor}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => e.target.value && setAnchor(e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker();
              } catch {
                /* el navegador no lo permite: se abre al tocar igualmente */
              }
            }}
          />
        </div>
        <IconButton label={`${noun} siguiente${view === "3days" ? "s" : ""}`} onClick={() => step(1)}>
          <ChevronRight aria-hidden="true" className="size-6" />
        </IconButton>
        <Button size="sm" variant="secondary" disabled={showsToday} onClick={() => setAnchor(today)}>
          Ir a hoy
        </Button>
        </div>
      <div className="flex flex-wrap items-end gap-2">
        {team && (
          <div className="min-w-48 flex-1">
            <SelectField label="Ver" value={who} onChange={(e) => setWho(e.target.value)}>
              <option value="">Todo el equipo</option>
              {staff.map((s) => (
                <option key={s.email} value={s.email}>
                  {s.email === me ? `${s.name} (tú)` : s.name}
                </option>
              ))}
              <option value="-">Citas sin asignar</option>
            </SelectField>
          </div>
        )}
        {team && (
          <Button variant="secondary" icon={<CalendarClock aria-hidden="true" className="size-5" />} onClick={() => setCreating({ kind: "shift", start: atMinutes(firstDay, 9 * 60) })}>
            Añadir turno
          </Button>
        )}
        {phoneDay ? (
          <>
            <IconButton label="Bloquear horas o días" onClick={() => setClosing({ closure: null, day: firstDay })}>
              <CalendarOff aria-hidden="true" className="size-5" />
            </IconButton>
            <IconButton
              label={dayGrid ? "Ver el día en lista" : "Ver el día en rejilla"}
              onClick={() => {
                const next = !dayGrid;
                setDayGrid(next);
                try {
                  localStorage.setItem(DAY_GRID_KEY, next ? "1" : "0");
                } catch {
                  /* sin almacenamiento: vale para esta vez */
                }
              }}
            >
              {dayGrid ? <List aria-hidden="true" className="size-5" /> : <LayoutGrid aria-hidden="true" className="size-5" />}
            </IconButton>
          </>
        ) : (
          <Button variant="secondary" icon={<CalendarOff aria-hidden="true" className="size-5" />} onClick={() => setClosing({ closure: null, day: firstDay })}>
            Bloquear horas o días
          </Button>
        )}
        {team && admin && view === "week" && (
          <Button
            variant="ghost"
            loading={copying}
            icon={<CopyPlus aria-hidden="true" className="size-5" />}
            onClick={async () => {
              setCopying(true);
              try {
                const n = await copyWeekForward(getDb(), from);
                toast(n ? `${n === 1 ? "1 turno copiado" : `${n} turnos copiados`} a la semana siguiente` : "La semana siguiente ya tiene estos turnos", "success");
                bumpData("schedule");
                step(1);
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e), "danger");
              } finally {
                setCopying(false);
              }
            }}
          >
            Repetir los turnos la semana siguiente
          </Button>
        )}
      </div>

      {undo && (
        <div role="status" className="flex items-center justify-between gap-2 rounded-md bg-text px-3 py-2 text-sm text-bg">
          <span className="flex min-w-0 flex-col">
            <span className="min-w-0 truncate">Movida · {undo.text}</span>
            {undo.warn && (
              <span className="flex items-start gap-1 font-semibold">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {undo.warn}
              </span>
            )}
          </span>
          <button
            type="button"
            className="tap inline-flex shrink-0 items-center gap-1 rounded px-2 font-semibold underline-offset-2 hover:underline"
            onClick={async () => {
              const u = undo;
              setUndo(null);
              await u.back();
            }}
          >
            <Undo2 aria-hidden="true" className="size-4" /> Deshacer
          </button>
        </div>
      )}

      {phoneDay && (
        <WeekStrip
          monday={monday}
          selected={anchor}
          today={today}
          counts={countByDay((week.data?.items ?? []).filter((x) => filter === undefined || x.assignedTo === filter))}
          closed={
            new Set(
              Array.from({ length: 7 }, (_, i) => addDays(monday, i)).filter((d) => {
                const from = new Date(`${d}T00:00:00`).getTime();
                return (week.data?.shut ?? []).some((k) => k.staffEmail === "" && Date.parse(k.startsAt) <= from && Date.parse(k.endsAt) >= from + 23 * 3_600_000);
              }),
            )
          }
          onPick={setAnchor}
          onWeek={(n) => setAnchor(addDays(anchor, 7 * n))}
        />
      )}
      {phoneDay && anchor === today && !!pendingToday.data && (
        <button
          type="button"
          onClick={() => setView("today")}
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-pill border border-warning bg-warning-soft px-3 text-sm font-semibold text-text"
        >
          Pendiente <span className="nums rounded-pill bg-bg px-2">{pendingToday.data}</span>
        </button>
      )}
      {phoneDay && !dayGrid ? (
        <DayList
          day={anchor}
          today={today}
          rows={dayRows(anchor, appointments, closures, team ? shifts.filter((x) => (filter ? x.staffEmail === filter : x.staffEmail === me)) : [])}
          staff={team ? staff : []}
          notes={data.data?.notes}
          waiting={week.data?.waiting ?? []}
          canEditClosure={canEditClosure}
          onOpen={setManaging}
          onFree={(start) => setCreating({ kind: "appointment", start, person: filter === undefined ? undefined : filter })}
          onClosure={(k) => setClosing({ closure: k, day: k.startsAt.slice(0, 10) })}
          onNew={() => setCreating({ kind: "appointment", start: atMinutes(anchor, 10 * 60) })}
        />
      ) : (
        <AgendaGrid
          columns={columns}
          header={header}
          appointments={appointments}
          notes={data.data?.notes}
          shifts={team ? shifts : []}
          closures={closures}
          canEditClosure={canEditClosure}
          onClosure={(k) => setClosing({ closure: k, day: k.startsAt.slice(0, 10) })}
          staff={team ? staff : []}
          today={today}
          showPerson={team && !byPerson && filter === undefined}
          onOpen={setManaging}
          onMove={(m) => void onMove(m)}
          onSlot={(c, minutes) => setCreating({ kind: "appointment", start: atMinutes(c.day, minutes), person: c.person })}
          onShift={team ? (s) => (admin || s.staffEmail === me) && setEditingShift(s) : undefined}
          onHeader={
            span > 1 && !byPerson
              ? (c) => {
                  setAnchor(c.day);
                  setView("day");
                }
              : undefined
          }
          onZoom={zoom}
          onSwipe={step}
        />
      )}
      {/* La ayuda, abierta la primera vez; después, plegada (se recuerda en este dispositivo). */}
      <details
        className="text-sm text-text-muted"
        open={!helpSeen}
        onToggle={(e) => {
          if (!(e.currentTarget as HTMLDetailsElement).open) markHelpSeen();
        }}
      >
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-accent">Cómo se usa la agenda</summary>
        Para pasar de semana, desliza la fila de los días a un lado. Para ver más o menos días, junta o separa dos dedos sobre la agenda (o elige Día, 3
        días o Semana); toca un día de la semana para verlo solo.
        Arrastra una cita para moverla (en el móvil, mantenla pulsada un momento); tócala para atenderla, anularla o moverla una hora, un día o una
        semana. Toca un hueco para dar una cita{team ? " (o, desde ahí, poner un turno)" : ""}. Para ir a otra fecha, tócala arriba.
      </details>
      </div>
      {hoyAside && (
        <aside aria-labelledby="h-hoy" className="flex flex-col gap-3">
          <h2 id="h-hoy" className="text-base font-semibold">
            Hoy · {cap(fmt(today, { weekday: "long", day: "numeric", month: "long" }))}
          </h2>
          <TodayView onOpen={setManaging} />
        </aside>
      )}
      </div>
      )}

      {creating?.kind === "appointment" && (
        <AppointmentSheet
          open
          onClose={() => setCreating(null)}
          appointment={null}
          start={creating.start}
          person={creating.person}
          onShiftInstead={team ? () => setCreating({ ...creating, kind: "shift" }) : undefined}
        />
      )}
      {(creating?.kind === "shift" || editingShift) && (
        <ShiftSheet
          open
          onClose={() => {
            setCreating(null);
            setEditingShift(null);
          }}
          shift={editingShift}
          day={creating ? localInput(creating.start).slice(0, 10) : today}
          from={creating ? localInput(creating.start).slice(11) : undefined}
          person={creating?.person ?? undefined}
          staff={staff}
          me={me}
          admin={admin}
        />
      )}
      {closing && (
        <ClosureSheet
          open
          onClose={() => setClosing(null)}
          closure={closing.closure}
          day={closing.day}
          person={closing.person}
          staff={staff}
          me={me}
          admin={admin}
          team={team}
        />
      )}
      {managing && <AppointmentSheet open onClose={() => setManaging(null)} patientId={managing.patientId} patientName={managing.name} appointment={managing} backToToday={view === "today"} />}
    </Page>
  );
}
