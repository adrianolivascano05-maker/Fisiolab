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
  tints: { prueba: "#4FD1FF", quiz: "#7B61FF", hallazgo: "#FF8A3D", giro: "#FF4D5E", matiz: "#3DDC97", cta: "#4FD1FF" },
  saveScene: "quehacer",
};
