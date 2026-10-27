// Desde la Biblioteca: llevar un test, un cuestionario o una medición a un paciente. Si se llega desde su ficha
// (?paciente=…), el botón lleva su nombre y va directo; si no, se elige el paciente en una hoja (el último abierto,
// arriba del todo). Nunca se adivina el paciente: así no se apunta nada en la ficha equivocada.
import { Search, Stethoscope } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { lastPatient } from "../app/recent";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { findPatients } from "../data/patientSearch";
import { getPatient } from "../data/repo";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

type Props = {
  /** A dónde ir con el paciente elegido. */
  to: (patientId: string) => string;
  /** El botón sin paciente: «Registrar el resultado en un paciente». */
  label: string;
  /** El botón con paciente: «Registrar el resultado en Ana». */
  labelFor: (name: string) => string;
  icon?: ReactNode;
};

export function ForPatient({ to, label, labelFor, icon }: Props) {
  const [params] = useSearchParams();
  const pid = params.get("paciente");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = useAsync(async () => (pid ? getPatient(getDb(), pid) : null), [pid]);
  const recent = lastPatient();
  const list = useAsync(async () => {
    if (!open) return { rows: [], more: 0 };
    const { rows, total } = await findPatients(getDb(), { search: q });
    // El último paciente abierto, primero (si está en la búsqueda; sin buscar, aunque no salga en esta página).
    const first = rows.find((p) => p.id === recent) ?? (recent && !q.trim() ? await getPatient(getDb(), recent) : null);
    return { rows: [...(first ? [first] : []), ...rows.filter((p) => p.id !== recent)], more: total - rows.length };
  }, [open, q, recent]);

  return (
    <>
      {current.data ? (
        <div className="flex flex-col gap-1">
          <Link to={to(current.data.id)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-center font-semibold text-on-accent hover:bg-accent-hover">
            {icon} {labelFor(current.data.name)}
          </Link>
          <button type="button" onClick={() => setOpen(true)} className="tap self-center rounded-md px-2 text-sm text-accent hover:bg-surface">
            En otro paciente
          </button>
        </div>
      ) : (
        <Button variant="secondary" icon={icon} onClick={() => setOpen(true)}>
          {label}
        </Button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="¿En qué paciente?">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            aria-label="Buscar paciente"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-11 w-full rounded-md border border-border-input bg-bg pr-3 pl-10 text-base"
          />
        </div>
        {list.data && list.data.rows.length > 0 ? (
          <ul className="flex max-h-[50dvh] flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {list.data.rows.map((p) => (
              <li key={p.id}>
                <Link to={to(p.id)} className="flex min-h-12 items-center justify-between gap-2 px-3 font-semibold hover:bg-surface">
                  <span>{p.name}</span>
                  {p.id === recent && <span className="text-xs font-normal text-text-muted">Último abierto</span>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          list.data && <p className="text-sm text-text-muted">{q ? `Ningún paciente se llama «${q}».` : "Todavía no hay pacientes."}</p>
        )}
        {!!list.data?.more && <p className="text-sm text-text-muted">Y {list.data.more} más: escribe su nombre, teléfono o DNI para encontrarlo.</p>}
      </Sheet>
    </>
  );
}

/** En la ficha de un test: registrar su resultado en un paciente. */
export function RegisterInPatient({ testId }: { testId: string }) {
  return (
    <ForPatient
      to={(id) => `/pacientes/${id}/exploracion/nuevo?test=${encodeURIComponent(testId)}`}
      label="Registrar el resultado en un paciente"
      labelFor={(name) => `Registrar el resultado en ${name}`}
      icon={<Stethoscope aria-hidden="true" className="size-5" />}
    />
  );
}
