// El botón «＋» del centro de la barra (docs/rediseno-sencilla.md, bloque 4): lo que más se hace, desde cualquier
// pantalla. Dentro de una ficha ofrece primero lo de ese paciente (nueva sesión, darle cita, cobrarle, apuntar en su
// calendario); siempre, nueva cita y nuevo paciente, los últimos pacientes abiertos y un buscador de pacientes (nombre,
// teléfono o DNI) y de pantallas («bono», «PIN»). Los botones de siempre siguen donde estaban: esto es un atajo más.
import { CalendarDays, CalendarPlus, NotebookPen, Plus, Search, UserPlus, UserRound, Wallet } from "lucide-react";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { getDb } from "../data/db";
import { findPatients } from "../data/patientSearch";
import { getPatient } from "../data/repo";
import { Sheet } from "../ui/Sheet";
import { recentPatients } from "./recent";
import { findScreens } from "./screens";
import { useAsync } from "./useAsync";

const AppointmentSheet = lazy(() => import("../clinical/AppointmentSheet").then((m) => ({ default: m.AppointmentSheet })));

const tileBase = "flex min-h-14 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-semibold hover:border-accent";
const tile = `${tileBase} border-border bg-bg`;
/** Lo del paciente de la ficha, sobre el verde suave. */
const tileHis = `${tileBase} border-transparent bg-accent-soft`;
const row = "flex min-h-11 items-center gap-2 rounded-md px-2 text-left hover:bg-surface";

/** El paciente de la ficha en la que se está (de la dirección), si la hay. */
function usePatientHere(): string | null {
  const { pathname } = useLocation();
  const m = /^\/pacientes\/([^/]+)/.exec(pathname);
  return m && m[1] !== "nuevo" ? m[1]! : null;
}

export function QuickAdd({ children, className, label = "Añadir o buscar" }: { children: ReactNode; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** La hoja de la cita: de un paciente concreto o para elegirlo en ella. */
  const [visit, setVisit] = useState<{ id: string; name: string } | "any" | null>(null);
  const here = usePatientHere();
  const data = useAsync(
    async () => {
      if (!open) return null;
      const db = getDb();
      const ids = recentPatients().filter((id) => id !== here);
      const [patient, recent] = await Promise.all([here ? getPatient(db, here) : null, Promise.all(ids.map((id) => getPatient(db, id)))]);
      return { patient, recent: recent.filter((p) => !!p).map((p) => ({ id: p!.id, name: p!.name })) };
    },
    [open, here],
    { tables: ["patients"] },
  );
  const found = useAsync(async () => (open && query.trim().length >= 2 ? (await findPatients(getDb(), { search: query.trim(), limit: 6 })).rows : []), [open, query], { tables: ["patients"] });
  const screens = findScreens(query);
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const patient = data.data?.patient ?? null;
  const first = patient?.name.split(" ")[0];
  const searching = query.trim().length > 0;
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={label} title={label} onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      <Sheet open={open} onClose={close} title={label}>
        <label className="relative block">
          <span className="sr-only">Buscar un paciente o una pantalla</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar paciente o pantalla"
            className="h-12 w-full rounded-md border border-border-input bg-bg pr-3 pl-10 text-base"
          />
        </label>
        {searching ? (
          <div className="flex flex-col gap-3">
            {(found.data ?? []).length > 0 && (
              <section aria-label="Pacientes" className="flex flex-col">
                <h3 className="px-2 text-xs font-semibold tracking-wide text-text-muted uppercase">Pacientes</h3>
                {found.data!.map((p) => (
                  <Link key={p.id} to={`/pacientes/${p.id}`} onClick={close} className={row}>
                    <UserRound aria-hidden="true" className="size-5 shrink-0 text-accent" />
                    <span className="min-w-0 break-words">{p.name}</span>
                  </Link>
                ))}
              </section>
            )}
            {screens.length > 0 && (
              <section aria-label="Pantallas" className="flex flex-col">
                <h3 className="px-2 text-xs font-semibold tracking-wide text-text-muted uppercase">Pantallas</h3>
                {screens.map((s) => (
                  <Link key={s.to} to={s.to} onClick={close} className={row}>
                    <Search aria-hidden="true" className="size-5 shrink-0 text-accent" />
                    {s.label}
                  </Link>
                ))}
              </section>
            )}
            {query.trim().length >= 2 && found.data && found.data.length === 0 && screens.length === 0 && <p className="px-2 text-sm text-text-muted">Nada con «{query.trim()}».</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {patient && (
              <section aria-label={`Con ${patient.name}`} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Con {patient.name}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Link to={`/pacientes/${patient.id}/sesiones/nueva`} onClick={close} className={tileHis}>
                    <NotebookPen aria-hidden="true" className="size-5 shrink-0 text-accent" /> Nueva sesión
                  </Link>
                  <button type="button" onClick={() => { close(); setVisit({ id: patient.id, name: patient.name }); }} className={tileHis}>
                    <CalendarPlus aria-hidden="true" className="size-5 shrink-0 text-accent" /> Cita para {first}
                  </button>
                  <Link to={`/pacientes/${patient.id}/cobros`} onClick={close} className={tileHis}>
                    <Wallet aria-hidden="true" className="size-5 shrink-0 text-accent" /> Cobros de {first}
                  </Link>
                  <Link to={`/pacientes/${patient.id}/calendario`} onClick={close} className={tileHis}>
                    <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-accent" /> Su calendario
                  </Link>
                </div>
              </section>
            )}
            <section aria-label="En la clínica" className="flex flex-col gap-2">
              {patient && <h3 className="text-sm font-semibold">En la clínica</h3>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { close(); setVisit("any"); }} className={tile}>
                  <CalendarPlus aria-hidden="true" className="size-5 shrink-0 text-accent" /> Cita nueva
                </button>
                <Link to="/pacientes/nuevo" onClick={close} className={tile}>
                  <UserPlus aria-hidden="true" className="size-5 shrink-0 text-accent" /> Paciente nuevo
                </Link>
              </div>
            </section>
            {(data.data?.recent ?? []).length > 0 && (
              <section aria-label="Últimos pacientes" className="flex flex-col">
                <h3 className="text-sm font-semibold">Últimos pacientes</h3>
                {data.data!.recent.map((p) => (
                  <Link key={p.id} to={`/pacientes/${p.id}`} onClick={close} className={row}>
                    <UserRound aria-hidden="true" className="size-5 shrink-0 text-accent" />
                    <span className="min-w-0 break-words">{p.name}</span>
                  </Link>
                ))}
              </section>
            )}
          </div>
        )}
      </Sheet>
      {visit && (
        <Suspense fallback={null}>
          <AppointmentSheet open onClose={() => setVisit(null)} patientId={visit === "any" ? undefined : visit.id} patientName={visit === "any" ? undefined : visit.name} appointment={null} />
        </Suspense>
      )}
    </>
  );
}

/** El «＋» redondo del centro de la barra de abajo. */
export function QuickAddFab() {
  return (
    <QuickAdd className="relative -mt-4 inline-flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-pop ring-4 ring-bg hover:bg-accent-hover">
      <Plus aria-hidden="true" className="size-7" />
    </QuickAdd>
  );
}
