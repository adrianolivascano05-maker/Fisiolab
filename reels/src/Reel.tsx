import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Background } from "./components/Background";
import { Progress } from "./components/Engage";
import { Camera, ColdOpen, Countdown, SaveNudge } from "./components/Overlays";
import { SourceTag } from "./components/SourceTag";
import { Subtitles } from "./components/Subtitles";
import { FPS, Timings } from "./config";
import { fontFamily } from "./theme";
import { buildTimeline } from "./timeline";
import { VideoDef } from "./videos/types";

export type ReelProps = { timings: Timings; voiceFile: string | null; broll: string[] };

const Sfx: React.FC<{ at: number; file: string; vol?: number }> = ({ at, file, vol = 1 }) =>
  at < 0 ? null : (
    <Sequence from={at} layout="none">
      <Audio src={staticFile(`sfx/${file}.wav`)} volume={vol} />
    </Sequence>
  );

type Q = { at: number; file: string; vol: number };
const PRIORITY = ["impact", "xray", "riser", "ding", "error", "whoosh", "pop", "click"];
const MIN_GAP = Math.round(0.3 * FPS);

/** Deja como mucho un efecto cada 0,3 s: primero los importantes (impacto, rayos X...), luego el resto si cabe. */
const spaceOut = (cues: Q[]): Q[] => {
  const kept: Q[] = [];
  for (const file of PRIORITY) {
    for (const q of cues.filter((c) => c.file === file).sort((a, b) => a.at - b.at)) {
      if (q.at < 0) continue;
      if (kept.every((k) => Math.abs(k.at - q.at) >= MIN_GAP)) kept.push(q);
    }
  }
  return kept.sort((a, b) => a.at - b.at);
};

/** Ducking: la base baja mientras habla la voz. */
const duck = (t: Timings) => (f: number) => {
  const sec = f / FPS;
  let k = 0;
  for (const s of t.sentences) {
    const d = sec < s.start - 0.1 ? s.start - 0.1 - sec : sec > s.end + 0.25 ? sec - s.end - 0.25 : 0;
    k = Math.max(k, Math.max(0, 1 - d / 0.35));
  }
  return 0.3 - 0.19 * k;
};

/** Crea la composición de un reel a partir de su definición (escenas, efectos, assets). */
export const makeReel = (video: VideoDef): React.FC<ReelProps> => {
  const Reel: React.FC<ReelProps> = ({ timings, voiceFile, broll }) => {
    const frame = useCurrentFrame();
    const { scenes, total } = buildTimeline(video.scenes, timings);
    const intro = Math.round((timings.intro ?? 0) * FPS);
    const data = scenes.find((s) => s.id === video.dataScene)!;
    const dataAt = data.from + data.s[0].start;
    const riserAt = dataAt - Math.round(0.9 * FPS) - Math.round(1.6 * FPS) + Math.round(0.35 * FPS);
    const dataFrom = scenes.find((s) => s.id === video.sourceScenes[0])!.from;
    const last = scenes.find((s) => s.id === video.sourceScenes[1])!;
    const dataTo = last.from + last.dur;
    const outroLen = Math.round(0.5 * FPS);
    const save = video.saveScene ? scenes.find((s) => s.id === video.saveScene) : undefined;
    return (
      <AbsoluteFill style={{ fontFamily }}>
        <Camera scenes={scenes} tints={video.tints}>
          <Background />
          {/* Clips reales (B-roll) por escena, si existen en public/<video>/broll/<escena>.mp4 */}
          {scenes
            .filter((c) => broll.includes(c.id))
            .map((c) => (
              <Sequence key={`b${c.id}`} from={c.from} durationInFrames={c.dur} layout="none">
                <AbsoluteFill style={{ opacity: 0.55 }}>
                  <Video src={staticFile(`${video.folder}/broll/${c.id}.mp4`)} muted loop objectFit="cover" style={{ width: "100%", height: "100%" }} />
                  <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(5,12,26,0.6) 0%, rgba(5,12,26,0.2) 40%, rgba(5,12,26,0.85) 100%)" }} />
                </AbsoluteFill>
              </Sequence>
            ))}
          {scenes.map((c) => {
            const Comp = video.components[c.id];
            return (
              <Sequence key={c.id} name={c.id} from={c.from} durationInFrames={c.dur} layout="none">
                <Comp c={c} />
              </Sequence>
            );
          })}
        </Camera>
        <Subtitles scenes={video.scenes} timings={timings} />
        <Progress scenes={scenes} frame={frame} dataScene={video.dataScene} />
        <SourceTag from={dataFrom} to={dataTo} text={video.meta.fuente} />
        <SourceTag from={total - outroLen - Math.round(1.5 * FPS)} to={total - outroLen} text={video.meta.fuente} />
        {save ? <SaveNudge at={save.from + 4} /> : null}
        <Countdown at={dataAt} />
        {/* Cold open al principio y vuelta al mismo fotograma al final (bucle) */}
        <ColdOpen meta={video.meta} from={0} dur={intro} />
        <ColdOpen meta={video.meta} from={total - outroLen} dur={outroLen} outro />

        {/* Sonido: la voz manda; los efectos pasan por un filtro de cadencia (ninguno a menos de 0,3 s de otro) */}
        {voiceFile ? <Audio src={staticFile(`${video.folder}/voz/${voiceFile}`)} volume={0.9} /> : null}
        <Audio src={staticFile(`${video.folder}/music.wav`)} volume={duck(timings)} />
        {spaceOut([
          { at: 0, file: "impact", vol: 0.6 },
          { at: Math.max(0, intro - 4), file: "whoosh", vol: 0.5 },
          ...scenes.slice(1).map((c) => ({ at: c.from - 4, file: "whoosh", vol: 0.45 })),
          ...scenes.flatMap((c) => video.cues(c).map((q) => ({ at: c.from + q.at, file: q.file, vol: (q.vol ?? 1) * 0.65 }))),
          { at: riserAt, file: "riser", vol: 0.4 },
          ...[0, 1, 2].map((i) => ({ at: dataAt - Math.round(0.9 * FPS) + i * 6, file: "click", vol: 0.6 })),
          ...(save ? [{ at: save.from + 4, file: "pop", vol: 0.5 }] : []),
          { at: total - outroLen, file: "whoosh", vol: 0.4 },
        ]).map((q, i) => (
          <Sfx key={`sfx${i}`} at={q.at} file={q.file} vol={q.vol} />
        ))}
      </AbsoluteFill>
    );
  };
  return Reel;
};

/** Una escena suelta (para previsualizarla en Studio) con el mismo audio y subtítulos. */
export const makeSceneSolo = (video: VideoDef, Reel: React.FC<ReelProps>): React.FC<ReelProps & { sceneId: string }> => {
  const SceneSolo: React.FC<ReelProps & { sceneId: string }> = ({ sceneId, ...props }) => {
    const { scenes } = buildTimeline(video.scenes, props.timings);
    const c = scenes.find((s) => s.id === sceneId)!;
    return (
      <Sequence from={-c.from} layout="none">
        <Reel {...props} />
      </Sequence>
    );
  };
  return SceneSolo;
};
