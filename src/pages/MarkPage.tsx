import { CircleQuestionMark, Upload, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { MIN_JUMPS } from "../calc/repeated";
import { optionalMarks, requiredMarks, type JumpType, type MarkEvent, type MarkInput } from "../calc/results";
import { getExercise } from "../calc/strength";
import { isJumpType, jumpLabels } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { videoStore } from "../app/videoStore";
import { getDb } from "../data/db";
import { getTest, saveMarksAndCompute } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { FrameControls, FrameScrubber, MarkButton, markerStyle, type Marker } from "../ui/FrameScrubber";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { frameAt, seekTime } from "../video/timeline";
import { useTimeline } from "../video/useTimeline";
import { JumpHelp } from "./JumpHelp";
import { StrengthHelp } from "./StrengthHelp";

/** Tipos de test que se marcan en vídeo: los saltos y la velocidad de barra. */
type MarkType = JumpType | "vbt";

/** Una serie alterna dos marcas (despegue/aterrizaje, inicio/fin de la subida) repetición tras repetición. */
type SeriesSpec = { first: MarkEvent; second: MarkEvent; min: number; unit: string; hint: (next: MarkEvent, n: number) => string; ideal: string };

const seriesSpecs: Partial<Record<MarkType, SeriesSpec>> = {
  rj_10_5: {
    first: "takeoff",
    second: "landing",
    min: MIN_JUMPS,
    unit: "saltos",
    ideal: "lo ideal, los 10",
    hint: (next, n) =>
      next === "takeoff"
        ? `Salto ${n}: busca el primer fotograma con los dos pies en el aire y pulsa Despegue.`
        : `Salto ${n}: busca el primer fotograma en que un pie toca el suelo y pulsa Aterrizaje.`,
  },
  vbt: {
    first: "bar_start",
    second: "bar_end",
    min: 1,
    unit: "repeticiones",
    ideal: "marca todas las de la serie para ver la pérdida de velocidad",
    hint: (next, n) =>
      next === "bar_start"
        ? `Repetición ${n}: busca el primer fotograma en que la barra empieza a subir y pulsa Inicio.`
        : `Repetición ${n}: busca el fotograma en que la barra se para arriba y pulsa Fin.`,
  },
};

const hints: Record<MarkEvent, string> = {
  movement_start: "Opcional: primer fotograma en que empieza a bajar. Permite el RSI modificado.",
  contact: "Busca el primer fotograma en que el pie toca el suelo al caer del cajón y pulsa Contacto.",
  takeoff: "Busca el primer fotograma con los dos pies en el aire y pulsa Despegue.",
  landing: "Busca el primer fotograma en que un pie vuelve a tocar el suelo y pulsa Aterrizaje.",
  bar_start: "",
  bar_end: "",
};

/** S07 Marcado de fotogramas */
export function MarkPage() {
  const { id = "" } = useParams();
  const test = useAsync(() => getTest(getDb(), id), [id]);
  const [file, setFile] = useState<File | null>(() => videoStore.get(id));
  const [help, setHelp] = useState(false);

  if (test.error) return <Page title="Marcar" backTo="/"><LoadError error={test.error} /></Page>;
  if (test.data === undefined) return <Page title="Marcar" backTo="/"><Loading /></Page>;
  const t = test.data;
  if (!t) return <Page title="Marcar" backTo="/"><LoadError error={new Error("Este test no existe.")} /></Page>;
  const back = `/pacientes/${t.patientId}`;
  if (!t.video || !(isJumpType(t.type) || t.type === "vbt")) return <Page title="Marcar" backTo={back}><LoadError error={new Error("Este test no tiene vídeo.")} /></Page>;
  const type: MarkType = t.type;
  const label = type === "vbt" ? (getExercise(String(t.details.exercise))?.label ?? "Fuerza") : jumpLabels[type].short;

  if (!file) {
    return (
      <Page title="Marcar" backTo={back}>
        <RepickVideo
          expectedName={t.video.fileName}
          onFile={(f) => {
            videoStore.set(id, f);
            setFile(f);
          }}
        />
      </Page>
    );
  }

  const initial: MarkInput[] = t.marks.map((m) => ({ event: m.event, frame: m.frameIndex, seriesIndex: m.seriesIndex }));

  return (
    <Page
      title={`Marcar · ${label}`}
      backTo={back}
      tone="media"
      action={
        <IconButton label="Cómo marcar" onClick={() => setHelp(true)}>
          <CircleQuestionMark aria-hidden="true" className="size-6" />
        </IconButton>
      }
    >
      <Sheet open={help} onClose={() => setHelp(false)} title={type === "vbt" ? "Cómo grabar y marcar la barra" : `Cómo marcar un ${label}`}>
        {type === "vbt" ? <StrengthHelp exercise={String(t.details.exercise)} /> : <JumpHelp type={type} />}
      </Sheet>
      <MarkingWorkspace
        testId={id}
        file={file}
        type={type}
        captureFps={t.video.captureFps}
        containerFps={t.video.containerFps}
        frameCount={t.video.frameCount ?? 1}
        initial={initial}
      />
    </Page>
  );
}

function RepickVideo({ expectedName, onFile }: { expectedName: string; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [mismatch, setMismatch] = useState<File | null>(null);
  return (
    <>
      <Alert tone="info" title="Vuelve a elegir el vídeo">
        La app no guarda los vídeos. Elige otra vez «{expectedName}» de tu galería para marcarlo.
      </Alert>
      <input
        ref={input}
        type="file"
        accept="video/*"
        className="sr-only"
        aria-label="Elegir vídeo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.name === expectedName) onFile(f);
          else setMismatch(f);
        }}
      />
      <Button size="lg" block icon={<Upload aria-hidden="true" className="size-5" />} onClick={() => input.current?.click()}>
        Elegir vídeo
      </Button>
      {mismatch && (
        <Alert tone="warning" title="No es el mismo archivo">
          Elegiste «{mismatch.name}». Si es el mismo vídeo con otro nombre,{" "}
          <button type="button" className="underline" onClick={() => onFile(mismatch)}>
            úsalo igualmente
          </button>
          .
        </Alert>
      )}
    </>
  );
}

