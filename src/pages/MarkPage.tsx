import { Upload, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { requiredMarks, type MarkEvent } from "../calc/results";
import { jumpLabels } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { videoStore } from "../app/videoStore";
import { getDb } from "../data/db";
import { getTest, saveMarksAndCompute } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { FrameControls, FrameScrubber, MarkButton, markerStyle, type Marker } from "../ui/FrameScrubber";
import { useToast } from "../ui/Toast";

const hints: Record<MarkEvent, string> = {
  contact: "Busca el primer fotograma en que el pie toca el suelo al caer del cajón y pulsa Contacto.",
  takeoff: "Busca el primer fotograma con los dos pies en el aire y pulsa Despegue.",
  landing: "Busca el primer fotograma en que un pie vuelve a tocar el suelo y pulsa Aterrizaje.",
};

/** S07 Marcado de fotogramas */
export function MarkPage() {
  const { id = "" } = useParams();
  const test = useAsync(() => getTest(getDb(), id), [id]);
  const [file, setFile] = useState<File | null>(() => videoStore.get(id));

  if (test.error) return <Page title="Marcar" backTo="/"><LoadError error={test.error} /></Page>;
  if (!test.data) return <Page title="Marcar" backTo="/"><Loading /></Page>;
  const t = test.data;
  const back = `/pacientes/${t.patientId}`;
  if (!t.video) return <Page title="Marcar" backTo={back}><LoadError error={new Error("Este test no tiene vídeo.")} /></Page>;

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

  const initial: Partial<Record<MarkEvent, number>> = {};
  for (const m of t.marks) initial[m.event] = m.frameIndex;

  return (
    <Page title={`Marcar · ${jumpLabels[t.type].short}`} backTo={back} tone="media">
      <MarkingWorkspace
        testId={id}
        file={file}
        type={t.type}
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
  type: "cmj" | "sj" | "dj";
  captureFps: number;
  containerFps: number;
  frameCount: number;
  initial: Partial<Record<MarkEvent, number>>;
};

function MarkingWorkspace({ testId, file, type, captureFps, containerFps, frameCount, initial }: MarkerProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const video = useRef<HTMLVideoElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const required = requiredMarks(type);
  const [frames, setFrames] = useState(initial);
  const [frame, setFrame] = useState(() => initial[required[0]!] ?? 0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [center, setCenter] = useState(frame);
  const [saving, setSaving] = useState(false);
  const last = frameCount - 1;

  // Fotograma → tiempo del archivo. Se apunta al centro del fotograma para no caer en el anterior.
  useEffect(() => {
    const v = video.current;
    if (!v || playing) return;
    v.currentTime = (frame + 0.5) / containerFps;
  }, [frame, playing, containerFps]);

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
      setFrame(Math.min(last, Math.floor(v.currentTime * containerFps)));
      if (v.ended) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, containerFps, last]);

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
  const mark = (event: MarkEvent) => {
    setPlaying(false);
    setFrames((fs) => ({ ...fs, [event]: frame }));
  };

  const missing = required.filter((e) => frames[e] === undefined);
  const ordered = required.every((e, i) => i === 0 || (frames[e] ?? Infinity) > (frames[required[i - 1]!] ?? -Infinity));
  const markers: Marker[] = required.filter((e) => frames[e] !== undefined).map((e) => ({ frame: frames[e]!, kind: e }));

  async function calculate() {
    setSaving(true);
    try {
      await saveMarksAndCompute(getDb(), testId, frames);
      navigate(`/tests/${testId}`, { replace: true });
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo calcular", "danger");
      setSaving(false);
    }
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
        aria-label="Vídeo del salto"
        className="max-h-[50dvh] w-full rounded-md bg-media-surface object-contain"
      />
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <FrameScrubber
            frameCount={frameCount}
            frame={frame}
            fps={captureFps}
            markers={markers}
            onFrame={(f) => {
              setPlaying(false);
              setFrame(f);
            }}
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
        {missing.length ? hints[missing[0]!] : ordered ? "Listo. Revisa las marcas si quieres y pulsa Calcular." : ""}
      </p>
      {!ordered && missing.length === 0 && (
        <Alert tone="warning" title="Las marcas están desordenadas">
          {required.map((e) => markerStyle[e].name).join(" → ")}: cada una debe ir después de la anterior.
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {required.map((e) => (
          <MarkButton key={e} kind={e} done={frames[e] !== undefined} onClick={() => mark(e)} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm text-media-muted">
        {required.map((e) =>
          frames[e] !== undefined ? (
            <button
              key={e}
              type="button"
              onClick={() => {
                setPlaying(false);
                setFrame(frames[e]!);
              }}
              className="tap rounded-md px-2 underline"
            >
              Ir a {markerStyle[e].name.toLowerCase()} (fotograma {frames[e]! + 1})
            </button>
          ) : null,
        )}
      </div>
      <Button size="lg" block disabled={missing.length > 0 || !ordered} loading={saving} onClick={calculate}>
        Calcular
      </Button>
    </div>
  );
}
