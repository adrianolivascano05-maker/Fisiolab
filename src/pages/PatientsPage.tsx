import { CalendarCheck, CalendarClock, Plus, Search, Users, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { fmtDate, testLabel } from "../app/format";
import { FirstSteps } from "../app/FirstSteps";
import { AccountCard } from "../cloud/AccountPages";
import { useCloud } from "../cloud/CloudGate";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { fmtVisit } from "../clinical/calendar";
import { dueReviews, upcomingVisits } from "../data/clinical";
import { getDb } from "../data/db";
import { createPatient, getSetting, listPatients } from "../data/repo";
import { SEED_PREFIX } from "../data/seed";
import { Alert } from "../ui/Alert";
import { EmptyState } from "../ui/EmptyState";
import { List, PatientRow } from "../ui/ListItem";
import { useToast } from "../ui/Toast";

/** Ficha donde van las mediciones hechas sin elegir paciente. */
export const QUICK_PATIENT = "Medición rápida";

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

  return (
    <Page title="Pacientes" tabs brand>
      {info.data && !info.data.persistent && (
        <Alert tone="warning" title="Este navegador no guarda los datos">
          Todo se perderá al cerrar la pestaña. Abre la app en Safari o Chrome actualizados.
        </Alert>
      )}
      {cloud && <AccountCard />}
      <div className="grid grid-cols-2 gap-2">
        <Link to="/pacientes/nuevo" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-accent px-3 font-semibold text-on-accent hover:bg-accent-hover">
          <Plus aria-hidden="true" className="size-5 shrink-0" /> Nuevo paciente
        </Link>
        <button
          type="button"
          disabled={quick}
          aria-busy={quick || undefined}
          onClick={quickMeasure}
          className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md border border-border-input bg-bg px-3 text-left leading-tight font-semibold hover:bg-surface disabled:opacity-50"
        >
          <Zap aria-hidden="true" className="size-5 shrink-0 text-accent" /> Medición rápida, sin ficha
        </button>
      </div>
      {patients.data && !search && <FirstSteps hasPatients={own.length > 0} />}
      {/* Con la nube, la copia es automática: no hace falta recordar la de archivo. */}
      {!cloud && <BackupReminder
        hasRealPatients={own.length > 0}
        lastBackup={lastBackup.loading ? undefined : (lastBackup.data ?? null)}
      />}
      {visits.data && visits.data.length > 0 && !search && <Visits items={visits.data} />}
      {reviews.data && reviews.data.length > 0 && !search && <Reviews items={reviews.data} />}

      <section aria-labelledby="h-todos" className="flex flex-col gap-2">
        <h2 id="h-todos" className="text-lg">
          {patients.data?.length ? `Todos tus pacientes (${patients.data.length})` : "Tus pacientes"}
        </h2>
        <div className="relative">
          <label htmlFor="patient-search" className="sr-only">
            Buscar paciente
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" />
          <input
            id="patient-search"
            type="search"
            placeholder="Buscar por nombre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full rounded-md border border-border-input bg-bg pl-10 pr-3 text-base placeholder:text-text-muted"
          />
        </div>

        {patients.error ? (
          <LoadError error={patients.error} />
        ) : !patients.data ? (
          <Loading />
        ) : patients.data.length === 0 ? (
          search ? (
            <p className="py-6 text-center text-text-muted">Ningún paciente se llama «{search}».</p>
          ) : (
            <EmptyState icon={Users} title="Todavía no hay pacientes">
              Pulsa «Nuevo paciente» para añadir al primero. Con el nombre basta.
            </EmptyState>
          )
        ) : (
          <List label="Pacientes">
            {patients.data.map((p) => (
              <PatientRow
                key={p.id}
                to={`/pacientes/${p.id}`}
                name={p.name}
                meta={
                  p.lastTestAt
                    ? `${p.testCount} ${p.testCount === 1 ? "medición" : "mediciones"} · última: ${testLabel(p.lastTestType ?? "")}, ${fmtDate(p.lastTestAt)}`
                    : "Sin mediciones todavía"
                }
              />
            ))}
          </List>
        )}
      </section>
    </Page>
  );
}

/** Citas de hoy y de los próximos 7 días (la siguiente cita que se puso en la última sesión de cada paciente). */
function Visits({ items }: { items: { patientId: string; name: string; nextAt: string }[] }) {
  const today = dayPlus(0);
  const tomorrow = dayPlus(1);
  const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" });
  const when = (iso: string) => (madridDay(iso) === today ? `Hoy, ${hour(iso)}` : madridDay(iso) === tomorrow ? `Mañana, ${hour(iso)}` : fmtVisit(iso));
  return (
    <section aria-labelledby="citas" className="flex flex-col gap-2">
      <h2 id="citas" className="flex items-center gap-2 text-lg">
        <CalendarCheck aria-hidden="true" className="size-5 text-accent" /> Próximas citas
      </h2>
      <List label="Próximas citas">
        {items.map((v) => (
          <PatientRow key={v.patientId} to={`/pacientes/${v.patientId}`} name={v.name} meta={when(v.nextAt)} />
        ))}
      </List>
    </section>
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
    <section aria-labelledby="reevaluar" className="flex flex-col gap-2">
      <h2 id="reevaluar" className="flex items-center gap-2 text-lg">
        <CalendarClock aria-hidden="true" className="size-5 text-accent" /> Para reevaluar
      </h2>
      <List label="Reevaluaciones">
        {items.map((r) => (
          <PatientRow
            key={r.patientId}
            to={`/pacientes/${r.patientId}/sesiones`}
            name={r.name}
            meta={r.reviewOn < today ? `Pendiente desde el ${fmtDate(`${r.reviewOn}T12:00:00`)}` : r.reviewOn === today ? "Hoy" : fmtDate(`${r.reviewOn}T12:00:00`)}
          />
        ))}
      </List>
    </section>
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
