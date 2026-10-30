// Bloqueo de la app con PIN (src/privacy/README.md), como el del móvil: teclado numérico grande que sale al
// instante, y la app se va abriendo por detrás (la base, la sincronización) mientras se teclea, así que al acertar
// ya está lista. Pide el PIN al abrir, al volver a la app y tras un rato sin usarla. Con cuenta de Google, cada
// persona tiene el suyo en el dispositivo; en una clínica es obligatorio. Si se olvida, tras 5 fallos o si falta el
// PIN donde ya hubo uno, para poner otro hay que escribir la contraseña de la clínica o el código de recuperación
// (pinProof.ts), o borrar los datos del dispositivo; volver a entrar con Google no vale (la sesión ya está abierta).
// Opcional: Face ID o huella (passkey.ts).
import { Delete, Fingerprint, Lock, Repeat } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getAccount } from "../cloud/account";
import { startLogin } from "../cloud/auth";
import { chosenClinic, clinicScope } from "../cloud/clinic";
import { cachedCloudConfig } from "../cloud/config";
import { forgetKey } from "../cloud/crypt";
import { cacheDrop } from "../documents/cache";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { TextField } from "../ui/Field";
import { LogoMark, Wordmark } from "../ui/Logo";
import { Sheet } from "../ui/Sheet";
import { checkPasskey } from "./passkey";
import { checkPin, clearLock, failCount, getLock, isPin, lastActiveAt, lockedOnOpen, markActive, markPinSet, MAX_FAILS, setLockScope, setPin, syncFailsFromDevice, unlockedOtherwise, waitUntil } from "./pin";
import { checkClinicPassword, checkRecoveryCode, proofNeeded, proofWaitUntil, type Proof } from "./pinProof";

type LockApi = { lockNow: () => void; required: boolean; /** La pantalla del PIN tapa la app. */ locked: boolean };
const LockContext = createContext<LockApi>({ lockNow: () => {}, required: false, locked: false });
export const useAppLock = () => useContext(LockContext);

/** En una clínica (servidor de Cloudflare y clínica elegida) el PIN es obligatorio. */
function pinRequired(): boolean {
  const account = getAccount();
  return !!account && !!cachedCloudConfig()?.cloudflareUrl && !!chosenClinic(account);
}

/** De quién son el PIN (la cuenta) y la clave de cifrado (la cuenta en su clínica, o la cuenta con su copia en Drive). */
function scopes() {
  const account = getAccount();
  const config = cachedCloudConfig();
  const clinic = account && config?.cloudflareUrl ? chosenClinic(account) : null;
  return { account, config, clinic, pinScope: account?.sub ?? null, keyScope: account ? (clinic ? clinicScope(account, clinic) : account.sub) : null };
}

/**
 * Borra de este dispositivo los datos de esta cuenta (la copia de la nube no se toca) y quita el PIN. Al recargar, la
 * app pide la contraseña y los datos vuelven a bajar.
 */
async function wipeDevice(keyScope: string | null) {
  const { getDb } = await import("../data/db");
  await getDb().wipe();
  if (keyScope) {
    await forgetKey(keyScope);
    localStorage.removeItem(`fisiolab.sync.${keyScope}`);
    await cacheDrop(keyScope).catch(() => {});
  }
  clearLock();
  location.reload();
}

