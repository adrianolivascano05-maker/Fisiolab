// Cifrado de la copia de Drive en pantalla (crypt.ts): activarlo, cambiar la contraseña o quitarlo en Ajustes, y
// pedir la contraseña en un dispositivo que aún no la tiene.
import { KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getSetting, setSetting } from "../data/repo";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { useCloud, useSyncState } from "./CloudGate";
import { deriveKey, ENCRYPTION_KEY, forgetKey, MIN_PASSWORD, newSalt, storeKey, WrongPassword, type EncryptionSetting } from "./crypt";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Ajustes → Cuenta de Google: cifrar la copia de Drive. */
export function EncryptionSettings() {
  const cloud = useCloud();
  const s = useSyncState();
  const toast = useToast();
  const enc = useAsync(async () => (await getSetting<EncryptionSetting>(getDb(), ENCRYPTION_KEY)) ?? null, []);
  const [mode, setMode] = useState<null | "set" | "off">(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<{ field: "password" | "repeat"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cloud || !s || enc.data === undefined) return null;
  const on = !!enc.data;

  const open = (m: "set" | "off") => {
    setMode(m);
    setPassword("");
    setRepeat("");
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!cloud) return;
    if (mode === "set") {
      if (password.length < MIN_PASSWORD) return setError({ field: "password", text: `Al menos ${MIN_PASSWORD} caracteres.` });
      if (password !== repeat) return setError({ field: "repeat", text: "No coincide con la contraseña." });
    }
    setBusy(true);
    try {
      if (mode === "set") {
        const salt = newSalt();
        await storeKey(cloud.account.sub, salt, await deriveKey(password, salt));
        await setSetting(getDb(), ENCRYPTION_KEY, { salt });
      } else {
        await setSetting(getDb(), ENCRYPTION_KEY, null);
        forgetKey(cloud.account.sub);
      }
      toast(mode === "set" ? (on ? "Contraseña cambiada" : "Copia de Drive cifrada") : "La copia de Drive ya no se cifra", "success");
      setMode(null);
      enc.reload();
      void cloud.sync.sync();
    } catch (err) {
      toast(errText(err), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-cifrado">
      <h2 id="h-cifrado" className="text-lg">
        Cifrado de la copia de Drive
      </h2>
      <Card className="flex flex-col gap-3">
        {on ? (
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="size-5 text-success" /> La copia de tu Drive va cifrada
          </p>
        ) : (
          <p>Cifra la copia de tu Drive con una contraseña: sin ella, nadie puede leerla, ni entrando en tu cuenta de Google.</p>
        )}
        {s.status === "needs-key" ? (
          <KeyPrompt />
        ) : on ? (
          <>
            <Button variant="secondary" onClick={() => open("set")}>
              Cambiar la contraseña
            </Button>
            <Button variant="ghost" onClick={() => open("off")}>
              Dejar de cifrar
            </Button>
          </>
        ) : (
          <Button icon={<KeyRound aria-hidden="true" className="size-5" />} onClick={() => open("set")}>
            Cifrar la copia de Drive
          </Button>
        )}
        <p className="text-sm text-text-muted">
          En tus otros dispositivos te la pedirá una vez. Si la olvidas, lo que haya en tus dispositivos sigue ahí, pero la copia de Drive no se puede
          abrir: apúntala en un sitio seguro.
        </p>
      </Card>

      <Sheet open={mode !== null} onClose={() => setMode(null)} title={mode === "off" ? "¿Dejar de cifrar la copia?" : on ? "Cambiar la contraseña" : "Cifrar la copia de Drive"}>
        <form className="flex flex-col gap-3" noValidate onSubmit={submit}>
          {mode === "off" ? (
            <p>La copia de tu Drive volverá a guardarse sin cifrar. Seguirá protegida por tu cuenta de Google.</p>
          ) : (
            <>
              <TextField
                label={on ? "Contraseña nueva" : "Contraseña"}
                type="password"
                autoComplete="new-password"
                hint={`Al menos ${MIN_PASSWORD} caracteres. Mejor una frase que no uses en otro sitio.`}
                value={password}
                error={error?.field === "password" ? error.text : undefined}
                onChange={(e) => setPassword(e.target.value)}
              />
              <TextField
                label="Repite la contraseña"
                type="password"
                autoComplete="new-password"
                value={repeat}
                error={error?.field === "repeat" ? error.text : undefined}
                onChange={(e) => setRepeat(e.target.value)}
              />
              {on && <p className="text-sm text-text-muted">Tus otros dispositivos te pedirán la contraseña nueva.</p>}
            </>
          )}
          <Button type="submit" block loading={busy} variant={mode === "off" ? "danger" : "primary"}>
            {mode === "off" ? "Dejar de cifrar" : on ? "Cambiar la contraseña" : "Cifrar"}
          </Button>
        </form>
      </Sheet>
    </section>
  );
}

/** Con la copia de Drive cifrada y sin su clave en este dispositivo: escribir la contraseña. */
export function KeyPrompt({ size = "md" }: { size?: "sm" | "md" }) {
  const cloud = useCloud();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cloud) return null;

  return (
    <>
      <Button size={size} icon={size === "md" ? <KeyRound aria-hidden="true" className="size-5" /> : undefined} onClick={() => setOpen(true)}>
        Escribir la contraseña
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Contraseña de la copia de Drive">
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await cloud.sync.unlock(password);
              setOpen(false);
              setPassword("");
              toast("Copia de Drive abierta", "success");
            } catch (err) {
              setError(err instanceof WrongPassword ? "No es la contraseña de esta copia." : errText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>La copia de tu Drive está cifrada. Escribe la contraseña con la que la cifraste en otro dispositivo.</p>
          <TextField
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            error={error ?? undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
          <Button type="submit" block loading={busy} disabled={!password}>
            Abrir la copia
          </Button>
          <Button variant="ghost" block onClick={() => setForgot(true)}>
            He olvidado la contraseña
          </Button>
        </form>
      </Sheet>
      <Sheet open={forgot} onClose={() => setForgot(false)} title="¿Sustituir la copia de Drive?">
        <p>Sin la contraseña, la copia de Drive no se puede abrir. Puedes sustituirla por lo que hay en este dispositivo, sin cifrar.</p>
        <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" /> Lo que solo esté en la copia de Drive se pierde. Si otro
          dispositivo tuyo tiene la app abierta con tus pacientes, lo que hay en él vuelve a subirse la próxima vez que sincronice.
        </p>
        <Button
          variant="danger"
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await setSetting(getDb(), ENCRYPTION_KEY, null);
              forgetKey(cloud.account.sub);
              await cloud.sync.replaceRemote();
              setForgot(false);
              setOpen(false);
              toast("Copia de Drive sustituida", "success");
            } catch (err) {
              toast(errText(err), "danger");
            } finally {
              setBusy(false);
            }
          }}
        >
          Sustituir la copia de Drive
        </Button>
        <Button variant="secondary" block onClick={() => setForgot(false)}>
          Cancelar
        </Button>
      </Sheet>
    </>
  );
}
