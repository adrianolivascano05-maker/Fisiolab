// Entrada con Google y sincronización (src/cloud/README.md). Con la nube activada (public/cloud.json) no se entra
// en la app sin cuenta; cada cuenta abre su base en el dispositivo y la junta con su copia de Google Drive o, con el
// servidor de Cloudflare, cada cuenta elige su clínica (clinic.ts) y trabaja con la base que comparte su equipo.
// Sin la nube activada no hace nada: la app funciona solo en el dispositivo, como siempre.
import { BootFallback } from "../app/RouteFallback";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { configureDb, getDb } from "../data/db";
import { setMember } from "../data/member";
import { ensureDevice } from "../data/editors";
import { ensureStaff } from "../data/schedule";
import { cacheDrop } from "../documents/cache";
import { adoptionDone, clearAccount, dbFileFor, getAccount, setAccount, type Account } from "./account";
import { authErrorText, clearToken, getToken, revokeToken, setCopyInDrive, silentTriedRecently, startLogin, takeRedirectResult, type RedirectResult, type Token } from "./auth";
import { adoptedIntoClinic, chooseClinic, chosenClinic, clinicApi, clinicDbFile, clinicScope, forgetClinic, isOperator, rememberOperator, setClinicNotice, takeClinicNotice, type ChosenClinic, type Me } from "./clinic";
import { loadCloudConfig, type CloudConfig } from "./config";
import { forgetKey } from "./crypt";
import { checkExpired, daysSinceCheck, forgetCheck, offlineDays, OFFLINE_DAYS_KEY, recordCheck } from "./offlineExpiry";
import { getSetting } from "../data/repo";
import { AuthError, userInfo } from "./drive";
import { CalendarSync } from "./googleCalendar";
import { cloudflareStore, driveStore, ServerError } from "./remote";
import { SyncController } from "./sync";
import { CloudContext, errText, type Cloud } from "./cloudContext";
import { Splash, LoginScreen, WelcomeScreen, ReconnectScreen, ClinicScreen, ExpiredScreen, type ClinicScreenProps } from "./screens";

/**
 * En una clínica, al abrir: si ya no es del equipo, se borran sus datos de este dispositivo; si ha cambiado su nombre
 * o el papel de quien ha entrado, se pone al día. Devuelve si el servidor ha contestado («checked», y se apunta la
 * fecha: offlineExpiry.ts), si le ha echado («left») o si no se ha podido comprobar («unknown»).
 */
async function refreshClinic(cloud: Cloud, token: Token): Promise<"checked" | "left" | "unknown"> {
  const current = cloud.clinic!;
  let me: Me;
  try {
    me = await cloud.clinics!.me(token);
  } catch {
    return "unknown"; // sin conexión o el servidor no responde: ya se mirará la próxima vez
  }
  rememberOperator(cloud.account, !!me.operator);
  const now = me.clinics.find((c) => c.id === current.id);
  if (!now) {
    forgetCheck(cloud.sync.scope);
    await cloud.leaveClinic(`Ya no formas parte de «${current.name}»: sus pacientes se han borrado de este dispositivo.`);
    return "left";
  }
  recordCheck(cloud.sync.scope);
  if (now.name !== current.name || now.role !== current.role || !!now.suspended !== !!current.suspended) cloud.updateClinic(now);
  return "checked";
}

// La vuelta de Google se lee una sola vez (React en modo estricto monta dos veces).
let redirect: RedirectResult | null | undefined;
const redirectOnce = () => (redirect === undefined ? (redirect = takeRedirectResult()) : redirect);

