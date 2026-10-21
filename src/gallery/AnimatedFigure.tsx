// Ilustración animada de un test: la maniobra en bucle, con pausa, avance manual y el texto de cada fase (y
// de cada paso, con sus grados, si la figura tiene guion). En 3D (maniquíes que se pueden girar un poco) si el
// navegador tiene WebGL; si no, el dibujo plano. Modo clínico (flechas, etiquetas, dolor) o natural (el gesto
// limpio), y el mismo test en el otro lado (espejo). Respeta «reducir movimiento».
import { Pause, Play, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../ui/cx";
import { mirrorText, stepTechnical } from "./describe";
import { phases, renderFrame, renderFigure, type FigureSpec } from "./figure";
import { restValue } from "./posture";
import { clockOf, scriptKeys, type PhaseId } from "./script";
import type { Stage, StageMode } from "./three/stage";

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

export function AnimatedFigure({ spec, title, uid, texts }: { spec: FigureSpec; title: string; uid: string; texts: Record<PhaseId, string> }) {
  const frame = useRef<HTMLDivElement>(null);
  const svgBox = useRef<HTMLDivElement>(null);
  const glBox = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [mode, setMode] = useState<Mode>("loading");
  // Si el móvil cierra el contexto 3D (falta de memoria), se vuelve a montar la figura; solo tras dos intentos, el
  // dibujo plano.
  const [attempt, setAttempt] = useState(0);
  // «Ver en 3D» desde el dibujo plano: se vuelve a intentar; sin WebGL no se ofrece.
  const [retry, setRetry] = useState(0);
  const [noWebgl, setNoWebgl] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [view, setView] = useState<StageMode>("clinical");
  const [mirror, setMirror] = useState(false);
  const [t, setT] = useState(0.6);
  const tRef = useRef(0.6);
  const [visible, setVisible] = useState(true);
  const still = useMemo(() => renderFigure(spec, title, uid), [spec, title, uid]);
  // Reloj del guion (o el de siempre) y poses clave con la postura natural (para los textos con grados).
  const keys = useMemo(() => (spec.script ? scriptKeys(spec.script, (k, d) => restValue(spec, k, d)) : null), [spec]);
  const clock = useMemo(() => clockOf(spec, keys ?? undefined), [spec, keys]);

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
        if (!m.webglAvailable()) {
          setNoWebgl(true);
          return setMode("2d");
        }
        try {
          st = m.createStage(host, spec, title, {
            onRotate: () => setRotated(true),
            onLost: () => {
              // El aviso puede llegar tarde, cuando ya se ve otra figura: entonces no es de esta.
              if (!alive) return;
              st?.dispose();
              stage.current = null;
              console.warn(`Figura 3D de «${title}»: el navegador cerró el contexto 3D (intento ${attempt + 1}).`);
              if (attempt < 2) setAttempt((a) => a + 1);
              else setMode("2d");
            },
          });
          stage.current = st;
          st.render(tRef.current);
          setMode("3d");
        } catch (e) {
          console.warn(`Figura 3D de «${title}»: no se pudo montar, se enseña el dibujo plano.`, e);
          setMode("2d");
        }
      })
      .catch((e) => {
        console.warn("No se pudo cargar el motor 3D, se enseña el dibujo plano.", e);
        if (alive) setMode("2d");
      });
    return () => {
      alive = false;
      st?.dispose();
      if (stage.current === st) stage.current = null;
    };
  }, [spec, title, attempt, retry]);

  // Otro test: vuelve a tener sus dos intentos.
  useEffect(() => setAttempt(0), [spec]);

  useEffect(() => {
    stage.current?.setMode(view);
  }, [view, mode]);
  useEffect(() => {
    stage.current?.setMirror(mirror);
  }, [mirror, mode]);

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
    const loopMs = clock.duration * 1000;
    let raf = 0;
    let last = 0;
    let cost = 0;
    const start = performance.now() - tRef.current * loopMs;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      // ~30 imágenes por segundo bastan; en un equipo lento, menos, para que la página siga respondiendo.
      if (now - last < Math.max(33, 3 * cost)) return;
      last = now;
      const tt = ((now - start) % loopMs) / loopMs;
      tRef.current = tt;
      const t0 = performance.now();
      draw(tt);
      cost = 0.7 * cost + 0.3 * (performance.now() - t0);
      setT((prev) => {
        const a = clock.at(prev);
        const b = clock.at(tt);
        return a.phase !== b.phase || a.step !== b.step || Math.abs(prev - tt) > 0.02 ? tt : prev;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, visible, mode, draw, clock]);

  const now = clock.at(t);
  const ph = phases.find((p) => p.id === now.phase)!;
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
  const flip = (s: string) => (mirror ? mirrorText(s) : s);
  // Texto: el de cada paso durante la maniobra (con sus grados en modo clínico); si no, el de la fase.
  const steps = spec.script?.steps ?? [];
  const stepNow = now.phase === "move" && now.step >= 0 ? steps[now.step] : undefined;
  const caption = stepNow ? stepNow.text : now.phase === "back" ? texts.setup : texts[now.phase];
  // Quién mueve (pasivo o activo) y qué cambia, con sus grados. Si no se mueve nada: isométrico (el paciente hace
  // fuerza contra el examinador) o solo la presión del examinador.
  const noMove = stepNow && !stepNow.to && !stepNow.shift;
  const who = !stepNow
    ? ""
    : noMove && (stepNow.by === "patient" || stepNow.marks?.some((m) => m.kind === "resist"))
      ? "Isométrico (el paciente hace fuerza; no se mueve)"
      : noMove && stepNow.by === "examiner"
        ? "Presión del examinador (sin movimiento)"
        : stepNow.by === "patient"
          ? "Activo (lo mueve el paciente)"
          : stepNow.by === "examiner"
            ? "Pasivo (lo mueve el examinador)"
            : "";
  const technical = stepNow && keys && view === "clinical" ? [who, stepTechnical(keys, now.step)].filter(Boolean).join(" · ") : "";
  const ctl = "inline-flex size-11 items-center justify-center rounded-full bg-bg/90 text-text shadow-sm ring-1 ring-border backdrop-blur hover:bg-surface";
  const seg = (on: boolean) => cx("h-8 rounded-md px-2.5 text-xs font-semibold transition-colors", on ? "bg-bg text-text shadow-sm" : "text-text-muted hover:text-text");
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
            <button type="button" onClick={() => turn(-20)} aria-label="Girar la vista a la izquierda" className={ctl}>
              <RotateCcw aria-hidden="true" className="size-5" />
            </button>
            <button type="button" onClick={() => turn(20)} aria-label="Girar la vista a la derecha" className={ctl}>
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
      {mode === "2d" && !noWebgl && (
        <div className="mx-3 mt-2">
          <button
            type="button"
            onClick={() => {
              setAttempt(0);
              setRetry((r) => r + 1);
            }}
            className="tap inline-flex items-center rounded-md px-2 text-sm font-semibold text-accent hover:bg-surface"
          >
            Ver en 3D
          </button>
        </div>
      )}
      {mode === "3d" && (
        <div className="mx-3 mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-0.5 rounded-lg bg-surface p-0.5" role="group" aria-label="Ayudas visuales">
            <button type="button" aria-pressed={view === "clinical"} onClick={() => setView("clinical")} className={seg(view === "clinical")}>
              Clínico
            </button>
            <button type="button" aria-pressed={view === "natural"} onClick={() => setView("natural")} className={seg(view === "natural")}>
              Natural
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted">Lado</span>
            <div className="flex gap-0.5 rounded-lg bg-surface p-0.5" role="group" aria-label="Lado del test">
              <button type="button" aria-pressed={!mirror} onClick={() => setMirror(false)} className={seg(!mirror)} aria-label="Como en la ficha">
                {spec.side === "l" ? "I" : spec.side === "both" ? "D+I" : "D"}
              </button>
              {spec.side !== "both" && (
                <button type="button" aria-pressed={mirror} onClick={() => setMirror(true)} className={seg(mirror)} aria-label="El otro lado (en espejo)">
                  {spec.side === "l" ? "D" : "I"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {mode === "3d" && <p className="px-4 pt-1.5 text-xs text-text-muted">Arrastra a los lados para girar un poco la figura.</p>}
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
        {clock.phases.slice(0, 3).map((p, i) => (
          <li key={p.id} className="flex-1">
            <button
              type="button"
              aria-current={now.phase === p.id ? "step" : undefined}
              onClick={() => jump(p.id === "move" && clock.steps[0] ? clock.steps[0].moveTo - 0.005 : (p.from + p.to) / 2 + (p.id === "move" ? 0.1 : 0))}
              className={cx("h-9 w-full rounded-md text-xs font-semibold transition-colors", now.phase === p.id ? "bg-bg text-text shadow-sm" : "text-text-muted hover:text-text")}
            >
              {i + 1}. {phases.find((x) => x.id === p.id)!.label}
            </button>
          </li>
        ))}
      </ol>
      <figcaption className="min-h-[4.5rem] px-4 pb-3 pt-2 text-sm leading-relaxed" aria-live="off">
        {stepNow && steps.length > 1 && <span className="mr-1.5 text-xs font-semibold text-text-muted">Paso {now.step + 1} de {steps.length}.</span>}
        {flip(caption)}
        {technical && <span className="mt-1 block text-xs text-text-muted">{flip(technical)}</span>}
      </figcaption>
    </figure>
  );
}
