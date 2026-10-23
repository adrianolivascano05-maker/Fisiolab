// Mediciones en la ficha: accesos a los análisis, tarjetas visuales por medición (último valor, cambio y
// tendencia) y la lista completa de tests.
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChartLine, Dumbbell, Gauge, Rotate3d, Scale } from "lucide-react";
import { Link } from "react-router";
import { fmt, fmtDate, fmtDateTime, isJumpType, testTitle } from "../app/format";
import type { TestSummary } from "../data/repo";
import { Card } from "../ui/Card";
import { mainValue, trends } from "./measures";
import { Sparkline } from "./parts";

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

/** Una tarjeta por medición: el último valor, cuánto cambió desde la anterior y su tendencia. */
export function TrendTiles({ tests, limit }: { tests: TestSummary[]; limit?: number }) {
  const all = trends(tests);
  const shown = limit ? all.slice(0, limit) : all;
  if (!shown.length) return null;
  return (
    <ul aria-label="Últimas mediciones" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {shown.map((tr) => {
        const diff = tr.previous ? tr.value.value - tr.previous.value : null;
        const digits = tr.value.text.includes(",") ? tr.value.text.split(",")[1]!.length : 0;
        const Arrow = diff === null || Math.abs(diff) < 10 ** -digits / 2 ? ArrowRight : diff > 0 ? ArrowUpRight : ArrowDownRight;
        return (
          <li key={tr.title}>
            <Link to={`/tests/${tr.latest.id}`} className="block">
              {/* Si no cabe en una línea (tarjetas a dos columnas), la gráfica y el valor bajan debajo del nombre. */}
              <Card className="flex flex-wrap items-center gap-x-3 gap-y-1 hover:border-accent">
                <span className="flex min-w-36 flex-1 flex-col">
                  <span className="truncate font-semibold">{tr.title}</span>
                  <span className="text-sm text-text-muted">
                    {fmtDate(tr.latest.performedAt)}
                    {tr.count > 1 && ` · ${tr.count} veces`}
                  </span>
                </span>
                <Sparkline values={tr.series} />
                <span className="nums ml-auto flex shrink-0 flex-col items-end">
                  <span>
                    {tr.value.prefix && <span className="text-sm text-text-muted">{tr.value.prefix} </span>}
                    <span className="text-xl">{tr.value.unit === "°" ? `${tr.value.text}°` : tr.value.text}</span>
                    {tr.value.unit && tr.value.unit !== "°" && <span className="text-text-muted"> {tr.value.unit}</span>}
                  </span>
                  {diff !== null && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-text-muted">
                      <Arrow aria-hidden="true" className="size-3.5" />
                      {diff > 0 ? "+" : diff < 0 ? "−" : "±"}
                      {fmt(Math.abs(diff), digits)} desde la anterior
                    </span>
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
