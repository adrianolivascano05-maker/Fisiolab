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
  tints: { prueba: "#0FA3B1", datos: "#0A58CA", quiz: "#0A58CA", giro: "#D7263D", matiz: "#12A37A", cta: "#0FA3B1" },
  saveScene: "quehacer",
};