type Phase =
  | { kind: "loading" }
  | { kind: "local" }
  | { kind: "login"; config: CloudConfig; error: string | null }
  | { kind: "welcome"; config: CloudConfig; account: Account; localPatients: number }
  | ({ kind: "clinic" } & ClinicScreenProps)
  | { kind: "wait"; text: string }
  /** `clinic`: la elegida (undefined: aún no hay, y sin conexión no se puede seguir). */
  | { kind: "reconnect"; config: CloudConfig; account: Account; clinic?: ChosenClinic | null; error: string | null }
  /** Demasiados días sin que el servidor confirme que sigue en la clínica (offlineExpiry.ts): hasta que haya conexión. */
  | { kind: "expired"; clinic: ChosenClinic; days: number; online: boolean }
  | { kind: "ready"; cloud: Cloud };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const home = () => location.assign(import.meta.env.BASE_URL);
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
    await cacheDrop(sync.scope); // los archivos de los pacientes guardados aquí (src/documents)
  };
  const cloud: Cloud = {
    config,
    account,
    clinic: clinic && { id: clinic.id, name: clinic.name, role: clinic.role, suspended: clinic.suspended },
    clinics: config.cloudflareUrl ? clinicApi(config.cloudflareUrl) : null,
    operator: !!config.cloudflareUrl && isOperator(account),
    switchClinic: async () => {
      if (sync.current.pending) await sync.sync();
      cloud.closing = true;
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
      cloud.closing = true;
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
      cloud.closing = true;
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
        setMember(clinic ? account.sub : null, account.email);
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
      // Caducidad sin conexión: si hace demasiados días que el servidor no confirma que sigue en la clínica, no se
      // enseña nada hasta comprobarlo (con conexión: si sigue, se abre; si no, refreshClinic borra sus datos).
      if (clinic) {
        const limit = offlineDays(await getSetting<number>(getDb(), OFFLINE_DAYS_KEY).catch(() => undefined));
        if (checkExpired(cloud.sync.scope, limit)) {
          const result = token && navigator.onLine ? await refreshClinic(cloud, token) : "unknown";
          if (result === "left") return;
          if (result === "unknown") {
            cloud.closing = true;
            cloud.sync.stop();
            return setPhase({ kind: "expired", clinic, days: daysSinceCheck(cloud.sync.scope), online: navigator.onLine });
          }
        }
      }
      if (token) {
        if (clinic) void refreshClinic(cloud, token);
        // Al abrir, primero lo que haya en la nube (hasta unos segundos; si tarda, sigue en segundo plano).
        setPhase({ kind: "wait", text: server ? "Sincronizando con el servidor de la clínica…" : "Sincronizando con Google Drive…" });
        await Promise.race([cloud.sync.sync(), wait(6000)]);
        if (cloud.sync.current.status !== "syncing") cloud.sync.seenNewData(); // la pantalla aún no se ha abierto
      }
      // En el horario de la clínica, cada persona sale con su nombre de Google.
      if (clinic) {
        await ensureStaff(getDb(), account.email, account.name, true).catch(() => {});
        // «Editado por»: este dispositivo es de esta persona.
        await ensureDevice(getDb(), account.email, account.name).catch(() => {});
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
      if (me) rememberOperator(account, !!me.operator);
      const notice = takeClinicNotice();
      // Lo normal en un equipo: una sola clínica y nada que llevar a ella. Se entra sin preguntar.
      if (me && !me.canCreate && me.clinics.length === 1 && n === 0 && !notice && !me.deleted?.length) {
        chooseClinic(account, me.clinics[0]!);
        return location.reload();
      }
      setPhase({ kind: "clinic", config, account, me, error, localPatients: n, notice });
    }
  }, []);

  const remount = () => setVersion((v) => v + 1);

  switch (phase.kind) {
    case "loading":
      return <BootFallback />;
    case "local":
      return children;
    case "wait":
      return <Splash text={phase.text} />;
    case "login":
      return <LoginScreen config={phase.config} error={phase.error} />;
    case "welcome":
      return <WelcomeScreen account={phase.account} localPatients={phase.localPatients} />;
    case "expired":
      return <ExpiredScreen clinic={phase.clinic.name} days={phase.days} online={phase.online} />;
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
