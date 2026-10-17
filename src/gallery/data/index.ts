// Todas las regiones juntas. Un archivo por región; el orden de presentación está en ../regions.ts.
import type { SpecialTest } from "../types";
import { atmTests } from "./atm";
import { caderaTests } from "./cadera";
import { cervicalTests } from "./cervical";
import { codoTests } from "./codo";
import { dorsalTests } from "./dorsal";
import { hombroTests } from "./hombro";
import { lumbarTests } from "./lumbar";
import { munecaManoTests } from "./muneca_mano";
import { rodillaTests } from "./rodilla";
import { sacroiliacaTests } from "./sacroiliaca";
import { tobilloPieTests } from "./tobillo_pie";

export const tests: SpecialTest[] = [
  ...atmTests,
  ...cervicalTests,
  ...hombroTests,
  ...codoTests,
  ...munecaManoTests,
  ...dorsalTests,
  ...lumbarTests,
  ...sacroiliacaTests,
  ...caderaTests,
  ...rodillaTests,
  ...tobilloPieTests,
];
