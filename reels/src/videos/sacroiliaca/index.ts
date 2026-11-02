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

export const sacroiliaca: VideoDef = {
  meta: META,
  folder: "sacroiliaca",
  scenes: SCENES,
  components: { gancho: Gancho, prueba: Prueba, estudio: Estudio, quiz: Quiz, hallazgo: Hallazgo, giro: Giro, matiz: Matiz, quehacer: QueHacer, cta: Cta } satisfies Record<SceneId, React.FC<SceneProps>>,
  cues: sceneCues,
  sourceScenes: ["prueba", "matiz"],
  dataScene: "hallazgo",
  tints: { prueba: "#D7263D", quiz: "#0A58CA", hallazgo: "#0A58CA", giro: "#D7263D", matiz: "#12A37A", cta: "#0FA3B1" },
  saveScene: "quehacer",
};
