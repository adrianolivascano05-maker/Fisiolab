// Mapa del dolor, un cuestionario (src/clinical/bodyMap.ts). Se elige qué marcar (dolor, hormigueo o rigidez) y se
// toca la zona en el dibujo, de frente o de espaldas; debajo sale cada zona marcada para cambiarle el síntoma y la
// intensidad. Las zonas pequeñas también se añaden desde una lista. En la ficha y en el informe, el dibujo se lee.
import { X } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type SVGProps } from "react";
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

const center = (s: Shape) => (s.kind === "ellipse" ? { x: s.cx, y: s.cy } : { x: s.x + s.w / 2, y: s.y + s.h / 2 });
const VIEWS = [
  { id: "front", label: "De frente", left: "Dcha.", right: "Izda." },
  { id: "back", label: "De espaldas", left: "Izda.", right: "Dcha." },
] as const;
type View = (typeof VIEWS)[number]["id"];

/**
 * Los dibujos: los dos (para leer) o uno (`view`, para marcar, más grande). Con `onToggle`, cada zona es una casilla que
 * se marca tocándola (o con espacio o intro). La intensidad sale escrita en la zona.
 */
export function BodyFigures({ marks, onToggle, view, className }: { marks: Mark[]; onToggle?: (zone: string) => void; view?: View; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const byZone = new Map(marks.map((m) => [m.zone, m]));
  const views = VIEWS.filter((v) => !view || v.id === view);
  return (
    <div className={cx("grid gap-3 [print-color-adjust:exact]", views.length === 2 ? "grid-cols-2" : "grid-cols-1", className)}>
      {views.map((v) => (
        <figure key={v.id} className="flex min-w-0 flex-col items-center gap-1">
          <svg
            viewBox={`0 0 200 ${MAP_HEIGHT}`}
            role={onToggle ? "group" : "img"}
            aria-label={onToggle ? v.label : `${v.label}: ${marks.length ? marksText(formatMarks(marks)) : "nada marcado"}`}
            className={cx("h-auto w-full touch-manipulation select-none", views.length === 1 ? "max-w-[340px]" : "max-w-[240px]")}
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
            {/* El lado del paciente, junto a los hombros. */}
            <text x="2" y="66" className="fill-text-muted text-[12px] font-semibold" aria-hidden="true">
              {v.left}
            </text>
            <text x="198" y="66" textAnchor="end" className="fill-text-muted text-[12px] font-semibold" aria-hidden="true">
              {v.right}
            </text>
            {ZONES.filter((z) => z[v.id]).map((z) => {
              const s = z[v.id]!;
              const m = byZone.get(z.id);
              const pattern = m?.symptom === "hormigueo" ? "dots" : m?.symptom === "rigidez" ? "lines" : null;
              const c = center(s);
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
                <g key={z.id} {...interactive} className={cx("outline-none", onToggle && "group/zona cursor-pointer")}>
                  <title>{m ? `${z.label}: ${SYMPTOMS.find((x) => x.id === m.symptom)!.short}${m.intensity !== null ? ` ${m.intensity}/10` : ""}` : z.label}</title>
                  <ShapeEl
                    s={s}
                    strokeWidth={1.5}
                    className={cx(
                      "stroke-border-input transition-colors",
                      m ? FILL[m.symptom] : "fill-surface",
                      onToggle && !m && "group-hover/zona:fill-accent-soft",
                      // Grupo con nombre: la ficha plegable de la anamnesis también es un «group» y lo pintaba todo al pasar por encima.
                      onToggle && "group-focus-visible/zona:stroke-focus group-focus-visible/zona:[stroke-width:4]",
                    )}
                  />
                  {pattern && <ShapeEl s={s} fill={`url(#${uid}-${pattern})`} pointerEvents="none" />}
                  {m && m.intensity !== null && (
                    <text
                      x={c.x}
                      y={c.y + 4.5}
                      textAnchor="middle"
                      pointerEvents="none"
                      className="fill-white stroke-media-bg text-[13px] font-bold [paint-order:stroke] [stroke-width:3px]"
                    >
                      {m.intensity}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
          <figcaption className="text-sm text-text-muted">{v.label}</figcaption>
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

/** El dibujo para marcar (cuestionario «Mapa del dolor»). */
export function BodyMapInput({ label, hint, value, onChange }: { label: string; hint?: string; value: unknown; onChange: (v: string[]) => void }) {
  const marks = sortMarks(parseMarks(value));
  const [symptom, setSymptom] = useState<Symptom>("dolor");
  const name = useId();
  const save = (next: Mark[]) => onChange(formatMarks(sortMarks(next)));
  const toggle = (zone: string) => save(marks.some((m) => m.zone === zone) ? marks.filter((m) => m.zone !== zone) : [...marks, { zone, symptom, intensity: null }]);
  const update = (zone: string, patch: Partial<Mark>) => save(marks.map((m) => (m.zone === zone ? { ...m, ...patch } : m)));
  const free = ZONES.filter((z) => !marks.some((m) => m.zone === z.id));
  const [pick, setPick] = useState("");
  const [view, setView] = useState<View>("front");
  /** Al quitar una zona de la lista, el foco va a la lista de zonas (el botón que tenía desaparece). */
  const pickRef = useRef<HTMLSelectElement>(null);

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
      <div role="group" aria-label="Vista" className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            className={cx("min-h-11 rounded-md text-sm font-semibold", view === v.id ? "bg-bg text-accent shadow-card" : "text-text-muted hover:text-text")}
            onClick={() => setView(v.id)}
          >
            {v.label}
            {marks.some((m) => ZONES.find((z) => z.id === m.zone)?.[v.id]) ? ` · ${marks.filter((m) => ZONES.find((z) => z.id === m.zone)?.[v.id]).length}` : ""}
          </button>
        ))}
      </div>
      <BodyFigures marks={marks} onToggle={toggle} view={view} />
      <p className="text-xs text-text-muted">Dcha. e Izda.: lado derecho e izquierdo del paciente. Toca otra vez una zona para quitarla. Hormigueo incluye el adormecimiento.</p>

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
                    onClick={() => {
                      toggle(m.zone);
                      pickRef.current?.focus();
                    }}
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
      {/* Elegir y luego «Añadir»: con el teclado, moverse por la lista no marca nada. */}
      <div className="flex gap-2">
        <select ref={pickRef} aria-label="Zona de la lista" className={cx(control, "min-w-0 flex-1")} value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Otra zona de la lista…</option>
          {free.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!pick}
          className="h-11 shrink-0 rounded-md border border-border-input bg-bg px-4 text-sm font-semibold hover:bg-surface disabled:opacity-50"
          onClick={() => {
            if (!pick) return;
            save([...marks, { zone: pick, symptom, intensity: null }]);
            setPick("");
          }}
        >
          Añadir
        </button>
      </div>
    </fieldset>
  );
}
