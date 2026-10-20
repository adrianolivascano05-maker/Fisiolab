// El equipo de la clínica para el horario y para elegir con quién es una cita (src/data/schedule.ts). Sin clínica,
// vacío: la app trabaja como siempre, sin equipo.
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
import { listStaff, type Staff } from "../data/schedule";

export function useStaff(): Staff[] {
  const cloud = useCloud();
  const inClinic = !!cloud?.clinic;
  const staff = useAsync(async () => (inClinic ? listStaff(getDb()) : []), [inClinic]);
  return staff.data ?? [];
}

/** El nombre con que sale alguien del equipo (o su correo, si ya no está). */
export const staffName = (staff: Staff[], email: string | null) => (email ? (staff.find((s) => s.email === email)?.name ?? email) : "Sin asignar");
