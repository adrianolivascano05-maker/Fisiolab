// Medición libre biomecánica: vídeo → pose 3D por fotograma → esqueleto superpuesto → ángulo
// dinámico entre una referencia (plomada o eje del cuerpo) y un segmento que se mueve.
import { todayDay } from "../app/dates";
import { Crosshair, Download, FlaskConical, Hand, Play, Save, ScanLine, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getPatient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card, MetricCard } from "../ui/Card";
import { SelectField } from "../ui/Field";
import { FrameControls, FrameScrubber, type Marker } from "../ui/FrameScrubber";
import { useToast } from "../ui/Toast";
import { nominalFps, readContainerMeta } from "../video/meta";
import { frameAt, seekTime } from "../video/timeline";
import { useTimeline } from "../video/useTimeline";
import { measureFrame, smoothPoses, summarizeKeyframes, type MeasureConfig } from "./geometry";
import { allJoints, baseJoints, drawnJoints, jointLabel, jointPoint, presets, skeleton } from "./joints";
import { angleSeries, choosePreset, movementWindow, spread, toConfig } from "./auto";
import { detectPose, grabFrame, loadPoseDetector, type Detector } from "../ai/pose";
import { listMeasurements, reportCsv, saveMeasurement } from "./store";
import type { AnatomicalPlane, BiomechanicalMeasurement, FramePose, KeyframeData } from "./types";
import { saveFile } from "../app/download";

/** Máximo de fotogramas que se analizan en un movimiento (se salta alguno si el tramo es largo). */
const MAX_ANALYZED = 240;
/** Fotogramas que se miran en todo el vídeo para encontrar el movimiento. */
const SCAN_FRAMES = 60;
/** Radio de anclaje a una articulación, en píxeles de pantalla. */
const SNAP_PX = 20;

const planeLabels: Record<AnatomicalPlane | "screen", string> = {
  sagittal: "Sagital (flexión / extensión)",
  frontal: "Frontal (abducción / aducción)",
  transverse: "Transversal (rotaciones)",
  screen: "Pantalla 2D (sin compensar)",
};

export function download(name: string, text: string) {
  saveFile(name, text, "text/csv;charset=utf-8");
}

