import init001 from "./migrations/001_init.sql?raw";
import rom002 from "./migrations/002_rom.sql?raw";
import wellness003 from "./migrations/003_wellness.sql?raw";
import phase4004 from "./migrations/004_phase4.sql?raw";
import validation005 from "./migrations/005_validation.sql?raw";
import clinical006 from "./migrations/006_clinical.sql?raw";
import nextVisit007 from "./migrations/007_next_visit.sql?raw";
import sync008 from "./migrations/008_sync.sql?raw";
import privacy009 from "./migrations/009_privacy.sql?raw";
import episodes010 from "./migrations/010_episodes.sql?raw";
import consents011 from "./migrations/011_consents.sql?raw";
import contactFree012 from "./migrations/012_contact_free.sql?raw";
import type { Migration } from "./engine";

export const migrations: Migration[] = [
  { version: 1, sql: init001 },
  { version: 2, sql: rom002 },
  { version: 3, sql: wellness003 },
  { version: 4, sql: phase4004 },
  { version: 5, sql: validation005 },
  { version: 6, sql: clinical006 },
  { version: 7, sql: nextVisit007 },
  { version: 8, sql: sync008 },
  { version: 9, sql: privacy009 },
  { version: 10, sql: episodes010 },
  { version: 11, sql: consents011 },
  { version: 12, sql: contactFree012 },
];
