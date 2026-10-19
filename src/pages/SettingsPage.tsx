import { ClipboardCheck, Database, Download, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { fmtDateTime } from "../app/format";
import { Page } from "../app/Page";
import { InstallSteps, useInstall } from "../app/pwa";
import { CloudSettings, useCloud } from "../cloud/CloudGate";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { exportCsv, getSetting, setSetting } from "../data/repo";
import { hasSeed, loadSeed, removeSeed } from "../data/seed";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
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

/** S24 Ajustes */
export function SettingsPage() {
  const toast = useToast();
  const install = useInstall();
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
    <Page title="Ajustes" tabs>
      <CloudSettings />
      <section className="flex flex-col gap-3" aria-labelledby="h-datos">
        <h2 id="h-datos" className="text-lg">Tus datos</h2>
        <p className="text-sm text-text-muted">
          {cloud
            ? "Se guardan en este dispositivo y, cada vez que cambian, en tu Google Drive (una carpeta oculta que solo usa esta app). La copia de seguridad en archivo es opcional."
            : "Todo se guarda solo en este dispositivo. Nada se envía a ningún servidor. Por eso conviene hacer una copia de seguridad cada semana."}
        </p>
        {state.data && !state.data.info.persistent && (
          <Alert tone="warning" title="Este navegador no guarda los datos">Se perderán al cerrar la pestaña.</Alert>
        )}
        <Card className="flex flex-col gap-3">
          <p className="text-sm">
            Última copia: {state.data?.lastBackup ? fmtDateTime(state.data.lastBackup) : "nunca"}
          </p>
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
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="h-validacion">
        <h2 id="h-validacion" className="text-lg">Validación</h2>
        <p className="text-sm text-text-muted">
          Compara Cénit con una plataforma de fuerza, un encoder o un goniómetro, mide cuánto se repite al volver a marcar y comprueba el sensor del móvil.
        </p>
        <Link to="/validacion" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-input bg-bg px-4 font-semibold">
          <ClipboardCheck aria-hidden="true" className="size-5" /> Abrir la validación
        </Link>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="h-instalar">
        <h2 id="h-instalar" className="text-lg">Instalación</h2>
        <Card className="flex flex-col gap-3">
          <InstallSteps {...install} />
          {state.data && (
            <p className="text-sm text-text-muted">
              {state.data.protectedStorage
                ? "El navegador protege los datos de esta app: no los borrará para liberar espacio."
                : "El navegador todavía no protege los datos de esta app. Instalarla lo soluciona en la mayoría de móviles."}
            </p>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="h-ejemplo">
        <h2 id="h-ejemplo" className="text-lg">Datos de ejemplo</h2>
        <p className="text-sm text-text-muted">Pacientes ficticios, con el nombre empezando por «Ejemplo ·», para probar la app.</p>
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
            onClick={() => run("seed", async () => {
              await loadSeed(getDb());
              toast("Datos de ejemplo cargados", "success");
            })}
          >
            Cargar datos de ejemplo
          </Button>
        )}
      </section>

      <Link to="/privacidad" className="font-semibold text-accent underline">
        Privacidad: qué datos guarda la app y dónde
      </Link>
      {state.data && (
        <p className="text-xs text-text-muted">
          Base de datos SQLite {state.data.info.sqliteVersion} · esquema v{state.data.info.schemaVersion} ·{" "}
          {state.data.info.persistent ? "guardado en el dispositivo" : "en memoria"}
        </p>
      )}

      <Sheet open={!!pending} onClose={() => setPending(null)} title="¿Restaurar esta copia?">
        <p>
          Los datos actuales de este dispositivo se sustituirán por los de «{pending?.name}». Si no tienes copia de lo actual, descárgala antes.
        </p>
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
