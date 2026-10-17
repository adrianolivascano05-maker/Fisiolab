import init001 from "./migrations/001_init.sql?raw";
import rom002 from "./migrations/002_rom.sql?raw";
import type { Migration } from "./engine";

export const migrations: Migration[] = [
  { version: 1, sql: init001 },
  { version: 2, sql: rom002 },
];
