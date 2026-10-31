import { CalculateMetadataFunction, Composition, Folder, Still, staticFile } from "remotion";
import { FPS, HEIGHT, META, SCENES, Timings, WIDTH } from "./config";
import { Portada } from "./Portada";
import { Reel, ReelProps, SceneSolo } from "./Reel";
import { buildTimeline } from "./timeline";

const FALLBACK: Timings = { source: "estimado", voiceDuration: 0, sentences: [], tail: 1.6 };

/** Lee los tiempos de la voz (public/voz/timings.json) y comprueba si existe la voz. */
const loadTimings = async (): Promise<ReelProps> => {
  const res = await fetch(staticFile("voz/timings.json"));
  const timings = (await res.json()) as Timings;
  let hasVoice = false;
  try {
    const v = await fetch(staticFile("voz/voz.wav"), { method: "HEAD" });
    hasVoice = v.ok;
  } catch {
    hasVoice = false;
  }
  return { timings, hasVoice };
};

const calculateReel: CalculateMetadataFunction<ReelProps> = async () => {
  const props = await loadTimings();
  const { total } = buildTimeline(props.timings);
  return { props, durationInFrames: total, defaultOutName: "reel-palpacion-l4" };
};

const calculateScene =
  (sceneId: (typeof SCENES)[number]["id"]): CalculateMetadataFunction<ReelProps & { sceneId: typeof sceneId }> =>
  async () => {
    const props = await loadTimings();
    const { scenes } = buildTimeline(props.timings);
    const c = scenes.find((s) => s.id === sceneId)!;
    return { props: { ...props, sceneId }, durationInFrames: c.dur };
  };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id={META.id}
      component={Reel}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={300}
      defaultProps={{ timings: FALLBACK, hasVoice: false }}
      calculateMetadata={calculateReel}
    />
    <Folder name="Escenas">
      {SCENES.map((s) => (
        <Composition
          key={s.id}
          id={`Escena-${s.id}`}
          component={SceneSolo}
          width={WIDTH}
          height={HEIGHT}
          fps={FPS}
          durationInFrames={60}
          defaultProps={{ timings: FALLBACK, hasVoice: false, sceneId: s.id }}
          calculateMetadata={calculateScene(s.id)}
        />
      ))}
    </Folder>
    <Still id="Portada" component={Portada} width={WIDTH} height={HEIGHT} />
  </>
);
