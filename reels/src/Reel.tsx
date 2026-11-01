import { Audio } from "@remotion/media";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Background } from "./components/Background";
import { Progress } from "./components/Engage";
import { SourceTag } from "./components/SourceTag";
import { Subtitles } from "./components/Subtitles";
import { FPS, Timings } from "./config";
import { fontFamily } from "./theme";
import { buildTimeline } from "./timeline";
import { VideoDef } from "./videos/types";

export type ReelProps = { timings: Timings; hasVoice: boolean };

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
  return 0.3 - 0.19 * k;
};

/** Crea la composición de un reel a partir de su definición (escenas, efectos, assets). */
export const makeReel = (video: VideoDef): React.FC<ReelProps> => {
  const Reel: React.FC<ReelProps> = ({ timings, hasVoice }) => {
    const frame = useCurrentFrame();
    const { scenes, total } = buildTimeline(video.scenes, timings);
    const data = scenes.find((s) => s.id === video.dataScene)!;
    const riserAt = data.from + data.s[0].start - Math.round(0.9 * FPS) - Math.round(1.6 * FPS) + Math.round(0.35 * FPS);
    const dataFrom = scenes.find((s) => s.id === video.sourceScenes[0])!.from;
    const last = scenes.find((s) => s.id === video.sourceScenes[1])!;
    const dataTo = last.from + last.dur;
    return (
      <AbsoluteFill style={{ fontFamily }}>
        <Background />
        {scenes.map((c) => {
          const Comp = video.components[c.id];
          return (
            <Sequence key={c.id} name={c.id} from={c.from} durationInFrames={c.dur} layout="none">
              <Comp c={c} />
            </Sequence>
          );
        })}
        <Subtitles scenes={video.scenes} timings={timings} />
        <Progress scenes={scenes} frame={frame} dataScene={video.dataScene} />
        <SourceTag from={dataFrom} to={dataTo} text={video.meta.fuente} />
        <SourceTag from={total - Math.round(2.2 * FPS)} to={total} text={video.meta.fuente} />

        {/* Sonido */}
        {hasVoice ? <Audio src={staticFile(`${video.folder}/voz/voz.wav`)} volume={0.9} /> : null}
        <Audio src={staticFile(`${video.folder}/music.wav`)} volume={duck(timings)} />
        {scenes.slice(1).map((c) => (
          <Sfx key={`w${c.id}`} at={c.from - 4} file="whoosh" vol={0.45} />
        ))}
        {scenes.flatMap((c) => video.cues(c).map((q, i) => <Sfx key={`${c.id}${i}`} at={c.from + q.at} file={q.file} vol={(q.vol ?? 1) * 0.65} />))}
        <Sfx at={riserAt} file="riser" vol={0.4} />
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
