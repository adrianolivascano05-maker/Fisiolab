// Entrada con Google y sincronización (src/cloud/README.md). Con la nube activada (public/cloud.json) no se entra
// en la app sin cuenta; cada cuenta abre su base en el dispositivo y la junta con su copia de Google Drive.
// Sin la nube activada no hace nada: la app funciona solo en el dispositivo, como siempre.
import { CloudOff, LogIn, RefreshCw, TriangleAlert } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { configureDb, getDb } from "../data/db";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { LogoMark } from "../ui/Logo";
import { Sheet } from "../ui/Sheet";
import { adoptionDone, clearAccount, dbFileFor, getAccount, setAccount, type Account } from "./account";
import { authErrorText, getToken, revokeToken, silentTriedRecently, startLogin, takeRedirectResult, type RedirectResult } from "./auth";
import { loadCloudConfig, type CloudConfig } from "./config";
import { forgetKey } from "./crypt";
import { KeyPrompt } from "./EncryptionParts";
import { userInfo } from "./drive";
import { CalendarSync, type CalendarState } from "./googleCalendar";
import { SyncController, type SyncState } from "./sync";

type Cloud = {
  config: CloudConfig;
  account: Account;
  sync: SyncController;
  /** Las citas en Google Calendar: después de cada sincronización. */
  calendar: CalendarSync;
  /** Volver a entrar con Google (ir y volver): para cuando el token ha caducado. */
  reconnect: () => void;
  /** Cerrar sesión. `wipe`: borrar también los datos de esta cuenta en el dispositivo (la nube no se toca). */
  logout: (wipe: boolean) => Promise<void>;
  /** Enseñar los datos que han llegado de otro dispositivo (vuelve a cargar la pantalla). */
  showNewData: () => void;
};

const CloudContext = createContext<Cloud | null>(null);

/** La cuenta y la sincronización, o null si la app funciona sin nube. */
export function useCloud() {
  return useContext(CloudContext);
}

export function useCalendarState(): CalendarState | null {
  const cloud = useCloud();
  const [state, setState] = useState(cloud?.calendar.current ?? null);
  useEffect(() => cloud?.calendar.subscribe(setState), [cloud]);
  return state;
}

export function useSyncState(): SyncState | null {
  const cloud = useCloud();
  const [state, setState] = useState(cloud?.sync.current ?? null);
  useEffect(() => cloud?.sync.subscribe(setState), [cloud]);
  return state;
}

// La vuelta de Google se lee una sola vez (React en modo estricto monta dos veces).
let redirect: RedirectResult | null | undefined;
const redirectOnce = () => (redirect === undefined ? (redirect = takeRedirectResult()) : redirect);

type Phase =
  | { kind: "loading" }
  | { kind: "local" }
  | { kind: "login"; config: CloudConfig; error: string | null }
  | { kind: "welcome"; config: CloudConfig; account: Account; localPatients: number }
  | { kind: "wait"; text: string }
  | { kind: "reconnect"; config: CloudConfig; account: Account; error: string | null }
  | { kind: "ready"; cloud: Cloud };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const home = () => location.assign(import.meta.env.BASE_URL);

/** La cuenta lista para usar, con su sincronización en marcha. `remount`: vuelve a cargar la pantalla. */
function startCloud(config: CloudConfig, account: Account, remount: () => void): Cloud {
  const sync = new SyncController(getDb(), account);
  const calendar = new CalendarSync(getDb(), account);
  // Al acabar cada sincronización con Drive (ya con las citas de los otros dispositivos), al calendario.
  let last = sync.current.status;
  sync.subscribe((s) => {
    if (last === "syncing" && s.status === "idle") void calendar.run();
    last = s.status;
  });
  sync.start();
  void calendar.run(); // para saber ya si está activado y con permiso
  return {
    config,
    account,
    sync,
    calendar,
    reconnect: () => startLogin(config.googleClientId, { hint: account.email }),
    logout: async (wipe) => {
      sync.stop();
      if (wipe) {
        await getDb().wipe();
        sync.forgetMeta();
        forgetKey(account.sub);
      }
      await revokeToken();
      clearAccount();
      home();
    },
    showNewData: () => {
      sync.seenNewData();
      remount();
    },
  };
}

