// Código de recuperación en pantalla (recovery.ts): el kit para guardar o imprimir (también en PDF), el aviso a
// quien administra mientras no conste que lo ha guardado, y abrir la copia con el código.
import { Download, KeyRound, LifeBuoy } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useAsync } from "../app/useAsync";
import { reportPdf } from "../clinical/reportPdf";
import { getDb } from "../data/db";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { errText, useCloud } from "./cloudContext";
import { checkPassword, confirmRecoverySaved, createRecovery, recoverWithCode, recoveryPending, WrongPassword } from "./recovery";
import { saveFile } from "../app/download";


/** El kit de recuperación recién creado: el código, para guardarlo en PDF o imprimirlo, y confirmar que está guardado. */
export function RecoveryKit({ code, salt, onClose }: { code: string; salt: string; onClose: () => void }) {
  const cloud = useCloud();
  const toast = useToast();
  const kit = useRef<HTMLElement>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!cloud?.clinic) return null;
  const clinic = cloud.clinic.name;
  const today = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  return (
    <Sheet open onClose={onClose} title="Kit de recuperación de la clínica">
      <article ref={kit} aria-label="Kit de recuperación" className="flex flex-col gap-3 rounded-md border border-border bg-bg p-4">
        <h3 className="text-lg font-semibold">OmniClin · Kit de recuperación de «{clinic}»</h3>
        <p className="text-sm">Creado el {today} por {cloud.account.email}.</p>
        <p className="text-sm">Código de recuperación:</p>
        <p className="rounded-md bg-surface px-3 py-3 text-center font-mono text-xl font-bold tracking-wider break-all" data-testid="recovery-code">
          {code}
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Con este código, quien administra la clínica recupera la copia de los pacientes aunque se olviden la contraseña y se pierdan todos los dispositivos.</li>
          <li>Guárdalo impreso en un sitio seguro de la clínica (un cajón con llave), no en el móvil ni en el correo.</li>
          <li>Nadie más lo tiene: ni quien gestiona la app ni Cloudflare pueden recuperarlo.</li>
          <li>Si cambiáis la contraseña de cifrado, este código deja de valer y se crea otro.</li>
        </ul>
      </article>
      <Button
        icon={<Download aria-hidden="true" className="size-5" />}
        loading={busy}
        onClick={async () => {
          if (!kit.current) return;
          setBusy(true);
          try {
            saveFile(`OmniClin-kit-recuperacion-${clinic.replace(/[^\p{L}\p{N}]+/gu, "-")}.pdf`, await reportPdf(kit.current), "application/pdf");
          } catch (e) {
            toast(errText(e), "danger");
          } finally {
            setBusy(false);
          }
        }}
      >
        Descargar el kit en PDF (para imprimirlo)
      </Button>
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>He guardado el código en un sitio seguro (impreso o apuntado en papel)</span>
      </label>
      <Button
        block
        disabled={!saved}
        onClick={async () => {
          await confirmRecoverySaved(getDb(), salt, cloud.account.email);
          toast("Código de recuperación guardado", "success");
          onClose();
        }}
      >
        Hecho
      </Button>
    </Sheet>
  );
}

/**
 * A quien administra la clínica: mientras no conste que el código de la contraseña de ahora está guardado, se le
 * recuerda (y se crea con la contraseña).
 */
export function RecoveryReminder() {
  const cloud = useCloud();
  const pending = useAsync(async () => (cloud?.clinic?.role === "admin" ? recoveryPending(getDb()) : false), [cloud?.clinic?.role]);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kit, setKit] = useState<{ code: string; salt: string } | null>(null);
  if (!cloud?.clinic || cloud.clinic.role !== "admin" || (!pending.data && !kit)) return null;

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!cloud) return;
    setBusy(true);
    setError(null);
    try {
      const { raw, salt } = await checkPassword(cloud, getDb(), password);
      setKit({ code: await createRecovery(cloud, raw, salt), salt });
      setAsking(false);
      setPassword("");
    } catch (err) {
      setError(err instanceof WrongPassword ? "No es la contraseña de la clínica." : errText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {pending.data && (
        <Alert tone="warning" title="Guarda el código de recuperación de la clínica">
          Sin él, si se olvida la contraseña de cifrado y se pierden los dispositivos, los pacientes no se pueden recuperar.{" "}
          <Button size="sm" className="mt-2" icon={<LifeBuoy aria-hidden="true" className="size-4" />} onClick={() => setAsking(true)}>
            Crear el código de recuperación
          </Button>
        </Alert>
      )}
      <Sheet open={asking} onClose={() => setAsking(false)} title="Crear el código de recuperación">
        <form className="flex flex-col gap-3" noValidate onSubmit={create}>
          <p>Escribe la contraseña de cifrado de la clínica para crear su código de recuperación.</p>
          <TextField
            label="Contraseña de la clínica"
            type="password"
            autoComplete="current-password"
            value={password}
            error={error ?? undefined}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
          />
          <Button type="submit" block loading={busy} disabled={!password} icon={<KeyRound aria-hidden="true" className="size-5" />}>
            Crear el código
          </Button>
        </form>
      </Sheet>
      {kit && (
        <RecoveryKit
          code={kit.code}
          salt={kit.salt}
          onClose={() => {
            setKit(null);
            pending.reload();
          }}
        />
      )}
    </>
  );
}

/** Para quien administra y ha olvidado la contraseña: abrir la copia con el código de recuperación. */
export function RecoverWithCode({ onDone }: { onDone: () => void }) {
  const cloud = useCloud();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!cloud) return null;
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await recoverWithCode(cloud, code);
          toast("Copia recuperada. Elige ahora una contraseña nueva.", "success");
          onDone();
        } catch (err) {
          setError(err instanceof WrongPassword ? "No es el código de recuperación de esta clínica." : errText(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <TextField
        label="Código de recuperación"
        hint="El del kit impreso: 20 letras y números (da igual mayúsculas, espacios o guiones)."
        autoComplete="off"
        spellCheck={false}
        value={code}
        error={error ?? undefined}
        onChange={(e) => {
          setCode(e.target.value);
          setError(null);
        }}
      />
      <Button type="submit" block loading={busy} disabled={code.replace(/[\s-]/g, "").length < 20}>
        Recuperar con el código
      </Button>
    </form>
  );
}
