// Las pantallas de entrada (CloudGate.tsx decide cuál se ve): entrar con Google, pasar a la cuenta los datos que había
// sin cuenta, volver a entrar y, con el servidor, elegir o dar de alta la clínica.
import { setPendingMode, type ClinicMode } from "./teamMode";
import { Building2, ChevronRight, CloudOff, LogIn, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { LogoMark, Wordmark } from "../ui/Logo";
import { AccessRequestCards } from "./AccessRequest";
import { setAccount, type Account } from "./account";
import { getToken, startLogin } from "./auth";
import { chooseClinic, clinicApi, ROLE_LABELS, type Clinic, type Me } from "./clinic";
import { type CloudConfig } from "./config";
import { errText } from "./cloudContext";


export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[var(--layout-content-max)] flex-col justify-center gap-5 p-4">
      <div className="flex items-center gap-3">
        <LogoMark size={44} />
        <Wordmark className="text-xl" />
      </div>
      {children}
    </main>
  );
}

export function Splash({ text }: { text: string }) {
  return (
    <Shell>
      <p role="status" className="flex items-center gap-2 text-text-muted">
        <RefreshCw aria-hidden="true" className="size-5 animate-spin" /> {text}
      </p>
    </Shell>
  );
}

export function LoginScreen({ config, error }: { config: CloudConfig; error: string | null }) {
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
      <a href={`${import.meta.env.BASE_URL}abrir-copia`} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent underline underline-offset-2">
        Abrir una copia cifrada (sin cuenta)
      </a>
    </Shell>
  );
}

/** Caducidad sin conexión (offlineExpiry.ts): la clínica no se enseña hasta que el servidor confirme que sigue en el equipo. */
export function ExpiredScreen({ clinic, days, online }: { clinic: string; days: number; online: boolean }) {
  return (
    <Shell>
      <h1 className="flex items-center gap-2 text-xl">
        <CloudOff aria-hidden="true" className="size-6 shrink-0 text-accent" /> Hace {days} días que este dispositivo no comprueba que sigues en el equipo
      </h1>
      <p>
        Los pacientes de «{clinic}» no se enseñan hasta comprobarlo con el servidor de la clínica. {online ? "El servidor no ha contestado." : "Sin conexión."} Conéctate
        para seguir: si sigues en el equipo, la app se abre como siempre.
      </p>
      <Button size="lg" block icon={<RefreshCw aria-hidden="true" className="size-5" />} onClick={() => location.reload()}>
        Volver a comprobar
      </Button>
    </Shell>
  );
}

