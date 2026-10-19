import { CalendarCheck, CalendarClock, Plus, Search, Users, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { fmtDate } from "../app/format";
import { useCloud } from "../cloud/CloudGate";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { fmtVisit } from "../clinical/calendar";
import { dueReviews, upcomingVisits } from "../data/clinical";
import { getDb } from "../data/db";
import { createPatient, getSetting, listPatients, type PatientSummary } from "../data/repo";
import { SEED_PREFIX } from "../data/seed";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { Group, RowButton } from "../ui/Grouped";
import { PatientRow } from "../ui/ListItem";
import { useToast } from "../ui/Toast";

/** Ficha donde van las mediciones hechas sin elegir paciente. */
export const QUICK_PATIENT = "Medición rápida";

/** «Hoy, 10:00», «Mañana, 9:30» o «lun, 26 oct, 10:00». */
function when(iso: string) {
  const hour = new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  const day = madridDay(iso);
  return day === dayPlus(0) ? `Hoy, ${hour}` : day === dayPlus(1) ? `Mañana, ${hour}` : fmtVisit(iso);
}

/** Lo que más sirve de cada paciente en la lista: su próxima cita o la última vez que vino. */
function meta(p: PatientSummary) {
  if (p.nextAt) return `Próxima cita: ${when(p.nextAt)}`;
  if (p.lastAt) return `Última visita: ${fmtDate(p.lastAt)}`;
  return "Sin visitas todavía";
}

/** Primera letra para las secciones (sin tildes; «#» si no es una letra). */
function letter(name: string) {
  const c = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().charAt(0).toUpperCase();
  return /[A-ZÑ]/.test(c) ? c : "#";
}

/** S01 Pacientes */
export function PatientsPage() {
  const [search, setSearch] = useState("");
  const patients = useAsync(() => listPatients(getDb(), search), [search]);
  const info = useAsync(() => getDb().info(), []);
  const lastBackup = useAsync(() => getSetting<string>(getDb(), "last_backup_at"), []);
  const reviews = useAsync(() => dueReviews(getDb(), dayPlus(7)), []);
  const visits = useAsync(async () => (await upcomingVisits(getDb())).filter((v) => madridDay(v.nextAt) <= dayPlus(7)), []);
  const navigate = useNavigate();
  const toast = useToast();
  const [quick, setQuick] = useState(false);
  const cloud = useCloud();

  /** Medir ya, sin rellenar una ficha: usa (o crea) la ficha «Medición rápida». */
  async function quickMeasure() {
    setQuick(true);
    try {
      const db = getDb();
      const found = (await listPatients(db, QUICK_PATIENT)).find((p) => p.name === QUICK_PATIENT);
      const id =
        found?.id ??
        (await createPatient(db, {
          name: QUICK_PATIENT,
          birthDate: null,
          sex: null,
          bodyMassKg: null,
          heightCm: null,
          legLengthCm: null,
          pushOffDistanceCm: null,
          notes: "Mediciones hechas sin elegir paciente. Puedes cambiarle el nombre y los datos cuando quieras.",
        }));
      navigate(`/pacientes/${id}/test`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo empezar", "danger");
      setQuick(false);
    }
  }

  const own = patients.data?.filter((p) => !p.name.startsWith(SEED_PREFIX) && p.name !== QUICK_PATIENT) ?? [];
  // Sin buscar: por letras, como los contactos del móvil.
  const byLetter = new Map<string, PatientSummary[]>();
  for (const p of patients.data ?? []) byLetter.set(letter(p.name), [...(byLetter.get(letter(p.name)) ?? []), p]);

  return (
    <Page
      title="Pacientes"
      action={
        <Link to="/pacientes/nuevo" aria-label="Nuevo paciente" className="tap inline-flex items-center justify-center rounded-md text-accent hover:bg-surface">
          <Plus aria-hidden="true" className="size-7" />
        </Link>
      }
    >
      {info.data && !info.data.persistent && (
        <Alert tone="warning" title="Este navegador no guarda los datos">
          Todo se perderá al cerrar la pestaña. Abre la app en Safari o Chrome actualizados.
        </Alert>
      )}
      <div className="relative">
        <label htmlFor="patient-search" className="sr-only">
          Buscar paciente
        </label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
        <input
          id="patient-search"
          type="search"
          placeholder="Buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 w-full rounded-lg border border-transparent bg-surface pr-3 pl-10 text-base placeholder:text-text-muted focus:border-border-input"
        />
      </div>
      {/* Con la nube, la copia es automática: no hace falta recordar la de archivo. */}
      {!cloud && !search && <BackupReminder hasRealPatients={own.length > 0} lastBackup={lastBackup.loading ? undefined : (lastBackup.data ?? null)} />}

      {!search && visits.data && visits.data.length > 0 && (
        <Group title="Próximas citas">
          {visits.data.map((v) => (
            <PatientRow key={v.patientId} to={`/pacientes/${v.patientId}`} name={v.name} meta={when(v.nextAt)} icon={CalendarCheck} />
          ))}
        </Group>
      )}
      {!search && reviews.data && reviews.data.length > 0 && <Reviews items={reviews.data} />}
      {!search && (
        <Group>
          <RowButton icon={Zap} title="Medición rápida" subtitle="Medir sin crear ficha" busy={quick} onClick={() => void quickMeasure()} />
        </Group>
      )}

      {patients.error ? (
        <LoadError error={patients.error} />
      ) : !patients.data ? (
        <Loading />
      ) : patients.data.length === 0 ? (
        search ? (
          <p className="py-6 text-center text-text-muted">Ningún paciente se llama «{search}».</p>
        ) : (
          <EmptyState icon={Users} title="Todavía no hay pacientes">
            Pulsa + arriba para añadir el primero. Con el nombre basta.
          </EmptyState>
        )
      ) : search ? (
        <Group title="Resultados">
          {patients.data.map((p) => (
            <PatientRow key={p.id} to={`/pacientes/${p.id}`} name={p.name} meta={meta(p)} />
          ))}
        </Group>
      ) : (
        <div role="list" aria-label="Pacientes" className="flex flex-col gap-4">
          {[...byLetter].map(([l, list]) => (
            <div role="listitem" key={l}>
              <Group title={l}>
                {list.map((p) => (
                  <PatientRow key={p.id} to={`/pacientes/${p.id}`} name={p.name} meta={meta(p)} />
                ))}
              </Group>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

/** AAAA-MM-DD de una hora, en Madrid. */
const madridDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

/** AAAA-MM-DD de hoy más n días, en la hora de Madrid. */
const dayPlus = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });

/** Reevaluaciones de hoy, atrasadas y de los próximos 7 días (la última fecha que se puso en cada paciente). */
function Reviews({ items }: { items: { patientId: string; name: string; reviewOn: string }[] }) {
  const today = dayPlus(0);
  return (
    <Group title="Para reevaluar">
      {items.map((r) => (
        <PatientRow
          key={r.patientId}
          to={`/pacientes/${r.patientId}/sesiones`}
          name={r.name}
          icon={CalendarClock}
          meta={r.reviewOn < today ? `Pendiente desde el ${fmtDate(`${r.reviewOn}T12:00:00`)}` : r.reviewOn === today ? "Hoy" : fmtDate(`${r.reviewOn}T12:00:00`)}
        />
      ))}
    </Group>
  );
}

const BACKUP_EVERY_DAYS = 7;

/** Recordatorio semanal: los datos solo están en este dispositivo. */
function BackupReminder({ hasRealPatients, lastBackup }: { hasRealPatients: boolean; lastBackup: string | null | undefined }) {
  if (!hasRealPatients || lastBackup === undefined) return null;
  const days = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86_400_000) : null;
  if (days !== null && days < BACKUP_EVERY_DAYS) return null;
  return (
    <Alert tone="info" title="Haz una copia de seguridad">
      {days === null ? "Todavía no has hecho ninguna." : `La última fue hace ${days} días.`} Los datos solo están en este
      dispositivo.{" "}
      <Link className="font-semibold text-accent underline" to="/ajustes/datos">
        Hacer la copia
      </Link>
    </Alert>
  );
}
