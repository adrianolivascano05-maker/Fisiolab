// Lo común a todas las pantallas de la ficha de un paciente: «‹ Pacientes» y «Editar» arriba, su cabecera (iniciales,
// nombre, datos, el motivo de consulta que se está viendo y la próxima cita, o «Dar cita») y las pestañas, que se
// quedan fijas arriba al bajar.
import { CalendarCheck, CalendarPlus, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { fmt } from "../app/format";
import { Page } from "../app/Page";
import { rememberPatient } from "../app/recent";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/CloudGate";
import { useDataVersion } from "../app/dataVersion";
import { nextAppointmentOf } from "../data/appointments";
import { euros, patientAccount } from "../data/billing";
import { editText, lastEditOfPatient } from "../data/editors";
import { getDb } from "../data/db";
import { ageOn } from "../data/privacy";
import type { Patient } from "../data/repo";
import { fmtVisit } from "./calendar";
import { AppointmentSheet } from "./AppointmentSheet";
import { EpisodePicker } from "./EpisodePicker";
import { PatientNav } from "./parts";

export function PatientShell({ patient, id, tabs = true, children }: { patient: Patient | null | undefined; id: string; tabs?: boolean; children: ReactNode }) {
  useEffect(() => rememberPatient(id), [id]);
  const visit = useAsync(() => nextAppointmentOf(getDb(), id), [id]);
  // En una clínica, quién tocó la ficha por última vez.
  const team = !!useCloud()?.clinic;
  const edit = useAsync(async () => (team ? lastEditOfPatient(getDb(), id) : null), [id, team]);
  const [managing, setManaging] = useState(false);
  const version = useDataVersion();
  const owes = useAsync(async () => {
    const a = await patientAccount(getDb(), id, new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }));
    return a.balanceCents > 0 ? a.balanceCents : 0;
  }, [id, version]);
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
      width="record"
      action={
        patient && (
          <Link to={`/pacientes/${id}/editar`} aria-label="Editar datos" className="tap inline-flex items-center rounded-md px-2 font-semibold text-accent hover:bg-surface">
            Editar
          </Link>
        )
      }
      header={
        // En ancho (el ordenador), el nombre a la izquierda y los chips a la derecha, en una fila.
        <div className="flex flex-col gap-2 @2xl:flex-row @2xl:items-end @2xl:justify-between @2xl:gap-4">
          <div className="flex min-w-0 flex-col">
            <h1 className="text-[1.75rem] leading-tight font-bold break-words">{name}</h1>
            {patient && <p className="text-sm text-text-muted">{facts.length ? facts.join(" · ") : "Sin más datos"}</p>}
            {edit.data && <p className="text-xs text-text-muted">Última modificación: {editText(edit.data)}</p>}
          </div>
          {/* Una fila de chips: el motivo que se ve, la próxima cita (o darla) y lo que debe. Añadir al calendario, dentro de la cita. */}
          <div className="flex flex-wrap items-center gap-2 @2xl:shrink-0 @2xl:justify-end">
            {patient && <EpisodePicker patientId={id} />}
            {visit.data ? (
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => setManaging(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-accent-soft px-3 text-sm font-semibold text-accent hover:bg-surface"
              >
                <CalendarCheck aria-hidden="true" className="size-4" /> Próxima cita: {fmtVisit(visit.data.startsAt)}
              </button>
            ) : (
              patient &&
              visit.data === null && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setManaging(true)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border bg-bg px-3 text-sm font-semibold text-accent hover:bg-surface"
                >
                  <CalendarPlus aria-hidden="true" className="size-4" /> Dar cita
                </button>
              )
            )}
            {owes.data ? (
              <Link
                to={`/pacientes/${id}/cobros`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-warning bg-warning-soft px-3 text-sm font-semibold hover:border-accent"
              >
                <Wallet aria-hidden="true" className="size-4" /> Debe {euros(owes.data)}
              </Link>
            ) : null}
          </div>
          {patient && <AppointmentSheet open={managing} onClose={() => setManaging(false)} patientId={id} patientName={patient.name} appointment={visit.data ?? null} />}
        </div>
      }
    >
      <PatientNav id={id} />
      {children}
    </Page>
  );
}
