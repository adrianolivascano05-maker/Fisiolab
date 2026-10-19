// Bloqueo de la app con PIN (src/privacy/README.md). Al abrirla, y al volver a ella después del tiempo elegido,
// pide el PIN de este dispositivo. Al bloquear con la app ya abierta, la pantalla se tapa pero no se cierra: no se
// pierde lo que se estuviera escribiendo.
import { Lock, TriangleAlert } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { LogoMark } from "../ui/Logo";
import { Sheet } from "../ui/Sheet";
import { checkPin, clearLock, getLock, waitUntil } from "./pin";

type LockApi = { lockNow: () => void };
const LockContext = createContext<LockApi>({ lockNow: () => {} });
export const useAppLock = () => useContext(LockContext);

export function AppLock({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => getLock() !== null);
  // Hasta el primer desbloqueo no se monta la app: nada de pacientes en pantalla ni en la página.
  const [opened, setOpened] = useState(!locked);
  const hiddenAt = useRef<number | null>(null);

  // Una hoja abierta (<dialog> modal) se pinta por encima de todo, también de la pantalla de bloqueo: se cierra.
  useEffect(() => {
    if (locked) document.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach((d) => d.close());
  }, [locked]);

  useEffect(() => {
    const onVisibility = () => {
      const c = getLock();
      if (!c) return;
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        if (c.afterMs === 0) setLocked(true);
      } else if (hiddenAt.current !== null && Date.now() - hiddenAt.current >= c.afterMs) {
        setLocked(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const api: LockApi = { lockNow: () => getLock() && setLocked(true) };
  return (
    <LockContext.Provider value={api}>
      {opened && (
        <div className="contents" inert={locked} aria-hidden={locked || undefined}>
          {children}
        </div>
      )}
      {locked && (
        <LockScreen
          onUnlock={() => {
            hiddenAt.current = null;
            setLocked(false);
            setOpened(true);
          }}
        />
      )}
    </LockContext.Provider>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const cloud = useCloud();
  const [pin, setPinText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [until, setUntil] = useState(waitUntil);
  const [now, setNow] = useState(Date.now);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) setUntil(0);
    }, 1000);
    return () => clearInterval(t);
  }, [until]);
  useEffect(() => form.current?.querySelector("input")?.focus(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (until || busy) return;
    setBusy(true);
    const ok = await checkPin(pin);
    setBusy(false);
    setPinText("");
    if (ok) return onUnlock();
    setUntil(waitUntil());
    setError("PIN incorrecto.");
    form.current?.querySelector("input")?.focus();
  }

  const seconds = until ? Math.max(1, Math.ceil((until - now) / 1000)) : 0;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-canvas">
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
        <h1 className="flex items-center gap-2 text-xl">
          <Lock aria-hidden="true" className="size-6 text-accent" /> App bloqueada
        </h1>
        <form ref={form} className="flex flex-col gap-3" onSubmit={submit} noValidate>
          <TextField
            label="PIN"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={pin}
            error={seconds ? `Demasiados intentos. Espera ${seconds} s.` : (error ?? undefined)}
            onChange={(e) => {
              setPinText(e.target.value.replace(/\D/g, ""));
              setError(null);
            }}
          />
          <Button type="submit" size="lg" block loading={busy} disabled={!!seconds || pin.length < 4}>
            Desbloquear
          </Button>
        </form>
        <Button variant="ghost" onClick={() => setForgot(true)}>
          He olvidado el PIN
        </Button>
      </main>
      <Forgot open={forgot} onClose={() => setForgot(false)} cloud={!!cloud} onReset={async () => {
        if (cloud) return cloud.logout(true); // vuelve a la pantalla de entrar
        await getDb().wipe();
        clearLock();
        location.reload();
      }} />
    </div>
  );
}

function Forgot({ open, onClose, cloud, onReset }: { open: boolean; onClose: () => void; cloud: boolean; onReset: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title="¿Has olvidado el PIN?">
      {cloud ? (
        <p>
          Cierra sesión borrando los datos de este dispositivo y vuelve a entrar con tu cuenta de Google: tus pacientes vuelven desde tu Drive y la app queda
          sin PIN. Lo que no se haya sincronizado todavía se pierde.
        </p>
      ) : (
        <>
          <p>Sin el PIN no se puede abrir. Puedes borrar todos los datos de este dispositivo y quitar el PIN.</p>
          <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" /> Los pacientes se pierden. Solo podrás recuperarlos con una
            copia de seguridad.
          </p>
        </>
      )}
      <Button
        variant="danger"
        block
        loading={busy}
        onClick={async () => {
          setBusy(true);
          clearLock();
          await onReset();
        }}
      >
        {cloud ? "Borrar los datos de este dispositivo y cerrar sesión" : "Borrar los datos y quitar el PIN"}
      </Button>
      <Button variant="secondary" block onClick={onClose}>
        Cancelar
      </Button>
    </Sheet>
  );
}