export function CloudGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const config = await loadCloudConfig();
      if (!config) {
        // Sin nube. Si ya se entró con una cuenta (la nube estuvo activada), sus datos están en la base de esa cuenta.
        const last = getAccount();
        configureDb(last ? dbFileFor(last) : null);
        return setPhase({ kind: "local" });
      }
      const r = redirectOnce();
      let account = getAccount();

      if (r?.token) {
        // Vuelve de Google con un token: ¿de quién es?
        let info: Account;
        try {
          info = await userInfo(r.token.accessToken);
        } catch {
          return setPhase({ kind: "login", config, error: "No se pudo comprobar la cuenta con Google. Revisa la conexión y vuelve a intentarlo." });
        }
        if (!account) {
          // Primera vez en este dispositivo: ¿había pacientes guardados sin cuenta?
          configureDb(null);
          const [{ n }] = await getDb().query<{ n: number }>("select count(*) as n from patients");
          if (n > 0) return setPhase({ kind: "welcome", config, account: info, localPatients: n });
          setAccount(info, false);
          return location.reload();
        }
        if (info.sub !== account.sub) {
          // Ha elegido otra cuenta en Google: se cambia a esa (los datos de la anterior se quedan en su base).
          setAccount(info, false);
          return location.reload();
        }
      }

      if (!account) return setPhase({ kind: "login", config, error: r?.error && !r.silent ? authErrorText(r.error) : null });

      configureDb(dbFileFor(account));
      await getDb().info();
      adoptionDone();
      account = getAccount()!;

      const token = getToken();
      if (!token) {
        if (r?.error && !r.silent) return setPhase({ kind: "reconnect", config, account, error: authErrorText(r.error) });
        if (r?.error) return setPhase({ kind: "reconnect", config, account, error: null }); // la sesión de Google no está abierta
        if (navigator.onLine && !silentTriedRecently()) {
          setPhase({ kind: "wait", text: "Entrando con Google…" });
          return startLogin(config.googleClientId, { silent: true, hint: account.email });
        }
      }
      const cloud = startCloud(config, account, remount);
      if (token) {
        // Al abrir, primero lo que haya en la nube (hasta unos segundos; si tarda, sigue en segundo plano).
        setPhase({ kind: "wait", text: "Sincronizando con Google Drive…" });
        await Promise.race([cloud.sync.sync(), wait(6000)]);
        if (cloud.sync.current.status !== "syncing") cloud.sync.seenNewData(); // la pantalla aún no se ha abierto
      }
      setPhase({ kind: "ready", cloud });
    })();
  }, []);

  const remount = () => setVersion((v) => v + 1);

  switch (phase.kind) {
    case "loading":
      return null;
    case "local":
      return children;
    case "wait":
      return <Splash text={phase.text} />;
    case "login":
      return <LoginScreen config={phase.config} error={phase.error} />;
    case "welcome":
      return <WelcomeScreen account={phase.account} localPatients={phase.localPatients} />;
    case "reconnect":
      return (
        <ReconnectScreen
          account={phase.account}
          error={phase.error}
          onContinue={() => startLogin(phase.config.googleClientId, { hint: phase.account.email })}
          onOther={() => startLogin(phase.config.googleClientId, { chooseAccount: true })}
          onOffline={() => setPhase({ kind: "ready", cloud: startCloud(phase.config, phase.account, remount) })}
        />
      );
    case "ready":
      return (
        <CloudContext.Provider value={phase.cloud}>
          <div key={version} className="contents">
            {children}
          </div>
        </CloudContext.Provider>
      );
  }
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--layout-content-max)] flex-col justify-center gap-5 p-4">
      <div className="flex items-center gap-3">
        <LogoMark size={44} />
        <span className="flex flex-col leading-none">
          <span className="text-xl font-semibold text-brand" style={{ fontFamily: "var(--font-display)" }}>
            Cénit
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Fisiolab</span>
        </span>
      </div>
      {children}
    </main>
  );
}