export function WelcomeScreen({ account, localPatients }: { account: Account; localPatients: number }) {
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

export function ReconnectScreen({
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
export type ClinicScreenProps = { config: CloudConfig; account: Account; me: Me | null; error: string | null; localPatients: number; notice: string | null };

export function ClinicScreen({ config, account, me, error, localPatients, notice }: ClinicScreenProps) {
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

  /** Fisio que trabaja por su cuenta o clínica con equipo (src/cloud/teamMode.ts). */
  const [mode, setMode] = useState<ClinicMode>("solo");
  async function create(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setNameError("Escribe el nombre de la clínica.");
    const token = getToken();
    if (!token) return startLogin(config.googleClientId, { hint: account.email });
    setBusy(true);
    setFailure(null);
    try {
      const made = await clinicApi(config.cloudflareUrl!).create(token, clean);
      setPendingMode(made.id, mode);
      pick(made);
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
          {me.canCreate && me.clinics.length > 0 ? (
            // Con clínica ya, dar de alta otra queda plegado: así nadie crea una segunda sin querer en otro dispositivo.
            <details className="rounded-lg border border-border bg-bg p-4">
              <summary className="cursor-pointer font-semibold">Dar de alta otra clínica distinta</summary>
              <div className="mt-3">
              <form className="flex flex-col gap-3" noValidate onSubmit={create}>
                {!me.clinics.length && <h2 className="font-semibold">Da de alta tu clínica</h2>}
                <ModeChoice mode={mode} onChange={setMode} />
                <p className="text-sm text-text-muted">
                  {mode === "solo"
                    ? "Solo tú verás tus pacientes. Si un día abres una clínica, añades a tu equipo desde Ajustes sin perder nada."
                    : "La administrarás tú: después añades a tu equipo con su correo de Google. Solo vosotros veréis sus pacientes."}
                </p>
                <TextField
                  label={mode === "solo" ? "Nombre de tu consulta (o el tuyo)" : "Nombre de la clínica"}
                  autoComplete="organization"
                  value={name}
                  error={nameError ?? undefined}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                />
                <Button type="submit" loading={busy} icon={<Plus aria-hidden="true" className="size-5" />}>
                  {mode === "solo" ? "Empezar" : "Crear la clínica"}
                </Button>
              </form>
              </div>
            </details>
          ) : me.canCreate ? (
            <Card>
              <form className="flex flex-col gap-3" noValidate onSubmit={create}>
                {!me.clinics.length && <h2 className="font-semibold">Da de alta tu clínica</h2>}
                <ModeChoice mode={mode} onChange={setMode} />
                <p className="text-sm text-text-muted">
                  {mode === "solo"
                    ? "Solo tú verás tus pacientes. Si un día abres una clínica, añades a tu equipo desde Ajustes sin perder nada."
                    : "La administrarás tú: después añades a tu equipo con su correo de Google. Solo vosotros veréis sus pacientes."}
                </p>
                <TextField
                  label={mode === "solo" ? "Nombre de tu consulta (o el tuyo)" : "Nombre de la clínica"}
                  autoComplete="organization"
                  value={name}
                  error={nameError ?? undefined}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError(null);
                  }}
                />
                <Button type="submit" loading={busy} icon={<Plus aria-hidden="true" className="size-5" />}>
                  {mode === "solo" ? "Empezar" : "Crear la clínica"}
                </Button>
              </form>
            </Card>
          ) : (
            me.clinics.length === 0 && <AccessRequestCards me={me} baseUrl={config.cloudflareUrl!} clientId={config.googleClientId} />
          )}
          {!!me.deleted?.length && (
            <section aria-labelledby="h-borradas" className="flex flex-col gap-2">
              <h2 id="h-borradas" className="font-semibold">
                Clínicas borradas
              </h2>
              {me.deleted.map((d) => (
                <Card key={d.id} className="flex flex-col gap-2">
                  <p>
                    <span className="font-semibold">{d.name}</span>: en la papelera. Se borra para siempre el{" "}
                    {new Date(d.purgeAfter).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}.
                  </p>
                  <Button
                    variant="secondary"
                    loading={busy}
                    onClick={async () => {
                      const token = getToken();
                      if (!token) return startLogin(config.googleClientId, { hint: account.email });
                      setBusy(true);
                      try {
                        await clinicApi(config.cloudflareUrl!).restore(token, d.id);
                        location.reload();
                      } catch (err) {
                        setFailure(errText(err));
                        setBusy(false);
                      }
                    }}
                  >
                    Recuperar «{d.name}»
                  </Button>
                </Card>
              ))}
            </section>
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

function ModeChoice({ mode, onChange }: { mode: ClinicMode; onChange: (m: ClinicMode) => void }) {
  const option = (value: ClinicMode, title: string, text: string) => (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
      <input type="radio" name="clinic-mode" className="mt-1 size-5 accent-accent" checked={mode === value} onChange={() => onChange(value)} />
      <span className="flex flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-text-muted">{text}</span>
      </span>
    </label>
  );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">¿Cómo trabajas?</legend>
      {option("solo", "Por mi cuenta", "Fisio independiente: sin equipo, turnos ni repartos.")}
      {option("team", "En una clínica con equipo", "Varios fisios (y recepción) con la misma agenda y los mismos pacientes.")}
    </fieldset>
  );
}
