// Desde la ficha de un test de la galería: registrar su resultado en un paciente. Si se llega desde la ficha
// de un paciente (?paciente=…), va directo a él.
import { Search, Stethoscope } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getPatient, listPatients } from "../data/repo";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

export function RegisterInPatient({ testId }: { testId: string }) {
  const [params] = useSearchParams();
  const pid = params.get("paciente");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const current = useAsync(async () => (pid ? getPatient(getDb(), pid) : null), [pid]);
  const list = useAsync(async () => (open ? listPatients(getDb(), q) : []), [open, q]);
  const to = (id: string) => `/pacientes/${id}/exploracion/nuevo?test=${encodeURIComponent(testId)}`;

  return (
    <>
      {current.data ? (
        <div className="flex flex-col gap-1">
          <Link to={to(current.data.id)} className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover">
            <Stethoscope aria-hidden="true" className="size-5" /> Registrar el resultado en {current.data.name}
          </Link>
          <button type="button" onClick={() => setOpen(true)} className="tap self-center rounded-md px-2 text-sm text-accent hover:bg-surface">
            En otro paciente
          </button>
        </div>
      ) : (
        <Button variant="secondary" icon={<Stethoscope aria-hidden="true" className="size-5" />} onClick={() => setOpen(true)}>
          Registrar el resultado en un paciente
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
        {list.data && list.data.length > 0 ? (
          <ul className="flex max-h-[50dvh] flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {list.data.map((p) => (
              <li key={p.id}>
                <Link to={to(p.id)} className="flex min-h-12 items-center px-3 font-semibold hover:bg-surface">
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          list.data && <p className="text-sm text-text-muted">{q ? `Ningún paciente se llama «${q}».` : "Todavía no hay pacientes."}</p>
        )}
      </Sheet>
    </>
  );
}
