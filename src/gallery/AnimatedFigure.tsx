// Ilustración animada de un test: la maniobra en bucle, con pausa, avance manual y el texto de cada fase.
// En 3D (maniquíes que se pueden girar) si el navegador tiene WebGL; si no, el dibujo plano.
// Respeta «reducir movimiento».
import { Pause, Play, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../ui/cx";
import { phases, renderFrame, renderFigure, type FigureSpec } from "./figure";
import type { Stage } from "./three/stage";

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

type Mode = "loading" | "3d" | "2d";

export function AnimatedFigure({ spec, title, uid, texts }: { spec: FigureSpec; title: string; uid: string; texts: Record<(typeof phases)[number]["id"], string> }) {
  const frame = useRef<HTMLDivElement>(null);
  const svgBox = useRef<HTMLDivElement>(null);
  const glBox = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  const [rotated, setRotated] = useState(false);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [t, setT] = useState(0.6);
  const tRef = useRef(0.6);
  const [visible, setVisible] = useState(true);
  const still = useMemo(() => renderFigure(spec, title, uid), [spec, title, uid]);

  const draw = useCallback(
    (tt: number) => {
      if (stage.current) stage.current.render(tt);
      else if (svgBox.current) svgBox.current.innerHTML = renderFrame(spec, title, uid, tt, false);
    },
    [spec, title, uid],
  );

  // Motor 3D: se descarga solo al abrir un test (y queda guardado para usarlo sin conexión).
  useEffect(() => {
    let alive = true;
    let st: Stage | null = null;
    setMode("loading");
    setRotated(false);
    import("./three/stage")
      .then((m) => {
        const host = glBox.current;
        if (!alive || !host) return;
        if (!m.webglAvailable()) return setMode("2d");
        try {
          st = m.createStage(host, spec, title, {
            onRotate: () => setRotated(true),
            onLost: () => {
              st?.dispose();
              stage.current = null;
              setMode("2d");
            },
          });
          stage.current = st;
          st.render(tRef.current);
          setMode("3d");
        } catch {
          setMode("2d");
        }
      })
      .catch(() => alive && setMode("2d"));
    return () => {
      alive = false;
      st?.dispose();
      stage.current = null;
    };
  }, [spec, title]);

  // Solo se anima mientras se ve en pantalla.
  useEffect(() => {
    const el = frame.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setVisible(!!e?.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (mode === "loading") return;
    if (!playing || !visible) {
      draw(tRef.current);
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
      draw(tt);
      setT((prev) => (phaseOf(prev) !== phaseOf(tt) || Math.abs(prev - tt) > 0.02 ? tt : prev));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, mode, draw]);

  const ph = phases[phaseOf(t)]!;
  const jump = (v: number) => {
    setPlaying(false);
    tRef.current = v;
    setT(v);
    draw(v);
  };
  const turn = (deg: number) => {
    stage.current?.rotateBy(deg);
    setRotated(true);
  };
  const ctl = "inline-flex size-11 items-center justify-center rounded-full bg-bg/90 text-text shadow-sm ring-1 ring-border backdrop-blur hover:bg-surface";
  return (
    <figure className="flex flex-col overflow-hidden rounded-2xl border border-border bg-bg">
      <div ref={frame} className="relative aspect-[4/3] w-full" style={figVars}>
        {mode === "2d" ? (
          <div ref={svgBox} className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: still }} />
        ) : (
          <div ref={glBox} className="relative h-full w-full">
            {mode === "loading" && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-text-muted" role="status">
                Preparando la figura en 3D…
              </p>
            )}
          </div>
        )}
        {mode === "3d" && (
          <div className="absolute left-2 top-2 flex gap-1.5">
            <button type="button" onClick={() => turn(-30)} aria-label="Girar la vista a la izquierda" className={ctl}>
              <RotateCcw aria-hidden="true" className="size-5" />
            </button>
            <button type="button" onClick={() => turn(30)} aria-label="Girar la vista a la derecha" className={ctl}>
              <RotateCw aria-hidden="true" className="size-5" />
            </button>
            {rotated && (
              <button
                type="button"
                onClick={() => {
                  stage.current?.resetView();
                  setRotated(false);
                }}
                aria-label="Volver a la vista inicial"
                className={ctl}
              >
                <Undo2 aria-hidden="true" className="size-5" />
              </button>
            )}
          </div>
        )}
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pausar la animación" : "Reproducir la animación"} className={cx(ctl, "absolute bottom-2 right-2")}>
          {playing ? <Pause aria-hidden="true" className="size-5" /> : <Play aria-hidden="true" className="size-5" />}
        </button>
      </div>
      {mode === "3d" && <p className="px-4 pt-1.5 text-xs text-text-muted">Arrastra a los lados para girar la figura.</p>}
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(t * 1000)}
        aria-label="Momento de la maniobra"
        aria-valuetext={ph.label}
        onChange={(e) => jump(Number(e.target.value) / 1000)}
        className="mx-3 mt-2 h-6 accent-[var(--color-accent)]"
      />
      <ol className="mx-3 flex gap-1 rounded-lg bg-surface p-1" aria-label="Fases">
        {phases.slice(0, 3).map((p, i) => (
          <li key={p.id} className="flex-1">
            <button
              type="button"
              aria-current={ph.id === p.id ? "step" : undefined}
              onClick={() => jump((p.from + p.to) / 2 + (p.id === "move" ? 0.1 : 0))}
              className={cx("h-9 w-full rounded-md text-xs font-semibold transition-colors", ph.id === p.id ? "bg-bg text-text shadow-sm" : "text-text-muted hover:text-text")}
            >
              {i + 1}. {p.label}
            </button>
          </li>
        ))}
      </ol>
      <figcaption className="min-h-[4.5rem] px-4 pb-3 pt-2 text-sm leading-relaxed" aria-live="off">
        {ph.id === "back" ? texts.setup : texts[ph.id]}
      </figcaption>
    </figure>
  );
}

function phaseOf(t: number) {
  const i = phases.findIndex((p) => t >= p.from && t < p.to);
  return i < 0 ? phases.length - 1 : i;
}
