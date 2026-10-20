// Entrada con Google y sincronización (src/cloud/README.md). Con la nube activada (public/cloud.json) no se entra
// en la app sin cuenta; cada cuenta abre su base en el dispositivo y la junta con su copia de Google Drive o, con el
// servidor de Cloudflare, cada cuenta elige su clínica (clinic.ts) y trabaja con la base que comparte su equipo.
// Sin la nube activada no hace nada: la app funciona solo en el dispositivo, como siempre.
import { Building2, ChevronRight, CloudOff, LogIn, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { configureDb, getDb } from "../data/db";
import { setMember } from "../data/member";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { LogoMark } from "../ui/Logo";
import { Sheet } from "../ui/Sheet";
import { adoptionDone, clearAccount, dbFileFor, getAccount, setAccount, type Account } from "./account";
import { authErrorText, clearToken, getToken, revokeToken, setCopyInDrive, silentTriedRecently, startLogin, takeRedirectResult, type RedirectResult, type Token } from "./auth";
import {
  adoptedIntoClinic,
  chooseClinic,
  chosenClinic,
  clinicApi,
  clinicDbFile,
  clinicScope,
  forgetClinic,
  ROLE_LABELS,
  setClinicNotice,
  takeClinicNotice,
  type ChosenClinic,
  type Clinic,
  type ClinicApi,
  type Me,
} from "./clinic";
import { loadCloudConfig, type CloudConfig } from "./config";
import { forgetKey } from "./crypt";
import { KeyPrompt } from "./EncryptionParts";
import { AuthError, userInfo } from "./drive";
import { CalendarSync, type CalendarState } from "./googleCalendar";
import { cloudflareStore, driveStore, ServerError } from "./remote";
import { SyncController, type SyncState } from "./sync";

type Cloud = {
  config: CloudConfig;
  account: Account;
  /** La clínica en la que se trabaja (con el servidor de Cloudflare); null con Google Drive. */
  clinic: Clinic | null;
  /** Lo que se pide al servidor sobre clínicas y equipo; null con Google Drive. */
  clinics: ClinicApi | null;
  /** Ir a la pantalla de elegir clínica (los datos de esta se quedan en el dispositivo). */
  switchClinic: () => Promise<void>;
  /** La clínica ha cambiado de nombre, o quien ha entrado de papel: se recuerda y se vuelve a pintar la pantalla. */
  updateClinic: (c: Clinic) => void;
  /** Dejar la clínica en este dispositivo: se borran de aquí sus datos y se vuelve a elegir clínica, con `notice`. */
  leaveClinic: (notice: string) => Promise<void>;
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

/**
 * En una clínica, al abrir: si ya no es del equipo, se borran sus datos de este dispositivo; si ha cambiado su nombre
 * o el papel de quien ha entrado, se pone al día.
 */
async function refreshClinic(cloud: Cloud, token: Token) {
  const current = cloud.clinic!;
  let me: Me;
  try {
    me = await cloud.clinics!.me(token);
  } catch {
    return; // sin conexión o el servidor no responde: ya se mirará la próxima vez
  }
  const now = me.clinics.find((c) => c.id === current.id);
  if (!now) return cloud.leaveClinic(`Ya no formas parte de «${current.name}»: sus pacientes se han borrado de este dispositivo.`);
  if (now.name !== current.name || now.role !== current.role) cloud.updateClinic(now);
}

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
  | { kind: "clinic"; config: CloudConfig; account: Account; me: Me | null; error: string | null; localPatients: number; notice: string | null }
  | { kind: "wait"; text: string }
  /** `clinic`: la elegida (undefined: aún no hay, y sin conexión no se puede seguir). */
  | { kind: "reconnect"; config: CloudConfig; account: Account; clinic?: ChosenClinic | null; error: string | null }
  | { kind: "ready"; cloud: Cloud };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const home = () => location.assign(import.meta.env.BASE_URL);
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** La cuenta lista para usar, con su sincronización en marcha. `remount`: vuelve a cargar la pantalla. */
function startCloud(config: CloudConfig, account: Account, remount: () => void, clinic: ChosenClinic | null): Cloud {
  const store = config.cloudflareUrl ? cloudflareStore(config.cloudflareUrl, clinic?.id) : driveStore;
  const sync = new SyncController(getDb(), account, store, clinic ? clinicScope(account, clinic) : account.sub);
  const calendar = new CalendarSync(getDb(), account);
  // Al acabar cada sincronización (ya con las citas de los otros dispositivos), al calendario. También si solo falta
  // la contraseña de cifrado: lo de la nube ya se ha juntado aquí, solo no se ha podido subir.
  let last = sync.current.status;
  sync.subscribe((s) => {
    if (last === "syncing" && (s.status === "idle" || s.status === "needs-password")) void calendar.run();
    last = s.status;
  });
  sync.start();
  void calendar.run(); // para saber ya si está activado y con permiso
  /** Borra de este dispositivo los datos de la base abierta, sin tocar la copia de la nube. */
  const wipe = async () => {
    await getDb().wipe();
    sync.forgetMeta();
    await forgetKey(sync.scope);
  };
  const cloud: Cloud = {
    config,
    account,
    clinic: clinic && { id: clinic.id, name: clinic.name, role: clinic.role },
    clinics: config.cloudflareUrl ? clinicApi(config.cloudflareUrl) : null,
    switchClinic: async () => {
      if (sync.current.pending) await sync.sync();
      sync.stop();
      forgetClinic(account);
      home();
    },
    updateClinic: (c) => {
      chooseClinic(account, c);
      cloud.clinic = c;
      remount();
    },
    leaveClinic: async (notice) => {
      sync.stop();
      await wipe();
      forgetClinic(account);
      setClinicNotice(notice);
      home();
    },
    sync,
    calendar,
    reconnect: () => startLogin(config.googleClientId, { hint: account.email }),
    logout: async (wipeData) => {
      sync.stop();
      if (wipeData) await wipe();
      await revokeToken();
      clearAccount();
      home();
    },
    showNewData: () => {
      sync.seenNewData();
      remount();
    },
  };
  return cloud;
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
      setCopyInDrive(!config.cloudflareUrl);
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

      // Con el servidor de Cloudflare se trabaja en una clínica: la primera vez en este dispositivo, se elige.
      const server = config.cloudflareUrl;
      const clinic = server ? chosenClinic(account) : null;
      if (server && !clinic) {
        if ((await pickClinic(config, account, r)) !== "old-server") return;
        // El servidor aún es de antes de las clínicas (falta pegar el worker.js nuevo): la copia de la cuenta, como antes.
      } else {
        configureDb(clinic ? clinicDbFile(account, clinic) : dbFileFor(account));
        setMember(clinic ? account.sub : null);
        await getDb().info();
        if (clinic) adoptedIntoClinic(account);
        else adoptionDone();
      }
      account = getAccount()!;

      const token = getToken();
      if (!token) {
        if (r?.error && !r.silent) return setPhase({ kind: "reconnect", config, account, clinic, error: authErrorText(r.error) });
        if (r?.error) return setPhase({ kind: "reconnect", config, account, clinic, error: null }); // la sesión de Google no está abierta
        if (navigator.onLine && !silentTriedRecently()) {
          setPhase({ kind: "wait", text: "Entrando con Google…" });
          return startLogin(config.googleClientId, { silent: true, hint: account.email });
        }
      }
      const cloud = startCloud(config, account, remount, clinic);
      if (token) {
        if (clinic) void refreshClinic(cloud, token);
        // Al abrir, primero lo que haya en la nube (hasta unos segundos; si tarda, sigue en segundo plano).
        setPhase({ kind: "wait", text: server ? "Sincronizando con el servidor de la clínica…" : "Sincronizando con Google Drive…" });
        await Promise.race([cloud.sync.sync(), wait(6000)]);
        if (cloud.sync.current.status !== "syncing") cloud.sync.seenNewData(); // la pantalla aún no se ha abierto
      }
      setPhase({ kind: "ready", cloud });
    })();

    /**
     * Sin clínica elegida en este dispositivo: las de la cuenta, según el servidor, y cuántos pacientes hay aquí.
     * «old-server»: el servidor no sabe de clínicas; se sigue con la base de la cuenta, ya abierta.
     */
    async function pickClinic(config: CloudConfig, account: Account, r: RedirectResult | null): Promise<"old-server" | void> {
      configureDb(dbFileFor(account));
      await getDb().info();
      adoptionDone();
      const [{ n }] = await getDb().query<{ n: number }>("select count(*) as n from patients");
      const token = getToken();
      if (!token) {
        if (r?.error) return setPhase({ kind: "reconnect", config, account, error: r.silent ? null : authErrorText(r.error) });
        if (navigator.onLine && !silentTriedRecently()) {
          setPhase({ kind: "wait", text: "Entrando con Google…" });
          return startLogin(config.googleClientId, { silent: true, hint: account.email });
        }
        return setPhase({ kind: "reconnect", config, account, error: null });
      }
      let me: Me | null = null;
      let error: string | null = null;
      try {
        me = await clinicApi(config.cloudflareUrl!).me(token);
      } catch (e) {
        if (e instanceof AuthError) {
          clearToken();
          return setPhase({ kind: "reconnect", config, account, error: null });
        }
        if (e instanceof ServerError && e.status === 404) return "old-server";
        error = navigator.onLine ? errText(e) : "Sin conexión: para elegir la clínica la primera vez hace falta internet.";
      }
      const notice = takeClinicNotice();
      // Lo normal en un equipo: una sola clínica y nada que llevar a ella. Se entra sin preguntar.
      if (me && !me.canCreate && me.clinics.length === 1 && n === 0 && !notice) {
        chooseClinic(account, me.clinics[0]!);
        return location.reload();
      }
      setPhase({ kind: "clinic", config, account, me, error, localPatients: n, notice });
    }
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
    case "clinic":
      return <ClinicScreen {...phase} />;
    case "reconnect": {
      const { config, account, clinic } = phase;
      return (
        <ReconnectScreen
          account={account}
          error={phase.error}
          onContinue={() => startLogin(config.googleClientId, { hint: account.email })}
          onOther={() => startLogin(config.googleClientId, { chooseAccount: true })}
          onOffline={clinic !== undefined ? () => setPhase({ kind: "ready", cloud: startCloud(config, account, remount, clinic) }) : undefined}
        />
      );
    }
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
        {config.cloudflareUrl
          ? "Tus pacientes se guardan en este dispositivo y, cifrados, en el servidor de la clínica (en la Unión Europea). Google solo sirve para entrar."
          : "Tus pacientes se guardan en este dispositivo y en tu Google Drive, en una carpeta oculta que solo usa esta app."}{" "}
        Así los tienes en cualquier móvil u ordenador donde entres con tu cuenta.
      </p>
      <p className="text-sm text-text-muted">
        {config.cloudflareUrl
          ? "Cada clínica tiene sus pacientes: solo los ve su equipo."
          : "Cada fisioterapeuta entra con su cuenta y solo ve sus pacientes."}
      </p>
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

function ReconnectScreen({
  account,
  error,
  onContinue,
  onOther,
  onOffline,
}: {
  account: Account;
  error: string | null;
  onContinue: () => void;
  onOther: () => void;
  /** Sin él (aún no hay clínica elegida), no se puede seguir sin conexión. */
  onOffline?: () => void;
}) {
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
      {onOffline && (
        <>
          <Button variant="ghost" block icon={<CloudOff aria-hidden="true" className="size-5" />} onClick={onOffline}>
            Seguir sin conexión
          </Button>
          <p className="text-sm text-text-muted">Sin conexión trabajas con lo que hay en este dispositivo; se sube a la nube la próxima vez que entres.</p>
        </>
      )}
    </Shell>
  );
}

