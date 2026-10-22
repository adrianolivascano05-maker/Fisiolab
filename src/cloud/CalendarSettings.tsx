// Ajustes → Cuenta de Google → Google Calendar: apuntar solas las citas en el calendario «Cénit · Citas» (googleCalendar.ts).
import { CalendarCheck, CalendarX, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { fmtDateTime } from "../app/format";
import { getDb } from "../data/db";
import { CALENDAR_SCOPE, hasGranted, wantCalendar } from "./auth";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField } from "../ui/Field";
import { useCalendarState, useCloud } from "./CloudGate";
import { CALENDAR_NAME, getCalendarSettings, saveCalendarSettings, type CalendarSettings as Settings, type CalendarState } from "./googleCalendar";

/** Con la cuenta de Google: si las citas se apuntan solas (y no hace falta ofrecer el enlace o el .ics). */
export function useAutoCalendar(): boolean {
  const s = useCalendarState();
  return !!s && s.status !== "off" && s.status !== "no-permission";
}

function statusText(s: CalendarState): string {
  switch (s.status) {
    case "off":
      return "Las citas no se apuntan solas.";
    case "no-permission":
      return "Falta el permiso de Google Calendar.";
    case "working":
      return "Apuntando las citas…";
    case "error":
      return `No se pudieron apuntar las citas: ${s.error}`;
    default:
      return s.lastAt
        ? `${s.upcoming === 1 ? "La próxima cita está" : `Las próximas citas (${s.upcoming}) están`} en el calendario «${CALENDAR_NAME}». Revisado: ${fmtDateTime(s.lastAt)}.`
        : `Las citas se apuntarán en el calendario «${CALENDAR_NAME}».`;
  }
}

export function CalendarSettings() {
  const cloud = useCloud();
  const s = useCalendarState();
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    void getCalendarSettings(getDb()).then(setSettings);
  }, []);
  if (!cloud || !s || !settings) return null;

  const save = async (next: Settings) => {
    setSettings(next);
    await saveCalendarSettings(getDb(), next);
    void cloud.calendar.run();
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-calendario">
      <h2 id="h-calendario" className="text-lg">
        Google Calendar
      </h2>
      <Card className="flex flex-col gap-3">
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-accent"
            checked={settings.enabled}
            onChange={async (e) => {
              const enabled = e.target.checked;
              await save({ ...settings, enabled });
              // El permiso del calendario se pide ahora, al activarlo: se va a Google y se vuelve aquí.
              if (enabled && !hasGranted(CALENDAR_SCOPE)) {
                wantCalendar(true);
                cloud.reconnect();
              }
            }}
          />
          <span>Apuntar solas las citas en mi Google Calendar</span>
        </label>
        <p role="status" className="flex items-start gap-2 text-sm">
          {s.status === "off" || s.status === "no-permission" || s.status === "error" ? (
            <CalendarX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
          ) : (
            <CalendarCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          )}
          {statusText(s)}
        </p>
        {s.status === "error" && s.fix && (
          <a href={s.fix} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-accent underline underline-offset-2">
            Activar la API de Google Calendar
          </a>
        )}
        {s.status === "no-permission" && settings.enabled && (
          <Button
            onClick={() => {
              wantCalendar(true);
              cloud.reconnect();
            }}
          >
            Dar el permiso de Google Calendar
          </Button>
        )}
        {settings.enabled && s.status !== "no-permission" && (
          <>
            <SelectField label="En el evento sale" value={settings.names} onChange={(e) => void save({ ...settings, names: e.target.value as Settings["names"] })}>
              <option value="initials">Solo sus iniciales</option>
              <option value="full">El nombre del paciente</option>
            </SelectField>
            <Button variant="secondary" icon={<RefreshCw aria-hidden="true" className="size-5" />} loading={s.status === "working"} onClick={() => void cloud.calendar.run(true)}>
              Apuntar ahora
            </Button>
          </>
        )}
        <p className="text-sm text-text-muted">
          Cada siguiente cita que pongas al guardar una sesión aparece en el calendario «{CALENDAR_NAME}», y se cambia o se quita si la cambias. La app
          solo puede tocar ese calendario, no los tuyos. El evento lleva el nombre (o las iniciales) y la hora, nada de su historia clínica. Si lo
          desactivas, las citas ya apuntadas se quedan: puedes borrar el calendario entero desde Google Calendar.
        </p>
      </Card>
    </section>
  );
}
