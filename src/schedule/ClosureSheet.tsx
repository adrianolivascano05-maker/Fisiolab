// Cerrar la agenda (src/data/closures.ts): una tarde, un día o varios en los que no se puede reservar por internet,
// de una persona o de toda la clínica. Cada fisio cierra la suya; quien administra, la de cualquiera o la de todos.
// Las citas que ya hay en esos días no se tocan: la hoja avisa de cuántas son.
import { CalendarOff, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { bumpData } from "../app/dataVersion";
import { localInput } from "../clinical/pageKit";
import { appointmentsInside, createClosure, deleteClosure, updateClosure, type Closure, type ClosureInput } from "../data/closures";
import { getDb } from "../data/db";
import type { Staff } from "../data/schedule";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

type Kind = "day" | "days" | "hours";
const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
};
const iso = (day: string, hm = "00:00") => new Date(`${day}T${hm}`).toISOString();

/** Lo que se ha escrito, como cierre (o el problema). */
function toInput(f: { who: string; kind: Kind; day: string; until: string; from: string; to: string; note: string }): ClosureInput | string {
  if (!f.day) return "Pon el día.";
  if (f.kind === "day") return { staffEmail: f.who, startsAt: iso(f.day), endsAt: iso(addDay(f.day, 1)), note: f.note };
  if (f.kind === "days") {
    if (!f.until) return "Pon hasta qué día.";
    if (f.until < f.day) return "El último día tiene que ser el primero o uno después.";
    return { staffEmail: f.who, startsAt: iso(f.day), endsAt: iso(addDay(f.until, 1)), note: f.note };
  }
  if (!f.from || !f.to) return "Pon desde qué hora y hasta cuál.";
  return { staffEmail: f.who, startsAt: iso(f.day, f.from), endsAt: iso(f.day, f.to), note: f.note };
}

/** Lo que es un cierre guardado, para cambiarlo en la hoja. */
function fromClosure(c: Closure) {
  const start = localInput(c.startsAt);
  const end = localInput(c.endsAt);
  const midnight = start.slice(11) === "00:00" && end.slice(11) === "00:00";
  const lastDay = addDay(end.slice(0, 10), -1);
  const kind: Kind = !midnight ? "hours" : lastDay === start.slice(0, 10) ? "day" : "days";
  return { who: c.staffEmail, kind, day: start.slice(0, 10), until: midnight ? lastDay : start.slice(0, 10), from: start.slice(11), to: end.slice(11), note: c.note };
}

export function ClosureSheet({
  open,
  onClose,
  closure,
  day,
  person,
  staff,
  me,
  admin,
  team,
}: {
  open: boolean;
  onClose: () => void;
  /** El cierre que se cambia; null para uno nuevo. */
  closure: Closure | null;
  /** Día (AAAA-MM-DD) con el que empieza uno nuevo. */
  day: string;
  /** De quién, si se abre desde la columna de una persona. */
  person?: string | null;
  staff: Staff[];
  /** Correo de quien ha entrado («» sin clínica). */
  me: string;
  admin: boolean;
  /** Clínica con equipo: se elige de quién; si no, es la agenda de la consulta entera. */
  team: boolean;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ who: "", kind: "day" as Kind, day, until: day, from: "15:00", to: "21:00", note: "" });
  const [inside, setInside] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      closure
        ? fromClosure(closure)
        : { who: team ? (admin && person !== undefined ? (person ?? "") : me) : "", kind: "day", day, until: day, from: "15:00", to: "21:00", note: "" },
    );
    setError(null);
  }, [open, closure, day, person, me, admin, team]);

  // Cuántas citas hay ya en esos días (no se anulan solas).
  useEffect(() => {
    if (!open) return;
    const input = toInput(form);
    if (typeof input === "string") return setInside(0);
    let alive = true;
    void appointmentsInside(getDb(), input).then((n) => alive && setInside(n));
    return () => {
      alive = false;
    };
  }, [open, form]);

  // Cada persona cierra la suya; quien administra, la de cualquiera o la de toda la clínica.
  const people = admin ? [...staff] : staff.filter((s) => s.email === me);
  if (team && me && !people.some((s) => s.email === me)) people.push({ email: me, name: "Yo", color: 0 });
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function run(work: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    try {
      await work();
      toast(done, "success");
      bumpData();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const save = () => {
    const input = toInput(form);
    if (typeof input === "string") return setError(input);
    return run(() => (closure ? updateClosure(getDb(), closure.id, input) : createClosure(getDb(), input, me)), closure ? "Cierre cambiado" : "Agenda cerrada: no se podrá reservar por internet");
  };

  return (
    <Sheet open={open} onClose={onClose} title={closure ? "Cambiar el cierre" : "Cerrar la agenda"}>
      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-sm text-text-muted">En esos ratos no se puede reservar por internet. Las citas que ya hay no se tocan.</p>
        {team && (
          <SelectField label="De quién" value={form.who} onChange={(e) => set({ who: e.target.value })} disabled={!admin && people.length < 2}>
            {admin && <option value="">Toda la clínica</option>}
            {people.map((p) => (
              <option key={p.email} value={p.email}>
                {p.email === me ? `${p.name} (tú)` : p.name}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField label="Cuánto" value={form.kind} onChange={(e) => set({ kind: e.target.value as Kind })}>
          <option value="day">Un día entero</option>
          <option value="days">Varios días (vacaciones, cierre)</option>
          <option value="hours">Unas horas (una mañana, una tarde)</option>
        </SelectField>
        {form.kind === "days" ? (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Desde el día" type="date" value={form.day} onChange={(e) => set({ day: e.target.value, until: form.until < e.target.value ? e.target.value : form.until })} />
            <TextField label="Hasta el día" type="date" min={form.day} value={form.until} onChange={(e) => set({ until: e.target.value })} />
          </div>
        ) : (
          <TextField label="Día" type="date" value={form.day} onChange={(e) => set({ day: e.target.value })} />
        )}
        {form.kind === "hours" && (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Desde" type="time" value={form.from} onChange={(e) => set({ from: e.target.value })} />
            <TextField label="Hasta" type="time" value={form.to} onChange={(e) => set({ to: e.target.value })} />
          </div>
        )}
        <TextField label="Motivo" hint="Opcional, solo lo ve el equipo: «vacaciones», «formación», «festivo»…" value={form.note} onChange={(e) => set({ note: e.target.value })} />
        {inside > 0 && (
          <Alert tone="warning" title={inside === 1 ? "Ya hay 1 cita en esos días" : `Ya hay ${inside} citas en esos días`}>
            Siguen como están: muévelas o anúlalas desde la agenda si hace falta.
          </Alert>
        )}
        {error && <Alert tone="danger" title={error} />}
        <Button type="submit" block loading={busy} icon={<CalendarOff aria-hidden="true" className="size-5" />}>
          {closure ? "Guardar el cierre" : "Cerrar la agenda"}
        </Button>
        {closure && (
          <Button
            variant="ghost"
            className="text-danger"
            block
            loading={busy}
            icon={<Trash aria-hidden="true" className="size-5" />}
            onClick={() => void run(() => deleteClosure(getDb(), closure.id), "Agenda abierta otra vez")}
          >
            Quitar el cierre (abrir la agenda)
          </Button>
        )}
      </form>
    </Sheet>
  );
}
