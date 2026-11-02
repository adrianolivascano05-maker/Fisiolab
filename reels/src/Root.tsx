import { CalculateMetadataFunction, Composition, Folder, Still, staticFile } from "remotion";
import { FPS, HEIGHT, Timings, WIDTH } from "./config";
import { Portada } from "./Portada";
import { makeReel, makeSceneSolo, ReelProps } from "./Reel";
import { buildTimeline } from "./timeline";
import { VIDEOS } from "./videos";
import { VideoDef } from "./videos/types";

const FALLBACK: Timings = { source: "estimado", voiceDuration: 0, sentences: [], tail: 1.8 };

const exists = async (path: string) => {
  try {
    return (await fetch(staticFile(path), { method: "HEAD" })).ok;
  } catch {
    return false;
  }
};

/** Lee los tiempos (public/<video>/voz/timings.json), elige la voz (recortada si existe) y busca clips reales por escena. */
const loadTimings = async (video: VideoDef): Promise<ReelProps> => {
  const res = await fetch(staticFile(`${video.folder}/voz/timings.json`));
  const timings = (await res.json()) as Timings;
  const voiceFile = (await exists(`${video.folder}/voz/voz_tight.wav`)) ? "voz_tight.wav" : (await exists(`${video.folder}/voz/voz.wav`)) ? "voz.wav" : null;
  const broll: string[] = [];
  for (const s of video.scenes) if (await exists(`${video.folder}/broll/${s.id}.mp4`)) broll.push(s.id);
  return { timings, voiceFile, broll };
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
      <Composition id={video.meta.id} component={Reel} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={300} defaultProps={{ timings: FALLBACK, voiceFile: null, broll: [] }} calculateMetadata={calculateReel} />
      <Still id={`${video.meta.id}-Portada`} component={Portada} width={WIDTH} height={HEIGHT} defaultProps={{ meta: video.meta }} />
      <Folder name="Escenas">
        {video.scenes.map((s) => (
          <Composition key={s.id} id={`${video.meta.id}-${s.id}`} component={SceneSolo} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={60} defaultProps={{ timings: FALLBACK, voiceFile: null, broll: [], sceneId: s.id }} calculateMetadata={calculateScene(s.id)} />
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
