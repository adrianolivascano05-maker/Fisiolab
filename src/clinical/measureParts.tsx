// Mediciones en la ficha: accesos a los análisis y la lista completa de tests.
import { ChartLine, Dumbbell, Gauge, Rotate3d, Scale } from "lucide-react";
import { Link } from "react-router";
import { fmt, fmtDateTime, isJumpType, testTitle } from "../app/format";
import type { TestSummary } from "../data/repo";
import { Card } from "../ui/Card";
import { mainValue } from "./measures";

const tile = "flex min-h-14 items-center gap-2 rounded-lg border border-border bg-bg p-3 font-semibold shadow-card hover:border-accent";

/** Accesos a los análisis que ya tienen datos. */
export function AnalysisNav({ id, tests }: { id: string; tests: TestSummary[] }) {
  const typesDone = new Set(tests.map((t) => t.type));
  const lastJump = tests.find((t) => isJumpType(t.type));
  const hasRom = tests.some((t) => t.movement !== null);
  if (!lastJump && !hasRom && !typesDone.has("vbt")) return null;
  return (
    <nav aria-label="Análisis" className="grid grid-cols-2 gap-2">
      {lastJump && (
        <Link to={`/pacientes/${id}/evolucion/${lastJump.type}`} className={tile}>
          <ChartLine aria-hidden="true" className="size-5 shrink-0 text-accent" /> Evolución de mediciones
        </Link>
      )}
      {(typesDone.has("sj") || typesDone.has("cmj")) && (
        <Link to={`/pacientes/${id}/perfil/fv`} className={tile}>
          <Gauge aria-hidden="true" className="size-5 shrink-0 text-accent" /> Perfil fuerza-velocidad
        </Link>
      )}
      {typesDone.has("single_leg") && (
        <Link to={`/pacientes/${id}/asimetria`} className={tile}>
          <Scale aria-hidden="true" className="size-5 shrink-0 text-accent" /> Asimetría
        </Link>
      )}
      {typesDone.has("vbt") && (
        <Link to={`/pacientes/${id}/perfil/carga-velocidad`} className={tile}>
          <Dumbbell aria-hidden="true" className="size-5 shrink-0 text-accent" /> Carga-velocidad y 1RM
        </Link>
      )}
      {hasRom && (
        <Link to={`/pacientes/${id}/movilidad`} className={tile}>
          <Rotate3d aria-hidden="true" className="size-5 shrink-0 text-accent" /> Movilidad
        </Link>
      )}
    </nav>
  );
}


/** Lista completa de tests del paciente, el más reciente primero. */
export function TestList({ tests }: { tests: TestSummary[] }) {
  return (
    <ul aria-label="Tests" className="flex flex-col gap-2">
      {tests.map((t) => {
        const v = mainValue(t);
        return (
          <li key={t.id}>
            <Link to={`/tests/${t.id}`} className="block">
              <Card className="flex items-center justify-between gap-3 hover:border-accent">
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {testTitle(t)}
                    {t.extraLoadKg > 0 && t.type !== "vbt" && <span className="font-normal text-text-muted"> · {fmt(t.extraLoadKg, 0)} kg</span>}
                  </span>
                  <span className="text-sm text-text-muted">{fmtDateTime(t.performedAt)}</span>
                </span>
                <span className="nums text-right">
                  {v === null ? (
                    t.movement !== null ? (
                      <span className="text-sm text-text-muted">—</span>
                    ) : (
                      <span className="text-sm text-warning">Sin marcar</span>
                    )
                  ) : (
                    <>
                      {v.prefix && <span className="text-sm text-text-muted">{v.prefix} </span>}
                      <span className="text-xl">{v.unit === "°" ? `${v.text}°` : v.text}</span>
                      {v.unit && v.unit !== "°" && <span className="text-text-muted"> {v.unit}</span>}
                      {t.rsi !== null && t.type !== "rj_10_5" && <span className="block text-sm text-text-muted">RSI {fmt(t.rsi, 2)}</span>}
                    </>
                  )}
                </span>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
