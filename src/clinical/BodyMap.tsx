// Mapa del dolor de la anamnesis (src/clinical/bodyMap.ts). Se elige qué marcar (dolor, hormigueo o rigidez) y se
// toca la zona en el dibujo, de frente o de espaldas; debajo sale cada zona marcada para cambiarle el síntoma y la
// intensidad. Las zonas pequeñas también se añaden desde una lista. En la ficha y en el informe, el dibujo se lee.
import { X } from "lucide-react";
import { useId, useState, type KeyboardEvent, type SVGProps } from "react";
import { cx } from "../ui/cx";
import { formatMarks, MAP_HEIGHT, marksText, parseMarks, sortMarks, SYMPTOMS, zoneLabel, ZONES, type Mark, type Shape, type Symptom } from "./bodyMap";

const FILL: Record<Symptom, string> = { dolor: "fill-danger", hormigueo: "fill-tingle", rigidez: "fill-warning" };
const SWATCH: Record<Symptom, string> = { dolor: "bg-danger", hormigueo: "bg-tingle", rigidez: "bg-warning" };
const control = "h-11 rounded-md border border-border-input bg-bg px-2 text-sm";

function ShapeEl({ s, ...rest }: { s: Shape } & SVGProps<SVGElement>) {
  return s.kind === "ellipse" ? (
    <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...(rest as SVGProps<SVGEllipseElement>)} />
  ) : (
    <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 6} {...(rest as SVGProps<SVGRectElement>)} />
  );
}

