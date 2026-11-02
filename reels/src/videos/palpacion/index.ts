import { SceneProps } from "../../timeline";
import { VideoDef } from "../types";
import { META, SCENES, SceneId } from "./config";
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

export const palpacion: VideoDef = {
  meta: META,
  folder: "palpacion",
  scenes: SCENES,
  components: { gancho: Gancho, prueba: Prueba, estudio: Estudio, quiz: Quiz, hallazgo: Hallazgo, giro: Giro, matiz: Matiz, quehacer: QueHacer, cta: Cta } satisfies Record<SceneId, React.FC<SceneProps>>,
  cues: sceneCues,
  /** Escenas con etiqueta de fuente (de la primera a la última, ambas incluidas) */
  sourceScenes: ["estudio", "quehacer"],
  /** Escena en la que la música hace el hueco de silencio antes del dato */
  dataScene: "hallazgo",
  tints: { prueba: "#0FA3B1", quiz: "#0A58CA", hallazgo: "#0A58CA", giro: "#D7263D", matiz: "#12A37A", cta: "#0FA3B1" },
  saveScene: "quehacer",
};
