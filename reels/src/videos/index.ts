import { kemp } from "./kemp";
import { lasegue } from "./lasegue";
import { palpacion } from "./palpacion";
import { sacroiliaca } from "./sacroiliaca";
import { carpiano } from "./carpiano";
import { tendon } from "./tendon";
import { VideoDef } from "./types";

/** Vídeos listos: palpación, Kemp, Lasègue, tendón y túnel carpiano. (La sacroilíaca queda aparcada.) */
export const VIDEOS: VideoDef[] = [palpacion, kemp, lasegue, tendon, carpiano, sacroiliaca];
