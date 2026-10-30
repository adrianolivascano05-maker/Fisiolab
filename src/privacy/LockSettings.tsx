// Ajustes → Bloqueo con PIN: activar el PIN de este dispositivo, cuándo pedirlo, cambiarlo o quitarlo.
import { Fingerprint, Lock, LockOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { getAccount } from "../cloud/account";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { useAppLock } from "./AppLock";
import { createPasskey, passkeyAvailable } from "./passkey";
import { checkPin, clearLock, getLock, isPin, LOCK_AFTER, setLockAfter, setPasskey, setPin, waitUntil } from "./pin";

type Mode = "set" | "change" | "remove";
const titles: Record<Mode, string> = { set: "Activar el bloqueo", change: "Cambiar el PIN", remove: "Quitar el bloqueo" };

const pinProps = { type: "password", inputMode: "numeric", autoComplete: "off", maxLength: 8 } as const;
const digits = (s: string) => s.replace(/\D/g, "");

export function LockSettings() {
  const toast = useToast();
  const { lockNow, required } = useAppLock();
  const [config, setConfig] = useState(getLock);
  const [bio, setBio] = useState(false);
  useEffect(() => {
    void passkeyAvailable().then(setBio);
  }, []);
  const [mode, setMode] = useState<Mode | null>(null);
  // Lo que enseña la hoja: se fija al abrirla y no cambia al cerrarla. Si dependiera de `mode`, en el instante en
  // que se cierra el botón de «Quitar el bloqueo» pasaría a decir «Activar el bloqueo» a la vez que el de la pantalla.
  const [shown, setShown] = useState<Mode>("set");
  const [current, setCurrent] = useState("");
  const [pin, setPinText] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<{ field: "current" | "pin" | "repeat"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (m: Mode) => {
    setMode(m);
    setShown(m);
    setCurrent("");
    setPinText("");
    setRepeat("");
    setError(null);
  };

  async function confirm() {
    if (!mode) return;
    if (mode !== "set") {
      if (waitUntil()) return setError({ field: "current", text: "Demasiados intentos: espera un poco." });
      if (!(await checkPin(current))) return setError({ field: "current", text: "No es el PIN actual." });
    }
    if (mode === "remove") {
      clearLock(true);
      setConfig(null);
      setMode(null);
      return toast("Bloqueo quitado", "success");
    }
    if (!isPin(pin)) return setError({ field: "pin", text: "De 4 a 8 cifras." });
    if (pin !== repeat) return setError({ field: "repeat", text: "No coincide con el PIN." });
    setBusy(true);
    await setPin(pin);
    setBusy(false);
    setConfig(getLock());
    setMode(null);
    toast(mode === "set" ? "Bloqueo activado" : "PIN cambiado", "success");
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="h-bloqueo">
      <h2 id="h-bloqueo" className="text-lg">
        Bloqueo de la app
      </h2>
      <Card className="flex flex-col gap-3">
        {config ? (
          <>
            <p className="flex items-center gap-2 font-semibold">
              <Lock aria-hidden="true" className="size-5 text-success" /> Esta app pide PIN en este dispositivo
            </p>
            <SelectField
              label="Pedir el PIN al volver"
              value={String(config.afterMs)}
              onChange={(e) => {
                setLockAfter(Number(e.target.value));
                setConfig(getLock());
              }}
            >
              {/* En una clínica, como mucho una hora sin pedirlo. */}
              {LOCK_AFTER.filter((o) => !required || o.ms <= 60 * 60_000).map((o) => (
                <option key={o.ms} value={o.ms}>
                  {o.label}
                </option>
              ))}
            </SelectField>
            <Button icon={<Lock aria-hidden="true" className="size-5" />} onClick={lockNow}>
              Bloquear ahora
            </Button>
            <Button variant="secondary" onClick={() => open("change")}>
              Cambiar el PIN
            </Button>
            {bio &&
              (config.passkey ? (
                <Button
                  variant="secondary"
                  icon={<Fingerprint aria-hidden="true" className="size-5" />}
                  onClick={() => {
                    setPasskey(null);
                    setConfig(getLock());
                    toast("Face ID o huella desactivados", "success");
                  }}
                >
                  Dejar de usar Face ID o huella
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  icon={<Fingerprint aria-hidden="true" className="size-5" />}
                  onClick={async () => {
                    const id = await createPasskey(getAccount()?.email ?? "OmniClin");
                    if (!id) return toast("No se ha activado: el dispositivo no lo ha confirmado.", "danger");
                    setPasskey(id);
                    setConfig(getLock());
                    toast("Ya puedes desbloquear con Face ID o huella", "success");
                  }}
                >
                  Desbloquear también con Face ID o huella
                </Button>
              ))}
            {required ? (
              <p className="text-sm text-text-muted">En una clínica el PIN es obligatorio.</p>
            ) : (
              <Button variant="ghost" icon={<LockOpen aria-hidden="true" className="size-5" />} onClick={() => open("remove")}>
                Quitar el bloqueo
              </Button>
            )}
          </>
        ) : (
          <>
            <p>Pide un PIN para abrir la app en este dispositivo, y al volver a ella si has salido un rato.</p>
            <Button icon={<Lock aria-hidden="true" className="size-5" />} onClick={() => open("set")}>
              Activar el bloqueo
            </Button>
          </>
        )}
        <p className="text-sm text-text-muted">
          Sirve para que quien coja el dispositivo desbloqueado no vea a tus pacientes, pero solo tapa la pantalla: no cifra los datos guardados en el
          dispositivo, y si alguien borra los datos del navegador, el PIN desaparece con ellos. La protección de verdad es el bloqueo del propio dispositivo
          (PIN o huella), que además cifra sus datos: tenlo siempre activado.
        </p>
      </Card>

      <Sheet open={mode !== null} onClose={() => setMode(null)} title={titles[shown]}>
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void confirm();
          }}
        >
          {shown !== "set" && (
            <TextField
              label="PIN actual"
              {...pinProps}
              value={current}
              error={error?.field === "current" ? error.text : undefined}
              onChange={(e) => setCurrent(digits(e.target.value))}
            />
          )}
          {shown !== "remove" && (
            <>
              <TextField
                label={shown === "change" ? "PIN nuevo" : "PIN"}
                hint="De 4 a 8 cifras. No uses tu fecha de nacimiento ni el PIN del móvil."
                {...pinProps}
                value={pin}
                error={error?.field === "pin" ? error.text : undefined}
                onChange={(e) => setPinText(digits(e.target.value))}
              />
              <TextField
                label="Repite el PIN"
                {...pinProps}
                value={repeat}
                error={error?.field === "repeat" ? error.text : undefined}
                onChange={(e) => setRepeat(digits(e.target.value))}
              />
            </>
          )}
          {shown === "set" && (
            <p className="text-sm text-text-muted">
              {getAccount()
                ? "Si lo olvidas, vuelves a entrar con tu cuenta de Google y eliges otro."
                : "Si lo olvidas, para volver a entrar hay que borrar los datos de este dispositivo."}
            </p>
          )}
          <Button type="submit" block loading={busy} variant={shown === "remove" ? "danger" : "primary"}>
            {titles[shown]}
          </Button>
        </form>
      </Sheet>
    </section>
  );
}
