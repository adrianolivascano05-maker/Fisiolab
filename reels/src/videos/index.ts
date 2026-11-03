import { kemp } from "./kemp";
import { lasegue } from "./lasegue";
import { palpacion } from "./palpacion";
import { sacroiliaca } from "./sacroiliaca";
import { tendon } from "./tendon";
import { VideoDef } from "./types";

/** Vídeos listos: palpación, Kemp, Lasègue y tendón. (La sacroilíaca queda aparcada.) */
export const VIDEOS: VideoDef[] = [palpacion, kemp, lasegue, tendon, sacroiliaca];
