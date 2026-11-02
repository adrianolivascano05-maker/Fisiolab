import { kemp } from "./kemp";
import { lasegue } from "./lasegue";
import { palpacion } from "./palpacion";
import { sacroiliaca } from "./sacroiliaca";
import { VideoDef } from "./types";

/** Orden de publicación: 1 palpación, 2 Kemp, 3 Lasègue. (La sacroilíaca queda aparcada.) */
export const VIDEOS: VideoDef[] = [palpacion, kemp, lasegue, sacroiliaca];