export function AppLock({ children }: { children: ReactNode }) {
  const account = getAccount();
  setLockScope(account?.sub ?? null);
  const required = pinRequired();
  const [locked, setLocked] = useState(lockedOnOpen);
  const [needsPin, setNeedsPin] = useState(() => required && getLock() === null);
  /** Ya ha demostrado que puede abrir la clínica (contraseña o código): elige el PIN sin volver a pedirlo. */
  const [proved, setProved] = useState(false);
  /** El contador de fallos de IndexedDB ya está mirado (si alguien borró el de localStorage, manda el mayor). */
  const [failsReady, setFailsReady] = useState(false);
  const lastActive = useRef(Date.now());
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const hiddenAt = useRef<number | null>(null);

  // Una hoja abierta (<dialog> modal) se pinta por encima de todo, también de la pantalla de bloqueo: se cierra.
  useEffect(() => {
    if (locked) document.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach((d) => d.close());
  }, [locked]);
  // Los fallos que recuerda IndexedDB, y la marca de que aquí hay PIN (para los de antes de la marca).
  useEffect(() => {
    void syncFailsFromDevice().finally(() => setFailsReady(true));
    if (getLock()) void markPinSet();
  }, []);

  useEffect(() => {
    const touch = () => {
      if (lockedRef.current) return;
      lastActive.current = Date.now();
      // Para la próxima vez que se abra la app (como mucho una escritura cada medio minuto).
      if (getLock() && lastActive.current - lastActiveAt() > 30_000) markActive(lastActive.current);
    };
    const onVisibility = () => {
      const c = getLock();
      if (!c) return;
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        if (!lockedRef.current) markActive(lastActive.current);
        if (c.afterMs === 0) setLocked(true);
      } else if (hiddenAt.current !== null && Date.now() - hiddenAt.current >= c.afterMs) {
        setLocked(true);
      }
    };
    // Tanto rato sin tocar la app como el elegido: se bloquea, como el móvil.
    const idle = setInterval(() => {
      const c = getLock();
      if (c && c.afterMs > 0 && Date.now() - lastActive.current >= c.afterMs) setLocked(true);
    }, 30_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", touch, { passive: true });
    window.addEventListener("keydown", touch);
    return () => {
      clearInterval(idle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  }, []);

  const api: LockApi = {
    // Bloqueada a mano: también al recargar.
    lockNow: () => {
      if (!getLock()) return;
      markActive(0);
      setLocked(true);
    },
    required,
    locked: locked || needsPin,
  };
  const covered = locked || needsPin;
  return (
    <LockContext.Provider value={api}>
      {/* La app se monta ya, invisible: así carga mientras se teclea el PIN, sin enseñar nada. */}
      <div className={covered ? "invisible" : "contents"} inert={covered} aria-hidden={covered || undefined}>
        {children}
      </div>
      {needsPin ? (
        <ChoosePin
          name={account?.name ?? ""}
          proved={proved}
          onDone={() => {
            lastActive.current = Date.now();
            markActive();
            setProved(false);
            setNeedsPin(false);
            setLocked(false);
          }}
        />
      ) : (
        locked && (
          <LockScreen
            key={failsReady ? "listo" : "mirando"}
            onUnlock={() => {
              hiddenAt.current = null;
              lastActive.current = Date.now();
              markActive();
              setLocked(false);
            }}
            onReset={() => {
              // Ha demostrado que puede abrir la clínica: fuera el PIN de aquí y a elegir otro.
              clearLock();
              setProved(true);
              setNeedsPin(true);
              setLocked(false);
            }}
          />
        )
      )}
    </LockContext.Provider>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-5 p-4">
        <div className="flex items-center gap-3">
          <LogoMark size={44} />
          <Wordmark className="text-xl" />
        </div>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="flex items-center gap-2 text-xl">
            <Lock aria-hidden="true" className="size-5 text-accent" /> {title}
          </h1>
          {subtitle && <p className="text-sm text-text-muted">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}

/** Los puntos del PIN y el teclado numérico. También con el teclado del ordenador. */
function PinPad({
  value,
  onChange,
  length,
  disabled,
  extra,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Cifras del PIN, si se saben: tantos puntos. Si no, uno por cifra tecleada. */
  length?: number;
  disabled?: boolean;
  /** El botón de abajo a la izquierda (Face ID o huella). */
  extra?: ReactNode;
  onEnter?: () => void;
}) {
  const press = useCallback((d: string) => !disabled && value.length < 8 && onChange(value + d), [disabled, value, onChange]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") onChange(value.slice(0, -1));
      else if (e.key === "Enter") onEnter?.();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [press, value, onChange, onEnter]);
  const dots = Math.max(length ?? 0, value.length, 4);
  const key = "flex size-18 items-center justify-center rounded-full bg-surface text-2xl font-semibold transition-colors hover:bg-border active:bg-accent-soft disabled:opacity-40";
  return (
    <div className="flex flex-col items-center gap-6">
      <div role="status" className="flex h-4 items-center gap-3">
        <span className="sr-only">{value.length === 1 ? "1 cifra tecleada" : `${value.length} cifras tecleadas`}</span>
        {Array.from({ length: dots }, (_, i) => (
          <span key={i} aria-hidden="true" className={cx("size-3.5 rounded-full border-2 border-accent", i < value.length && "bg-accent")} />
        ))}
      </div>
      <div role="group" aria-label="Teclado del PIN" className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" className={key} disabled={disabled} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <span className="flex size-18 items-center justify-center">{extra}</span>
        <button type="button" className={key} disabled={disabled} onClick={() => press("0")}>
          0
        </button>
        <button type="button" aria-label="Borrar la última cifra" className={cx(key, "bg-transparent")} disabled={disabled || !value} onClick={() => onChange(value.slice(0, -1))}>
          <Delete aria-hidden="true" className="size-7" />
        </button>
      </div>
    </div>
  );
}

function LockScreen({ onUnlock, onReset }: { onUnlock: () => void; onReset: () => void }) {
  const config = getLock();
  const account = getAccount();
  const cloud = !!cachedCloudConfig() && !!account;
  const [pin, setPinText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  /** Está demostrando que puede abrir la clínica para poner un PIN nuevo. */
  const [proving, setProving] = useState(false);
  const [tooMany, setTooMany] = useState(() => cloud && failCount() >= MAX_FAILS);
  const [until, setUntil] = useState(waitUntil);
  const [now, setNow] = useState(Date.now);
  const triedPasskey = useRef(false);

  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) setUntil(0);
    }, 1000);
    return () => clearInterval(t);
  }, [until]);

  const tryPasskey = useCallback(async () => {
    if (!config?.passkey) return;
    if (await checkPasskey(config.passkey)) {
      unlockedOtherwise();
      onUnlock();
    }
  }, [config?.passkey, onUnlock]);
  // Con Face ID o huella, se pide solo al abrir (si el navegador lo deja sin pulsar nada).
  useEffect(() => {
    if (config?.passkey && !triedPasskey.current) {
      triedPasskey.current = true;
      void tryPasskey();
    }
  }, [config?.passkey, tryPasskey]);

  const submit = useCallback(
    async (value: string) => {
      if (until || busy || value.length < 4) return;
      setBusy(true);
      const ok = await checkPin(value);
      setBusy(false);
      setPinText("");
      if (ok) return onUnlock();
      if (cloud && failCount() >= MAX_FAILS) return setTooMany(true);
      setUntil(waitUntil());
      const left = MAX_FAILS - failCount();
      setError(cloud && left > 0 ? `PIN incorrecto. ${left === 1 ? "Queda 1 intento" : `Quedan ${left} intentos`}.` : "PIN incorrecto.");
    },
    [until, busy, onUnlock, cloud],
  );

  const change = (v: string) => {
    setError(null);
    setPinText(v);
    if (config?.length && v.length === config.length) void submit(v);
  };

  const seconds = until ? Math.max(1, Math.ceil((until - now) / 1000)) : 0;
  const subtitle = account ? account.name : undefined;
  if (tooMany) return <ProvePin title="Demasiados intentos" subtitle={subtitle} onProved={onReset} />;
  if (proving) return <ProvePin title="PIN nuevo" subtitle={subtitle} onProved={onReset} onCancel={() => setProving(false)} />;
  return (
    <Shell title="Introduce tu PIN" subtitle={subtitle}>
      <PinPad
        value={pin}
        onChange={change}
        length={config?.length}
        disabled={busy || !!seconds}
        onEnter={() => void submit(pin)}
        extra={
          config?.passkey ? (
            <button type="button" aria-label="Desbloquear con Face ID o huella" className="flex size-18 items-center justify-center rounded-full text-accent hover:bg-surface" onClick={() => void tryPasskey()}>
              <Fingerprint aria-hidden="true" className="size-8" />
            </button>
          ) : null
        }
      />
      <p role="alert" className="min-h-5 text-sm font-semibold text-danger">
        {seconds ? `Demasiados intentos. Espera ${seconds} s.` : error}
      </p>
      {!config?.length && (
        <Button block disabled={pin.length < 4 || !!seconds} loading={busy} onClick={() => void submit(pin)}>
          Desbloquear
        </Button>
      )}
      <div className="flex flex-col items-center gap-1">
        <Button variant="ghost" onClick={() => setForgot(true)}>
          He olvidado el PIN
        </Button>
        {cloud && (
          <Button variant="ghost" icon={<Repeat aria-hidden="true" className="size-5" />} onClick={() => startLogin(cachedCloudConfig()!.googleClientId, { chooseAccount: true, returnTo: import.meta.env.BASE_URL })}>
            Cambiar de cuenta de Google
          </Button>
        )}
      </div>
      <Sheet open={forgot} onClose={() => setForgot(false)} title="¿Has olvidado el PIN?">
        {cloud ? (
          <p>
            Para poner un PIN nuevo, escribe la contraseña de la clínica (la que pusiste al instalar la app) o el código de recuperación. Si no los tienes, puedes
            borrar los datos de este dispositivo: vuelven a bajar cuando tengas la contraseña.
          </p>
        ) : (
          <p>Sin cuenta de Google, la única forma es borrar los datos de este dispositivo y quitar el PIN. Solo podrás recuperarlos con una copia de seguridad.</p>
        )}
        <Button
          variant={cloud ? "primary" : "danger"}
          block
          onClick={async () => {
            if (cloud) {
              setForgot(false);
              return setProving(true);
            }
            await wipeDevice(null);
          }}
        >
          {cloud ? "Continuar" : "Borrar los datos y quitar el PIN"}
        </Button>
        <Button variant="secondary" block onClick={() => setForgot(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Shell>
  );
}

/**
 * Demostrar que se puede abrir la clínica antes de poner un PIN nuevo: la contraseña de la clínica (sin conexión) o
 * el código de recuperación (con conexión), comprobados con la clave guardada en el dispositivo (pinProof.ts). Si
 * aquí nunca hubo PIN, no hay nada que demostrar; si hubo PIN pero no hay clave guardada, solo queda borrar los datos
 * del dispositivo (vuelven a bajar con la contraseña).
 */
function ProvePin({ title, subtitle, onProved, onCancel }: { title: string; subtitle?: string; onProved: () => void; onCancel?: () => void }) {
  const { config, clinic, pinScope, keyScope } = scopes();
  const [need, setNeed] = useState<Proof | null>(null);
  const [tab, setTab] = useState<"password" | "code">("password");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [until, setUntil] = useState(() => (keyScope ? proofWaitUntil(keyScope) : 0));
  const [now, setNow] = useState(Date.now);
  const done = useRef(false);
  useEffect(() => {
    void proofNeeded(pinScope, keyScope).then(setNeed);
  }, [pinScope, keyScope]);
  useEffect(() => {
    if (need !== "none" || done.current) return;
    done.current = true;
    onProved();
  }, [need, onProved]);
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) setUntil(0);
    }, 1000);
    return () => clearInterval(t);
  }, [until]);

  const check = async () => {
    if (!keyScope || !value.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const ok = tab === "password" ? await checkClinicPassword(keyScope, value) : await checkRecoveryCode(config!.cloudflareUrl!, clinic!.id, keyScope, value.trim());
      if (ok) return onProved();
      setValue("");
      const wait = proofWaitUntil(keyScope);
      setUntil(wait);
      setError(wait ? null : tab === "password" ? "La contraseña no es la de la clínica." : "Ese código no es el de la clínica.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const seconds = until ? Math.max(1, Math.ceil((until - now) / 1000)) : 0;
  const pick = (t: "password" | "code") => {
    setTab(t);
    setValue("");
    setError(null);
  };
  if (need === null || need === "none") {
    return (
      <Shell title={title} subtitle={subtitle}>
        <p className="text-sm text-text-muted">Un momento…</p>
      </Shell>
    );
  }
  return (
    <Shell title={title} subtitle={subtitle}>
      {need === "wipe" ? (
        <p className="text-center">Para poner un PIN nuevo en este dispositivo, primero se borran sus datos; bajan de nuevo al escribir la contraseña de la clínica.</p>
      ) : (
        <>
          <p className="text-center text-sm">
            Para poner un PIN nuevo, escribe la contraseña de la clínica (la que pusiste al instalar la app) o el código de recuperación. Si no los tienes, puedes
            borrar los datos de este dispositivo: vuelven a bajar cuando tengas la contraseña.
          </p>
          {clinic && (
            <div role="group" aria-label="Cómo lo demuestras" className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant={tab === "password" ? "primary" : "secondary"} aria-pressed={tab === "password"} onClick={() => pick("password")}>
                Contraseña de la clínica
              </Button>
              <Button size="sm" variant={tab === "code" ? "primary" : "secondary"} aria-pressed={tab === "code"} onClick={() => pick("code")}>
                Código de recuperación
              </Button>
            </div>
          )}
          <form
            className="flex w-full flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void check();
            }}
          >
            <TextField
              label={tab === "code" ? "Código de recuperación" : clinic ? "Contraseña de la clínica" : "Contraseña de cifrado de la copia"}
              type={tab === "code" ? "text" : "password"}
              autoComplete={tab === "code" ? "off" : "current-password"}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy || !!seconds}
            />
            <p role="alert" className="min-h-5 text-sm font-semibold text-danger">
              {seconds ? `Demasiados intentos. Espera ${seconds} s.` : error}
            </p>
            <Button type="submit" size="lg" block loading={busy} disabled={!value.trim() || !!seconds}>
              Comprobar
            </Button>
          </form>
        </>
      )}
      {!confirmWipe ? (
        <Button variant={need === "wipe" ? "danger" : "ghost"} block onClick={() => setConfirmWipe(true)}>
          Borrar los datos de este dispositivo
        </Button>
      ) : (
        <div className="flex w-full flex-col gap-2">
          <p className="text-center text-sm">Se borran solo de este dispositivo; la copia de la clínica no se toca y vuelve a bajar con la contraseña.</p>
          <Button variant="danger" block onClick={() => void wipeDevice(keyScope)}>
            Sí, borrar los datos de aquí
          </Button>
          <Button variant="secondary" block onClick={() => setConfirmWipe(false)}>
            No
          </Button>
        </div>
      )}
      {onCancel && (
        <Button variant="ghost" block onClick={onCancel}>
          Volver
        </Button>
      )}
    </Shell>
  );
}

