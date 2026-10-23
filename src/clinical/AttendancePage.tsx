// Justificante de asistencia: el documento que el paciente lleva a su trabajo o a su centro de estudios. Sale de la
// cita (día y hora) y de los datos de la clínica y del fisioterapeuta (Ajustes → Clínica). El DNI y para qué es se
// escriben aquí y no se guardan. Se imprime, se guarda en PDF o va a Drive.
import { Download, Printer } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { fmtDate } from "../app/format";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { DriveSaveButton } from "../cloud/DriveSaveButton";
import { safeName } from "../cloud/saveToDrive";
import { getAppointment, lastVisitOf } from "../data/appointments";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { getPatient } from "../data/repo";
import { TopBar } from "../ui/AppBar";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { localInput } from "./pageKit";
import { Letterhead, SignatureLine } from "./reportParts";

const hour = (d: Date) => d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
const longDay = (d: Date) => d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });

export function AttendancePage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const toast = useToast();
  const appointmentId = params.get("cita");
  const data = useAsync(async () => {
    const db = getDb();
    // Sin cita elegida, la última visita (nunca «ahora»: el justificante dice que ha asistido).
    const [patient, clinic, appointment, last] = await Promise.all([
      getPatient(db, id),
      getClinic(db),
      appointmentId ? getAppointment(db, appointmentId) : null,
      appointmentId ? null : lastVisitOf(db, id),
    ]);
    return { patient, clinic, appointment: appointment ? { startsAt: appointment.startsAt, minutes: appointment.minutes } : last };
  }, [id, appointmentId]);
  const [when, setWhen] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<string | null>(null);
  /** El de su ficha, salvo que se cambie aquí (solo para este justificante). */
  const [idDocEdit, setIdDoc] = useState<string | null>(null);
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const article = useRef<HTMLElement>(null);

  const bar = (
    <div className="print:hidden">
      <TopBar title="Justificante" backTo={`/pacientes/${id}`} />
    </div>
  );
  if (data.error) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={data.error} /></main></>;
  if (!data.data) return <>{bar}<main className="mx-auto max-w-3xl p-4"><Loading /></main></>;
  const { patient, clinic, appointment } = data.data;
  if (!patient) return <>{bar}<main className="mx-auto max-w-3xl p-4"><LoadError error={new Error("Este paciente no existe.")} /></main></>;
  const idDoc = idDocEdit ?? patient.dni;

  const start = new Date(when ?? (appointment ? localInput(appointment.startsAt) : ""));
  // Lo escrito tal cual (se puede borrar para escribir otro); para el texto, entre 5 y 480 minutos.
  const minutesText = minutes ?? String(appointment?.minutes ?? 45);
  const typed = Number(minutesText);
  const length = Number.isFinite(typed) && typed >= 5 ? Math.min(480, Math.round(typed)) : (appointment?.minutes ?? 45);
  const end = new Date(start.getTime() + length * 60_000);
  const valid = !Number.isNaN(start.getTime());
  /** Una hora que aún no ha llegado: no se puede justificar una asistencia. */
  const future = valid && start.getTime() > Date.now();
  const physio = clinic.professional;
  const fileName = safeName(`Justificante ${patient.name} ${valid ? start.toISOString().slice(0, 10) : ""}.pdf`);

  async function pdf() {
    const { reportPdf } = await import("./reportPdf");
    return reportPdf(article.current!);
  }

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 18mm 18mm 20mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <form className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4 print:hidden" onSubmit={(e) => e.preventDefault()}>
          <TextField label="Día y hora de la consulta" type="datetime-local" value={valid ? localInput(start.toISOString()) : ""} onChange={(e) => setWhen(e.target.value)} />
          <TextField
            label="Duración (minutos)"
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            value={minutesText}
            onChange={(e) => setMinutes(e.target.value)}
            error={minutesText && length !== typed ? `Entre 5 y 480 minutos: sale ${length}.` : undefined}
          />
          <TextField label="DNI o NIE del paciente (opcional)" value={idDoc} onChange={(e) => setIdDoc(e.target.value)} hint="Sale de su ficha; si lo cambias aquí, solo vale para este justificante." />
          <TextField label="Para qué es (opcional)" value={purpose} onChange={(e) => setPurpose(e.target.value)} hint="Por ejemplo: «a petición del interesado, para presentar en su empresa»." />
          {!appointment && !when && <Alert tone="info" title="No consta ninguna visita">Pon el día y la hora de la consulta.</Alert>}
          {future && <Alert tone="warning" title="Esa hora aún no ha llegado">El justificante dice que ha asistido: hazlo cuando haya venido.</Alert>}
          {!physio && (
            <p className="text-sm text-warning">
              Falta tu nombre y nº de colegiado:{" "}
              <Link to="/ajustes/clinica" className="py-3 font-semibold underline">
                rellénalos en Ajustes → Clínica
              </Link>{" "}
              para que salgan en la firma.
            </p>
          )}
          <Button size="lg" disabled={!valid || future} icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button
            variant="secondary"
            loading={busy}
            disabled={!valid || future}
            icon={<Download aria-hidden="true" className="size-5" />}
            onClick={async () => {
              setBusy(true);
              try {
                const bytes = await pdf();
                const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e), "danger");
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar en PDF
          </Button>
          <DriveSaveButton label="Guardar en mi Drive (PDF)" make={async () => ({ name: fileName, mimeType: "application/pdf", bytes: await pdf() })} />
        </form>

        <article
          ref={article}
          aria-label="Justificante de asistencia"
          className="flex flex-col gap-6 theme-light rounded-lg border border-border bg-white p-8 text-base leading-relaxed text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <Letterhead clinic={clinic} title="Justificante de asistencia" subtitle={fmtDate(new Date().toISOString())} />
          {valid ? (
            <p>
              {physio ? (
                <>
                  <b>{physio}</b>, fisioterapeuta{clinic.license ? ` con nº de colegiado ${clinic.license}` : ""}
                  {clinic.name ? ` de ${clinic.name}` : ""}, hace constar que
                </>
              ) : (
                <>Se hace constar que</>
              )}{" "}
              <b>{patient.name}</b>
              {idDoc.trim() ? `, con DNI/NIE ${idDoc.trim()},` : ""} ha asistido a consulta de fisioterapia el <b>{longDay(start)}</b>, de{" "}
              <b>{hour(start)}</b> a <b>{hour(end)}</b>.
            </p>
          ) : (
            <p className="text-text-muted">Pon el día y la hora de la consulta.</p>
          )}
          {purpose.trim() && <p>Se expide {purpose.trim().replace(/\.$/, "")}.</p>}
          <p>Y para que conste, se firma en {clinic.city || "________________"}, a {fmtDate(new Date().toISOString())}.</p>
          <SignatureLine name={physio} license={clinic.license} date={fmtDate(new Date().toISOString())} />
        </article>
      </main>
    </div>
  );
}