function Splash({ text }: { text: string }) {
  return (
    <Shell>
      <p role="status" className="flex items-center gap-2 text-text-muted">
        <RefreshCw aria-hidden="true" className="size-5 animate-spin" /> {text}
      </p>
    </Shell>
  );
}

function LoginScreen({ config, error }: { config: CloudConfig; error: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
      <h1 className="text-xl">Entra con tu cuenta de Google</h1>
      <p>
        Tus pacientes se guardan en este dispositivo y en tu Google Drive, en una carpeta oculta que solo usa esta app. Así los tienes en cualquier
        móvil u ordenador donde entres con tu cuenta.
      </p>
      <p className="text-sm text-text-muted">Cada fisioterapeuta entra con su cuenta y solo ve sus pacientes.</p>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      {!navigator.onLine && <p className="text-sm text-warning">Sin conexión: para entrar la primera vez hace falta internet.</p>}
      <Button
        size="lg"
        block
        loading={busy}
        icon={<LogIn aria-hidden="true" className="size-5" />}
        onClick={() => {
          setBusy(true);
          startLogin(config.googleClientId, { chooseAccount: true });
        }}
      >
        Entrar con Google
      </Button>
    </Shell>
  );
}

function WelcomeScreen({ account, localPatients }: { account: Account; localPatients: number }) {
  const choose = (adopt: boolean) => {
    setAccount(account, adopt);
    location.reload();
  };
  return (
    <Shell>
      <h1 className="text-xl">Hola, {account.name.split(" ")[0]}</h1>
      <Card className="flex flex-col gap-3">
        <p>
          En este dispositivo hay <span className="font-semibold">{localPatients === 1 ? "1 paciente guardado" : `${localPatients} pacientes guardados`}</span> sin
          cuenta. ¿Pasarlos a tu cuenta ({account.email})?
        </p>
        <p className="text-sm text-text-muted">Si son de otro fisioterapeuta, no los pases: que entre él con su cuenta en este dispositivo.</p>
        <Button block onClick={() => choose(true)}>
          Pasarlos a mi cuenta
        </Button>
        <Button variant="secondary" block onClick={() => choose(false)}>
          No, empezar con mi cuenta
        </Button>
      </Card>
    </Shell>
  );
}

function ReconnectScreen({ account, error, onContinue, onOther, onOffline }: { account: Account; error: string | null; onContinue: () => void; onOther: () => void; onOffline: () => void }) {
  return (
    <Shell>
      <h1 className="text-xl">Hola, {account.name.split(" ")[0]}</h1>
      <p>
        Vuelve a entrar con Google para traer y guardar tus pacientes en la nube. Entrarás como <span className="font-semibold">{account.email}</span>.
      </p>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-md bg-danger-soft p-3 text-sm text-danger">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {error}
        </p>
      )}
      <Button size="lg" block icon={<LogIn aria-hidden="true" className="size-5" />} onClick={onContinue}>
        Continuar con Google
      </Button>
      <Button variant="secondary" block onClick={onOther}>
        Entrar con otra cuenta
      </Button>
      <Button variant="ghost" block icon={<CloudOff aria-hidden="true" className="size-5" />} onClick={onOffline}>
        Seguir sin conexión
      </Button>
      <p className="text-sm text-text-muted">Sin conexión trabajas con lo que hay en este dispositivo; se sube a la nube la próxima vez que entres.</p>
    </Shell>
  );
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
};

