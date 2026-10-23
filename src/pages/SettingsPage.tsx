// S24 Ajustes: un menú con lo que se configura, agrupado, y en cada fila cómo está ahora. Cada apartado tiene su
// pantalla (cuenta, clínica, bloqueo, copias), como los ajustes del móvil.
import { useTeamMode } from "../cloud/teamMode";
import { SHOW_EXERCISES } from "../app/features";
import {
  BookOpenCheck,
  Briefcase,
  Building2,
  ChartColumn,
  ClipboardCheck,
  Database,
  ClipboardList,
  Download,
  Dumbbell,
  FileSpreadsheet,
  FileUp,
  LifeBuoy,
  Lock,
  MonitorSmartphone,
  Palette,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { readErrors } from "../app/errorLog";
import { fmtDateTime } from "../app/format";
import { Page } from "../app/Page";
import { useInstall } from "../app/pwa";
import { THEME_LABELS, useTheme, type Theme } from "../app/theme";
import { useAsync } from "../app/useAsync";
import { AccountCard } from "../cloud/AccountPages";
import { CalendarSettings } from "../cloud/CalendarSettings";
import { getToken } from "../cloud/auth";
import { ROLE_LABELS } from "../cloud/clinic";
import { CloudSettings, syncText, useCloud, useSyncState } from "../cloud/CloudGate";
import { DriveSaveButton } from "../cloud/DriveSaveButton";
import { EncryptionSettings } from "../cloud/EncryptionParts";
import { getDb } from "../data/db";
import { FullExportButton } from "../export/FullExportButton";
import { clinicComplete, getClinic } from "../data/privacy";
import { exportCsv, getSetting, setSetting } from "../data/repo";
import { hasSeed, loadSeed, removeSeed } from "../data/seed";
import { ClinicSettings } from "../privacy/ClinicSettings";
import { LockSettings } from "../privacy/LockSettings";
import { getLock } from "../privacy/pin";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Group, RowLink } from "../ui/Grouped";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/** S24 Ajustes: el menú. */
export function SettingsPage() {
  const cloud = useCloud();
  const { solo } = useTeamMode();
  // El proveedor ve cuántas solicitudes de acceso tiene por atender.
  const pendingRequests = useAsync(async () => {
    const token = getToken();
    return cloud?.operator && cloud.clinics && token ? ((await cloud.clinics.me(token)).pendingRequests ?? 0) : 0;
  }, [cloud?.operator]);
  const sync = useSyncState();
  const install = useInstall();
  const state = useAsync(async () => {
    const db = getDb();
    return { clinic: await getClinic(db), lastBackup: await getSetting<string>(db, "last_backup_at"), info: await db.info() };
  }, []);
  const lock = getLock();
  const clinic = state.data?.clinic;
  const [theme] = useTheme();

  return (
    <Page title="Ajustes" tabs>
      {/* En el ordenador, los cuatro grupos en dos columnas. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6">
      <Group title="Clínica">
        <RowLink
          to="/ajustes/clinica"
          icon={Building2}
          title="Clínica y protección de datos"
          subtitle={!clinic ? "…" : clinicComplete(clinic) ? clinic.name : "Faltan los datos de la clínica"}
          warn={!!clinic && !clinicComplete(clinic)}
          tone={clinic && !clinicComplete(clinic) ? "warning" : "accent"}
        />
        {cloud?.clinic && (
          <RowLink
            to="/ajustes/equipo"
            icon={UsersRound}
            title={solo ? "Mi consulta" : "Equipo de la clínica"}
            subtitle={solo ? `${cloud.clinic.name} · por mi cuenta (si abres una clínica, añade aquí a tu equipo)` : `${cloud.clinic.name} · ${ROLE_LABELS[cloud.clinic.role]}`}
          />
        )}
        <RowLink to="/ajustes/cobros" icon={Wallet} title="Precios y cobros" subtitle="Precio de la sesión, bonos, lo cobrado y lo pendiente" />
        <RowLink to="/ajustes/anamnesis" icon={ClipboardList} title="Anamnesis de la clínica" subtitle="Tus propias preguntas en la ficha" />
        {SHOW_EXERCISES && <RowLink to="/ajustes/ejercicios" icon={Dumbbell} title="Biblioteca de ejercicios" subtitle="Para las hojas de ejercicios para casa" />}
        <RowLink to="/ajustes/estadisticas" icon={ChartColumn} title="La clínica en números" subtitle="Sesiones, pacientes nuevos, ausencias y altas" />
      </Group>

      <Group title="Datos">
        <RowLink
          to="/ajustes/cuenta"
          icon={UserRound}
          title={cloud ? cloud.account.name : "Cuenta de Google"}
          subtitle={cloud && sync ? `${cloud.account.email} · ${syncText(sync)}` : "Sin conectar"}
          warn={!!sync && (sync.status === "needs-auth" || sync.status === "needs-key" || sync.status === "needs-password" || sync.status === "error")}
        />
        <RowLink
          to="/ajustes/datos"
          icon={Database}
          title="Copias y exportar"
          subtitle={cloud ? `Copia automática en ${cloud.sync.store.where}` : `Última copia: ${state.data?.lastBackup ? fmtDateTime(state.data.lastBackup) : "nunca"}`}
          warn={!cloud && !!state.data && !state.data.lastBackup}
          tone={!cloud && state.data && !state.data.lastBackup ? "warning" : "accent"}
        />
        <RowLink to="/ajustes/importar" icon={FileSpreadsheet} title="Importar datos" subtitle="De otro programa: pacientes, citas e historial · Excel o CSV" />
        {cloud?.operator && (
          <RowLink
            to="/ajustes/proveedor"
            icon={Briefcase}
            title="Proveedor"
            subtitle={
              pendingRequests.data
                ? `${pendingRequests.data === 1 ? "1 solicitud de acceso" : `${pendingRequests.data} solicitudes de acceso`} por atender`
                : "Solicitudes, clínicas, altas, bajas y contrato"
            }
          />
        )}
      </Group>

      <Group title="Seguridad">
        <RowLink to="/ajustes/bloqueo" icon={Lock} title="Bloqueo con PIN" subtitle={lock ? "Activado" : "Desactivado"} />
        <RowLink to="/privacidad" icon={ShieldCheck} title="Privacidad" subtitle="Qué datos guarda la app y dónde" />
      </Group>

      <Group title="App">
        <RowLink
          to="/instalar"
          icon={MonitorSmartphone}
          title="Instalar la app"
          subtitle={install.state === "installed" ? "Instalada en este dispositivo" : "En este y en otros dispositivos"}
        />
        <RowLink to="/ajustes/aspecto" icon={Palette} title="Aspecto" subtitle={theme === "auto" ? "Automático, como el dispositivo" : THEME_LABELS[theme]} />
        <RowLink to="/ayuda" icon={BookOpenCheck} title="Cómo se usa" />
        <RowLink to="/ayuda/fallos" icon={LifeBuoy} title="Algo no funciona" subtitle={errorCount(readErrors().length)} />
        <RowLink to="/validacion" icon={ClipboardCheck} title="Validación de las mediciones" subtitle="Compararlas con una plataforma, un encoder o un goniómetro" />
      </Group>
      </div>

      {state.data && (
        <p className="text-xs text-text-muted">
          Base de datos SQLite {state.data.info.sqliteVersion} · esquema v{state.data.info.schemaVersion} ·{" "}
          {state.data.info.persistent ? "guardado en el dispositivo" : "en memoria"}
        </p>
      )}
    </Page>
  );
}

const errorCount = (n: number) => (n === 0 ? "Problemas frecuentes e informe de fallo" : n === 1 ? "1 error anotado en este dispositivo" : `${n} errores anotados en este dispositivo`);

/** Ajustes → Cuenta de Google: la sesión y la sincronización, Google Calendar y el cifrado de la copia. */
export function AccountSettingsPage() {
  const cloud = useCloud();
  return (
    <Page title="Cuenta de Google" backTo="/ajustes">
      {cloud ? (
        <>
          <CloudSettings />
          <CalendarSettings />
          <EncryptionSettings />
        </>
      ) : (
        <>
          <p>Con tu cuenta de Google, tus pacientes se guardan también en tu Google Drive y los tienes en cualquier dispositivo.</p>
          <AccountCard />
        </>
      )}
    </Page>
  );
}

/** Ajustes → Clínica y protección de datos. */
export function ClinicSettingsPage() {
  return (
    <Page title="Clínica y protección de datos" backTo="/ajustes">
      <ClinicSettings />
      <Link to="/privacidad" className="inline-flex min-h-11 items-center self-start font-semibold text-accent underline">
        Privacidad: qué datos guarda la app y dónde
      </Link>
    </Page>
  );
}

/** Ajustes → Bloqueo con PIN. */
export function LockSettingsPage() {
  return (
    <Page title="Bloqueo con PIN" backTo="/ajustes">
      <LockSettings />
    </Page>
  );
}

/** Ajustes → Copias y exportar (y los datos de ejemplo). */
export function DataSettingsPage() {
  const toast = useToast();
  const cloud = useCloud();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const state = useAsync(async () => {
    const db = getDb();
    return {
      info: await db.info(),
      lastBackup: await getSetting<string>(db, "last_backup_at"),
      seed: await hasSeed(db),
      // Si el navegador garantiza no borrar los datos por falta de espacio o por inactividad.
      protectedStorage: (await navigator.storage?.persisted?.()) ?? false,
    };
  }, []);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Algo falló", "danger");
    } finally {
      setBusy(null);
      state.reload();
    }
  }

  return (
    <Page title="Copias y exportar" backTo="/ajustes">
      <section className="flex flex-col gap-3" aria-labelledby="h-datos">
        <h2 id="h-datos" className="text-lg">
          Tus datos
        </h2>
        <p className="text-sm text-text-muted">
          {cloud
            ? cloud.sync.store.kind === "server"
              ? "Se guardan en este dispositivo y, cada vez que cambian, cifrados en el servidor de la clínica (Cloudflare, en la Unión Europea). La copia de seguridad en archivo es opcional."
              : "Se guardan en este dispositivo y, cada vez que cambian, cifrados en tu Google Drive (una carpeta oculta que solo usa esta app). La copia de seguridad en archivo es opcional."
            : "Todo se guarda solo en este dispositivo. Nada se envía a ningún servidor. Por eso conviene hacer una copia de seguridad cada semana."}
        </p>
        {state.data && !state.data.info.persistent && <Alert tone="warning" title="Este navegador no guarda los datos">Se perderán al cerrar la pestaña.</Alert>}
        {state.data && !state.data.protectedStorage && (
          <p className="text-sm text-text-muted">El navegador todavía no protege los datos de esta app. Instalarla lo soluciona en la mayoría de móviles.</p>
        )}
        <Card className="flex flex-col gap-3">
          <h3 className="font-semibold">Todos tus datos, para leer sin la app</h3>
          <p className="text-sm text-text-muted">
            Un archivo .zip con la historia clínica de cada paciente (se abre en cualquier navegador y se imprime), un Excel con todo y la copia de
            seguridad. Es lo que te llevas si un día dejas Cénit.
          </p>
          <FullExportButton name={cloud?.clinic?.name ?? "Fisiolab"} />
        </Card>
        <Card className="flex flex-col gap-3">
          <p className="text-sm">Última copia: {state.data?.lastBackup ? fmtDateTime(state.data.lastBackup) : "nunca"}</p>
          <Button
            icon={<Download aria-hidden="true" className="size-5" />}
            loading={busy === "backup"}
            onClick={() =>
              run("backup", async () => {
                const db = getDb();
                download(`fisiolab-copia-${stamp()}.sqlite3`, (await db.exportBytes()) as BlobPart, "application/vnd.sqlite3");
                await setSetting(db, "last_backup_at", new Date().toISOString());
                toast("Copia descargada. Guárdala fuera del móvil (correo, nube de la clínica…).", "success");
              })
            }
          >
            Descargar copia de seguridad
          </Button>
          <input
            ref={input}
            type="file"
            accept=".sqlite3,.sqlite,.db,application/octet-stream,application/vnd.sqlite3"
            className="sr-only"
            aria-label="Elegir copia de seguridad"
            onChange={(e) => setPending(e.target.files?.[0] ?? null)}
          />
          <Button variant="secondary" icon={<FileUp aria-hidden="true" className="size-5" />} onClick={() => input.current?.click()}>
            Restaurar una copia
          </Button>
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="h-exportar">
        <h2 id="h-exportar" className="text-lg">
          Exportar los resultados
        </h2>
        <p className="text-sm text-text-muted">Todas las mediciones, cuestionarios y tests de exploración en una tabla para Excel.</p>
        <Card className="flex flex-col gap-3">
          <Button
            variant="secondary"
            icon={<Download aria-hidden="true" className="size-5" />}
            loading={busy === "csv"}
            onClick={() =>
              run("csv", async () => {
                download(`fisiolab-resultados-${stamp()}.csv`, await exportCsv(getDb()), "text/csv;charset=utf-8");
              })
            }
          >
            Exportar resultados a Excel (CSV)
          </Button>
          <DriveSaveButton
            label="Guardar los resultados en mi Drive (CSV)"
            make={async () => ({ name: `fisiolab-resultados-${stamp()}.csv`, mimeType: "text/csv", bytes: new TextEncoder().encode(await exportCsv(getDb())) })}
          />
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="h-ejemplo">
        <h2 id="h-ejemplo" className="text-lg">
          Datos de ejemplo
        </h2>
        <p className="text-sm text-text-muted">Pacientes ficticios, con el nombre empezando por «Ejemplo ·», para probar la app sin pacientes reales.</p>
        {/* Hasta saber si ya hay datos de ejemplo no se ofrece nada: evita cargarlos dos veces. */}
        {!state.data ? null : state.data.seed ? (
          <Button
            variant="secondary"
            loading={busy === "seed"}
            disabled={busy !== null}
            onClick={() => run("seed", async () => toast(`${await removeSeed(getDb())} pacientes de ejemplo borrados`, "success"))}
          >
            Borrar los datos de ejemplo
          </Button>
        ) : (
          <Button
            variant="secondary"
            icon={<Database aria-hidden="true" className="size-5" />}
            loading={busy === "seed"}
            disabled={busy !== null}
            onClick={() =>
              run("seed", async () => {
                await loadSeed(getDb());
                toast("Datos de ejemplo cargados", "success");
              })
            }
          >
            Cargar datos de ejemplo
          </Button>
        )}
      </section>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="¿Restaurar esta copia?">
        <p>Los datos actuales de este dispositivo se sustituirán por los de «{pending?.name}». Si no tienes copia de lo actual, descárgala antes.</p>
        <Button
          variant="danger"
          block
          loading={busy === "restore"}
          onClick={() =>
            run("restore", async () => {
              const bytes = new Uint8Array(await pending!.arrayBuffer());
              setPending(null);
              await getDb().importBytes(bytes);
              toast("Copia restaurada", "success");
            })
          }
        >
          Sustituir mis datos
        </Button>
        <Button variant="secondary" block onClick={() => setPending(null)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}

/** Ajustes → Aspecto: claro, oscuro o como el dispositivo. Vale para este dispositivo. */
export function AppearancePage() {
  const [theme, setTheme] = useTheme();
  const options: { id: Theme; hint: string }[] = [
    { id: "auto", hint: "Claro u oscuro según el ajuste del teléfono u ordenador" },
    { id: "light", hint: "Siempre claro" },
    { id: "dark", hint: "Siempre oscuro" },
  ];
  return (
    <Page title="Aspecto" backTo="/ajustes">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-text-muted">Cómo se ve la app en este dispositivo. Los informes y documentos se ven siempre en claro, como en papel.</legend>
        {options.map((o) => (
          <label key={o.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-border bg-bg px-4 py-2 has-[:checked]:border-accent">
            <input type="radio" name="tema" className="size-5 shrink-0 accent-[var(--color-accent)]" checked={theme === o.id} onChange={() => setTheme(o.id)} />
            <span className="flex flex-col">
              <span className="font-semibold">{THEME_LABELS[o.id]}</span>
              <span className="text-sm text-text-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Page>
  );
}
