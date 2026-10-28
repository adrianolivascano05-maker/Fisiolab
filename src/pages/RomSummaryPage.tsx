import { dayOf as day } from "../app/dates";
import { ChevronRight, Plus, Rotate3d } from "lucide-react";
import { Link, useParams } from "react-router";
import { movementLabel, movements, type Movement } from "../calc/rom";
import { fmt, fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getPatient, romEntries, type RomEntry } from "../data/repo";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";


/** Última medición de cada lado y, si se midieron el mismo día, la diferencia. */
function latestBySide(entries: RomEntry[]) {
  const left = entries.find((e) => e.side === "left") ?? null;
  const right = entries.find((e) => e.side === "right") ?? null;
  const both = entries.find((e) => e.side === null) ?? null;
  const diff = left && right && day(left.performedAt) === day(right.performedAt) ? Math.abs(left.angleDeg - right.angleDeg) : null;
  return { left, right, both, diff };
}

/** Movilidad del paciente: un resumen por movimiento medido. */
export function RomSummaryPage() {
  const { id = "" } = useParams();
  const data = useAsync(async () => ({ patient: await getPatient(getDb(), id), entries: await romEntries(getDb(), id) }), [id]);
  const title = "Movilidad";
  const back = `/pacientes/${id}/mediciones`;
  if (data.error) return <Page title={title} backTo={back}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title={title} backTo={back}><Loading /></Page>;
  const { patient, entries } = data.data;
  // En el orden del catálogo: tobillo, cadera, hombro, cuello.
  const measured = movements.filter((m) => entries.some((e) => e.movement === m.id));

  return (
    <Page title={title} backTo={back}>
      <p className="text-text-muted">{patient?.name}</p>
      <Link
        to={`/pacientes/${id}/test/movilidad`}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-input px-4 font-semibold hover:bg-surface"
      >
        <Plus aria-hidden="true" className="size-5" /> Medir movilidad
      </Link>
      {measured.length === 0 ? (
        <EmptyState icon={Rotate3d} title="Sin mediciones de movilidad">
          Mide un movimiento para verlo aquí.
        </EmptyState>
      ) : (
        <ul aria-label="Movimientos medidos" className="flex flex-col gap-2">
          {measured.map((m) => (
            <li key={m.id}>
              <MovementCard patientId={id} movement={m} entries={entries.filter((e) => e.movement === m.id)} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-text-muted">La diferencia entre lados solo se muestra si los dos se midieron el mismo día.</p>
    </Page>
  );
}

function MovementCard({ patientId, movement, entries }: { patientId: string; movement: Movement; entries: RomEntry[] }) {
  const { left, right, both, diff } = latestBySide(entries);
  const cell = (label: string, e: RomEntry | null) => (
    <span className="flex flex-col">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="nums text-xl">{e ? `${fmt(e.angleDeg, 0)}°` : "—"}</span>
      {e && <span className="text-xs text-text-muted">{fmtDate(e.performedAt)}</span>}
    </span>
  );
  return (
    <Link to={`/pacientes/${patientId}/movilidad/${movement.id}`} className="block">
      <Card className="flex flex-col gap-2 hover:border-accent">
        <span className="flex items-center justify-between gap-2 font-semibold">
          {movementLabel(movement)}
          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
        </span>
        {movement.sided ? (
          <span className="grid grid-cols-3 gap-2">
            {cell("Izquierdo", left)}
            {cell("Derecho", right)}
            <span className="flex flex-col">
              <span className="text-sm text-text-muted">Diferencia</span>
              <span className="nums text-xl">{diff === null ? "—" : `${fmt(diff, 0)}°`}</span>
            </span>
          </span>
        ) : (
          cell("Última", both)
        )}
      </Card>
    </Link>
  );
}
