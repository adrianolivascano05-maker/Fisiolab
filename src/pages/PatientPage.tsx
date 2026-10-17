import { Activity, ChartLine, Gauge, Pencil, Plus, Rotate3d, Scale } from "lucide-react";
import { Link, useParams } from "react-router";
import { fmt, fmtDateTime, isJumpType, testTitle } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getPatient, listTests } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";

function age(birthDate: string | null) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0);
}

const tile = "flex min-h-14 items-center gap-2 rounded-lg border border-border bg-bg p-3 font-semibold shadow-card hover:border-accent";

/** S02 Ficha del paciente */
export function PatientPage() {
  const { id = "" } = useParams();
  const data = useAsync(async () => {
    const db = getDb();
    return { patient: await getPatient(db, id), tests: await listTests(db, id) };
  }, [id]);

  if (data.error) return <Page title="Paciente" backTo="/"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Paciente" backTo="/"><Loading /></Page>;
  const { patient, tests } = data.data;
  if (!patient) return <Page title="Paciente" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;

  const years = age(patient.birthDate);
  const facts = [
    years !== null && `${years} años`,
    patient.bodyMassKg && `${fmt(patient.bodyMassKg)} kg`,
    patient.heightCm && `${fmt(patient.heightCm, 0)} cm`,
    patient.pushOffDistanceCm && `empuje ${fmt(patient.pushOffDistanceCm)} cm`,
  ].filter(Boolean);
  const typesDone = [...new Set(tests.map((t) => t.type))];
  const lastJump = tests.find((t) => isJumpType(t.type));
  const hasRom = tests.some((t) => t.movement !== null);

  return (
    <Page
      title={patient.name}
      backTo="/"
      action={
        <Link to={`/pacientes/${id}/editar`} aria-label="Editar paciente" className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
          <Pencil aria-hidden="true" className="size-5" />
        </Link>
      }
    >
      <p className="text-text-muted">{facts.length ? facts.join(" · ") : "Sin datos físicos"}</p>
      {(!patient.bodyMassKg || !patient.pushOffDistanceCm) && (
        <Alert tone="info" title="Faltan datos para fuerza y potencia">
          Añade la masa y la distancia de empuje en <Link className="underline" to={`/pacientes/${id}/editar`}>editar</Link>. La altura del salto se calcula igualmente.
        </Alert>
      )}
      <Link
        to={`/pacientes/${id}/test`}
        className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover"
      >
        <Plus aria-hidden="true" className="size-5" /> Nueva medición
      </Link>

      {tests.length > 0 && (
        <nav aria-label="Análisis" className="grid grid-cols-2 gap-2">
          {lastJump && (
            <Link to={`/pacientes/${id}/evolucion/${lastJump.type}`} className={tile}>
              <ChartLine aria-hidden="true" className="size-5 shrink-0 text-accent" /> Evolución
            </Link>
          )}
          {(typesDone.includes("sj") || typesDone.includes("cmj")) && (
            <Link to={`/pacientes/${id}/perfil/fv`} className={tile}>
              <Gauge aria-hidden="true" className="size-5 shrink-0 text-accent" /> Perfil fuerza-velocidad
            </Link>
          )}
          {typesDone.includes("single_leg") && (
            <Link to={`/pacientes/${id}/asimetria`} className={tile}>
              <Scale aria-hidden="true" className="size-5 shrink-0 text-accent" /> Asimetría
            </Link>
          )}
          {hasRom && (
            <Link to={`/pacientes/${id}/movilidad`} className={tile}>
              <Rotate3d aria-hidden="true" className="size-5 shrink-0 text-accent" /> Movilidad
            </Link>
          )}
        </nav>
      )}

      <h2 className="text-lg">Tests</h2>
      {tests.length === 0 ? (
        <EmptyState icon={Activity} title="Sin tests todavía">
          Pulsa «Nueva medición» para registrar su primer salto o su movilidad.
        </EmptyState>
      ) : (
        <ul aria-label="Tests" className="flex flex-col gap-2">
          {tests.map((t) => (
            <li key={t.id}>
              <Link to={`/tests/${t.id}`} className="block">
                <Card className="flex items-center justify-between gap-3 hover:border-accent">
                  <span className="flex flex-col">
                    <span className="font-semibold">
                      {testTitle(t)}
                      {t.extraLoadKg > 0 && <span className="font-normal text-text-muted"> · {fmt(t.extraLoadKg, 0)} kg</span>}
                    </span>
                    <span className="text-sm text-text-muted">{fmtDateTime(t.performedAt)}</span>
                  </span>
                  <span className="nums text-right">
                    {t.movement !== null ? (
                      t.angleDeg === null ? (
                        <span className="text-sm text-text-muted">—</span>
                      ) : (
                        <span className="text-xl">{fmt(t.angleDeg, 0)}°</span>
                      )
                    ) : t.distanceCm !== null ? (
                      <>
                        <span className="text-xl">{fmt(t.distanceCm, 0)}</span> <span className="text-text-muted">cm</span>
                      </>
                    ) : t.type === "rj_10_5" && t.rsi !== null ? (
                      <>
                        <span className="text-sm text-text-muted">RSI </span>
                        <span className="text-xl">{fmt(t.rsi, 2)}</span>
                      </>
                    ) : t.heightCm === null ? (
                      <span className="text-sm text-warning">Sin marcar</span>
                    ) : (
                      <>
                        <span className="text-xl">{fmt(t.heightCm)}</span> <span className="text-text-muted">cm</span>
                        {t.rsi !== null && <span className="block text-sm text-text-muted">RSI {fmt(t.rsi, 2)}</span>}
                      </>
                    )}
                  </span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
