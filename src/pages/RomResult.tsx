import { ChartLine, RotateCcw } from "lucide-react";
import { Link } from "react-router";
import { getMovement, MAX_SPREAD_DEG, methodLabels, movementLabel, summarize, type RomMethod } from "../calc/rom";
import { fmt, fmtDateTime } from "../app/format";
import { LoadError } from "../app/Page";
import type { Patient, Test } from "../data/repo";
import { Alert } from "../ui/Alert";
import { MetricCard } from "../ui/Card";

const linkPrimary = "inline-flex h-14 items-center justify-center gap-2 rounded-md bg-accent px-6 text-lg text-on-accent hover:bg-accent-hover";
const linkGhost = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold text-accent hover:bg-accent-soft";

/** Resultado de una medición de movilidad (dentro de S08). */
export function RomResult({ test, patient }: { test: Test; patient: Patient }) {
  const movement = getMovement(String(test.details.movement ?? ""));
  if (!movement) return <LoadError error={new Error("Movimiento desconocido.")} />;
  const angle = test.results.find((r) => r.metric === "angle_deg" && r.seriesIndex === 0);
  const wall = test.results.find((r) => r.metric === "wall_distance_cm");
  const readings = test.results.filter((r) => r.metric === "angle_deg" && r.seriesIndex > 0).map((r) => r.value);
  const spread = readings.length ? summarize(readings).spread : 0;
  const method = methodLabels[test.details.method as RomMethod] ?? "";
  const other = test.side === "left" ? "right" : "left";
  const again = new URLSearchParams({ mov: movement.id });
  if (test.side) again.set("lado", other);

  return (
    <>
      <p className="text-sm text-text-muted">
        {fmtDateTime(test.performedAt)} · {method}
      </p>
      {angle && (
        <MetricCard
          size="lg"
          label={movement.sensor === "vertical" ? "Ángulo de la tibia" : "Rango de movimiento"}
          value={fmt(angle.value, 0)}
          unit="°"
          detail={readings.length > 1 ? `Media de ${readings.length} lecturas: ${readings.map((r) => `${fmt(r, 0)}°`).join(", ")}` : undefined}
          warning={angle.value > movement.maxDeg ? "Valor poco habitual: revisa cómo se midió." : undefined}
        />
      )}
      {wall && <MetricCard label="Distancia del dedo gordo a la pared" value={fmt(wall.value)} unit="cm" />}
      {spread > MAX_SPREAD_DEG && (
        <Alert tone="warning" title={`Las lecturas difieren ${fmt(spread, 0)}°`}>
          La media es menos fiable. Si dudas, repite la medición.
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        <Link to={`/pacientes/${patient.id}/test/movilidad/medir?${again}`} className={linkPrimary}>
          <RotateCcw aria-hidden="true" className="size-5" />
          {test.side ? `Ahora el lado ${other === "left" ? "izquierdo" : "derecho"}` : "Medir otra vez"}
        </Link>
        <Link to={`/pacientes/${patient.id}/movilidad/${movement.id}`} className={linkGhost}>
          <ChartLine aria-hidden="true" className="size-5" /> Evolución de {movementLabel(movement).toLowerCase()}
        </Link>
      </div>
    </>
  );
}
