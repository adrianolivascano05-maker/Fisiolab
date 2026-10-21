// Agenda: las citas como en Google Calendar, por día, 3 días o semana, y en una clínica también los turnos de cada
// persona y una columna por persona en la vista de un día. Las citas se arrastran para moverlas (de hora, de día o
// de persona) y se puede deshacer; tocar un hueco da una cita o pone un turno. Sirve igual a quien trabaja solo (sin
// equipo, solo sus citas) que a una clínica con mucha gente (filtro por persona). En una clínica va en la base
// compartida: cada compañero ve los cambios de los demás en su dispositivo, solo.
import { BellRing, CalendarClock, ChevronLeft, ChevronRight, CopyPlus, Hourglass, Plus, Undo2 } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { bumpData } from "../app/dataVersion";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { AppointmentSheet } from "../clinical/AppointmentSheet";
import { fmtVisit } from "../clinical/calendar";
import { addDays, localInput, todayDay } from "../clinical/pageKit";
import { useCloud, useSyncState } from "../cloud/CloudGate";
import { agenda, remindersBetween, updateAppointment, type AgendaItem } from "../data/appointments";
import { waitlistCount } from "../data/waitlist";
import { getDb } from "../data/db";
import { copyWeekForward, shiftsBetween, staffColor, type Shift } from "../data/schedule";
import { Button, IconButton } from "../ui/Button";
import { cx } from "../ui/cx";
import { SelectField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { AgendaGrid, type Move } from "./AgendaGrid";
import { atMinutes, dayColumns, personColumns, type Column } from "./layout";
import { ShiftSheet } from "./ShiftSheet";
import { staffName, useStaff } from "./useStaff";

type View = "day" | "3days" | "week";
const VIEWS: { id: View; label: string; days: number }[] = [
  { id: "day", label: "Día", days: 1 },
  { id: "3days", label: "3 días", days: 3 },
  { id: "week", label: "Semana", days: 7 },
];
const VIEW_KEY = "fisiolab.agenda.view";

/** El lunes (AAAA-MM-DD) de la semana de `day`. */
const mondayOf = (day: string) => addDays(day, -((new Date(`${day}T12:00:00`).getDay() + 6) % 7));
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00`).toLocaleDateString("es-ES", o);
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** La vista de la última vez; la primera, por día en el móvil y por semana en el ordenador. */
function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY) as View | null;
    if (v && VIEWS.some((x) => x.id === v)) return v;
  } catch {
    /* sin almacenamiento */
  }
  return window.innerWidth >= 900 ? "week" : "day";
}

type Creating = { kind: "appointment" | "shift"; start: string; person?: string | null };

export function SchedulePage() {
  const cloud = useCloud();
  const toast = useToast();
  const sync = useSyncState();
  const staff = useStaff();
  const team = !!cloud?.clinic;
  const me = cloud?.account.email.trim().toLowerCase() ?? "";
  const admin = cloud?.clinic?.role === "admin";
  const today = todayDay();
  const [view, setView] = useState<View>(savedView);
  // ?dia=AAAA-MM-DD: abrir en ese día (al dar una cita desde la lista de espera, la nueva se ve al llegar).
  const [params] = useSearchParams();
  const [anchor, setAnchor] = useState(() => (/^\d{4}-\d{2}-\d{2}$/.test(params.get("dia") ?? "") ? params.get("dia")! : today));
  const [who, setWho] = useState("");
  const [creating, setCreating] = useState<Creating | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [managing, setManaging] = useState<AgendaItem | null>(null);
  const [undo, setUndo] = useState<{ text: string; back: () => Promise<void> } | null>(null);
  const [copying, setCopying] = useState(false);

  const span = VIEWS.find((v) => v.id === view)!.days;
  const first = view === "week" ? mondayOf(anchor) : anchor;
  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDays(first, i)), [first, span]);
  const from = new Date(`${days[0]}T00:00:00`).toISOString();
  const to = new Date(`${addDays(days.at(-1)!, 1)}T00:00:00`).toISOString();
  const data = useAsync(async () => ({ shifts: await shiftsBetween(getDb(), from, to), appointments: await agenda(getDb(), from, to) }), [from, to]);
  // Las citas de mañana que aún no se han recordado.
  const tomorrow = addDays(today, 1);
  const toRemind = useAsync(
    async () =>
      (await remindersBetween(getDb(), new Date(`${tomorrow}T00:00:00`).toISOString(), new Date(`${addDays(tomorrow, 1)}T00:00:00`).toISOString())).filter(
        (a) => !a.remindedAt && !a.confirmedAt,
      ).length,
    [tomorrow, data.data],
  );
  const waiting = useAsync(() => waitlistCount(getDb()), [data.data]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* sin almacenamiento */
    }
  }, [view]);

  // Con la agenda a la vista, lo que cambian los compañeros se enseña solo (si no se está escribiendo nada).
  const newData = !!sync?.newData;
  const sheetOpen = !!(creating || editingShift || managing);
  useEffect(() => {
    if (newData && !sheetOpen && cloud) {
      cloud.sync.seenNewData();
      bumpData();
    }
  }, [newData, sheetOpen, cloud]);

  // El aviso de «Deshacer» se va solo.
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10_000);
    return () => clearTimeout(t);
  }, [undo]);

  const filter = who === "-" ? null : who || undefined;
  const shifts = useMemo(() => (data.data?.shifts ?? []).filter((s) => filter === undefined || s.staffEmail === filter), [data.data, filter]);
  const appointments = useMemo(() => (data.data?.appointments ?? []).filter((a) => filter === undefined || a.assignedTo === filter), [data.data, filter]);
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
      bumpData();
      const withWhom = "assignedTo" in person ? `, con ${staffName(staff, column.person ?? null)}` : "";
      setUndo({
        text: `${item.name}: ${fmtVisit(startsAt)}${withWhom}`,
        back: async () => {
          await updateAppointment(getDb(), item.id, before);
          bumpData();
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
   * Pellizco en la rejilla: juntando los dedos se ven más días (día → 3 días → semana); separándolos, menos. Se centra
   * en el día que queda entre los dedos (si no se sabe, el de en medio de lo que se ve).
   */
  const zoom = (by: 1 | -1, c: Column | undefined) => {
    const next = VIEWS[VIEWS.findIndex((v) => v.id === view) + by];
    if (!next) return;
    const focus = c?.day ?? days[Math.floor(days.length / 2)]!;
    setAnchor(next.id === "3days" ? addDays(focus, -1) : focus);
    setView(next.id);
  };

  return (
    <Page title="Agenda" large={false} wide>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={showsToday} onClick={() => setAnchor(today)}>
          Hoy
        </Button>
        <IconButton label={`${noun} anterior${view === "3days" ? "es" : ""}`} onClick={() => step(-1)}>
          <ChevronLeft aria-hidden="true" className="size-6" />
        </IconButton>
        <IconButton label={`${noun} siguiente${view === "3days" ? "s" : ""}`} onClick={() => step(1)}>
          <ChevronRight aria-hidden="true" className="size-6" />
        </IconButton>
        <div className="relative min-w-[10rem] flex-1">
          <h2 className="truncate text-base font-semibold" aria-live="polite">
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
        <div role="group" aria-label="Vista" className="flex rounded-md border border-border p-0.5">
          {VIEWS.map((v) => (
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
        <Button icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setCreating({ kind: "appointment", start: atMinutes(firstDay, 10 * 60) })}>
          Nueva cita
        </Button>
        {/* En el móvil, solo el icono y su número (el nombre lo lee el lector de pantalla): todo en una fila. */}
        <Link
          to="/agenda/recordatorios"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 font-semibold hover:bg-surface sm:px-4"
        >
          <BellRing aria-hidden="true" className="size-5 text-accent" /> <span className="sr-only sm:not-sr-only">Recordatorios</span>
          {!!toRemind.data && (
            <span className="rounded-full bg-accent px-2 text-sm text-on-accent">
              {toRemind.data}
              <span className="sr-only"> de mañana sin recordar</span>
            </span>
          )}
        </Link>
        <Link
          to="/agenda/espera"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-border bg-bg px-3 font-semibold hover:bg-surface sm:px-4"
        >
          <Hourglass aria-hidden="true" className="size-5 text-accent" /> <span className="sr-only sm:not-sr-only">Lista de espera</span>
          {!!waiting.data && (
            <span className="rounded-full bg-accent px-2 text-sm text-on-accent">
              {waiting.data}
              <span className="sr-only"> esperando</span>
            </span>
          )}
        </Link>
        {team && (
          <Button variant="secondary" icon={<CalendarClock aria-hidden="true" className="size-5" />} onClick={() => setCreating({ kind: "shift", start: atMinutes(firstDay, 9 * 60) })}>
            Añadir turno
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
                bumpData();
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
          <span className="min-w-0 truncate">Movida · {undo.text}</span>
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

      <AgendaGrid
        columns={columns}
        header={header}
        appointments={appointments}
        shifts={team ? shifts : []}
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
      />
      <p className="text-sm text-text-muted">
        Para ver más o menos días, junta o separa dos dedos sobre la agenda (o elige Día, 3 días o Semana); toca un día de la semana para verlo solo.
        Arrastra una cita para moverla (en el móvil, mantenla pulsada un momento); tócala para atenderla, anularla o moverla una hora, un día o una
        semana. Toca un hueco para dar una cita{team ? " (o, desde ahí, poner un turno)" : ""}. Para ir a otra fecha, tócala arriba.
      </p>

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
      {managing && <AppointmentSheet open onClose={() => setManaging(null)} patientId={managing.patientId} patientName={managing.name} appointment={managing} />}
    </Page>
  );
}