/** Los dos dibujos. Con `onToggle`, cada zona es una casilla que se marca tocándola (o con espacio o intro). */
export function BodyFigures({ marks, onToggle, className }: { marks: Mark[]; onToggle?: (zone: string) => void; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const byZone = new Map(marks.map((m) => [m.zone, m]));
  const views = [
    { id: "front", label: "De frente", left: "D", right: "I" },
    { id: "back", label: "De espaldas", left: "I", right: "D" },
  ] as const;
  return (
    <div className={cx("grid grid-cols-2 gap-3 [print-color-adjust:exact]", className)}>
      {views.map((view) => (
        <figure key={view.id} className="flex flex-col items-center gap-1">
          <svg
            viewBox={`0 0 200 ${MAP_HEIGHT}`}
            role={onToggle ? "group" : "img"}
            aria-label={onToggle ? view.label : `${view.label}: ${marks.length ? marksText(formatMarks(marks)) : "nada marcado"}`}
            className="h-auto w-full max-w-[240px] touch-manipulation select-none"
          >
            <defs>
              {/* Además del color, una trama: el hormigueo con puntos y la rigidez con rayas (no solo color). */}
              <pattern id={`${uid}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
                <circle cx="3" cy="3" r="1.3" className="fill-white" />
              </pattern>
              <pattern id={`${uid}-lines`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="2" height="6" className="fill-white" />
              </pattern>
            </defs>
            <text x="8" y="18" className="fill-text-muted text-[14px] font-semibold" aria-hidden="true">
              {view.left}
            </text>
            <text x="192" y="18" textAnchor="end" className="fill-text-muted text-[14px] font-semibold" aria-hidden="true">
              {view.right}
            </text>
            {ZONES.filter((z) => z[view.id]).map((z) => {
              const s = z[view.id]!;
              const m = byZone.get(z.id);
              const pattern = m?.symptom === "hormigueo" ? "dots" : m?.symptom === "rigidez" ? "lines" : null;
              const interactive = onToggle
                ? {
                    role: "checkbox",
                    "aria-checked": !!m,
                    "aria-label": z.label,
                    tabIndex: 0,
                    onClick: () => onToggle(z.id),
                    onKeyDown: (e: KeyboardEvent) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        onToggle(z.id);
                      }
                    },
                  }
                : { "aria-hidden": true };
              return (
                <g key={z.id} {...interactive} className={cx("outline-none", onToggle && "group cursor-pointer")}>
                  <title>{m ? `${z.label}: ${SYMPTOMS.find((x) => x.id === m.symptom)!.short}` : z.label}</title>
                  <ShapeEl
                    s={s}
                    strokeWidth={1.5}
                    className={cx(
                      "stroke-border-input transition-colors",
                      m ? FILL[m.symptom] : "fill-surface",
                      onToggle && !m && "group-hover:fill-accent-soft",
                      onToggle && "group-focus-visible:stroke-focus group-focus-visible:[stroke-width:4]",
                    )}
                  />
                  {pattern && <ShapeEl s={s} fill={`url(#${uid}-${pattern})`} pointerEvents="none" />}
                </g>
              );
            })}
          </svg>
          <figcaption className="text-sm text-text-muted">{view.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

/** La leyenda de colores y tramas. */
export function BodyMapLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted" aria-label="Leyenda">
      {SYMPTOMS.map((s) => (
        <li key={s.id} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cx("inline-block size-3 rounded-full", SWATCH[s.id])} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** El campo de la anamnesis. */
export function BodyMapInput({ label, hint, value, onChange }: { label: string; hint?: string; value: unknown; onChange: (v: string[]) => void }) {
  const marks = sortMarks(parseMarks(value));
  const [symptom, setSymptom] = useState<Symptom>("dolor");
  const name = useId();
  const save = (next: Mark[]) => onChange(formatMarks(sortMarks(next)));
  const toggle = (zone: string) => save(marks.some((m) => m.zone === zone) ? marks.filter((m) => m.zone !== zone) : [...marks, { zone, symptom, intensity: null }]);
  const update = (zone: string, patch: Partial<Mark>) => save(marks.map((m) => (m.zone === zone ? { ...m, ...patch } : m)));
  const free = ZONES.filter((z) => !marks.some((m) => m.zone === z.id));

  return (
    // min-w-0: un fieldset no se estrecha por debajo de su contenido y las listas desplegables lo ensanchaban.
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="pb-1 text-sm font-semibold">{label}</legend>
      {hint && <p className="text-sm text-text-muted">{hint}</p>}
      <div role="radiogroup" aria-label="Al tocar una zona, marcar" className="flex flex-wrap items-center gap-2">
        <span className="text-sm">Al tocar, marcar:</span>
        {SYMPTOMS.map((s) => (
          <label key={s.id} className="relative">
            <input type="radio" name={name} checked={symptom === s.id} onChange={() => setSymptom(s.id)} className="peer sr-only" />
            <span
              className={cx(
                "inline-flex min-h-11 items-center gap-2 rounded-pill border px-3 text-sm",
                "border-border-input bg-bg peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:font-semibold",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
              )}
            >
              <span aria-hidden="true" className={cx("inline-block size-3 rounded-full", SWATCH[s.id])} />
              {s.label}
            </span>
          </label>
        ))}
      </div>
      <BodyFigures marks={marks} onToggle={toggle} />
      <p className="text-xs text-text-muted">D y I: lado derecho e izquierdo del paciente. Toca otra vez una zona para quitarla.</p>

      {marks.length > 0 && (
        <ul aria-label="Zonas marcadas" className="flex flex-col gap-2">
          {marks.map((m) => {
            const zone = zoneLabel(m.zone);
            return (
              <li key={m.zone} className="flex flex-col gap-1 rounded-md border border-border bg-bg py-1 pr-1 pl-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className={cx("inline-block size-3 shrink-0 rounded-full", SWATCH[m.symptom])} />
                  <span className="min-w-0 flex-1 font-semibold">{zone}</span>
                  <button
                    type="button"
                    aria-label={`Quitar ${zone}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-text"
                    onClick={() => toggle(m.zone)}
                  >
                    <X aria-hidden="true" className="size-5" />
                  </button>
                </div>
                <div className="flex gap-2 pr-2 pb-2">
                  <select aria-label={`Qué tiene en: ${zone}`} className={cx(control, "min-w-0 flex-1")} value={m.symptom} onChange={(e) => update(m.zone, { symptom: e.target.value as Symptom })}>
                    {SYMPTOMS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.short[0]!.toUpperCase() + s.short.slice(1)}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Intensidad en: ${zone}`}
                    className={cx(control, "w-32 shrink-0")}
                    value={m.intensity === null ? "" : String(m.intensity)}
                    onChange={(e) => update(m.zone, { intensity: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">Intensidad</option>
                    {Array.from({ length: 11 }, (_, n) => (
                      <option key={n} value={n}>
                        {n}/10
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <select
        aria-label="Añadir una zona de la lista"
        className={control}
        value=""
        onChange={(e) => {
          if (e.target.value) save([...marks, { zone: e.target.value, symptom, intensity: null }]);
        }}
      >
        <option value="">Añadir una zona de la lista…</option>
        {free.map((z) => (
          <option key={z.id} value={z.id}>
            {z.label}
          </option>
        ))}
      </select>
    </fieldset>
  );
}
