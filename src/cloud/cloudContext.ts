// La cuenta y la sincronización que ve toda la app (`useCloud`), y los estados de la sincronización y del calendario.
// Quien las crea es CloudGate.tsx; aquí solo está lo que importan las pantallas, para no cargar con ellas las de entrada.
import { createContext, useContext, useEffect, useState } from "react";
import { type Account } from "./account";
import { type Clinic, type ClinicApi } from "./clinic";
import { type CloudConfig } from "./config";
import { CalendarSync, type CalendarState } from "./googleCalendar";
import { SyncController, type SyncState } from "./sync";

/** El texto de un error, para enseñarlo. */
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type Cloud = {
  config: CloudConfig;
  account: Account;
  /** La clínica en la que se trabaja (con el servidor de Cloudflare); null con Google Drive. */
  clinic: Clinic | null;
  /** Lo que se pide al servidor sobre clínicas y equipo; null con Google Drive. */
  clinics: ClinicApi | null;
  /** Quien ha entrado gestiona el servidor: ve Ajustes → Proveedor. */
  operator: boolean;
  /**
   * Se está dejando la clínica (borrada, cambio de clínica, cerrar sesión): lo que trabaja en segundo plano (los
   * formularios) no vuelve a llamar al servidor, que ya puede contestar que la clínica no existe.
   */
  closing?: boolean;
  /** Ir a la pantalla de elegir clínica (los datos de esta se quedan en el dispositivo). */
  switchClinic: () => Promise<void>;
  /** La clínica ha cambiado de nombre, o quien ha entrado de papel: se recuerda y se vuelve a pintar la pantalla. */
  updateClinic: (c: Clinic) => void;
  /** Dejar la clínica en este dispositivo: se borran de aquí sus datos y se vuelve a elegir clínica, con `notice`. */
  leaveClinic: (notice: string) => Promise<void>;
  sync: SyncController;
  /** Las citas en Google Calendar: después de cada sincronización. */
  calendar: CalendarSync;
  /** Volver a entrar con Google (ir y volver): para cuando el token ha caducado. */
  reconnect: () => void;
  /** Cerrar sesión. `wipe`: borrar también los datos de esta cuenta en el dispositivo (la nube no se toca). */
  logout: (wipe: boolean) => Promise<void>;
  /** Enseñar los datos que han llegado de otro dispositivo (vuelve a cargar la pantalla). */
  showNewData: () => void;
};

export const CloudContext = createContext<Cloud | null>(null);

/** La cuenta y la sincronización, o null si la app funciona sin nube. */
export function useCloud() {
  return useContext(CloudContext);
}

export function useCalendarState(): CalendarState | null {
  const cloud = useCloud();
  const [state, setState] = useState(cloud?.calendar.current ?? null);
  useEffect(() => cloud?.calendar.subscribe(setState), [cloud]);
  return state;
}

export function useSyncState(): SyncState | null {
  const cloud = useCloud();
  const [state, setState] = useState(cloud?.sync.current ?? null);
  useEffect(() => cloud?.sync.subscribe(setState), [cloud]);
  return state;
}