/**
 * Con el servidor de Cloudflare, la primera vez en este dispositivo: elegir la clínica (o crearla, si la cuenta puede)
 * y, si en el dispositivo hay pacientes de la cuenta, si se llevan a ella.
 */
function ClinicScreen({ config, account, me, error, localPatients, notice }: Extract<Phase, { kind: "clinic" }>) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [picked, setPicked] = useState<Clinic | null>(null);

  const enter = (c: Clinic, adopt: boolean) => {
    chooseClinic(account, { ...c, adopt });
    location.reload();
  };
  const pick = (c: Clinic) => (localPatients > 0 ? setPicked(c) : enter(c, false));

  async function create(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setNameError("Escribe el nombre de la clínica.");
    const token = getToken();
    if (!token) return startLogin(config.googleClientId, { hint: account.email });
    setBusy(true);
    setFailure(null);
    try {
      pick(await clinicApi(config.cloudflareUrl!).create(token, clean));
    } catch (err) {
      setFailure(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const patients = localPatients === 1 ? "1 paciente guardado" : `${localPatients} pacientes guardados`;
  return (
    <Shell>
      <h1 className="text-xl">{picked ? `Entrar en ${picked.name}` : me?.clinics.length ? "Elige tu clínica" : "Tu clínica"}</h1>
      {notice && <Alert tone="warning" title={notice} />}
      {picked ? (
        <Card className="flex flex-col gap-3">
          <p>
            En este dispositivo tienes <span className="font-semibold">{patients}</span> con tu cuenta ({account.email}). ¿Llevarlos a «{picked.name}»?
          </p>
          <p className="text-sm text-text-muted">Los verá todo el equipo de la clínica. Si no los llevas, siguen en tu cuenta en este dispositivo.</p>
          <Button block onClick={() => enter(picked, true)}>
            Llevarlos a la clínica
          </Button>
          <Button variant="secondary" block onClick={() => enter(picked, false)}>
            No, entrar sin ellos
          </Button>
        </Card>
      ) : !me ? (
        <>
          <Alert tone="danger" title="No se pudo consultar el servidor de la clínica">
            {error}
          </Alert>
          <Button icon={<RefreshCw aria-hidden="true" className="size-5" />} onClick={() => location.reload()}>
            Volver a intentarlo
          </Button>
        </>
      ) : (
        <>
          {me.clinics.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Tus clínicas">
              {me.clinics.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-bg px-4 py-2 text-left hover:bg-surface"
                    onClick={() => pick(c)}
                  >
                    <Building2 aria-hidden="true" className="size-5 shrink-0 text-accent" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-semibold">{c.name}</span>
                      <span className="text-sm text-text-muted">{ROLE_LABELS[c.role]}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {me.canCreate ? (
            <Card>
              <form className="flex flex-col gap-3" noValidate onSubmit={create}>
                <h2 className="font-semibold">{me.clinics.length ? "O da de alta otra clínica" : "Da de alta tu clínica"}</h2>
                <p className="text-sm text-text-muted">
                  La administrarás tú: después añades a tu equipo con su correo de Google. Solo vosotros veréis sus pacientes.
                </p>
                <TextField
                  label="Nombre de la clínica"
                  autoComplete="organization"
                  value={name}
                  error={nameError ?? undefined}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                />
                <Button type="submit" loading={busy} icon={<Plus aria-hidden="true" className="size-5" />}>
                  Crear la clínica
                </Button>
              </form>
            </Card>
          ) : (
            me.clinics.length === 0 && (
              <Card className="flex flex-col gap-3">
                <p>
                  Tu cuenta (<span className="font-semibold">{me.email}</span>) aún no está en ninguna clínica.
                </p>
                <p className="text-sm text-text-muted">Pide a quien administra la tuya que te añada con este correo y vuelve a comprobarlo.</p>
                <Button icon={<RefreshCw aria-hidden="true" className="size-5" />} onClick={() => location.reload()}>
                  Volver a comprobar
                </Button>
              </Card>
            )
          )}
          {failure && <Alert tone="danger" title={failure} />}
        </>
      )}
      <Button variant="ghost" block onClick={() => startLogin(config.googleClientId, { chooseAccount: true })}>
        Entrar con otra cuenta
      </Button>
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

/** «de tu Drive», «del servidor de la clínica». */
const deWhere = (where: string) => (where.startsWith("el ") ? `del ${where.slice(3)}` : `de ${where}`);

/** Cómo va la sincronización, en una frase. */
export function syncText(s: SyncState): string {
  switch (s.status) {
    case "syncing":
      return "Sincronizando…";
    case "needs-auth":
      return s.pending ? "Hay cambios sin subir: vuelve a entrar con Google." : "Sin sincronizar: vuelve a entrar con Google.";
    case "needs-key":
      return `La copia ${deWhere(s.where)} está cifrada: escribe su contraseña para sincronizar.`;
    case "needs-password":
      return `La copia ${deWhere(s.where)} va siempre cifrada: elige una contraseña de cifrado para sincronizar.`;
    case "offline":
      return s.pending ? "Sin conexión: los cambios se subirán al volver la conexión." : "Sin conexión.";
    case "error":
      return `No se pudo sincronizar: ${s.error}`;
    default:
      return s.pending ? "Cambios pendientes de subir." : s.lastSyncAt ? `Guardado en ${s.where} ${ago(s.lastSyncAt)}.` : "Aún sin sincronizar.";
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
  if (s.status === "needs-password")
    return row(
      syncText(s),
      <Link to="/ajustes/cuenta" className="tap inline-flex items-center rounded-md bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover">
        Elegir contraseña
      </Link>,
    );
  if (s.status === "error")
    return row(
      syncText(s),
      <Button size="sm" variant="secondary" onClick={() => void cloud.sync.sync()}>
        Reintentar
      </Button>,
    );
  return null;
}

/** Ajustes → Cuenta de Google: quién ha entrado, cómo va la sincronización y cerrar sesión. */
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
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Hay cambios que aún no están en {s.where}. Sincroniza antes, o se
            {confirm === "wipe" ? " perderán." : " subirán la próxima vez que entres en este dispositivo."}
          </p>
        )}
        <p>
          {confirm === "wipe"
            ? `Se borran tus pacientes de este dispositivo. La copia ${deWhere(s.where)} no se toca: al volver a entrar, vuelven.`
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