/**
 * En una clínica, la primera vez en el dispositivo: elegir el PIN (dos veces). Si aquí ya hubo un PIN (alguien lo
 * borró del navegador), antes hay que demostrar que se puede abrir la clínica (ProvePin), salvo que ya lo haya hecho.
 */
function ChoosePin({ name, proved, onDone }: { name: string; proved: boolean; onDone: () => void }) {
  const [ok, setOk] = useState(proved);
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPinText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const proven = useCallback(() => setOk(true), []);
  if (!ok) return <ProvePin title="Antes de elegir el PIN" subtitle={name || undefined} onProved={proven} />;
  const next = async () => {
    if (!isPin(pin)) return setError("De 4 a 8 cifras.");
    if (first === null) {
      setFirst(pin);
      setPinText("");
      return setError(null);
    }
    if (pin !== first) {
      setFirst(null);
      setPinText("");
      return setError("No coincide. Empieza otra vez.");
    }
    setBusy(true);
    await setPin(pin);
    setBusy(false);
    onDone();
  };
  return (
    <Shell
      title={first === null ? "Elige tu PIN" : "Repite el PIN"}
      subtitle={first === null ? `${name ? `${name}: ` : ""}en una clínica la app se abre con PIN, como el móvil. De 4 a 8 cifras.` : undefined}
    >
      <PinPad value={pin} onChange={(v) => (setError(null), setPinText(v))} onEnter={() => void next()} disabled={busy} />
      <p role="alert" className="min-h-5 text-sm font-semibold text-danger">
        {error}
      </p>
      <Button size="lg" block loading={busy} disabled={pin.length < 4} onClick={() => void next()}>
        {first === null ? "Siguiente" : "Guardar el PIN"}
      </Button>
    </Shell>
  );
}
