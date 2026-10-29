// Cómo va la sincronización en una frase (`syncText`) y el aviso arriba de cada pantalla cuando hay algo que hacer:
// datos nuevos de otro dispositivo, una cita doble, lo que otro cambió a la vez o la contraseña de cifrado.
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useAsync } from "../app/useAsync";
import { fmtDateTime } from "../app/format";
import { doubleBookingsFromOthers } from "../data/appointments";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { KeyPrompt } from "./EncryptionParts";
import { type SyncState } from "./sync";
import { useCloud, useSyncState } from "./cloudContext";

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
};

/** «de tu Drive», «del servidor de la clínica». */
export const deWhere = (where: string) => (where.startsWith("el ") ? `del ${where.slice(3)}` : `de ${where}`);

/** Cómo va la sincronización, en una frase. */
export function syncText(s: SyncState): string {
  switch (s.status) {
    case "syncing":
      return "Sincronizando…";
    case "needs-auth":
      return s.pending ? "Hay cambios sin subir: vuelve a entrar con Google." : "Sin sincronizar: vuelve a entrar con Google.";
    case "needs-key":
      return `La copia ${deWhere(s.where)} está cifrada: escribe su contraseña para sincronizar.`;
    case "needs-password":
      return `La copia ${deWhere(s.where)} va siempre cifrada: elige una contraseña de cifrado para sincronizar.`;
    case "offline":
      return s.pending ? "Sin conexión: los cambios se subirán al volver la conexión." : "Sin conexión.";
    case "error":
      return `No se pudo sincronizar: ${s.error}`;
    default:
      return s.pending ? "Cambios pendientes de subir." : s.lastSyncAt ? `Guardado en ${s.where} ${ago(s.lastSyncAt)}.` : "Aún sin sincronizar.";
  }
}

/**
 * Aviso arriba de cada pantalla cuando hay algo que hacer: ver datos nuevos, lo que otro ha cambiado a la vez o la
 * contraseña de cifrado. Lo que impide sincronizar (error, sesión caducada) va en la ventana flotante (SyncFloat.tsx).
 */
export function SyncNotice() {
  return (
    <>
      <DoubleBookingNotice />
      <SyncNoticeRow />
    </>
  );
}

const SEEN_DOUBLES = "cenit.citas-dobles-vistas";
/** AAAA-MM-DD en la hora del dispositivo, como la agenda (src/schedule/layout.ts, dayOf). */
const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const seenDoubles = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_DOUBLES) ?? "[]") as string[];
  } catch {
    return [];
  }
};

/**
 * Cita doble llegada al sincronizar (src/data/appointments.ts, doubleBookingsFromOthers): dos personas han dado la
 * misma hora a la vez en dos dispositivos. Sale hasta que se ve o se pulsa «Entendido».
 */
function DoubleBookingNotice() {
  const cloud = useCloud();
  const s = useSyncState();
  const found = useAsync(() => (cloud ? doubleBookingsFromOthers(getDb()) : Promise.resolve([])), [cloud, s?.lastSyncAt]);
  const [seen, setSeen] = useState(seenDoubles);
  const list = (found.data ?? []).filter((d) => !seen.includes(d.key));
  const d = list[0];
  if (!d) return null;
  const done = () => {
    const next = [...seen, ...list.map((x) => x.key)].slice(-200);
    try {
      localStorage.setItem(SEEN_DOUBLES, JSON.stringify(next));
    } catch {
      /* sin almacenamiento: vuelve a salir la próxima vez */
    }
    setSeen(next);
  };
  const when = fmtDateTime(d.first.startsAt);
  const text = d.who
    ? `${d.who} tiene dos citas a la vez (${when}): ${d.first.name} y ${d.second.name}.`
    : d.first.patientId === d.second.patientId
      ? `${d.first.name} tiene dos citas a la vez (${when}).`
      : `Hay dos citas a la vez (${when}): ${d.first.name} y ${d.second.name}.`;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm">
      <span>
        <span className="font-semibold">Cita doble. </span>
        {text} Se han dado a la vez en dos dispositivos.
        {list.length > 1 && ` Y ${list.length - 1 === 1 ? "otra más" : `${list.length - 1} más`}.`}
      </span>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/agenda?dia=${localDay(d.first.startsAt)}`}
          onClick={done}
          className="tap inline-flex items-center rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
        >
          Ver en la agenda
        </Link>
        <Button size="sm" variant="secondary" onClick={done}>
          Entendido
        </Button>
      </div>
    </div>
  );
}

function SyncNoticeRow() {
  const cloud = useCloud();
  const s = useSyncState();
  if (!cloud || !s) return null;
  const row = (text: string, action?: ReactNode) => (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
      <span>{text}</span>
      {action}
    </div>
  );
  if (s.overwritten?.length)
    return (
      <div role="status" className="flex flex-col gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm">
        <span>
          Otra persona ha cambiado a la vez lo mismo que acababas de guardar; se ha quedado su versión, y la tuya está guardada: {s.overwritten.join("; ")}.
        </span>
        <div className="flex flex-wrap gap-2">
          {s.newData && (
            <Button size="sm" onClick={cloud.showNewData}>
              Mostrar
            </Button>
          )}
          <Link
            to="/ajustes/sustituidos"
            onClick={() => cloud.sync.seenOverwritten()}
            className="tap inline-flex items-center rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
          >
            Ver y recuperar lo mío
          </Link>
          <Button size="sm" variant="secondary" onClick={() => cloud.sync.seenOverwritten()}>
            Entendido
          </Button>
        </div>
      </div>
    );
  if (s.newData)
    return row(
      "Hay datos nuevos de otro dispositivo.",
      <Button size="sm" onClick={cloud.showNewData}>
        Mostrar
      </Button>,
    );
  if (s.status === "needs-key") return row(syncText(s), <KeyPrompt size="sm" />);
  if (s.status === "needs-password")
    return row(
      syncText(s),
      <Link to="/ajustes/cuenta" className="tap inline-flex items-center rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover">
        Elegir contraseña
      </Link>,
    );
  return null;
}