type MarkerProps = {
  testId: string;
  file: File;
  type: MarkType;
  captureFps: number;
  containerFps: number;
  frameCount: number;
  initial: MarkInput[];
};

/** Estado del marcado: qué falta, si el orden es correcto y qué botones mostrar. */
function markingState(type: MarkType, marks: MarkInput[]) {
  const spec = seriesSpecs[type];
  if (spec) {
    const ordered = [...marks].sort((a, b) => a.frame - b.frame);
    const firsts = marks.filter((m) => m.event === spec.first).length;
    const seconds = marks.filter((m) => m.event === spec.second).length;
    const next: MarkEvent = firsts === seconds ? spec.first : spec.second;
    // En una serie las marcas alternan: primera, segunda, primera…
    const alternate = ordered.every((m, i) => m.event === (i % 2 === 0 ? spec.first : spec.second));
    const complete = Math.min(firsts, seconds);
    return {
      series: true as const,
      spec,
      next,
      nextIndex: next === spec.first ? firsts : seconds,
      complete,
      ordered: alternate,
      ready: alternate && complete >= spec.min && firsts === seconds,
    };
  }
  const jump = type as JumpType;
  const required = requiredMarks(jump);
  const at = (e: MarkEvent) => marks.find((m) => m.event === e)?.frame;
  const missing = required.filter((e) => at(e) === undefined);
  const sequence = [...optionalMarks(jump), ...required].filter((e) => at(e) !== undefined);
  const ordered = sequence.every((e, i) => i === 0 || at(e)! > at(sequence[i - 1]!)!);
  return { series: false as const, required, missing, ordered, ready: missing.length === 0 && ordered };
}

