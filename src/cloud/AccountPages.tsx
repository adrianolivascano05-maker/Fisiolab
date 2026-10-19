// La cuenta en la pantalla principal y la pantalla «Iniciar sesión con Google» (src/cloud/README.md).
import { Check, CloudUpload, Copy, LogIn, MonitorSmartphone, Share2 } from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router";
import { Page } from "../app/Page";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { redirectUri, startLogin } from "./auth";
import { syncText, useCloud, useSyncState } from "./CloudGate";
import { isClientId, setDeviceClientId } from "./config";

const primaryLink = "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-5 font-semibold text-on-accent hover:bg-accent-hover";

/**
 * Pantalla principal: con sesión, quién ha entrado y cómo va la copia en Drive; sin nube, el enlace para iniciar
 * sesión con Google. Debajo, cómo usar la app en otros dispositivos.
 */
export function AccountCard() {
  const cloud = useCloud();
  const s = useSyncState();
  return (
    <div className="flex flex-col gap-2">
      {cloud && s ? (
        <Card className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">
            {cloud.account.name.slice(0, 1).toUpperCase()}
          </span>
          <Link to="/ajustes" className="flex min-w-0 flex-1 flex-col hover:underline">
            <span className="truncate font-semibold">{cloud.account.name}</span>
            <span className="text-sm text-text-muted">{syncText(s)}</span>
          </Link>
          {s.status === "needs-auth" && (
            <Button size="sm" onClick={cloud.reconnect}>
              Entrar con Google
            </Button>
          )}
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <CloudUpload aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-accent" />
            <div>
              <h2 className="font-semibold">Guarda tus pacientes en tu Google Drive</h2>
              <p className="text-sm text-text-muted">Inicia sesión con tu cuenta de Google y tenlos en el móvil, la tablet o el ordenador.</p>
            </div>
          </div>
          <Link to="/cuenta" className={primaryLink}>
            <LogIn aria-hidden="true" className="size-5" /> Iniciar sesión con Google
          </Link>
        </Card>
      )}
      <Link to="/instalar" className="inline-flex min-h-11 items-center gap-2 self-start rounded-md px-1 text-sm font-semibold text-accent hover:underline">
        <MonitorSmartphone aria-hidden="true" className="size-5" /> Usar la app en otros dispositivos
      </Link>
    </div>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-text-muted">{label}</span>
      <div className="flex flex-col items-start gap-2">
        <code className="w-full break-all rounded-md bg-surface px-2 py-2 text-sm">{value}</code>
        <Button
          variant="secondary"
          size="sm"
          icon={copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* sin portapapeles: se copia a mano */
            }
          }}
        >
          {copied ? "Copiado" : `Copiar ${label.toLowerCase()}`}
        </Button>
      </div>
    </div>
  );
}

// Enlaces directos de la consola de Google (Google Auth Platform) para quien lo active.
const CONSOLE = {
  enableDrive: "https://console.cloud.google.com/flows/enableapi?apiid=drive.googleapis.com",
  branding: "https://console.cloud.google.com/auth/branding",
  scopes: "https://console.cloud.google.com/auth/scopes",
};

/** Los pasos en texto, para mandarlos por WhatsApp o correo a quien lo vaya a activar. */
function activationText(origin: string, redirect: string) {
  return [
    "Activar «Entrar con Google» en Cénit · Fisiolab (una sola vez, gratis, unos 10 minutos):",
    `1. Crear el proyecto y activar Google Drive: ${CONSOLE.enableDrive}`,
    `2. ${CONSOLE.branding} → nombre «Cénit · Fisiolab», tu correo, público «Externo». Después, en «Público», pulsa «Publicar aplicación».`,
    `3. ${CONSOLE.scopes} → añadir el permiso …/auth/drive.appdata.`,
    `4. En «Clientes» → «Crear cliente» → «Aplicación web», con origen autorizado ${origin} y URI de redirección ${redirect}`,
    "5. Copiar el ID de cliente (termina en .apps.googleusercontent.com) y enviarlo. El «secreto» no hace falta.",
  ].join("\n");
}