/** Lista de mediciones del paciente y botón para empezar una nueva. */
export function FreeMeasurePage() {
  const { id = "" } = useParams();
  const data = useAsync(async () => ({ patient: await getPatient(getDb(), id), saved: await listMeasurements(getDb(), id) }), [id]);
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const back = `/pacientes/${id}/test/movilidad`;
  const title = "Medición libre";
  if (data.error) return <Page title={title} backTo={back} tabs={false}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title={title} backTo={back} tabs={false}><Loading /></Page>;
  const { patient, saved } = data.data;
  if (!patient) return <Page title={title} backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;

  if (file) {
    return (
      <Page title={title} backTo={back} tone="media">
        <Workspace key={file.name + file.size} file={file} patientId={id} patientName={patient.name} onDone={() => { setFile(null); data.reload(); }} />
      </Page>
    );
  }

  return (
    <Page title={title} backTo={back} tabs={false}>
      <p className="text-text-muted">{patient.name}</p>
      <Alert tone="info" title="Experimental">
        La pose 3D la estima una IA a partir de una sola cámara, en el propio móvil (nada sale de él). Sirve para seguir un movimiento; para
        un valor clínico exacto, usa la movilidad con goniómetro o inclinómetro.
      </Alert>
      <input ref={input} type="file" accept="video/*" className="sr-only" aria-label="Elegir vídeo" tabIndex={-1} onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
      <Button size="lg" block icon={<Upload aria-hidden="true" className="size-5" />} onClick={() => input.current?.click()}>
        Grabar o elegir vídeo
      </Button>
      <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">
        <li>Cuerpo entero en el cuadro, con buena luz y ropa que deje ver las articulaciones.</li>
        <li>Mejor de frente para abducciones y de lado para flexiones; si no se puede, el plano anatómico corrige la diagonal.</li>
      </ul>
      {saved.length > 0 && (
        <section aria-labelledby="h-libres" className="flex flex-col gap-2">
          <h2 id="h-libres" className="text-lg">
            Mediciones guardadas
          </h2>
          <ul className="flex flex-col gap-2">
            {saved.map((m) => (
              <li key={m.id}>
                <Link to={`/pacientes/${id}/medicion-libre/${m.id}`} className="block">
                  <Card className="flex items-center justify-between gap-3 hover:border-accent">
                    <span className="flex flex-col">
                      <span className="font-semibold">
                        {jointLabel(m.movementVector.startJoint)} → {jointLabel(m.movementVector.endJoint)}
                      </span>
                      <span className="text-sm text-text-muted">
                        {fmtDate(m.createdAt)} · {planeLabels[m.anatomicalPlane]}
                      </span>
                    </span>
                    <span className="nums text-right">
                      <span className="text-sm text-text-muted">Δθ </span>
                      <span className="text-xl">{fmt(m.deltaAngleDegrees, 0)}°</span>
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

type TapMode = null | "movement" | "reference" | "correct";

function Workspace({ file, patientId, patientName, onDone }: { file: File; patientId: string; patientName: string; onDone: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const [fps, setFps] = useState(30);
  const [captureFps, setCaptureFps] = useState(30);
  const [frameCount, setFrameCount] = useState(1);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    let alive = true;
    readContainerMeta(file).then(
      (m) => {
        if (!alive) return;
        setFps(nominalFps(m.fps));
        setCaptureFps(nominalFps(m.captureFps ?? m.fps));
        setFrameCount(m.frameCount);
      },
      () => undefined, // Sin metadatos: 30 fps y la duración del vídeo.
    );
    return () => {
      alive = false;
    };
  }, [file]);

  const { timeline, ready } = useTimeline(file, video);
  const last = Math.max(0, (timeline?.times.length ?? frameCount) - 1);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [range, setRange] = useState<{ start: number | null; end: number | null }>({ start: null, end: null });

  const [raw, setRaw] = useState<Map<number, FramePose>>(new Map());
  const [overrides, setOverrides] = useState<Map<number, Map<number, { x: number; y: number }>>>(new Map());
  const [busy, setBusy] = useState<{ label: string; done: number; total: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [auto, setAuto] = useState<string | null>(null);
  const cancel = useRef(false);
  const grab = useRef<HTMLCanvasElement | null>(null);

  const [presetId, setPresetId] = useState(presets[0]!.id);
  const [cfg, setCfg] = useState<MeasureConfig>(() => toConfig(presets[0]!));
  /** La medición la ha elegido el usuario: el autocompletado ya no la cambia. */
  const touched = useRef(false);
  const editCfg: typeof setCfg = (v) => {
    touched.current = true;
    setAuto(null);
    setCfg(v);
  };
  const [tapMode, setTapMode] = useState<TapMode>(null);
  const [pendingTap, setPendingTap] = useState<string | null>(null);
  const drag = useRef<number | null>(null);

  // Fotograma → posición del reproductor.
  useEffect(() => {
    const v = video.current;
    if (!v || playing || !ready) return;
    v.currentTime = seekTime(timeline, frame, fps);
  }, [frame, playing, fps, timeline, ready]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (!playing) return void v.pause();
    void v.play();
    let raf = 0;
    const tick = () => {
      setFrame(frameAt(timeline, v.currentTime, fps, last));
      if (v.ended) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, fps, last, timeline]);

  // Poses suavizadas (One Euro) y con las correcciones a mano encima.
  const poses = useMemo(() => {
    const smooth = smoothPoses([...raw.values()]);
    return new Map(
      smooth.map((p) => {
        const o = overrides.get(p.frame);
        if (!o) return [p.frame, p];
        return [p.frame, { ...p, image: p.image.map((l, i) => (o.has(i) ? { ...l, ...o.get(i)! } : l)) }];
      }),
    );
  }, [raw, overrides]);
  const current = poses.get(frame) ?? null;

  const keyframes: KeyframeData[] = useMemo(() => {
    if (!size) return [];
    const out: KeyframeData[] = [];
    for (const p of [...poses.values()].sort((a, b) => a.frame - b.frame)) {
      if (range.start !== null && p.frame < range.start) continue;
      if (range.end !== null && p.frame > range.end) continue;
      const a = measureFrame(p, cfg, size);
      if (a !== null) out.push({ frameNumber: p.frame, timestampSeconds: p.frame / captureFps, angleDegrees: a });
    }
    return out;
  }, [poses, cfg, size, range, captureFps]);
  const summary = summarizeKeyframes(keyframes);
  const currentAngle = current && size ? measureFrame(current, cfg, size) : null;

  /**
   * Lleva el vídeo a un fotograma y espera a que se vea. Con límite de tiempo: si el móvil no avisa
   * de que ha llegado, se sigue igualmente en vez de quedarse colgado.
   */
  const seekTo = useCallback(
    async (f: number) => {
      const v = video.current!;
      const target = seekTime(timeline, f, fps);
      if (Math.abs(v.currentTime - target) < 1e-4 && !v.seeking) return;
      // En Android el fotograma nuevo se pinta un poco después de «seeked»: se espera a que se presente.
      const painted = new Promise<void>((resolve) => {
        if ("requestVideoFrameCallback" in v) v.requestVideoFrameCallback(() => resolve());
        else resolve();
      });
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(t);
          v.removeEventListener("seeked", done);
          resolve();
        };
        const t = setTimeout(done, 3000);
        v.addEventListener("seeked", done);
        v.currentTime = target;
      });
      await Promise.race([painted, new Promise((r) => setTimeout(r, 200))]);
    },
    [timeline, fps],
  );

  /** Detecta la pose en cada fotograma de la lista y la añade a `found`. Devuelve cuántos no tenían a nadie. */
  async function detectFrames(d: Detector, frames: number[], found: Map<number, FramePose>, label: string) {
    let missing = 0;
    grab.current ??= document.createElement("canvas");
    for (const [i, f] of frames.entries()) {
      if (cancel.current) break;
      setBusy({ label, done: i, total: frames.length });
      await seekTo(f);
      const img = grabFrame(video.current!, grab.current);
      const p = img ? detectPose(d, img) : null;
      if (p) found.set(f, { frame: f, timeS: f / captureFps, ...p });
      else {
        found.delete(f);
        missing++;
      }
    }
    return missing;
  }

  /**
   * Analiza y autocompleta: si no hay inicio y fin, mira todo el vídeo, elige la medición que más se
   * mueve, marca dónde empieza y acaba el movimiento y lo analiza fotograma a fotograma.
   */
  async function analyze(only?: number) {
    if (!size) return;
    setPlaying(false);
    setStatus(null);
    setAuto(null);
    cancel.current = false;
    setBusy({ label: "Cargando el detector de pose…", done: 0, total: 0 });
    const found = new Map(raw);
    let show = frame;
    let d: Detector;
    try {
      d = await loadPoseDetector();
    } catch (e) {
      setStatus(`No se pudo cargar el detector de pose: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(null);
      return;

    }
    try {
      const manual = range.start !== null || range.end !== null;
      const scan = only !== undefined ? [only] : manual ? spread(range.start ?? 0, range.end ?? last, MAX_ANALYZED) : spread(0, last, SCAN_FRAMES);
      let missing = await detectFrames(d, scan, found, only !== undefined ? "Analizando el fotograma…" : manual ? "Analizando el movimiento…" : "Buscando el movimiento…");
      // Si la tarjeta gráfica no ve a nadie, se prueba con la CPU (algunos móviles fallan sin avisar).
      if (missing === scan.length && d.delegate === "GPU" && !cancel.current) {
        const cpu = await loadPoseDetector("CPU");
        const probe = scan.filter((_, i) => i % Math.ceil(scan.length / 4) === 0);
        if ((await detectFrames(cpu, probe, found, "Probando sin la tarjeta gráfica…")) < probe.length) {
          d = cpu;
          missing = await detectFrames(d, scan, found, "Repitiendo con la CPU…");
        }
      }
      if (missing === scan.length) {
        setStatus("No se detecta a ninguna persona. Comprueba que se ve el cuerpo entero y con buena luz.");
        return;
      }

      const smooth = smoothPoses([...found.values()]);
      const done: string[] = [];
      let use = cfg;
      if (!touched.current && only === undefined) {
        const pick = choosePreset(smooth.filter((p) => scan.includes(p.frame)), size);
        if (pick) {
          use = toConfig(pick.preset);
          setCfg(use);
          setPresetId(pick.preset.id);
          done.push(`medición «${pick.preset.label}»`);
        }
      }
      let peak = scan[0]!;
      const series = angleSeries(smooth.filter((p) => scan.includes(p.frame)), use, size);
      const win = only === undefined ? movementWindow(series) : null;
      if (win) {
        peak = win.peak;
        if (!manual) {
          setRange({ start: win.start, end: win.end });
          done.push(`inicio y fin (fot. ${win.start + 1} a ${win.end + 1})`);
          const dense = spread(win.start, win.end, MAX_ANALYZED).filter((f) => !found.has(f));
          missing += await detectFrames(d, dense, found, "Analizando el movimiento…");
        }
      } else if (series.length) {
        peak = series.reduce((a, b) => (b.angle > a.angle ? b : a)).frame;
      }
      setRaw(new Map(found));
      show = peak;
      if (done.length) setAuto(`Autocompletado: ${done.join(", ")}. Te dejo en el punto de máximo recorrido; puedes cambiar cualquier cosa.`);
      else if (only === undefined && !win) setAuto("No se ve un movimiento claro: marca inicio y fin a mano si hace falta.");
      if (missing > 0 && !manual) setStatus(`En ${missing} fotogramas no se detectó a la persona; esos no se miden.`);
      else if (missing > 0) setStatus(`En ${missing} de ${scan.length} fotogramas no se detectó a la persona; esos no se miden.`);
    } catch (e) {
      setRaw(new Map(found));
      setStatus(`Falló la detección de pose: ${e instanceof Error ? e.message : String(e)}. Prueba con un vídeo más corto o en otro navegador.`);
    } finally {
      // Deja el vídeo en el fotograma que se va a mostrar (el análisis lo ha movido).
      await seekTo(show).catch(() => undefined);
      setFrame(show);
      setBusy(null);
    }
  }

  // ---------- Dibujo: esqueleto, segmentos de la medición y arco con el ángulo ----------
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.round(rect.width * dpr);
    const ch = Math.round(rect.height * dpr);
    if (c.width !== cw) c.width = cw;
    if (c.height !== ch) c.height = ch;
    const g = c.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, rect.width, rect.height);
    if (!current) return;
    const px = (id: string) => {
      const p = jointPoint(current.image, id);
      return p ? { x: p.x * rect.width, y: p.y * rect.height, v: p.visibility ?? 1 } : null;
    };
    const css = getComputedStyle(c);
    const accent = css.getPropertyValue("--color-accent").trim() || "#0e6672";
    const right = css.getPropertyValue("--color-chart-right").trim() || "#b4532a";
    // Esqueleto minimalista en blanco con borde oscuro (se ve sobre cualquier fondo).
    g.lineCap = "round";
    for (const [a, b] of skeleton) {
      const p = px(a);
      const q = px(b);
      if (!p || !q || Math.min(p.v, q.v) < 0.3) continue;
      for (const [w, col] of [[5, "rgba(0,0,0,0.55)"], [2.5, "rgba(255,255,255,0.95)"]] as const) {
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(q.x, q.y);
        g.stroke();
      }
    }
    for (const id of drawnJoints) {
      const p = px(id);
      if (!p || p.v < 0.3) continue;
      g.fillStyle = "rgba(255,255,255,0.95)";
      g.strokeStyle = "rgba(0,0,0,0.6)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    // Referencia (discontinua) y segmento móvil, con el arco del ángulo en el origen del segmento.
    const m0 = px(cfg.movement.start);
    const m1 = px(cfg.movement.end);
    if (!m0 || !m1) return;
    let r0 = m0;
    let r1 = { x: m0.x, y: m0.y - 80, v: 1 };
    if (cfg.reference.type === "axial_body") {
      const s = px(cfg.reference.start);
      const e = px(cfg.reference.end);
      if (s && e) {
        r0 = s;
        r1 = e;
      }
    }
    const line = (a: { x: number; y: number }, b: { x: number; y: number }, color: string, dash: number[]) => {
      g.setLineDash(dash);
      g.strokeStyle = color;
      g.lineWidth = 3.5;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.stroke();
      g.setLineDash([]);
    };
    line(r0, r1, right, [8, 6]);
    line(m0, m1, accent, []);
    if (currentAngle === null) return;
    const ur = Math.atan2(r1.y - r0.y, r1.x - r0.x);
    const um = Math.atan2(m1.y - m0.y, m1.x - m0.x);
    let d = um - ur;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    g.strokeStyle = "#ffffff";
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(m0.x, m0.y, 34, ur, ur + d, d < 0);
    g.stroke();
    const label = `${fmt(currentAngle, 0)}°`;
    g.font = "600 16px Inter, system-ui, sans-serif";
    const tw = g.measureText(label).width;
    const lx = m0.x + 44 * Math.cos(ur + d / 2) - tw / 2;
    const ly = m0.y + 44 * Math.sin(ur + d / 2) + 6;
    g.fillStyle = "rgba(0,0,0,0.7)";
    g.fillRect(lx - 4, ly - 16, tw + 8, 22);
    g.fillStyle = "#ffffff";
    g.fillText(label, lx, ly);
  });

  // ---------- Toques: anclaje a la articulación más cercana y corrección a mano ----------
  function nearestJoint(e: PointerEvent<HTMLCanvasElement>) {
    if (!current) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    let best: { id: string; d: number } | null = null;
    for (const id of drawnJoints) {
      const p = jointPoint(current.image, id);
      if (!p) continue;
      const d = Math.hypot(p.x * rect.width - (e.clientX - rect.left), p.y * rect.height - (e.clientY - rect.top));
      if (d < SNAP_PX && (!best || d < best.d)) best = { id, d };
    }
    return best?.id ?? null;
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!tapMode) return;
    const id = nearestJoint(e);
    if (!id) {
      toast("Toca más cerca de una articulación", "danger");
      return;
    }
    if (tapMode === "correct") {
      const base = baseJoints.find((j) => j.id === id);
      if (!base) {
        toast("Ese punto es un punto medio: corrige los dos de los que sale", "danger");
        return;
      }
      drag.current = base.index;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (!pendingTap) {
      setPendingTap(id);
      return;
    }
    if (tapMode === "movement") editCfg((c) => ({ ...c, movement: { start: pendingTap, end: id } }));
    else editCfg((c) => ({ ...c, reference: { type: "axial_body", start: pendingTap, end: id } }));
    setPresetId("custom");
    setPendingTap(null);
    setTapMode(null);
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (drag.current === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const idx = drag.current;
    setOverrides((prev) => {
      const next = new Map(prev);
      const m = new Map(next.get(frame) ?? []);
      m.set(idx, { x, y });
      next.set(frame, m);
      return next;
    });
  }

  async function save() {
    if (!summary) return;
    const m: BiomechanicalMeasurement = {
      id: crypto.randomUUID(),
      patientId,
      createdAt: new Date().toISOString(),
      anatomicalPlane: cfg.plane,
      referenceType: cfg.reference.type,
      referenceVector: cfg.reference.type === "axial_body" ? { startJoint: cfg.reference.start, endJoint: cfg.reference.end } : { startJoint: "vertical", endJoint: "vertical" },
      movementVector: { startJoint: cfg.movement.start, endJoint: cfg.movement.end },
      initialAngleDegrees: summary.initial,
      maxAngleDegrees: summary.max,
      deltaAngleDegrees: summary.delta,
      keyframes,
      video: { fileName: file.name, fps: captureFps },
    };
    try {
      await saveMeasurement(getDb(), m);
      toast("Medición guardada", "success");
      navigate(`/pacientes/${patientId}/medicion-libre/${m.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "danger");
    }
  }

  const markers: Marker[] = [
    ...(range.start !== null ? [{ frame: range.start, kind: "other" as const }] : []),
    ...(range.end !== null ? [{ frame: range.end, kind: "other" as const }] : []),
  ];
  const tapHint =
    tapMode === "correct"
      ? "Arrastra una articulación del esqueleto a su sitio en este fotograma. Corrige la medición en pantalla (2D); la 3D usa la pose del modelo."
      : tapMode
        ? pendingTap
          ? `Ahora toca el otro extremo (${tapMode === "movement" ? "segmento móvil" : "referencia"}). Primero: ${jointLabel(pendingTap)}.`
          : `Toca la articulación de inicio del ${tapMode === "movement" ? "segmento móvil" : "eje de referencia"}: se ancla a la más cercana.`
        : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full overflow-hidden rounded-md bg-media-surface" style={size ? { aspectRatio: `${size.w} / ${size.h}` } : undefined}>
        <video
          ref={video}
          src={url}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setSize({ w: v.videoWidth, h: v.videoHeight });
            setFrameCount((n) => (n > 1 ? n : Math.max(1, Math.round(v.duration * 30))));
          }}
          onPause={() => setPlaying(false)}
          onError={() => setStatus("Este navegador no puede abrir el vídeo. Si el móvil graba en alta eficiencia (HEVC/H.265), desactívalo en los ajustes de la cámara y graba de nuevo.")}
          aria-label="Vídeo para la medición libre"
          className="block h-full w-full"
        />
        <canvas
          ref={canvas}
          data-testid="overlay"
          aria-hidden="true"
          className={tapMode ? "absolute inset-0 h-full w-full cursor-crosshair touch-none" : "pointer-events-none absolute inset-0 h-full w-full"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        />
      </div>
      <FrameScrubber frameCount={last + 1} frame={frame} fps={captureFps} markers={markers} onFrame={(f) => { if (busy) return; setPlaying(false); setFrame(f); }} />
      <FrameControls playing={playing} onTogglePlay={() => !busy && setPlaying((p) => !p)} onStep={(d) => { if (busy) return; setPlaying(false); setFrame((f) => Math.max(0, Math.min(last, f + d))); }} />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setRange((r) => ({ ...r, start: frame }))}>
          Inicio: {range.start === null ? "—" : `fot. ${range.start + 1}`}
        </Button>
        <Button variant="secondary" onClick={() => setRange((r) => ({ ...r, end: frame }))}>
          Fin: {range.end === null ? "—" : `fot. ${range.end + 1}`}
        </Button>
      </div>
      {busy ? (
        <div className="flex flex-col gap-2" role="status">
          <p className="text-sm text-media-muted">
            {busy.label} {busy.total > 0 && `${busy.done} / ${busy.total}`}
          </p>
          <progress className="w-full" max={busy.total || undefined} value={busy.total ? busy.done : undefined} aria-label="Progreso del análisis" />
          <Button variant="secondary" onClick={() => (cancel.current = true)}>
            Parar
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={<ScanLine aria-hidden="true" className="size-5" />} onClick={() => void analyze(frame)}>
            Este fotograma
          </Button>
          <Button icon={<Play aria-hidden="true" className="size-5" />} disabled={!size} onClick={() => void analyze()}>
            Analizar movimiento
          </Button>
        </div>
      )}
      {auto && <Alert tone="info" title="Listo">{auto}</Alert>}
      {status && <Alert tone="warning" title="Detección de pose">{status}</Alert>}

      <Card className="flex flex-col gap-3 text-text">
        <h2 className="text-lg">Qué medir</h2>
        <SelectField
          label="Medición"
          value={presetId}
          onChange={(e) => {
            setPresetId(e.target.value);
            const p = presets.find((x) => x.id === e.target.value);
            if (p) editCfg(toConfig(p));
            else touched.current = true;
          }}
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          <option value="custom">Personalizada</option>
        </SelectField>
        <SelectField label="Plano" value={cfg.plane} onChange={(e) => { setPresetId("custom"); editCfg((c) => ({ ...c, plane: e.target.value as MeasureConfig["plane"] })); }}>
          {(Object.keys(planeLabels) as (keyof typeof planeLabels)[]).map((k) => (
            <option key={k} value={k}>
              {planeLabels[k]}
            </option>
          ))}
        </SelectField>
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Referencia"
            value={cfg.reference.type}
            onChange={(e) => {
              setPresetId("custom");
              editCfg((c) => ({ ...c, reference: e.target.value === "plumb_line" ? { type: "plumb_line" } : { type: "axial_body", start: "mid_shoulder", end: "mid_hip" } }));
            }}
          >
            <option value="plumb_line">Plomada (vertical)</option>
            <option value="axial_body">Eje del cuerpo</option>
          </SelectField>
          {cfg.reference.type === "axial_body" && (
            <JointPair label="Eje" pair={cfg.reference} onChange={(start, end) => { setPresetId("custom"); editCfg((c) => ({ ...c, reference: { type: "axial_body", start, end } })); }} />
          )}
        </div>
        <JointPair label="Segmento móvil" pair={cfg.movement} onChange={(start, end) => { setPresetId("custom"); editCfg((c) => ({ ...c, movement: { start, end } })); }} />
        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant={tapMode === "reference" ? "primary" : "secondary"} icon={<Crosshair aria-hidden="true" className="size-4" />} disabled={!current} onClick={() => { setTapMode(tapMode === "reference" ? null : "reference"); setPendingTap(null); }}>
            Fijar eje
          </Button>
          <Button size="sm" variant={tapMode === "movement" ? "primary" : "secondary"} icon={<Crosshair aria-hidden="true" className="size-4" />} disabled={!current} onClick={() => { setTapMode(tapMode === "movement" ? null : "movement"); setPendingTap(null); }}>
            Segmento
          </Button>
          <Button size="sm" variant={tapMode === "correct" ? "primary" : "secondary"} icon={<Hand aria-hidden="true" className="size-4" />} disabled={!current} onClick={() => { setTapMode(tapMode === "correct" ? null : "correct"); setPendingTap(null); }}>
            Corregir
          </Button>
        </div>
        {tapHint && <p className="text-sm text-text-muted" aria-live="polite">{tapHint}</p>}
      </Card>

      {keyframes.length > 0 && summary ? (
        <Card className="flex flex-col gap-3 text-text" aria-label="Resultado">
          <div className="grid grid-cols-3 gap-2">
            <MetricCard stacked label="Inicial" value={fmt(summary.initial, 0)} unit="°" />
            <MetricCard stacked label="Máximo" value={fmt(summary.max, 0)} unit="°" />
            <MetricCard stacked label="Amplitud Δθ" value={fmt(summary.delta, 0)} unit="°" />
          </div>
          <p className="text-sm text-text-muted" data-testid="angulo-actual">
            Este fotograma: {currentAngle === null ? "sin medida" : `${fmt(currentAngle, 1)}°`} · {keyframes.length} fotogramas medidos
          </p>
          <AngleChart keyframes={keyframes} />
          <div className="grid grid-cols-2 gap-2">
            <Button icon={<Save aria-hidden="true" className="size-5" />} onClick={save}>
              Guardar
            </Button>
            <Button
              variant="secondary"
              icon={<Download aria-hidden="true" className="size-5" />}
              onClick={() =>
                download(
                  `medicion-libre-${todayDay()}.csv`,
                  reportCsv(
                    {
                      id: "",
                      patientId,
                      createdAt: new Date().toISOString(),
                      anatomicalPlane: cfg.plane,
                      referenceType: cfg.reference.type,
                      referenceVector: cfg.reference.type === "axial_body" ? { startJoint: cfg.reference.start, endJoint: cfg.reference.end } : { startJoint: "vertical", endJoint: "vertical" },
                      movementVector: { startJoint: cfg.movement.start, endJoint: cfg.movement.end },
                      initialAngleDegrees: summary.initial,
                      maxAngleDegrees: summary.max,
                      deltaAngleDegrees: summary.delta,
                      keyframes,
                      video: { fileName: file.name, fps: captureFps },
                    },
                    patientName,
                    jointLabel,
                  ),
                )
              }
            >
              Exportar reporte
            </Button>
          </div>
        </Card>
      ) : (
        current === null &&
        raw.size === 0 && (
          <p className="flex items-center gap-2 text-sm text-media-muted">
            <FlaskConical aria-hidden="true" className="size-4" /> Pulsa «Analizar movimiento»: busca el movimiento y rellena la medición. Si quieres, antes marca tú inicio y fin.
          </p>
        )
      )}
      <Button variant="secondary" onClick={onDone}>
        Cerrar este vídeo
      </Button>
    </div>
  );
}

function JointPair({ label, pair, onChange }: { label: string; pair: { start: string; end: string }; onChange: (start: string, end: string) => void }) {
  return (
    <fieldset className="col-span-2 grid grid-cols-2 gap-2">
      <legend className="sr-only">{label}</legend>
      <SelectField label={`${label}: desde`} value={pair.start} onChange={(e) => onChange(e.target.value, pair.end)}>
        {allJoints.map((j) => (
          <option key={j.id} value={j.id}>
            {j.label}
          </option>
        ))}
      </SelectField>
      <SelectField label={`${label}: hasta`} value={pair.end} onChange={(e) => onChange(pair.start, e.target.value)}>
        {allJoints.map((j) => (
          <option key={j.id} value={j.id}>
            {j.label}
          </option>
        ))}
      </SelectField>
    </fieldset>
  );
}

export function AngleChart({ keyframes }: { keyframes: KeyframeData[] }) {
  if (keyframes.length < 2) return null;
  const data = keyframes.map((k) => ({ t: Number(k.timestampSeconds.toFixed(3)), a: Number(k.angleDegrees.toFixed(1)) }));
  const tick = { fill: "var(--color-text-muted)", fontSize: 12 };
  return (
    <figure aria-label="Ángulo a lo largo del movimiento" className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 14, left: -16 }}>
          <CartesianGrid stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => fmt(Number(v), 1)} tick={tick} stroke="var(--color-border)" label={{ value: "Tiempo (s)", position: "insideBottom", offset: -6, fill: "var(--color-text-muted)", fontSize: 12 }} />
          <YAxis unit="°" tick={tick} stroke="var(--color-border)" />
          <Tooltip formatter={(v) => [`${fmt(Number(v), 1)}°`, "Ángulo"]} labelFormatter={(v) => `${fmt(Number(v), 2)} s`} itemStyle={{ color: "var(--color-text)" }} />
          <Line type="monotone" dataKey="a" name="Ángulo" stroke="var(--color-chart-primary)" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}