function MarkingWorkspace({ testId, file, type, captureFps, containerFps, frameCount, initial }: MarkerProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const video = useRef<HTMLVideoElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const [marks, setMarks] = useState<MarkInput[]>(initial);
  const [frame, setFrame] = useState(() => initial.find((m) => m.event === "takeoff" || m.event === "bar_start")?.frame ?? 0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [center, setCenter] = useState(frame);
  const [saving, setSaving] = useState(false);
  // Hora real de cada fotograma; mientras se calibra no se mueve el reproductor.
  const { timeline, ready } = useTimeline(file, video);
  const last = (timeline?.times.length ?? frameCount) - 1;

  // Fotograma → tiempo del reproductor: el centro de su intervalo real, para no caer en el de al lado.
  useEffect(() => {
    const v = video.current;
    if (!v || playing || !ready) return;
    v.currentTime = seekTime(timeline, frame, containerFps);
  }, [frame, playing, containerFps, timeline, ready]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (!playing) {
      v.pause();
      return;
    }
    // Un vídeo de 240 fps a velocidad normal pasa demasiado rápido: se reproduce a un cuarto.
    v.playbackRate = containerFps >= 100 ? 0.25 : 1;
    void v.play();
    let raf = 0;
    const tick = () => {
      setFrame(frameAt(timeline, v.currentTime, containerFps, last));
      if (v.ended) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, containerFps, last, timeline]);

  // Con la lupa, la barra muestra ~1 s del archivo alrededor del fotograma actual.
  const half = Math.max(10, Math.round(containerFps / 2));
  useEffect(() => {
    if (zoom && Math.abs(frame - center) > half) setCenter(frame);
  }, [frame, zoom, center, half]);
  const rangeStart = zoom ? Math.max(0, Math.min(center - half, last - 2 * half)) : 0;
  const rangeEnd = zoom ? Math.min(last, rangeStart + 2 * half) : last;

  const step = (d: number) => {
    setPlaying(false);
    setFrame((f) => Math.max(0, Math.min(last, f + d)));
  };
  const goTo = (f: number) => {
    setPlaying(false);
    setFrame(f);
  };

  const state = markingState(type, marks);

  /** Salto simple: fija (o mueve) el evento en el fotograma actual. */
  const markSingle = (event: MarkEvent) => {
    setPlaying(false);
    setMarks((ms) => [...ms.filter((m) => m.event !== event), { event, frame, seriesIndex: 0 }]);
  };
  /** Serie: añade la siguiente marca (despegue o aterrizaje) si va después de la anterior. */
  const markNext = () => {
    if (!state.series) return;
    setPlaying(false);
    const lastFrame = Math.max(-1, ...marks.map((m) => m.frame));
    if (frame <= lastFrame) {
      toast("Cada marca debe ir después de la anterior: avanza en el vídeo.", "danger");
      return;
    }
    setMarks((ms) => [...ms, { event: state.next, frame, seriesIndex: state.nextIndex }]);
  };
  const undoLast = () => {
    setMarks((ms) => {
      const lastMark = [...ms].sort((a, b) => b.frame - a.frame)[0];
      return lastMark ? ms.filter((m) => m !== lastMark) : ms;
    });
  };

  const markers: Marker[] = marks.map((m) => ({ frame: m.frame, kind: m.event }));

  async function calculate() {
    setSaving(true);
    try {
      await saveMarksAndCompute(getDb(), testId, marks);
      navigate(`/tests/${testId}`, { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo calcular", "danger");
      setSaving(false);
    }
  }

  let hint: string;
  if (state.series) {
    const { spec } = state;
    hint = spec.hint(state.next, state.nextIndex + 1);
    if (state.ready) hint = `${state.complete} ${spec.unit} marcados. Puedes seguir marcando o pulsar Calcular.`;
    else hint += spec.min > 1 ? ` (mínimo ${spec.min} ${spec.unit}; ${spec.ideal})` : ` (${spec.ideal})`;
  } else {
    hint = state.missing.length ? hints[state.missing[0]!] : state.ordered ? "Listo. Revisa las marcas si quieres y pulsa «Calcular resultado»." : "";
  }

  return (
    <div className="flex flex-col gap-4">
      <video
        ref={video}
        src={url}
        muted
        playsInline
        preload="auto"
        onPause={() => setPlaying(false)}
        aria-label={type === "vbt" ? "Vídeo de la serie" : "Vídeo del salto"}
        className="max-h-[50dvh] w-full rounded-md bg-media-surface object-contain"
      />
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FrameScrubber
            frameCount={last + 1}
            frame={frame}
            fps={captureFps}
            markers={markers}
            onFrame={goTo}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />
        </div>
        <IconButton
          tone="media"
          label={zoom ? "Ver el vídeo entero en la barra" : "Ampliar la barra alrededor de este fotograma"}
          aria-pressed={zoom}
          onClick={() => {
            setCenter(frame);
            setZoom((z) => !z);
          }}
          className="mb-7"
        >
          {zoom ? <ZoomOut aria-hidden="true" className="size-6" /> : <ZoomIn aria-hidden="true" className="size-6" />}
        </IconButton>
      </div>
      <FrameControls playing={playing} onTogglePlay={() => setPlaying((p) => !p)} onStep={step} />

      <p aria-live="polite" className="text-sm text-media-muted">
        {hint}
      </p>
      {!state.ordered && (state.series || state.missing.length === 0) && (
        <Alert tone="warning" title="Las marcas están desordenadas">
          {state.series
            ? `Deben alternar ${markerStyle[state.spec.first].name.toLowerCase()} y ${markerStyle[state.spec.second].name.toLowerCase()}, cada una después de la anterior. Deshaz la última y vuelve a marcar.`
            : `${[...optionalMarks(type as JumpType), ...state.required].map((e) => markerStyle[e].name).join(" → ")}: cada una debe ir después de la anterior.`}
        </Alert>
      )}

      {state.series ? (
        <div className="flex gap-2">
          <MarkButton kind={state.next} done={false} label={`${markerStyle[state.next].name} ${state.nextIndex + 1}`} onClick={markNext} />
          <Button variant="secondary" disabled={marks.length === 0} onClick={undoLast}>
            Deshacer
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state.required.map((e) => (
            <MarkButton key={e} kind={e} done={marks.some((m) => m.event === e)} onClick={() => markSingle(e)} />
          ))}
          {optionalMarks(type as JumpType).map((e) => (
            <MarkButton key={e} kind={e} done={marks.some((m) => m.event === e)} onClick={() => markSingle(e)} label={`${markerStyle[e].name} (opcional)`} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1 text-sm text-media-muted">
        {[...marks]
          .sort((a, b) => a.frame - b.frame)
          .map((m) => (
            <button key={`${m.event}-${m.seriesIndex}`} type="button" onClick={() => goTo(m.frame)} className="tap rounded-md px-2 underline">
              Ir a {markerStyle[m.event].name.toLowerCase()}
              {state.series ? ` ${m.seriesIndex + 1}` : ""} (fotograma {m.frame + 1})
            </button>
          ))}
      </div>
      <Button size="lg" block disabled={!state.ready} loading={saving} onClick={calculate}>
        Calcular resultado
      </Button>
    </div>
  );
}
