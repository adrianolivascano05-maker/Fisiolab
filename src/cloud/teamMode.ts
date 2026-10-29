// Fisio independiente o clínica con equipo. Las dos son una «clínica» en el servidor (src/cloud/clinic.ts); la que es
// de una sola persona («por mi cuenta») no enseña lo de equipo: turnos, con quién es cada cita, el filtro del equipo ni
// las cuentas por persona. Se guarda en los ajustes de la clínica (se sincroniza con sus dispositivos) y se puede pasar
// a clínica con equipo en cualquier momento (Ajustes → Mi consulta), sin perder nada.
import { useEffect } from "react";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getSetting, setSetting } from "../data/repo";
import { useCloud } from "./cloudContext";

export type ClinicMode = "solo" | "team";
const CLINIC_MODE_KEY = "clinic_mode";
const PENDING_KEY = "fisiolab.newClinicMode";

/** Al dar de alta una clínica: lo que se eligió, para guardarlo en su base cuando se abra (aún no existe). */
export function setPendingMode(clinicId: string, mode: ClinicMode) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({ clinicId, mode }));
  } catch {
    /* sin almacenamiento: queda como clínica con equipo, que se puede cambiar en Ajustes */
  }
}

function takePending(clinicId: string): ClinicMode | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null") as { clinicId: string; mode: ClinicMode } | null;
    if (!p || p.clinicId !== clinicId) return null;
    localStorage.removeItem(PENDING_KEY);
    return p.mode;
  } catch {
    return null;
  }
}

export async function setClinicMode(mode: ClinicMode): Promise<void> {
  await setSetting(getDb(), CLINIC_MODE_KEY, mode);
  bumpData();
}

/** Sin clínica (en local): ni equipo ni «por mi cuenta». En una clínica: con equipo salvo que se haya elegido lo otro. */
export function useTeamMode(): { inClinic: boolean; solo: boolean; team: boolean } {
  const cloud = useCloud();
  const clinicId = cloud?.clinic?.id ?? null;
  const version = useDataVersion();
  const mode = useAsync(async () => (clinicId ? ((await getSetting<ClinicMode>(getDb(), CLINIC_MODE_KEY)) ?? null) : null), [clinicId, version]);
  useEffect(() => {
    if (!clinicId || mode.loading || mode.data) return;
    const pending = takePending(clinicId);
    if (pending) void setClinicMode(pending);
  }, [clinicId, mode.loading, mode.data]);
  const inClinic = !!clinicId;
  const solo = inClinic && mode.data === "solo";
  return { inClinic, solo, team: inClinic && !solo };
}
