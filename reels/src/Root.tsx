import { CalculateMetadataFunction, Composition, Folder, Still, staticFile } from "remotion";
import { FPS, HEIGHT, Timings, WIDTH } from "./config";
import { Portada } from "./Portada";
import { makeReel, makeSceneSolo, ReelProps } from "./Reel";
import { buildTimeline } from "./timeline";
import { VIDEOS } from "./videos";
import { VideoDef } from "./videos/types";

const FALLBACK: Timings = { source: "estimado", voiceDuration: 0, sentences: [], tail: 1.8 };

/** Lee los tiempos de la voz (public/<video>/voz/timings.json) y comprueba si existe la voz. */
const loadTimings = async (video: VideoDef): Promise<ReelProps> => {
  const res = await fetch(staticFile(`${video.folder}/voz/timings.json`));
  const timings = (await res.json()) as Timings;
  let hasVoice = false;
  try {
    const v = await fetch(staticFile(`${video.folder}/voz/voz.wav`), { method: "HEAD" });
    hasVoice = v.ok;
  } catch {
    hasVoice = false;
  }
  return { timings, hasVoice };
};

const VideoCompositions: React.FC<{ video: VideoDef }> = ({ video }) => {
  const Reel = makeReel(video);
  const SceneSolo = makeSceneSolo(video, Reel);
  const calculateReel: CalculateMetadataFunction<ReelProps> = async () => {
    const props = await loadTimings(video);
    const { total } = buildTimeline(video.scenes, props.timings);
    return { props, durationInFrames: total, defaultOutName: `reel-${video.folder}` };
  };
  const calculateScene =
    (sceneId: string): CalculateMetadataFunction<ReelProps & { sceneId: string }> =>
    async () => {
      const props = await loadTimings(video);
      const { scenes } = buildTimeline(video.scenes, props.timings);
      const c = scenes.find((s) => s.id === sceneId)!;
      return { props: { ...props, sceneId }, durationInFrames: c.dur };
    };
  return (
    <Folder name={video.meta.id}>
      <Composition id={video.meta.id} component={Reel} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={300} defaultProps={{ timings: FALLBACK, hasVoice: false }} calculateMetadata={calculateReel} />
      <Still id={`${video.meta.id}-Portada`} component={Portada} width={WIDTH} height={HEIGHT} defaultProps={{ meta: video.meta }} />
      <Folder name="Escenas">
        {video.scenes.map((s) => (
          <Composition key={s.id} id={`${video.meta.id}-${s.id}`} component={SceneSolo} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={60} defaultProps={{ timings: FALLBACK, hasVoice: false, sceneId: s.id }} calculateMetadata={calculateScene(s.id)} />
        ))}
      </Folder>
    </Folder>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    {VIDEOS.map((v) => (
      <VideoCompositions key={v.meta.id} video={v} />
    ))}
  </>
);
