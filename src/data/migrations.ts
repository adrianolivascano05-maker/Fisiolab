import init001 from "./migrations/001_init.sql?raw";
import rom002 from "./migrations/002_rom.sql?raw";
import wellness003 from "./migrations/003_wellness.sql?raw";
import phase4004 from "./migrations/004_phase4.sql?raw";
import validation005 from "./migrations/005_validation.sql?raw";
import clinical006 from "./migrations/006_clinical.sql?raw";
import type { Migration } from "./engine";

export const migrations: Migration[] = [
  { version: 1, sql: init001 },
  { version: 2, sql: rom002 },
  { version: 3, sql: wellness003 },
  { version: 4, sql: phase4004 },
  { version: 5, sql: validation005 },
  { version: 6, sql: clinical006 },
];
