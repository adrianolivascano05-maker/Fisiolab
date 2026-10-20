// Cifrado de la copia de la nube en pantalla (crypt.ts): elegir o cambiar la contraseña en Ajustes, y pedirla en un
// dispositivo que aún no la tiene. La copia va siempre cifrada, en Drive y en el servidor de la clínica.
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
import { deriveKeyBytes, ENCRYPTION_KEY, forgetKey, MIN_PASSWORD, newSalt, storeKey, WrongPassword, type EncryptionSetting } from "./crypt";
import { createRecovery } from "./recovery";
import { RecoverWithCode, RecoveryKit, RecoveryReminder } from "./RecoveryParts";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** «la copia de tu Drive» o «la copia del servidor de la clínica». */
function copyName(cloud: NonNullable<ReturnType<typeof useCloud>>) {
  const server = cloud.sync.store.kind === "server";
  return {
    copy: server ? "la copia del servidor de la clínica" : "la copia de tu Drive",
    Copy: server ? "Copia del servidor" : "Copia de Drive",
    short: server ? "la copia del servidor" : "la copia de Drive",
    server,
  };
}

/** Ajustes → Cuenta de Google: cifrar la copia de la nube. */
export function EncryptionSettings() {
  const cloud = useCloud();
  const s = useSyncState();
  const toast = useToast();
  const enc = useAsync(async () => (await getSetting<EncryptionSetting>(getDb(), ENCRYPTION_KEY)) ?? null, []);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<{ field: "password" | "repeat"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [kit, setKit] = useState<{ code: string; salt: string } | null>(null);
  if (!cloud || !s || enc.data === undefined) return null;
  const on = !!enc.data;
  const { copy, Copy, server } = copyName(cloud);
  // En una clínica, la contraseña es de todo el equipo: la elige (y la cambia) quien la administra.
  const clinic = cloud.clinic;
  const mayChange = !clinic || clinic.role === "admin" || !on;

  const start = () => {
    setOpen(true);
    setPassword("");
    setRepeat("");
    setError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!cloud) return;
    if (password.length < MIN_PASSWORD) return setError({ field: "password", text: `Al menos ${MIN_PASSWORD} caracteres.` });
    if (password !== repeat) return setError({ field: "repeat", text: "No coincide con la contraseña." });
    setBusy(true);
    try {
      const salt = newSalt();
      const { key, raw } = await deriveKeyBytes(password, salt);
      await storeKey(cloud.sync.scope, salt, key);
      await setSetting(getDb(), ENCRYPTION_KEY, { salt });
      toast(on ? "Contraseña cambiada" : `${Copy} cifrada`, "success");
      setOpen(false);
      enc.reload();
      void cloud.sync.sync();
      // En una clínica, quien la administra recibe su código de recuperación para esta contraseña.
      if (clinic?.role === "admin") {
        try {
          setKit({ code: await createRecovery(cloud, raw, salt), salt });
        } catch (err) {
          toast(`No se pudo crear el código de recuperación: ${errText(err)}`, "danger");
        }
      }
    } catch (err) {
      toast(errText(err), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-cifrado">
      <h2 id="h-cifrado" className="text-lg">
        Cifrado de la copia
      </h2>
      <Card className="flex flex-col gap-3">
        {on ? (
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="size-5 text-success" /> {copy.charAt(0).toUpperCase() + copy.slice(1)} va cifrada
          </p>
        ) : server ? (
          <p>El servidor de la clínica solo guarda copias cifradas. Elige una contraseña: sin ella nadie puede leer la copia, tampoco Cloudflare.</p>
        ) : (
          <p>La copia de tu Drive va siempre cifrada. Elige una contraseña: sin ella nadie puede leerla, ni entrando en tu cuenta de Google. Hasta entonces, no se sube nada.</p>
        )}
        {on && s.status !== "needs-key" && <RecoveryReminder />}
        {s.status === "needs-key" ? (
          <KeyPrompt />
        ) : !mayChange ? (
          <p className="text-sm">La contraseña de la clínica la cambia quien la administra.</p>
        ) : on ? (
          <Button variant="secondary" onClick={start}>
            Cambiar la contraseña
          </Button>
        ) : (
          <Button icon={<KeyRound aria-hidden="true" className="size-5" />} onClick={start}>
            Elegir la contraseña de cifrado
          </Button>
        )}
        <p className="text-sm text-text-muted">
          {clinic
            ? `Es la contraseña de «${clinic.name}»: a cada persona del equipo se le pide una vez en cada dispositivo. Dásela en persona, nunca por correo ni por mensaje. Si la olvidáis, lo que haya en los dispositivos sigue ahí, pero ${copy} no se puede abrir: guardadla en un sitio seguro.`
            : `En tus otros dispositivos te la pedirá una vez. Si la olvidas, lo que haya en tus dispositivos sigue ahí, pero ${copy} no se puede abrir: apúntala en un sitio seguro.`}
        </p>
      </Card>

      {kit && <RecoveryKit code={kit.code} salt={kit.salt} onClose={() => setKit(null)} />}
      <Sheet open={open} onClose={() => setOpen(false)} title={on ? "Cambiar la contraseña" : "Contraseña de cifrado"}>
        <form className="flex flex-col gap-3" noValidate onSubmit={submit}>
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
          {on && (
            <p className="text-sm text-text-muted">
              {clinic ? "A todo el equipo se le pedirá la contraseña nueva: dásela en persona." : "Tus otros dispositivos te pedirán la contraseña nueva."}
            </p>
          )}
          <Button type="submit" block loading={busy}>
            {on ? "Cambiar la contraseña" : "Cifrar"}
          </Button>
        </form>
      </Sheet>
    </section>
  );
}

/** Con la copia de la nube cifrada y sin su clave en este dispositivo: escribir la contraseña. */
export function KeyPrompt({ size = "md" }: { size?: "sm" | "md" }) {
  const cloud = useCloud();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cloud) return null;
  const { copy, Copy, short } = copyName(cloud);
  const clinic = cloud.clinic;
  // En una clínica, solo quien la administra puede sustituir la copia de todos.
  const mayReplace = !clinic || clinic.role === "admin";

  return (
    <>
      <Button size={size} icon={size === "md" ? <KeyRound aria-hidden="true" className="size-5" /> : undefined} onClick={() => setOpen(true)}>
        Escribir la contraseña
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Contraseña de ${short}`}>
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
              toast(`${Copy} abierta`, "success");
            } catch (err) {
              setError(err instanceof WrongPassword ? "No es la contraseña de esta copia." : errText(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {copy.charAt(0).toUpperCase() + copy.slice(1)} está cifrada.{" "}
            {clinic ? `Escribe la contraseña de «${clinic.name}» (te la da quien la administra).` : "Escribe la contraseña con la que la cifraste en otro dispositivo."}
          </p>
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
      <Sheet open={forgot && !mayReplace} onClose={() => setForgot(false)} title="Contraseña de la clínica">
        <p>Pídesela a quien administra «{clinic?.name}»: es la misma para todo el equipo.</p>
        <Button variant="secondary" block onClick={() => setForgot(false)}>
          Entendido
        </Button>
      </Sheet>
      <Sheet open={forgot && mayReplace} onClose={() => setForgot(false)} title={clinic ? "Contraseña olvidada" : `¿Sustituir ${short}?`}>
        {clinic && (
          <>
            <p>Si tienes el kit de recuperación de la clínica, escribe su código: la copia se abre sin la contraseña y no se pierde nada.</p>
            <RecoverWithCode
              onDone={() => {
                setForgot(false);
                setOpen(false);
              }}
            />
            <p className="border-t border-border pt-3 font-semibold">Sin el código</p>
          </>
        )}
        <p>
          Sin la contraseña, {copy} no se puede abrir. Puedes sustituirla por lo que hay en este dispositivo, cifrado con una contraseña nueva
          que elegirás después.
        </p>
        <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" /> Lo que solo esté en {copy} se pierde. Si otro
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
              await forgetKey(cloud.sync.scope);
              await cloud.sync.replaceRemote();
              setForgot(false);
              setOpen(false);
              toast(`${Copy} sustituida`, "success");
            } catch (err) {
              toast(errText(err), "danger");
            } finally {
              setBusy(false);
            }
          }}
        >
          Sustituir {copy}
        </Button>
        <Button variant="secondary" block onClick={() => setForgot(false)}>
          Cancelar
        </Button>
      </Sheet>
    </>
  );
}
