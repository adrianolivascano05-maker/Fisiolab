// Lo común a todas las pantallas de la ficha de un paciente: «‹ Pacientes» (o «‹ Lista de espera», si se llegó desde
// ella) y «Editar» arriba, su cabecera (iniciales, nombre, datos, el motivo de consulta que se está viendo, quién lo
// lleva, la próxima cita o «Dar cita», WhatsApp y lo que debe) y las pestañas, que se quedan fijas arriba al bajar.
// Compacta (docs/rediseno-sencilla.md, bloque 1): lo que se usa poco (teléfono, peso, estatura) va en «Más datos».
import { todayDay } from "../app/dates";
import { CalendarCheck, CalendarPlus, Ellipsis, MessageCircle, Wallet } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { PatientAside, useWideScreen } from "./PatientAside";
import { Link, useLocation, useNavigate } from "react-router";
import { fmt } from "../app/format";
import { Page } from "../app/Page";
import { rememberPatient } from "../app/recent";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/cloudContext";
import { useDataVersion } from "../app/dataVersion";
import { nextAppointmentOf } from "../data/appointments";
import { euros, patientAccount } from "../data/billing";
import { editText, lastEditOfPatient } from "../data/editors";
import { logAccess } from "../data/accessLog";
import { getDb } from "../data/db";
import { ageOn, mayMessage } from "../data/privacy";
import type { Patient } from "../data/repo";
import { fmtVisit } from "./calendar";
import { AppointmentSheet } from "./AppointmentSheet";
import { EpisodePicker } from "./EpisodePicker";
import { PatientPhysios } from "./PatientPhysios";
import { PatientNav } from "./parts";
import { PrecautionsNote } from "./PrecautionsNote";
import { useLeaveWaitlist } from "../schedule/LeaveWaitlist";
import { waPhone, whatsappUrl } from "../schedule/reminders";
import { sessionCount } from "../data/clinical";
import { Sheet } from "../ui/Sheet";

/** Las cinco pestañas de la ficha, en orden (las mismas de PatientNav), para pasar de una a otra deslizando el dedo. */
const TABS = ["", "/anamnesis", "/valoracion", "/sesiones", "/calendario"];

/**
 * Pasar de pestaña deslizando el dedo de lado. No se mete donde el dedo ya hace otra cosa: campos, dibujos (canvas),
 * hojas, lo que se desliza de lado por su cuenta (`data-swipe`, o con scroll horizontal) y los controles de arrastre.
 */
function useTabSwipe(id: string) {
  const navigate = useNavigate();
  const { pathname, state } = useLocation();
  const from = useRef<{ x: number; y: number; t: number } | null>(null);
  const base = `/pacientes/${id}`;
  const at = TABS.indexOf(pathname.replace(/\/$/, "").slice(base.length));
  return {
    start: (e: TouchEvent) => {
      from.current = null;
      if (at < 0 || e.touches.length !== 1) return;
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, canvas, dialog, [data-swipe], [draggable=true], [role=slider]")) return;
      for (let n: HTMLElement | null = el; n && n !== e.currentTarget; n = n.parentElement) if (n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== "visible") return;
      from.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY, t: Date.now() };
    },
    end: (e: TouchEvent) => {
      const a = from.current;
      from.current = null;
      const b = e.changedTouches[0];
      if (!a || !b) return;
      const dx = b.clientX - a.x;
      const dy = b.clientY - a.y;
      if (Math.abs(dx) < 70 || Math.abs(dx) < 2.5 * Math.abs(dy) || Date.now() - a.t > 600) return;
      const next = at + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < TABS.length) navigate(base + TABS[next], { state });
    },
  };
}

