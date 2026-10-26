// Piezas de la ficha clínica: pestañas del paciente, escala de dolor, chips de opciones, resultado de un test
// y gráficas pequeñas en SVG (sin librería: la ficha se abre al instante).
import { CircleHelp, ClipboardList, LayoutDashboard, Minus, NotebookPen, Plus, Stethoscope } from "lucide-react";
import { useId, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router";
import { fmtDateShort } from "../app/format";
import type { FindingResult } from "../data/clinical";
import { cx } from "../ui/cx";

/** Pestañas dentro de la ficha de un paciente: las cuatro, con su nombre entero en el móvil. */
export function PatientNav({ id }: { id: string }) {
  // Si se llegó desde otra pantalla (la lista de espera), las pestañas lo conservan para volver a ella.
  const { state } = useLocation();
  const tabs = [
    { to: `/pacientes/${id}`, label: "Resumen", icon: LayoutDashboard, end: true },
    { to: `/pacientes/${id}/anamnesis`, label: "Anamnesis", icon: ClipboardList },
    { to: `/pacientes/${id}/valoracion`, label: "Valoración", icon: Stethoscope },
    { to: `/pacientes/${id}/sesiones`, label: "Sesiones", icon: NotebookPen },
  ];
  return (
    // Fijas arriba al bajar: cambiar de pestaña está siempre a un toque.
    <nav aria-label="Ficha del paciente" className="sticky top-[var(--layout-header)] z-10 -mx-4 bg-canvas/95 px-4 py-1.5 backdrop-blur">
      <ul className="grid grid-cols-4 gap-1 rounded-lg bg-surface p-1">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="min-w-0">
            <NavLink
              to={to}
              end={end}
              state={state}
              className={({ isActive }) =>
                cx(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 text-xs leading-tight font-semibold @2xl:min-h-11 @2xl:flex-row @2xl:gap-2 @2xl:text-sm",
                  isActive ? "bg-bg text-accent shadow-card" : "text-text-muted hover:text-text",
                )
              }
            >
              <Icon aria-hidden="true" className="size-5 shrink-0" />
              <span className="max-w-full">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Escala de números enteros en botones (0-10, −7…+7). Se puede dejar sin dato. En el móvil, en dos o tres filas. */
export function NumberScale({
  label,
  from,
  to,
  value,
  onChange,
  ends,
  hint,
}: {
  label: string;
  from: number;
  to: number;
  value: number | null;
  onChange: (v: number | null) => void;
  /** Qué significan los extremos. */
  ends: [string, string];
  hint?: string;
}) {
  const name = useId();
  const values = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const signed = from < 0;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className={cx("grid gap-1.5", values.length > 11 ? "grid-cols-5 sm:grid-cols-15" : "grid-cols-6 sm:grid-cols-11")}>
        {values.map((n) => (
          <label key={n} className="relative">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <span
              className={cx(
                "tap nums flex items-center justify-center rounded-md border text-base font-semibold",
                "border-border-input bg-bg text-text peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
              )}
            >
              {signed && n > 0 ? `+${n}` : n < 0 ? `−${-n}` : n}
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
        <span>{ends[0]}</span>
        {value !== null ? (
          <button type="button" onClick={() => onChange(null)} className="tap rounded-md px-2 text-sm text-accent hover:bg-surface">
            Quitar
          </button>
        ) : (
          hint && <span>{hint}</span>
        )}
        <span className="text-right">{ends[1]}</span>
      </div>
    </fieldset>
  );
}

/** Dolor de 0 a 10 (escala numérica). */
export function PainScale(props: { label: string; value: number | null; onChange: (v: number | null) => void; hint?: string }) {
  return <NumberScale from={0} to={10} ends={["0 sin dolor", "10 el peor imaginable"]} {...props} />;
}

/** Opciones en chips: una sola (radio) o varias (checkbox). Pulsar la elegida otra vez la quita. */
export function Chips({
  label,
  options,
  value,
  onChange,
  multiple,
  render = (o) => o,
  hint,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  multiple?: boolean;
  render?: (o: string) => string;
  hint?: string;
}) {
  const name = useId();
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : multiple ? [...value, o] : [o]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold">{label}</legend>
      {hint && <p className="-mt-1 text-sm text-text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <label key={o} className="relative">
              <input
                type={multiple ? "checkbox" : "radio"}
                name={name}
                checked={on}
                onChange={() => toggle(o)}
                onClick={(e) => {
                  // Un radio marcado no se desmarca solo: se quita a mano.
                  if (!multiple && on) {
                    e.preventDefault();
                    onChange([]);
                  }
                }}
                className="peer sr-only"
              />
              <span
                className={cx(
                  "inline-flex min-h-11 items-center rounded-pill border px-3 text-sm",
                  "border-border-input bg-bg text-text peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:font-semibold peer-checked:text-accent",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                )}
              >
                {render(o)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function TextArea({ label, hint, value, onChange, rows = 3 }: { label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full rounded-md border border-border-input bg-bg px-3 py-2 text-base"
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export const resultLabels: Record<FindingResult, string> = { positive: "Positivo", negative: "Negativo", inconclusive: "Dudoso" };
const resultStyle: Record<FindingResult, { box: string; icon: typeof Plus }> = {
  positive: { box: "bg-danger-soft text-danger", icon: Plus },
  negative: { box: "bg-surface text-text", icon: Minus },
  inconclusive: { box: "bg-warning-soft text-warning", icon: CircleHelp },
};

/** Resultado de un test: color y signo, nunca solo color. */
export function ResultBadge({ result, children }: { result: FindingResult; children?: ReactNode }) {
  const { box, icon: Icon } = resultStyle[result];
  return (
    <span className={cx("inline-flex min-h-7 items-center gap-1 rounded-pill px-2.5 text-sm font-semibold", box)}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {children ?? resultLabels[result]}
    </span>
  );
}

export const sideShort = { left: "izq.", right: "dcha.", both: "ambos" } as const;

/** Evolución del dolor (0-10) en el tiempo: línea con puntos, rejilla en 0, 5 y 10 y el último valor rotulado. */
export function PainChart({ points, label }: { points: { at: string; pain: number }[]; label: string }) {
  if (points.length === 0) return null;
  const W = 320;
  const H = 120;
  const pad = { l: 22, r: 28, t: 10, b: 20 };
  const t0 = Date.parse(points[0]!.at);
  const t1 = Date.parse(points.at(-1)!.at);
  const x = (at: string) => (t1 === t0 ? (pad.l + W - pad.r) / 2 : pad.l + ((Date.parse(at) - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / 10) * (H - pad.t - pad.b);
  const last = points.at(-1)!;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)},${y(p.pain).toFixed(1)}`).join(" ");
  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-auto w-full">
        {[0, 5, 10].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth="1" />
            <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">
              {v}
            </text>
          </g>
        ))}
        <path d={d} fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(p.at)} cy={y(p.pain)} r="4" fill="var(--color-danger)" stroke="var(--color-bg)" strokeWidth="2" />
        ))}
        <text x={x(last.at) + 8} y={y(last.pain) + 4} fontSize="12" fontWeight="700" fill="var(--color-text)">
          {last.pain}
        </text>
        <text x={pad.l} y={H - 4} fontSize="10" fill="var(--color-text-muted)">
          {fmtDateShort(points[0]!.at)}
        </text>
        {points.length > 1 && (
          <text x={W - pad.r} y={H - 4} textAnchor="end" fontSize="10" fill="var(--color-text-muted)">
            {fmtDateShort(last.at)}
          </text>
        )}
      </svg>
    </figure>
  );
}

/** Línea mínima de una serie (la más antigua a la izquierda) con el último punto marcado. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 72;
  const H = 24;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i: number) => 3 + (i / (values.length - 1)) * (W - 6);
  const y = (v: number) => (hi === lo ? H / 2 : 3 + (1 - (v - lo) / (hi - lo)) * (H - 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="h-6 w-18 shrink-0">
      <path d={values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values.at(-1)!)} r="3" fill="var(--color-accent)" />
    </svg>
  );
}
