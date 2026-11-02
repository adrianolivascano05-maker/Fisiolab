import { SceneProps } from "../../timeline";
import { VideoDef } from "../types";
import { META, SCENES, SceneId } from "./config";
import { sceneCues } from "./cues";
import { Cta } from "./scenes/Cta";
import { Datos } from "./scenes/Datos";
import { Gancho } from "./scenes/Gancho";
import { Giro } from "./scenes/Giro";
import { Matiz } from "./scenes/Matiz";
import { Prueba } from "./scenes/Prueba";
import { QueHacer } from "./scenes/QueHacer";
import { Quiz } from "./scenes/Quiz";

export const kemp: VideoDef = {
  meta: META,
  folder: "kemp",
  scenes: SCENES,
  components: { gancho: Gancho, prueba: Prueba, datos: Datos, quiz: Quiz, giro: Giro, matiz: Matiz, quehacer: QueHacer, cta: Cta } satisfies Record<SceneId, React.FC<SceneProps>>,
  cues: sceneCues,
  sourceScenes: ["prueba", "matiz"],
  dataScene: "datos",
  tints: { prueba: "#4FD1FF", datos: "#FF8A3D", quiz: "#7B61FF", giro: "#FF4D5E", matiz: "#3DDC97", cta: "#4FD1FF" },
  saveScene: "quehacer",
};
