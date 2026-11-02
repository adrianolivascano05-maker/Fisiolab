import { SceneDef, VideoMeta } from "../config";
import { SceneClock, SceneProps } from "../timeline";

export type Cue = { at: number; file: string; vol?: number };

/** Todo lo que define un reel: metadatos, guion, escenas, efectos y carpeta de assets en public/. */
export type VideoDef = {
  meta: VideoMeta;
  /** Carpeta en public/<folder>/ con voz/ y music.wav */
  folder: string;
  scenes: SceneDef[];
  components: Record<string, React.FC<SceneProps>>;
  cues: (c: SceneClock) => Cue[];
  sourceScenes: [string, string];
  dataScene: string;
  /** Color de «beat» por escena (tinte de fondo y fogonazo en el corte). */
  tints?: Record<string, string>;
  /** Escena en la que aparece el aviso de «guárdalo». */
  saveScene?: string;
};

export type { SceneProps };
