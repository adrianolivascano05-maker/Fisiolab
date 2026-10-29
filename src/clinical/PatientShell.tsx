// Lo común a todas las pantallas de la ficha de un paciente: «‹ Pacientes» (o «‹ Lista de espera», si se llegó desde
// ella) y «Editar» arriba, su cabecera (iniciales, nombre, datos, el motivo de consulta que se está viendo, quién lo
// lleva, la próxima cita o «Dar cita», WhatsApp y lo que debe) y las pestañas, que se quedan fijas arriba al bajar.
import { todayDay } from "../app/dates";
import { CalendarCheck, CalendarPlus, MessageCircle, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { fmt } from "../app/format";
import { Page } from "../app/Page";
import { rememberPatient } from "../app/recent";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/cloudContext";
import { useDataVersion } from "../app/dataVersion";
import { nextAppointmentOf } from "../data/appointments";
import { euros, patientAccount } from "../data/billing";
import { editText, lastEditOfPatient } from "../data/editors";
import { getDb } from "../data/db";
import { ageOn, mayMessage } from "../data/privacy";
import type { Patient } from "../data/repo";
import { fmtVisit } from "./calendar";
import { AppointmentSheet } from "./AppointmentSheet";
import { EpisodePicker } from "./EpisodePicker";
import { PatientPhysios } from "./PatientPhysios";
import { PatientNav } from "./parts";
import { useLeaveWaitlist } from "../schedule/LeaveWaitlist";
import { waPhone, whatsappUrl } from "../schedule/reminders";

export function PatientShell({ patient, id, tabs = true, children }: { patient: Patient | null | undefined; id: string; tabs?: boolean; children: ReactNode }) {
  useEffect(() => rememberPatient(id), [id]);
  const visit = useAsync(() => nextAppointmentOf(getDb(), id), [id]);
  // En una clínica, quién tocó la ficha por última vez.
  const team = !!useCloud()?.clinic;
  const edit = useAsync(async () => (team ? lastEditOfPatient(getDb(), id) : null), [id, team]);
  const [managing, setManaging] = useState(false);
  const leave = useLeaveWaitlist();
  // Desde la lista de espera, «‹» vuelve a ella con sus filtros.
  const from = (useLocation().state as { from?: string } | null)?.from;
  const fromWaitlist = typeof from === "string" && from.startsWith("/agenda/espera") ? from : null;
  const wa = patient && mayMessage(patient.privacy.consents?.contact) ? waPhone(patient.phone) : null;
  const version = useDataVersion();
  const owes = useAsync(async () => {
    const a = await patientAccount(getDb(), id, todayDay());
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
      ]
        .filter((f): f is string => !!f)
        // Cada dato entero en su línea: «172 cm», no «172» y «cm» en dos.
        .map((f) => f.replace(/ /g, "\u00a0"))
    : [];
  return (
    <Page
      title={name}
      backTo={fromWaitlist ?? "/"}
      backLabel={fromWaitlist ? "Lista de espera" : undefined}
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
        // En ancho (el ordenador), el nombre a la izquierda y los chips a la derecha, en una fila. El nombre guarda
        // siempre su sitio (16 rem): si los chips no caben, bajan a otra línea en vez de estrecharlo letra a letra.
        <div className="flex flex-col gap-2 @2xl:flex-row @2xl:items-end @2xl:justify-between @2xl:gap-4">
          <div className="flex min-w-0 flex-col @2xl:min-w-64">
            <h1 className="text-[1.75rem] leading-tight font-bold break-words">{name}</h1>
            {patient && <p className="text-sm text-text-muted">{facts.length ? facts.join(" · ") : "Sin más datos"}</p>}
            {edit.data && <p className="text-xs text-text-muted">Última modificación: {editText(edit.data)}</p>}
          </div>
          {/* Una fila de chips: el motivo que se ve, la próxima cita (o darla) y lo que debe. Añadir al calendario, dentro de la cita. */}
          <div className="flex flex-wrap items-center gap-2 @2xl:justify-end">
            {patient && <EpisodePicker patientId={id} />}
            {/* En una clínica con equipo: quién lo lleva (para el filtro «Fisio» de la lista). */}
            {patient && <PatientPhysios patientId={id} />}
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
            {wa && (
              <a
                href={whatsappUrl(wa, "")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border bg-bg px-3 text-sm font-semibold text-accent hover:bg-surface"
              >
                <MessageCircle aria-hidden="true" className="size-4" /> WhatsApp
              </a>
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
          {patient && (
            <AppointmentSheet
              open={managing}
              onClose={() => setManaging(false)}
              patientId={id}
              patientName={patient.name}
              appointment={visit.data ?? null}
              onCreated={(pid) => void leave.ask(pid)}
            />
          )}
          {leave.sheet}
        </div>
      }
    >
      <PatientNav id={id} />
      {children}
    </Page>
  );
}
