// Bloqueo de la app con PIN (src/privacy/README.md), como el del móvil: teclado numérico grande que sale al
// instante, y la app se va abriendo por detrás (la base, la sincronización) mientras se teclea, así que al acertar
// ya está lista. Pide el PIN al abrir, al volver a la app y tras un rato sin usarla. Con cuenta de Google, cada
// persona tiene el suyo en el dispositivo; en una clínica es obligatorio. Si se olvida, o tras 5 fallos, se vuelve a
// entrar con Google y se elige otro. Opcional: Face ID o huella (passkey.ts).
import { Delete, Fingerprint, Lock, LogIn, Repeat } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { clearAccount, getAccount } from "../cloud/account";
import { startLogin } from "../cloud/auth";
import { chosenClinic } from "../cloud/clinic";
import { cachedCloudConfig } from "../cloud/config";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { LogoMark } from "../ui/Logo";
import { Sheet } from "../ui/Sheet";
import { checkPasskey } from "./passkey";
import { checkPin, clearLock, failCount, getLock, isPin, lastActiveAt, lockedOnOpen, markActive, MAX_FAILS, setLockScope, setPin, unlockedOtherwise, waitUntil } from "./pin";

type LockApi = { lockNow: () => void; required: boolean; /** La pantalla del PIN tapa la app. */ locked: boolean };
const LockContext = createContext<LockApi>({ lockNow: () => {}, required: false, locked: false });
export const useAppLock = () => useContext(LockContext);

/** En una clínica (servidor de Cloudflare y clínica elegida) el PIN es obligatorio. */
export function pinRequired(): boolean {
  const account = getAccount();
  return !!account && !!cachedCloudConfig()?.cloudflareUrl && !!chosenClinic(account);
}

/** Volver a entrar con Google (la misma cuenta u otra): se olvida el PIN de aquí y se elige otro después. */
function backToGoogle(chooseAccount: boolean) {
  const config = cachedCloudConfig();
  const account = getAccount();
  clearLock();
  if (!config) return location.reload();
  if (chooseAccount) return startLogin(config.googleClientId, { chooseAccount: true, returnTo: import.meta.env.BASE_URL });
  clearAccount();
  startLogin(config.googleClientId, { hint: account?.email, returnTo: import.meta.env.BASE_URL });
}

export function AppLock({ children }: { children: ReactNode }) {
  const account = getAccount();
  setLockScope(account?.sub ?? null);
  const required = pinRequired();
  const [locked, setLocked] = useState(lockedOnOpen);
  const [needsPin, setNeedsPin] = useState(() => required && getLock() === null);
  const lastActive = useRef(Date.now());
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const hiddenAt = useRef<number | null>(null);

  // Una hoja abierta (<dialog> modal) se pinta por encima de todo, también de la pantalla de bloqueo: se cierra.
  useEffect(() => {
    if (locked) document.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach((d) => d.close());
  }, [locked]);

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
          onDone={() => {
            lastActive.current = Date.now();
            markActive();
            setNeedsPin(false);
            setLocked(false);
          }}
        />
      ) : (
        locked && (
          <LockScreen
            onUnlock={() => {
              hiddenAt.current = null;
              lastActive.current = Date.now();
              markActive();
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
          <span className="flex flex-col leading-none">
            <span className="text-xl font-semibold text-brand-ink" style={{ fontFamily: "var(--font-display)" }}>
              Cénit
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Fisiolab</span>
          </span>
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

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const config = getLock();
  const account = getAccount();
  const cloud = !!cachedCloudConfig() && !!account;
  const [pin, setPinText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
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
  if (tooMany)
    return (
      <Shell title="Demasiados intentos" subtitle={subtitle}>
        <p className="text-center">Por seguridad, vuelve a entrar con tu cuenta de Google. Después elegirás un PIN nuevo.</p>
        <Button size="lg" block icon={<LogIn aria-hidden="true" className="size-5" />} onClick={() => backToGoogle(false)}>
          Entrar con Google
        </Button>
      </Shell>
    );
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
          <p>Vuelve a entrar con tu cuenta de Google ({account?.email}) y elige un PIN nuevo. Tus datos se quedan en este dispositivo.</p>
        ) : (
          <p>Sin cuenta de Google, la única forma es borrar los datos de este dispositivo y quitar el PIN. Solo podrás recuperarlos con una copia de seguridad.</p>
        )}
        <Button
          variant={cloud ? "primary" : "danger"}
          block
          onClick={async () => {
            if (cloud) return backToGoogle(false);
            const { getDb } = await import("../data/db");
            await getDb().wipe();
            clearLock();
            location.reload();
          }}
        >
          {cloud ? "Entrar con Google" : "Borrar los datos y quitar el PIN"}
        </Button>
        <Button variant="secondary" block onClick={() => setForgot(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Shell>
  );
}

/** En una clínica, la primera vez en el dispositivo: elegir el PIN (dos veces). */
function ChoosePin({ name, onDone }: { name: string; onDone: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPinText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
