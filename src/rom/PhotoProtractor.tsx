import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImagePlus, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { photoAngle, type PhotoSpec, type Pt } from "../calc/rom";
import { Button, IconButton } from "../ui/Button";

type Props = {
  spec: PhotoSpec;
  /** Ángulo clínico con los puntos actuales; null mientras falten puntos. */
  onAngle: (angle: number | null) => void;
};

/**
 * Transportador sobre una foto: se tocan los puntos en orden y se pueden arrastrar o mover con
 * las flechas. Las coordenadas van en píxeles de la imagen, así el ángulo no depende del zoom.
 * La foto no se guarda: solo el ángulo.
 */
export function PhotoProtractor({ spec, onAngle }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [pts, setPts] = useState<Pt[]>([]);
  const [selected, setSelected] = useState(0);
  const drag = useRef<number | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const need = spec.points.length;
  const done = pts.length === need;
  const angle = done ? photoAngle(spec, pts) : null;

  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  useEffect(() => onAngle(angle === null || Number.isNaN(angle) ? null : angle), [angle, onAngle]);

  function choose(file: File | undefined) {
    if (!file) return;
    setUrl(URL.createObjectURL(file));
    setSize(null);
    setPts([]);
    setSelected(0);
  }

  function toImage(e: PointerEvent): Pt | null {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect || !size) return null;
    const x = ((e.clientX - rect.left) / rect.width) * size.w;
    const y = ((e.clientY - rect.top) / rect.height) * size.h;
    return { x: Math.min(size.w, Math.max(0, x)), y: Math.min(size.h, Math.max(0, y)) };
  }

  function onBackground(e: PointerEvent<SVGSVGElement>) {
    if (done || drag.current !== null) return;
    const p = toImage(e);
    if (!p) return;
    setPts((prev) => [...prev, p]);
    setSelected(pts.length);
  }

  function move(i: number, dx: number, dy: number) {
    if (!size) return;
    setPts((prev) => prev.map((p, j) => (j === i ? { x: Math.min(size.w, Math.max(0, p.x + dx)), y: Math.min(size.h, Math.max(0, p.y + dy)) } : p)));
  }

  const step = size ? Math.max(1, size.w / 400) : 1;
  function onKey(i: number, e: KeyboardEvent) {
    const k = e.shiftKey ? 8 : 1;
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    setSelected(i);
    move(i, d[0]! * step * k, d[1]! * step * k);
  }

  const unit = size ? Math.max(size.w, size.h) / 100 : 1;
  const line = { stroke: "var(--color-accent)", strokeWidth: unit * 0.6, strokeLinecap: "round" as const };

  return (
    <div className="flex flex-col gap-3">
      <input ref={input} type="file" accept="image/*" className="sr-only" aria-label="Elegir foto" tabIndex={-1} onChange={(e) => choose(e.target.files?.[0])} />
      <Button variant={url ? "secondary" : "primary"} block icon={<ImagePlus aria-hidden="true" className="size-5" />} onClick={() => input.current?.click()}>
        {url ? "Cambiar de foto" : "Elegir o hacer una foto"}
      </Button>
      <p className="text-sm text-text-muted">{spec.note} La foto no se guarda: solo el ángulo.</p>

      {url && (
        <>
          <ol className="flex flex-col gap-1 text-sm" aria-label="Puntos que marcar">
            {spec.points.map((label, i) => (
              <li key={label} className={i === pts.length ? "font-semibold text-accent" : i < pts.length ? "" : "text-text-muted"}>
                {i + 1}. {label}
                {i === pts.length && " ← toca en la foto"}
              </li>
            ))}
          </ol>
          <div className="relative overflow-hidden rounded-md bg-media-bg">
            <img src={url} alt="Foto para medir el ángulo" className="block h-auto w-full select-none" draggable={false} onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
            {size && (
              <svg
                ref={svg}
                viewBox={`0 0 ${size.w} ${size.h}`}
                className="absolute inset-0 size-full touch-none"
                data-testid="protractor"
                onPointerDown={onBackground}
                onPointerMove={(e) => {
                  if (drag.current === null) return;
                  const p = toImage(e);
                  if (p) setPts((prev) => prev.map((q, j) => (j === drag.current ? p : q)));
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
              >
                {spec.kind === "vertical" && pts[0] && (
                  <line x1={pts[0].x} y1={pts[0].y} x2={pts[0].x} y2={Math.max(0, pts[0].y - unit * 30)} {...line} strokeDasharray={`${unit * 2} ${unit * 1.5}`} strokeWidth={unit * 0.4} />
                )}
                {pts.slice(1).map((p, i) => (
                  <line key={i} x1={pts[i]!.x} y1={pts[i]!.y} x2={p.x} y2={p.y} {...line} />
                ))}
                {pts.map((p, i) => (
                  <g
                    key={i}
                    role="button"
                    tabIndex={0}
                    aria-label={`Punto ${i + 1}, ${spec.points[i]}: arrástralo o muévelo con las flechas`}
                    className="cursor-grab outline-none focus-visible:[&>circle:nth-child(2)]:stroke-focus"
                    onKeyDown={(e) => onKey(i, e)}
                    onFocus={() => setSelected(i)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget.ownerSVGElement ?? svg.current)?.setPointerCapture(e.pointerId);
                      drag.current = i;
                      setSelected(i);
                    }}
                  >
                    <circle cx={p.x} cy={p.y} r={unit * 5} fill="transparent" />
                    <circle cx={p.x} cy={p.y} r={unit * 2.2} fill="var(--color-accent)" stroke={i === selected ? "var(--color-bg)" : "var(--color-accent-soft)"} strokeWidth={unit * (i === selected ? 0.9 : 0.5)} />
                    <text x={p.x} y={p.y} dy="0.35em" textAnchor="middle" fontSize={unit * 2.6} fontWeight="700" fill="var(--color-on-accent)" pointerEvents="none">
                      {i + 1}
                    </text>
                  </g>
                ))}
              </svg>
            )}
          </div>

          {done && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">
                Ajuste fino del punto {selected + 1}
              </span>
              <span className="flex gap-1">
                <IconButton label="Mover a la izquierda" onClick={() => move(selected, -step, 0)}><ArrowLeft aria-hidden="true" className="size-5" /></IconButton>
                <IconButton label="Mover arriba" onClick={() => move(selected, 0, -step)}><ArrowUp aria-hidden="true" className="size-5" /></IconButton>
                <IconButton label="Mover abajo" onClick={() => move(selected, 0, step)}><ArrowDown aria-hidden="true" className="size-5" /></IconButton>
                <IconButton label="Mover a la derecha" onClick={() => move(selected, step, 0)}><ArrowRight aria-hidden="true" className="size-5" /></IconButton>
              </span>
            </div>
          )}
          {pts.length > 0 && (
            <Button variant="ghost" icon={<RotateCcw aria-hidden="true" className="size-5" />} onClick={() => { setPts([]); setSelected(0); }}>
              Volver a marcar los puntos
            </Button>
          )}
        </>
      )}
    </div>
  );
}
