// El equipo de la clínica para el horario y para elegir con quién es una cita (src/data/schedule.ts). Sin clínica,
// o en la de un fisio que trabaja por su cuenta (src/cloud/teamMode.ts), vacío: la app trabaja sin equipo.
import { useAsync } from "../app/useAsync";
import { useTeamMode } from "../cloud/teamMode";
import { getDb } from "../data/db";
import { listStaff, type Staff } from "../data/schedule";

export function useStaff(): Staff[] {
  const { team } = useTeamMode();
  const staff = useAsync(async () => (team ? listStaff(getDb()) : []), [team], { tables: ["members"] });
  return staff.data ?? [];
}

/** El nombre con que sale alguien del equipo (o su correo, si ya no está). */
export const staffName = (staff: Staff[], email: string | null) => (email ? (staff.find((s) => s.email === email)?.name ?? email) : "Sin asignar");
