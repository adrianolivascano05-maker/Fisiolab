// La reserva online en segundo plano: con la app abierta en una clínica que la tiene encendida, publica las franjas
// libres cuando cambia la agenda (unos segundos después, para juntar cambios) y cada dos minutos (y al volver a la
// app) recoge las reservas y las anulaciones nuevas y avisa. Con el servidor, además, pone al día los enlaces para
// anular de las citas que se mueven o se anulan. Sin servidor, nada.
import { useEffect, useRef } from "react";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { logError } from "../app/errorLog";
import { useCloud } from "../cloud/CloudGate";
import { useTeamMode } from "../cloud/teamMode";
import { getDb, type Db } from "../data/db";
import { listWaitlist } from "../data/waitlist";
import { useAppLock } from "../privacy/AppLock";
import { dayText, hourText } from "../schedule/reminders";
import { useToast } from "../ui/Toast";
import { getBookingSettings } from "./settings";
import { collectBookings, publishBooking, syncCancelLinks } from "./sync";

const EVERY_MS = 120_000;
const HOUR = 3_600_000;

/** Si hay citas por venir con enlace para anular (el paciente puede anularlas desde su móvil). */
const hasCancelLinks = async (db: Db) =>
  (await db.query<{ n: number }>("select count(*) as n from appointments where cancel_token is not null and status = 'scheduled' and starts_at > ?", [new Date().toISOString()]))[0]!.n > 0;

export function BookingSync() {
  const cloud = useCloud();
  const toast = useToast();
  const version = useDataVersion();
  const { team } = useTeamMode();
  const { locked } = useAppLock();
  const active = !!cloud?.clinic && !!cloud.clinics && !locked;
  const latest = useRef({ cloud, team, toast });
  latest.current = { cloud, team, toast };
  /** Cuándo se publicó la página por última vez: con la app abierta, se vuelve a publicar cada hora (los días vista avanzan). */
  const publishedAt = useRef(0);

  // Publicar: al cambiar los datos (la agenda, los turnos o los ajustes), unos segundos después.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => {
      const { cloud: c, team: tm } = latest.current;
      if (!navigator.onLine) return;
      void getBookingSettings(getDb())
        .then((s) => (s.enabled ? publishBooking(getDb(), c, tm) : "off"))
        .then((r) => {
          if (r !== "off") publishedAt.current = Date.now();
        })
        .catch((e) => logError("reserva online (publicar)", e));
      // Los enlaces para anular: la hora nueva si se ha movido una cita, o anulada si la ha anulado la clínica.
      void syncCancelLinks(getDb(), c, tm).catch((e) => logError("enlaces para anular", e));
    }, 3000);
    return () => clearTimeout(t);
  }, [active, version]);

  // Recoger reservas y anulaciones.
  useEffect(() => {
    if (!active) return;
    let busy = false;
    const run = async () => {
      if (busy || document.visibilityState !== "visible" || !navigator.onLine) return;
      busy = true;
      try {
        // Con la reserva apagada, solo si hay citas con enlace para anular (de los recordatorios) que vigilar.
        const db = getDb();
        const enabled = (await getBookingSettings(db)).enabled;
        if (!enabled && !(await hasCancelLinks(db))) return;
        if (enabled && Date.now() - publishedAt.current > HOUR) {
          await publishBooking(db, latest.current.cloud, latest.current.team);
          publishedAt.current = Date.now();
        }
        const got = await collectBookings(db, latest.current.cloud);
        if (!got) return;
        for (const b of got.booked)
          latest.current.toast(
            `Nueva reserva por internet: ${b.name}, ${dayText(b.startsAt)} a las ${hourText(b.startsAt)}${b.clash ? `. Ojo: se solapa con la cita de ${b.clash}` : ""}`,
            b.clash ? "danger" : "success",
          );
        if (got.unreadable)
          latest.current.toast(
            got.unreadable === 1
              ? "Ha llegado una reserva que no se puede abrir y se ha descartado (puede ser falsa). Si alguien dice que reservó y no le ves, llámale."
              : `Han llegado ${got.unreadable} reservas que no se pueden abrir y se han descartado (pueden ser falsas).`,
            "danger",
          );
        if (got.cancelled.length) {
          // Un hueco libre: buen momento para mirar la lista de espera.
          const waiting = (await listWaitlist(db)).length;
          const tail = waiting ? `. Tienes ${waiting === 1 ? "1 paciente" : `${waiting} pacientes`} en la lista de espera` : "";
          for (const c of got.cancelled) latest.current.toast(`${c.name || "Un paciente"} ha anulado su cita del ${dayText(c.startsAt)} a las ${hourText(c.startsAt)}${tail}`);
        }
        if (got.booked.length || got.cancelled.length) bumpData();
      } catch (e) {
        logError("reserva online (recoger)", e);
      } finally {
        busy = false;
      }
    };
    const first = setTimeout(run, 4000);
    const every = setInterval(run, EVERY_MS);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("online", run);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("online", run);
    };
  }, [active]);
  return null;
}
