import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Background } from "./components/Background";
import { Progress } from "./components/Engage";
import { SourceTag } from "./components/SourceTag";
import { Subtitles } from "./components/Subtitles";
import { FPS, Timings } from "./config";
import { sceneCues } from "./cues";
import { Cta } from "./scenes/Cta";
import { Estudio } from "./scenes/Estudio";
import { Gancho } from "./scenes/Gancho";
import { Giro } from "./scenes/Giro";
import { Hallazgo } from "./scenes/Hallazgo";
import { Matiz } from "./scenes/Matiz";
import { Prueba } from "./scenes/Prueba";
import { QueHacer } from "./scenes/QueHacer";
import { Quiz } from "./scenes/Quiz";
import { SceneProps } from "./scenes/types";
import { fontFamily } from "./theme";
import { buildTimeline, SceneClock } from "./timeline";

export type ReelProps = { timings: Timings; hasVoice: boolean };

const COMPONENTS: Record<SceneClock["id"], React.FC<SceneProps>> = {
  gancho: Gancho,
  prueba: Prueba,
  estudio: Estudio,
  quiz: Quiz,
  hallazgo: Hallazgo,
  giro: Giro,
  matiz: Matiz,
  quehacer: QueHacer,
  cta: Cta,
};

const Sfx: React.FC<{ at: number; file: string; vol?: number }> = ({ at, file, vol = 1 }) =>
  at < 0 ? null : (
    <Sequence from={at} layout="none">
      <Audio src={staticFile(`sfx/${file}.wav`)} volume={vol} />
    </Sequence>
  );

/** Ducking: la base baja mientras habla la voz. */
const duck = (t: Timings) => (f: number) => {
  const sec = f / FPS;
  let k = 0;
  for (const s of t.sentences) {
    const d = sec < s.start - 0.1 ? s.start - 0.1 - sec : sec > s.end + 0.25 ? sec - s.end - 0.25 : 0;
    k = Math.max(k, Math.max(0, 1 - d / 0.35));
  }
  return 0.34 - 0.2 * k;
};

export const Reel: React.FC<ReelProps> = ({ timings, hasVoice }) => {
  const frame = useCurrentFrame();
  const { scenes, total } = buildTimeline(timings);
  const hallazgo = scenes.find((s) => s.id === "hallazgo")!;
  const riserAt = hallazgo.from + hallazgo.s[0].start - Math.round(0.9 * FPS) - Math.round(1.6 * FPS) + Math.round(0.35 * FPS);
  const dataFrom = scenes.find((s) => s.id === "estudio")!.from;
  const dataTo = scenes.find((s) => s.id === "quehacer")!.from;
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background />
      {scenes.map((c) => {
        const Comp = COMPONENTS[c.id];
        return (
          <Sequence key={c.id} name={c.id} from={c.from} durationInFrames={c.dur} layout="none">
            <Comp c={c} />
          </Sequence>
        );
      })}
      <Subtitles timings={timings} />
      <Progress scenes={scenes} frame={frame} />
      <SourceTag from={dataFrom} to={dataTo} />
      <SourceTag from={total - Math.round(2.2 * FPS)} to={total} />

      {/* Sonido */}
      {hasVoice ? <Audio src={staticFile("voz/voz.wav")} volume={1} /> : null}
      <Audio src={staticFile("sfx/music.wav")} volume={duck(timings)} />
      {scenes.slice(1).map((c) => (
        <Sfx key={`w${c.id}`} at={c.from - 4} file="whoosh" vol={0.55} />
      ))}
      {scenes.flatMap((c) => sceneCues(c).map((q, i) => <Sfx key={`${c.id}${i}`} at={c.from + q.at} file={q.file} vol={(q.vol ?? 1) * 0.8} />))}
      <Sfx at={riserAt} file="riser" vol={0.5} />
    </AbsoluteFill>
  );
};

/** Una escena suelta (para previsualizarla en Studio) con el mismo audio y subtítulos. */
export const SceneSolo: React.FC<ReelProps & { sceneId: SceneClock["id"] }> = ({ sceneId, ...props }) => {
  const { scenes } = buildTimeline(props.timings);
  const c = scenes.find((s) => s.id === sceneId)!;
  return (
    <Sequence from={-c.from} layout="none">
      <Reel {...props} />
    </Sequence>
  );
};
