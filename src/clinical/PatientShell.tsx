// Lo común a todas las pantallas de la ficha de un paciente: «‹ Pacientes» y «Editar» arriba, su cabecera (iniciales,
// nombre, datos, el motivo de consulta que se está viendo y la próxima cita, o «Dar cita») y las pestañas, que se
// quedan fijas arriba al bajar.
import { CalendarCheck, CalendarPlus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { fmt } from "../app/format";
import { Page } from "../app/Page";
import { rememberPatient } from "../app/recent";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/CloudGate";
import { nextAppointmentOf } from "../data/appointments";
import { editText, lastEditOfPatient } from "../data/editors";
import { getDb } from "../data/db";
import { ageOn } from "../data/privacy";
import type { Patient } from "../data/repo";
import { useAutoCalendar } from "../cloud/CalendarSettings";
import { initials } from "../ui/ListItem";
import { fmtVisit, visitEvent } from "./calendar";
import { AppointmentSheet } from "./AppointmentSheet";
import { CalendarButton } from "./CalendarButton";
import { EpisodePicker } from "./EpisodePicker";
import { PatientNav } from "./parts";

export function PatientShell({ patient, id, tabs = true, children }: { patient: Patient | null | undefined; id: string; tabs?: boolean; children: ReactNode }) {
  useEffect(() => rememberPatient(id), [id]);
  const visit = useAsync(() => nextAppointmentOf(getDb(), id), [id]);
  // En una clínica, quién tocó la ficha por última vez.
  const team = !!useCloud()?.clinic;
  const edit = useAsync(async () => (team ? lastEditOfPatient(getDb(), id) : null), [id, team]);
  const [managing, setManaging] = useState(false);
  // Con Google Calendar conectado la cita ya está en el calendario; si no, el botón para pasarla.
  const autoCalendar = useAutoCalendar();
  const event = visit.data && patient ? visitEvent({ id: visit.data.id, nextAt: visit.data.startsAt, nextMinutes: visit.data.minutes }, patient) : null;
  const name = patient?.name ?? "Paciente";
  const years = patient ? ageOn(patient.birthDate) : null;
  const facts = patient
    ? [
        years !== null && `${years} años`,
        patient.phone,
        patient.bodyMassKg && `${fmt(patient.bodyMassKg)} kg`,
        patient.heightCm && `${fmt(patient.heightCm, 0)} cm`,
      ].filter(Boolean)
    : [];
  return (
    <Page
      title={name}
      backTo="/"
      tabs={tabs}
      action={
        patient && (
          <Link to={`/pacientes/${id}/editar`} className="tap inline-flex items-center rounded-md px-2 font-semibold text-accent hover:bg-surface">
            Editar
          </Link>
        )
      }
      header={
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
              {initials(name)}
            </span>
            <div className="flex min-w-0 flex-col">
              <h1 className="text-[1.75rem] leading-tight font-bold break-words">{name}</h1>
              {patient && <p className="text-sm text-text-muted">{facts.length ? facts.join(" · ") : "Sin más datos"}</p>}
              {edit.data && <p className="text-xs text-text-muted">Última modificación: {editText(edit.data)}</p>}
            </div>
          </div>
          {patient && <EpisodePicker patientId={id} />}
          {visit.data ? (
            <div className="flex flex-wrap items-center gap-x-2">
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setManaging(true)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-accent-soft px-3 text-sm font-semibold text-accent hover:bg-surface"
              >
                <CalendarCheck aria-hidden="true" className="size-4" /> Próxima cita: {fmtVisit(visit.data.startsAt)}
              </button>
              {autoCalendar ? (
                <span className="text-xs text-text-muted">Apuntada en tu Google Calendar</span>
              ) : (
                event && <CalendarButton event={event} compact />
              )}
            </div>
          ) : (
            patient &&
            visit.data === null && (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setManaging(true)}
                className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-pill border border-border bg-bg px-3 text-sm font-semibold text-accent hover:bg-surface"
              >
                <CalendarPlus aria-hidden="true" className="size-4" /> Dar cita
              </button>
            )
          )}
          {patient && <AppointmentSheet open={managing} onClose={() => setManaging(false)} patientId={id} patientName={patient.name} appointment={visit.data ?? null} />}
        </div>
      }
    >
      <PatientNav id={id} />
      {children}
    </Page>
  );
}
