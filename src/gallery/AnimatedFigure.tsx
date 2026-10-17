// Ilustración animada de un test: la maniobra en bucle, con pausa, avance manual y el texto de cada fase.
import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../ui/cx";
import { phases, renderFrame, renderFigure, type FigureSpec } from "./figure";

/** Duración de una vuelta completa, en milisegundos. */
const LOOP_MS = 7000;

const reducedMotion = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const figVars = {
  "--fig-force": "var(--color-accent)",
  "--fig-pain": "var(--color-danger)",
  "--fig-text": "var(--color-text)",
  "--fig-bg": "var(--color-bg)",
} as React.CSSProperties;

export function AnimatedFigure({ spec, title, uid, texts }: { spec: FigureSpec; title: string; uid: string; texts: Record<(typeof phases)[number]["id"], string> }) {
  const box = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [t, setT] = useState(0.6);
  const tRef = useRef(0.6);
  const [visible, setVisible] = useState(true);
  const still = useMemo(() => renderFigure(spec, title, uid), [spec, title, uid]);

  // Solo se anima mientras se ve en pantalla.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (!playing || !visible) {
      el.innerHTML = renderFrame(spec, title, uid, tRef.current, false);
      return;
    }
    let raf = 0;
    let last = 0;
    const start = performance.now() - tRef.current * LOOP_MS;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 33) return; // ~30 imágenes por segundo bastan
      last = now;
      const tt = ((now - start) % LOOP_MS) / LOOP_MS;
      tRef.current = tt;
      el.innerHTML = renderFrame(spec, title, uid, tt, false);
      setT((prev) => (phaseOf(prev) !== phaseOf(tt) || Math.abs(prev - tt) > 0.02 ? tt : prev));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, spec, title, uid]);

  const ph = phases[phaseOf(t)]!;
  return (
    <figure className="flex flex-col gap-2">
      <div
        ref={box}
        className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-bg [&>svg]:h-full [&>svg]:w-full"
        style={figVars}
        dangerouslySetInnerHTML={{ __html: still }}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pausar la animación" : "Reproducir la animación"}
          className="tap inline-flex shrink-0 items-center justify-center rounded-md border border-border-input hover:bg-surface"
        >
          {playing ? <Pause aria-hidden="true" className="size-5" /> : <Play aria-hidden="true" className="size-5" />}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(t * 1000)}
          aria-label="Momento de la maniobra"
          aria-valuetext={ph.label}
          onChange={(e) => {
            const v = Number(e.target.value) / 1000;
            setPlaying(false);
            tRef.current = v;
            setT(v);
            if (box.current) box.current.innerHTML = renderFrame(spec, title, uid, v, false);
          }}
          className="flex-1 accent-[var(--color-accent)]"
        />
      </div>
      <ol className="flex gap-1" aria-label="Fases">
        {phases.slice(0, 3).map((p, i) => (
          <li key={p.id} className="flex-1">
            <button
              type="button"
              aria-current={ph.id === p.id ? "step" : undefined}
              onClick={() => {
                const v = (p.from + p.to) / 2 + (p.id === "move" ? 0.1 : 0);
                setPlaying(false);
                tRef.current = v;
                setT(v);
                if (box.current) box.current.innerHTML = renderFrame(spec, title, uid, v, false);
              }}
              className={cx(
                "w-full rounded-md px-2 py-1 text-xs font-semibold",
                ph.id === p.id ? "bg-accent text-on-accent" : "bg-surface text-text-muted hover:text-text",
              )}
            >
              {i + 1}. {p.label}
            </button>
          </li>
        ))}
      </ol>
      <figcaption className="min-h-[4.5rem] text-sm" aria-live="off">
        {ph.id === "back" ? texts.setup : texts[ph.id]}
      </figcaption>
    </figure>
  );
}

function phaseOf(t: number) {
  const i = phases.findIndex((p) => t >= p.from && t < p.to);
  return i < 0 ? phases.length - 1 : i;
}