export function PatientShell({ patient, id, tabs = true, children }: { patient: Patient | null | undefined; id: string; tabs?: boolean; children: ReactNode }) {
  useEffect(() => rememberPatient(id), [id]);
  // Registro de accesos (src/data/accessLog.ts): quién abrió la ficha, una vez al día.
  const loaded = !!patient;
  useEffect(() => {
    if (loaded) void logAccess(getDb(), "abrir_ficha", id).catch(() => {});
  }, [id, loaded]);
  const visit = useAsync(() => nextAppointmentOf(getDb(), id), [id]);
  // La columna de la derecha (PatientAside): solo en pantallas muy anchas y fuera del Resumen, que ya trae esas cifras.
  const wide = useWideScreen();
  const onSummary = /\/pacientes\/[^/]+\/?$/.test(useLocation().pathname);
  const aside = wide && !!patient && !onSummary;
  // En una clínica, quién tocó la ficha por última vez.
  const cloud = useCloud();
  const team = !!cloud?.clinic;
  const admin = !!cloud?.clinic && cloud.clinic.role === "admin";
  const edit = useAsync(async () => (team ? lastEditOfPatient(getDb(), id) : null), [id, team]);
  const [managing, setManaging] = useState(false);
  const [more, setMore] = useState(false);
  const leave = useLeaveWaitlist();
  const swipe = useTabSwipe(id);
  // Desde la lista de espera, «‹» vuelve a ella con sus filtros.
  const from = (useLocation().state as { from?: string } | null)?.from;
  const fromWaitlist = typeof from === "string" && from.startsWith("/agenda/espera") ? from : null;
  const wa = patient && mayMessage(patient.privacy.consents?.contact) ? waPhone(patient.phone) : null;
  const version = useDataVersion();
  const owes = useAsync(async () => {
    const a = await patientAccount(getDb(), id, todayDay());
    return a.balanceCents > 0 ? a.balanceCents : 0;
  }, [id, version]);
  const count = useAsync(() => sessionCount(getDb(), id), [id, version]);
  const name = patient?.name ?? "Paciente";
  const years = patient ? ageOn(patient.birthDate) : null;
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
      actionPast={
        // Al bajar, la cabecera se recoge aquí: la cita y WhatsApp siguen a un toque (el nombre ya sale en la barra).
        patient && (
          <span className="flex items-center">
            <button type="button" aria-haspopup="dialog" aria-label={visit.data ? `Próxima cita: ${fmtVisit(visit.data.startsAt)}` : "Dar cita"} onClick={() => setManaging(true)} className="tap inline-flex items-center justify-center rounded-md px-2 text-accent hover:bg-surface">
              {visit.data ? <CalendarCheck aria-hidden="true" className="size-5" /> : <CalendarPlus aria-hidden="true" className="size-5" />}
            </button>
            {wa && (
              <a href={whatsappUrl(wa, "")} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="tap inline-flex items-center justify-center rounded-md px-2 text-accent hover:bg-surface">
                <MessageCircle aria-hidden="true" className="size-5" />
              </a>
            )}
          </span>
        )
      }
      header={
        // Compacta: el nombre y la edad; el motivo que se ve (con por dónde va); las precauciones, siempre a la vista; y
        // una fila de acciones (la cita dice su estado, WhatsApp, lo que debe y «Más»: teléfono, peso, estatura…).
        // En ancho (el ordenador), el nombre a la izquierda y las acciones a la derecha.
        <div className="flex flex-col gap-1 @2xl:flex-row @2xl:items-end @2xl:justify-between @2xl:gap-4">
          <div className="flex min-w-0 flex-col @2xl:min-w-64">
            <div className="flex items-start gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 pt-1.5">
                <h1 className="min-w-0 text-[1.5rem] leading-tight font-bold break-words">{name}</h1>
                {years !== null && <span className="text-sm whitespace-nowrap text-text-muted">{years} años</span>}
              </div>
              {patient && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label="Más datos"
                  title="Más datos"
                  onClick={() => setMore(true)}
                  className="inline-flex size-11 items-center justify-center rounded-pill bg-surface text-text hover:brightness-95"
                >
                  <Ellipsis aria-hidden="true" className="size-5" />
                </button>
              )}
            </div>
            {patient && <EpisodePicker patientId={id} plain extra={count.data && count.data.done > 0 ? (count.data.planned !== null ? `sesión ${count.data.done} de ${count.data.planned}` : count.data.done === 1 ? "1 sesión" : `${count.data.done} sesiones`) : undefined} />}
            {edit.data && <p className="text-xs text-text-muted">Última modificación: {editText(edit.data)}</p>}
            {patient && <PrecautionsNote patientId={id} className="mb-1" />}
          </div>
          <div className="flex flex-wrap items-center gap-2 @2xl:justify-end">
            {visit.data ? (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-label={`Próxima cita: ${fmtVisit(visit.data.startsAt)}`}
                onClick={() => setManaging(true)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
              >
                <CalendarCheck aria-hidden="true" className="size-4" /> {fmtVisit(visit.data.startsAt)}
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
                aria-label="WhatsApp"
                title="WhatsApp"
                className="inline-flex size-11 items-center justify-center rounded-pill border border-border bg-bg text-accent hover:bg-surface"
              >
                <MessageCircle aria-hidden="true" className="size-5" />
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
            {/* En una clínica con equipo: quién lo lleva (para el filtro «Fisio» de la lista). */}
            {patient && <PatientPhysios patientId={id} />}
          </div>
          {patient && (
            <Sheet open={more} onClose={() => setMore(false)} title={`Más datos de ${patient.name}`}>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-base">
                {years !== null && (
                  <>
                    <dt className="text-text-muted">Edad</dt>
                    <dd>{years} años</dd>
                  </>
                )}
                <dt className="text-text-muted">Teléfono</dt>
                <dd>
                  {patient.phone ? (
                    <a href={`tel:${patient.phone.replace(/\s/g, "")}`} className="font-semibold text-accent underline underline-offset-2">
                      {patient.phone}
                    </a>
                  ) : (
                    "Sin apuntar"
                  )}
                </dd>
                {patient.email && (
                  <>
                    <dt className="text-text-muted">Correo</dt>
                    <dd className="break-all">{patient.email}</dd>
                  </>
                )}
                {patient.bodyMassKg ? (
                  <>
                    <dt className="text-text-muted">Peso</dt>
                    <dd>{fmt(patient.bodyMassKg)} kg</dd>
                  </>
                ) : null}
                {patient.heightCm ? (
                  <>
                    <dt className="text-text-muted">Estatura</dt>
                    <dd>{fmt(patient.heightCm, 0)} cm</dd>
                  </>
                ) : null}
              </dl>
              <div className="flex flex-col gap-2">
                <Link to={`/pacientes/${id}/editar`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-bg px-4 font-semibold text-accent hover:bg-surface">
                  Editar sus datos
                </Link>
                {admin && (
                  <Link to={`/ajustes/equipo/accesos?paciente=${id}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-bg px-4 font-semibold text-accent hover:bg-surface">
                    Quién ha abierto esta ficha
                  </Link>
                )}
              </div>
            </Sheet>
          )}
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
      {/* En pantallas muy anchas, a la derecha y en todas las pestañas menos el Resumen: lo esencial del paciente. */}
      {aside ? (
        <div className="grid grid-cols-[minmax(0,1fr)_15rem] items-start gap-6">
          <div data-tab-swipe className="flex min-w-0 flex-col gap-4" onTouchStart={swipe.start} onTouchEnd={swipe.end}>
            {children}
          </div>
          <PatientAside id={id} />
        </div>
      ) : (
        <div data-tab-swipe className="flex flex-col gap-4" onTouchStart={swipe.start} onTouchEnd={swipe.end}>
          {children}
        </div>
      )}
    </Page>
  );
}
