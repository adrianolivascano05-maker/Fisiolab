import { CalendarClock, Plus, Search, Users, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { fmtDate, testLabel } from "../app/format";
import { InstallCard } from "../app/pwa";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { dueReviews } from "../data/clinical";
import { getDb } from "../data/db";
import { createPatient, getSetting, listPatients } from "../data/repo";
import { SEED_PREFIX } from "../data/seed";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
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
  const navigate = useNavigate();
  const toast = useToast();
  const [quick, setQuick] = useState(false);

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

  const addLink = (
    <Link to="/pacientes/nuevo" aria-label="Nuevo paciente" className="tap inline-flex items-center justify-center rounded-md hover:bg-surface">
      <Plus aria-hidden="true" className="size-6" />
    </Link>
  );

  return (
    <Page title="Pacientes" tabs brand action={addLink}>
      {info.data && !info.data.persistent && (
        <Alert tone="warning" title="Este navegador no guarda los datos">
          Todo se perderá al cerrar la pestaña. Abre la app en Safari o Chrome actualizados.
        </Alert>
      )}
      <InstallCard />
      <BackupReminder
        hasRealPatients={!!patients.data?.some((p) => !p.name.startsWith(SEED_PREFIX))}
        lastBackup={lastBackup.loading ? undefined : (lastBackup.data ?? null)}
      />
      {reviews.data && reviews.data.length > 0 && !search && <Reviews items={reviews.data} />}
      <Button variant="secondary" block loading={quick} icon={<Zap aria-hidden="true" className="size-5" />} onClick={quickMeasure}>
        Medición rápida, sin ficha
      </Button>
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
          <EmptyState
            icon={Users}
            title="Todavía no hay pacientes"
            action={
              <Link to="/pacientes/nuevo" className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-4 font-semibold text-on-accent">
                <Plus aria-hidden="true" className="size-5" /> Añadir paciente
              </Link>
            }
          >
            Añade a tu primer paciente y mide su salto en un par de minutos.
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
                  ? `${p.testCount} ${p.testCount === 1 ? "test" : "tests"} · último ${testLabel(p.lastTestType ?? "")}, ${fmtDate(p.lastTestAt)}`
                  : "Sin tests todavía"
              }
            />
          ))}
        </List>
      )}
    </Page>
  );
}

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
      <Link className="font-semibold text-accent underline" to="/ajustes">
        Ir a Ajustes
      </Link>
    </Alert>
  );
}
