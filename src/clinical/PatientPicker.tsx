// Elegir el paciente de una cita nueva (desde un hueco de la agenda o la lista de espera): buscar por nombre o
// teléfono y tocarlo; si no existe, crearlo aquí mismo con solo el nombre.
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { findPatients } from "../data/patientSearch";
import { createPatient, QUICK_PATIENT } from "../data/repo";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";

export type PickedPatient = { id: string; name: string };

export function PatientPicker({ picked, onPick }: { picked: PickedPatient | null; onPick: (p: PickedPatient | null) => void }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  // En la base, sin cargarlos todos: los 6 primeros que coinciden.
  const all = useAsync(async () => (await findPatients(getDb(), { search: q, limit: 7 })).rows.filter((p) => p.name !== QUICK_PATIENT).slice(0, 6), [q]);
  const found = all.data ?? [];
  if (picked)
    return (
      <div className="flex items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
        <span>
          Paciente: <span className="font-semibold">{picked.name}</span>
        </span>
        <Button size="sm" variant="ghost" onClick={() => onPick(null)}>
          Cambiar
        </Button>
      </div>
    );
  const exact = found.some((p) => p.name.trim().toLowerCase() === q.trim().toLowerCase());
  return (
    <div className="flex flex-col gap-2">
      <TextField label="Paciente" placeholder="Busca por nombre o teléfono" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      {/* Primero los que ya existen (con su teléfono, por si hay dos con el mismo nombre); crear uno nuevo, al final. */}
      <ul aria-label="Pacientes" className="flex flex-col divide-y divide-border rounded-md border border-border">
        {found.map((p) => (
          <li key={p.id}>
            <button type="button" className="tap flex w-full items-baseline justify-between gap-3 px-3 text-left hover:bg-surface" onClick={() => onPick({ id: p.id, name: p.name })}>
              <span className="font-semibold">{p.name}</span>
              {p.phone && <span className="text-sm text-text-muted">{p.phone}</span>}
            </button>
          </li>
        ))}
        {all.data && !found.length && <li className="px-3 py-2 text-sm text-text-muted">Ningún paciente con ese nombre.</li>}
      </ul>
      {q.trim() && !exact && (
        <Button
          variant="ghost"
          className="self-start"
          loading={adding}
          icon={<UserPlus aria-hidden="true" className="size-5" />}
          onClick={async () => {
            setAdding(true);
            try {
              const name = q.trim().replace(/\s+/g, " ");
              const id = await createPatient(getDb(), { name, birthDate: null, sex: null, bodyMassKg: null, heightCm: null, legLengthCm: null, pushOffDistanceCm: null, notes: "" });
              onPick({ id, name });
            } finally {
              setAdding(false);
            }
          }}
        >
          {found.length ? `No es ninguno: crear «${q.trim()}»` : `Paciente nuevo: «${q.trim()}»`}
        </Button>
      )}
      {!q.trim() && <p className="text-sm text-text-muted">¿Es nuevo? Escribe su nombre y créalo aquí mismo; el resto de su ficha, cuando venga.</p>}
    </div>
  );
}
