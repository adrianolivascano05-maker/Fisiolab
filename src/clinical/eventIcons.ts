// El icono de cada tipo de evento del calendario del paciente (src/data/patientEvents.ts): en el calendario, en su hoja y
// en el Resumen de la ficha.
import { CalendarDays, Dumbbell, Hospital, Plane, ScanLine, Stethoscope, Trophy, type LucideIcon } from "lucide-react";
import type { EventKind } from "../data/patientEvents";

export const KIND_ICON: Record<EventKind, LucideIcon> = {
  surgery: Hospital,
  medical: Stethoscope,
  test: ScanLine,
  training: Dumbbell,
  competition: Trophy,
  travel: Plane,
  other: CalendarDays,
};