const ext = (href: string, text: string) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent underline underline-offset-2">
    {text}
  </a>
);

/**
 * «Iniciar sesión con Google» mientras la app publicada no lleva el ID de cliente. Para el fisioterapeuta: aún no
 * está activado y un botón para mandar los pasos a quien lo active. Para quien lo activa (desplegable): los pasos
 * con enlaces directos y el campo para pegar el ID y entrar ya en este dispositivo.
 */
export function SignInSetupPage() {
  const cloud = useCloud();
  const [id, setId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (cloud) return <Navigate to="/" replace />;
  const origin = location.origin;
  const text = activationText(origin, redirectUri());
  const canShare = typeof navigator.share === "function";
  return (
    <Page title="Iniciar sesión con Google" backTo="/">
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Aún no está activado</h2>
        <p>
          El inicio de sesión con Google se activa <b>una sola vez para toda la clínica</b>. Después, cada fisioterapeuta solo pulsa «Entrar con Google».
        </p>
        <p className="text-sm text-text-muted">Mientras tanto la app funciona igual: tus pacientes se guardan en este dispositivo.</p>
        {canShare && (
          <Button icon={<Share2 aria-hidden="true" className="size-5" />} onClick={() => void navigator.share({ title: "Activar Entrar con Google", text }).catch(() => {})}>
            Enviar los pasos a quien lo active
          </Button>
        )}
        <Button
          variant={canShare ? "secondary" : "primary"}
          icon={copied ? <Check aria-hidden="true" className="size-5" /> : <Copy aria-hidden="true" className="size-5" />}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* sin portapapeles: los pasos están abajo */
            }
          }}
        >
          {copied ? "Pasos copiados" : "Copiar los pasos"}
        </Button>
      </Card>

      <details className="rounded-lg border border-border bg-bg p-4">
        <summary className="cursor-pointer font-semibold">Lo activo yo, o ya tengo el ID de cliente</summary>
        <div className="mt-3 flex flex-col gap-3">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
            <li>{ext(CONSOLE.enableDrive, "Crear el proyecto y activar Google Drive")} (con tu cuenta de Google).</li>
            <li>
              {ext(CONSOLE.branding, "Pantalla de consentimiento")}: nombre «Cénit · Fisiolab», tu correo, público <b>Externo</b>. Después, en <b>Público</b>,{" "}
              <b>Publicar aplicación</b>.
            </li>
            <li>
              {ext(CONSOLE.scopes, "Acceso a datos")}: añade el permiso <b>drive.appdata</b>.
            </li>
            <li>
              En <b>Clientes → Crear cliente</b>: <b>Aplicación web</b>, con este origen y esta redirección:
            </li>
          </ol>
          <CopyRow label="Origen" value={origin} />
          <CopyRow label="Redirección" value={redirectUri()} />
          <form
            className="flex flex-col gap-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!isClientId(id)) return setError("Eso no parece un ID de cliente: tiene que terminar en .apps.googleusercontent.com.");
              setDeviceClientId(id);
              startLogin(id.trim(), { chooseAccount: true, returnTo: import.meta.env.BASE_URL }); // vuelve a la pantalla principal
            }}
          >
            <TextField
              label="ID de cliente"
              placeholder="123456789012-abc….apps.googleusercontent.com"
              autoComplete="off"
              spellCheck={false}
              value={id}
              error={error ?? undefined}
              onChange={(e) => {
                setId(e.target.value);
                setError(null);
              }}
            />
            <Button type="submit" size="lg" block icon={<LogIn aria-hidden="true" className="size-5" />}>
              Entrar con Google
            </Button>
          </form>
          <p className="text-sm text-text-muted">
            Pegado aquí, vale para este dispositivo. Para que valga en todos los de la clínica sin pegarlo en cada uno, el ID se pone una vez en la app
            publicada (archivo <code>public/cloud.json</code>).
          </p>
        </div>
      </details>
    </Page>
  );
}