/** Cómo va la sincronización, en una frase. */
export function syncText(s: SyncState): string {
  switch (s.status) {
    case "syncing":
      return "Sincronizando…";
    case "needs-auth":
      return s.pending ? "Hay cambios sin subir: vuelve a entrar con Google." : "Sin sincronizar: vuelve a entrar con Google.";
    case "needs-key":
      return "La copia de tu Drive está cifrada: escribe su contraseña para sincronizar.";
    case "offline":
      return s.pending ? "Sin conexión: los cambios se subirán al volver la conexión." : "Sin conexión.";
    case "error":
      return `No se pudo sincronizar: ${s.error}`;
    default:
      return s.pending ? "Cambios pendientes de subir." : s.lastSyncAt ? `Guardado en tu Drive ${ago(s.lastSyncAt)}.` : "Aún sin sincronizar.";
  }
}

/** Aviso arriba de cada pantalla cuando hay algo que hacer: volver a entrar, ver datos nuevos o reintentar. */
export function SyncNotice() {
  const cloud = useCloud();
  const s = useSyncState();
  if (!cloud || !s) return null;
  const row = (text: string, action?: ReactNode) => (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm">
      <span>{text}</span>
      {action}
    </div>
  );
  if (s.newData)
    return row(
      "Hay datos nuevos de otro dispositivo.",
      <Button size="sm" onClick={cloud.showNewData}>
        Mostrar
      </Button>,
    );
  if (s.status === "needs-auth" && s.pending)
    return row(
      syncText(s),
      <Button size="sm" onClick={cloud.reconnect}>
        Entrar con Google
      </Button>,
    );
  if (s.status === "needs-key") return row(syncText(s), <KeyPrompt size="sm" />);
  if (s.status === "error")
    return row(
      syncText(s),
      <Button size="sm" variant="secondary" onClick={() => void cloud.sync.sync()}>
        Reintentar
      </Button>,
    );
  return null;
}

/** Ajustes → Cuenta: quién ha entrado, cómo va la sincronización y cerrar sesión. */
export function CloudSettings() {
  const cloud = useCloud();
  const s = useSyncState();
  const [confirm, setConfirm] = useState<null | "logout" | "wipe">(null);
  const [busy, setBusy] = useState(false);
  if (!cloud || !s) return null;
  const { account } = cloud;
  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-cuenta">
      <h2 id="h-cuenta" className="text-lg">
        Cuenta
      </h2>
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {account.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{account.name}</span>
            <span className="truncate text-sm text-text-muted">{account.email}</span>
          </span>
        </div>
        <p className="text-sm" role="status">
          {syncText(s)}
        </p>
        {s.status === "needs-auth" ? (
          <Button icon={<LogIn aria-hidden="true" className="size-5" />} onClick={cloud.reconnect}>
            Entrar con Google para sincronizar
          </Button>
        ) : (
          <Button icon={<RefreshCw aria-hidden="true" className="size-5" />} loading={s.status === "syncing"} onClick={() => void cloud.sync.sync()}>
            Sincronizar ahora
          </Button>
        )}
        <Button variant="secondary" onClick={() => setConfirm("logout")}>
          Cerrar sesión
        </Button>
        <Button variant="ghost" className="text-danger" onClick={() => setConfirm("wipe")}>
          Cerrar sesión y borrar los datos de este dispositivo
        </Button>
      </Card>
      <Sheet open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "wipe" ? "¿Borrar los datos de este dispositivo?" : "¿Cerrar sesión?"}>
        {s.pending && (
          <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Hay cambios que aún no están en tu Drive. Sincroniza antes, o se
            {confirm === "wipe" ? " perderán." : " subirán la próxima vez que entres en este dispositivo."}
          </p>
        )}
        <p>
          {confirm === "wipe"
            ? "Se borran tus pacientes de este dispositivo. La copia de tu Google Drive no se toca: al volver a entrar, vuelven."
            : "Tus pacientes se quedan en este dispositivo, pero hará falta entrar con tu cuenta para verlos."}
        </p>
        <Button
          variant={confirm === "wipe" ? "danger" : "primary"}
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await cloud.logout(confirm === "wipe");
          }}
        >
          {confirm === "wipe" ? "Borrar y cerrar sesión" : "Cerrar sesión"}
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(null)}>
          Cancelar
        </Button>
      </Sheet>
    </section>
  );
}
