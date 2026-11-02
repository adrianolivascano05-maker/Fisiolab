import { SceneProps } from "../../timeline";
import { VideoDef } from "../types";
import { META, SCENES, SceneId } from "./config";
import { sceneCues } from "./cues";
import { Cta } from "./scenes/Cta";
import { Datos } from "./scenes/Datos";
import { Gancho } from "./scenes/Gancho";
import { Giro } from "./scenes/Giro";
import { Hallazgo } from "./scenes/Hallazgo";
import { Matiz } from "./scenes/Matiz";
import { Prueba } from "./scenes/Prueba";
import { QueHacer } from "./scenes/QueHacer";
import { Quiz } from "./scenes/Quiz";

export const lasegue: VideoDef = {
  meta: META,
  folder: "lasegue",
  scenes: SCENES,
  components: { gancho: Gancho, prueba: Prueba, datos: Datos, quiz: Quiz, hallazgo: Hallazgo, giro: Giro, matiz: Matiz, quehacer: QueHacer, cta: Cta } satisfies Record<SceneId, React.FC<SceneProps>>,
  cues: sceneCues,
  sourceScenes: ["prueba", "matiz"],
  dataScene: "hallazgo",
  tints: { prueba: "#0FA3B1", datos: "#0A58CA", quiz: "#0A58CA", hallazgo: "#12A37A", giro: "#0FA3B1", matiz: "#D7263D", cta: "#0FA3B1" },
  saveScene: "quehacer",
};
