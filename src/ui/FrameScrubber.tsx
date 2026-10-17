import { Check, ChevronsLeft, ChevronsRight, Pause, Play, StepBack, StepForward } from "lucide-react";
import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { IconButton } from "./Button";
import { cx } from "./cx";

export type MarkerKind = "movement_start" | "takeoff" | "landing" | "contact" | "bar_start" | "bar_end" | "other";

/** Color y letra de cada evento: nunca se distinguen solo por el color. */
export const markerStyle: Record<MarkerKind, { bg: string; letter: string; name: string }> = {
  movement_start: { bg: "bg-marker-other", letter: "I", name: "Inicio" },
  takeoff: { bg: "bg-marker-takeoff", letter: "D", name: "Despegue" },
  landing: { bg: "bg-marker-landing", letter: "A", name: "Aterrizaje" },
  contact: { bg: "bg-marker-contact", letter: "C", name: "Contacto" },
  bar_start: { bg: "bg-marker-takeoff", letter: "S", name: "Inicio" },
  bar_end: { bg: "bg-marker-landing", letter: "F", name: "Fin" },
  other: { bg: "bg-marker-other", letter: "M", name: "Marca" },
};

export type Marker = { frame: number; kind: MarkerKind };

type ScrubberProps = {
  frameCount: number;
  frame: number;
  fps: number;
  markers: Marker[];
  onFrame: (frame: number) => void;
  /** Ventana visible (zoom). Por defecto, el vídeo entero. */
  rangeStart?: number;
  rangeEnd?: number;
};

export function formatTime(seconds: number) {
  return seconds.toLocaleString("es-ES", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " s";
}

/**
 * Barra de tiempo del visor (S07). Es un slider accesible:
 * ← → un fotograma, RePág/AvPág diez, Inicio/Fin a los extremos; también se arrastra con el dedo.
 */
export function FrameScrubber({ frameCount, frame, fps, markers, onFrame, rangeStart = 0, rangeEnd }: ScrubberProps) {
  const track = useRef<HTMLDivElement>(null);
  const last = frameCount - 1;
  const end = Math.min(rangeEnd ?? last, last);
  const span = Math.max(1, end - rangeStart);
  const clamp = (f: number) => Math.max(0, Math.min(last, Math.round(f)));
  const pct = (f: number) => Math.max(0, Math.min(100, ((f - rangeStart) / span) * 100));
  const visible = (f: number) => f >= rangeStart && f <= end;

  function fromPointer(e: PointerEvent<HTMLDivElement>) {
    const r = track.current!.getBoundingClientRect();
    onFrame(clamp(rangeStart + ((e.clientX - r.left) / r.width) * span));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
    if (e.key in step) onFrame(clamp(frame + step[e.key]!));
    else if (e.key === "Home") onFrame(0);
    else if (e.key === "End") onFrame(last);
    else return;
    e.preventDefault();
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Posición en el vídeo"
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={frame}
        aria-valuetext={`Fotograma ${frame + 1} de ${frameCount}, ${formatTime(frame / fps)}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => e.buttons === 1 && fromPointer(e)}
        className="relative h-12 touch-none rounded-md"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-media-surface" />
        <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-media-muted" style={{ width: `${pct(frame)}%` }} />
        {markers.filter((m) => visible(m.frame)).map((m) => (
          <span
            key={`${m.kind}-${m.frame}`}
            aria-hidden="true"
            className={cx(
              "absolute top-0 flex size-5 -translate-x-1/2 items-center justify-center rounded-sm text-xs font-bold text-media-bg",
              markerStyle[m.kind].bg,
            )}
            style={{ left: `${pct(m.frame)}%` }}
          >
            {markerStyle[m.kind].letter}
          </span>
        ))}
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-pill border-2 border-media-bg bg-media-text"
          style={{ left: `${pct(frame)}%` }}
        />
      </div>
      <p className="nums flex justify-between text-sm text-media-muted">
        <span>
          Fotograma {frame + 1} / {frameCount}
        </span>
        <span>{formatTime(frame / fps)}</span>
      </p>
    </div>
  );
}

type ControlsProps = {
  playing: boolean;
  onTogglePlay: () => void;
  onStep: (delta: number) => void;
};

/** Botones grandes (56px) para avanzar fotograma a fotograma con el pulgar. */
export function FrameControls({ playing, onTogglePlay, onStep }: ControlsProps) {
  const icon = "size-7";
  return (
    <div className="flex items-center justify-between">
      <IconButton tone="media" size="video" label="Retroceder 10 fotogramas" onClick={() => onStep(-10)}>
        <ChevronsLeft aria-hidden="true" className={icon} />
      </IconButton>
      <IconButton tone="media" size="video" label="Fotograma anterior" onClick={() => onStep(-1)}>
        <StepBack aria-hidden="true" className={icon} />
      </IconButton>
      <IconButton tone="media" size="video" label={playing ? "Pausa" : "Reproducir a cámara lenta"} onClick={onTogglePlay}>
        {playing ? <Pause aria-hidden="true" className={icon} /> : <Play aria-hidden="true" className={icon} />}
      </IconButton>
      <IconButton tone="media" size="video" label="Fotograma siguiente" onClick={() => onStep(1)}>
        <StepForward aria-hidden="true" className={icon} />
      </IconButton>
      <IconButton tone="media" size="video" label="Avanzar 10 fotogramas" onClick={() => onStep(10)}>
        <ChevronsRight aria-hidden="true" className={icon} />
      </IconButton>
    </div>
  );
}

/**
 * Botón para fijar un evento en el fotograma actual. Texto visible corto (cabe en medio ancho);
 * el lector de pantalla oye además la acción: «Despegue: marcar en este fotograma».
 * Sin aria-label: así el nombre accesible empieza por lo que se ve (WCAG 2.5.3).
 */
export function MarkButton({ kind, done, onClick, label }: { kind: MarkerKind; done: boolean; onClick: () => void; label?: string }) {
  const s = markerStyle[kind];
  const text = label ?? s.name;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("tap-video flex flex-1 items-center justify-center gap-2 rounded-md px-3 text-base font-semibold text-media-bg", s.bg)}
    >
      <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-sm bg-media-bg/15 text-sm">
        {s.letter}
      </span>
      <span>{text}</span>
      <span className="sr-only">{done ? ": mover a este fotograma" : ": marcar en este fotograma"}</span>
      {done && <Check aria-hidden="true" className="size-5" />}
    </button>
  );
}
