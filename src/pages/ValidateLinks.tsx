import { ClipboardCheck, EyeOff } from "lucide-react";
import { Link } from "react-router";
import type { Test } from "../data/repo";
import type { ValidationKind } from "../data/validation";

const link = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold text-accent hover:bg-accent-soft";

/** Qué medida de validación corresponde a un test (y con qué métrica principal). */
function kindOf(test: Test): { kind: ValidationKind; metric: string } | null {
  if (["cmj", "cmj_arms", "sj", "dj", "single_leg"].includes(test.type)) return { kind: "jump_height", metric: "jump_height_cm" };
  if (test.type === "vbt") return { kind: "bar_velocity", metric: "bar_velocity_m_s" };
  if (test.type === "nordic") return { kind: "nordic_torque", metric: "torque_nm" };
  if (test.type === "sprint_linear" || test.type.startsWith("cod_")) return { kind: "sprint_time", metric: "time_s" };
  if (test.type.startsWith("rom_")) return { kind: "rom_angle", metric: "angle_deg" };
  return null;
}

/** Enlaces a la validación desde un resultado: comparar con otra herramienta y volver a marcar a ciegas. */
export function ValidateLinks({ test }: { test: Test }) {
  const k = kindOf(test);
  if (!k || !test.results.some((r) => r.metric === k.metric && r.seriesIndex === 0)) return null;
  const blind = !!test.video && (k.kind === "jump_height" || k.kind === "bar_velocity");
  return (
    <div className="flex flex-col gap-1">
      {blind && (
        <Link to={`/tests/${test.id}/marcar?ciego=1`} className={link}>
          <EyeOff aria-hidden="true" className="size-5" /> Marcar otra vez a ciegas (fiabilidad)
        </Link>
      )}
      <Link to={`/validacion?${new URLSearchParams({ tipo: k.kind, test: test.id })}`} className={link}>
        <ClipboardCheck aria-hidden="true" className="size-5" /> Comparar con otra herramienta
      </Link>
    </div>
  );
}
