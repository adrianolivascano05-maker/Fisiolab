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
import appointments013 from "./migrations/013_appointments.sql?raw";
import clinicMember014 from "./migrations/014_clinic_member.sql?raw";
import schedule015 from "./migrations/015_schedule.sql?raw";
import editors016 from "./migrations/016_editors.sql?raw";
import deltas017 from "./migrations/017_deltas.sql?raw";
import reminders018 from "./migrations/018_reminders.sql?raw";
import billing019 from "./migrations/019_billing.sql?raw";
import waitlist020 from "./migrations/020_waitlist.sql?raw";
import exercises021 from "./migrations/021_exercises.sql?raw";
import waitlistPrefs022 from "./migrations/022_waitlist_prefs.sql?raw";
import exerciseVideo023 from "./migrations/023_exercise_video.sql?raw";
import patientForms024 from "./migrations/024_patient_forms.sql?raw";
import patientDni025 from "./migrations/025_patient_dni.sql?raw";
import outbox026 from "./migrations/026_outbox.sql?raw";
import booking027 from "./migrations/027_booking.sql?raw";
import invoices028 from "./migrations/028_invoices.sql?raw";
import closures029 from "./migrations/029_closures.sql?raw";
import invoiceRef030 from "./migrations/030_invoice_ref.sql?raw";
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
  { version: 13, sql: appointments013 },
  { version: 14, sql: clinicMember014 },
  { version: 15, sql: schedule015 },
  { version: 16, sql: editors016 },
  { version: 17, sql: deltas017 },
  { version: 18, sql: reminders018 },
  { version: 19, sql: billing019 },
  { version: 20, sql: waitlist020 },
  { version: 21, sql: exercises021 },
  { version: 22, sql: waitlistPrefs022 },
  { version: 23, sql: exerciseVideo023 },
  { version: 24, sql: patientForms024 },
  { version: 25, sql: patientDni025 },
  { version: 26, sql: outbox026 },
  { version: 27, sql: booking027 },
  { version: 28, sql: invoices028 },
  { version: 29, sql: closures029 },
  { version: 30, sql: invoiceRef030 },
];
