// Poner, cambiar o borrar un turno del horario (src/data/schedule.ts). Quien administra la clínica pone los de todos;
// cada persona, los suyos.
import { Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { bumpData } from "../app/dataVersion";
import { getDb } from "../data/db";
import { createShift, deleteShift, updateShift, type Shift, type Staff } from "../data/schedule";
import { localInput } from "../clinical/pageKit";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

export function ShiftSheet({
  open,
  onClose,
  shift,
  day,
  staff,
  me,
  admin,
}: {
  open: boolean;
  onClose: () => void;
  /** El turno que se cambia; null para poner uno nuevo. */
  shift: Shift | null;
  /** Día (AAAA-MM-DD) con el que empieza un turno nuevo. */
  day: string;
  staff: Staff[];
  /** Correo de quien ha entrado. */
  me: string;
  admin: boolean;
}) {
  const toast = useToast();
  const [who, setWho] = useState(me);
  const [date, setDate] = useState(day);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("14:00");
  const [note, setNote] = useState("");
  const [repeat, setRepeat] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWho(shift?.staffEmail ?? me);
    setDate(shift ? localInput(shift.startsAt).slice(0, 10) : day);
    setFrom(shift ? localInput(shift.startsAt).slice(11) : "09:00");
    setTo(shift ? localInput(shift.endsAt).slice(11) : "14:00");
    setNote(shift?.note ?? "");
    setRepeat("0");
    setError(null);
  }, [open, shift, day, me]);

  // Cada persona elige solo entre sus turnos; quien administra, entre todo el equipo.
  const people = admin ? [...staff] : staff.filter((s) => s.email === me);
  if (!people.some((s) => s.email === me)) people.push({ email: me, name: "Yo", color: 0 });

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
    if (!date || !from || !to) return setError("Pon el día y las horas del turno.");
    const input = { staffEmail: who, startsAt: new Date(`${date}T${from}`).toISOString(), endsAt: new Date(`${date}T${to}`).toISOString(), note };
    const weeks = Number(repeat);
    return run(
      () => (shift ? updateShift(getDb(), shift.id, input) : createShift(getDb(), input, weeks)),
      shift ? "Turno cambiado" : weeks ? `Turno puesto y repetido ${weeks === 1 ? "la semana siguiente" : `${weeks} semanas`}` : "Turno puesto",
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={shift ? "Cambiar el turno" : "Nuevo turno"}>
      <form
        className="flex flex-col gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <SelectField label="Persona" value={who} onChange={(e) => setWho(e.target.value)} disabled={people.length < 2}>
          {people.map((p) => (
            <option key={p.email} value={p.email}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <TextField label="Día" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Entrada" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label="Salida" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <TextField label="Nota" hint="Opcional: «recepción», «domicilios»…" value={note} onChange={(e) => setNote(e.target.value)} />
        {!shift && (
          <SelectField label="Repetir" value={repeat} onChange={(e) => setRepeat(e.target.value)}>
            <option value="0">Solo este día</option>
            {[1, 2, 3, 4, 8, 12, 26].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "También la semana siguiente" : `Las ${n} semanas siguientes`}
              </option>
            ))}
          </SelectField>
        )}
        {error && <Alert tone="danger" title={error} />}
        <Button type="submit" block loading={busy}>
          Guardar el turno
        </Button>
        {shift && (
          <Button variant="ghost" className="text-danger" block loading={busy} icon={<Trash aria-hidden="true" className="size-5" />} onClick={() => void run(() => deleteShift(getDb(), shift.id), "Turno borrado")}>
            Borrar el turno
          </Button>
        )}
      </form>
    </Sheet>
  );
}
