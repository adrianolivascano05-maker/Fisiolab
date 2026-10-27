// Los fisios que llevan al paciente (src/data/patientStaff.ts), en la cabecera de su ficha: un botón con quién lo
// lleva (o «Asignar fisio») y una hoja para elegir uno o varios del equipo, con las citas que tiene con cada uno. Solo
// en una clínica con equipo. El filtro «Fisio» de la lista de pacientes usa esto.
import { UserRound } from "lucide-react";
import { useState } from "react";
import { bumpData } from "../app/dataVersion";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { appointmentsByPhysio, patientPhysios, setPatientPhysios } from "../data/patientStaff";
import { staffColor } from "../data/schedule";
import { staffName, useStaff } from "../schedule/useStaff";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

export function PatientPhysios({ patientId }: { patientId: string }) {
  const staff = useStaff();
  const assigned = useAsync(() => patientPhysios(getDb(), patientId), [patientId]);
  const [open, setOpen] = useState(false);
  if (!staff.length || !assigned.data) return null;
  const names = assigned.data.map((e) => staffName(staff, e));
  const label = names.length ? `${names.length === 1 ? "Fisio" : "Fisios"}: ${names.join(", ")}` : "Asignar fisio";
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-pill border border-border bg-bg px-3 text-sm font-semibold text-accent hover:bg-surface"
      >
        <UserRound aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {open && <PhysiosSheet patientId={patientId} assigned={assigned.data} onClose={() => setOpen(false)} onSaved={assigned.reload} />}
    </>
  );
}

function PhysiosSheet({ patientId, assigned, onClose, onSaved }: { patientId: string; assigned: string[]; onClose: () => void; onSaved: () => void }) {
  const staff = useStaff();
  const toast = useToast();
  const [picked, setPicked] = useState(assigned);
  const [saving, setSaving] = useState(false);
  const visits = useAsync(() => appointmentsByPhysio(getDb(), patientId), [patientId]);
  // Los del equipo y, si alguno asignado ya no está en él, también (para poder quitarlo).
  const people = [...staff, ...assigned.filter((e) => !staff.some((s) => s.email === e)).map((email) => ({ email, name: email, color: 0, gone: true }))];
  const save = async () => {
    setSaving(true);
    try {
      await setPatientPhysios(getDb(), patientId, picked);
      bumpData();
      onSaved();
      toast(picked.length ? "Fisios guardados" : "Sin fisio asignado", "success");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
      setSaving(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Fisios que lo llevan">
      <p className="text-sm text-text-muted">Uno o varios. Sirve para buscarlo en Pacientes → Filtros → Fisio; sus citas pueden ser con cualquiera.</p>
      <fieldset className="flex flex-col">
        <legend className="sr-only">Fisios del equipo</legend>
        {people.map((s) => {
          const n = visits.data?.get(s.email) ?? 0;
          return (
            <label key={s.email} className="flex min-h-12 items-center gap-3 border-b border-border py-1 last:border-b-0">
              <input
                type="checkbox"
                className="size-5 shrink-0 accent-accent"
                checked={picked.includes(s.email)}
                onChange={(e) => setPicked(e.target.checked ? [...picked, s.email] : picked.filter((x) => x !== s.email))}
              />
              <span aria-hidden="true" className="size-3 shrink-0 rounded-pill" style={{ background: staffColor(s) }} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{s.name}</span>
                <span className="text-sm text-text-muted">
                  {"gone" in s ? "Ya no está en el equipo" : n ? `${n === 1 ? "1 cita" : `${n} citas`} con este paciente` : "Sin citas con este paciente"}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <Button size="lg" loading={saving} onClick={() => void save()}>
        Guardar
      </Button>
      <Button variant="secondary" onClick={onClose}>
        Cancelar
      </Button>
    </Sheet>
  );
}
