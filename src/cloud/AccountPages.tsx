// La cuenta en la pantalla principal y la pantalla «Iniciar sesión con Google» (src/cloud/README.md).
import { Check, CloudUpload, Copy, LogIn, MonitorSmartphone } from "lucide-react";
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

/**
 * «Iniciar sesión con Google» cuando la app publicada aún no lleva el ID de cliente: cómo crearlo (una vez para
 * toda la clínica) y pegarlo aquí para entrar ya en este dispositivo.
 */
export function SignInSetupPage() {
  const cloud = useCloud();
  const [id, setId] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (cloud) return <Navigate to="/" replace />;
  const origin = location.origin;
  const steps = [
    <>
      Entra en <b>console.cloud.google.com</b> con tu cuenta de Google y crea un proyecto (por ejemplo, «Cenit Fisiolab»).
    </>,
    <>
      En <b>APIs y servicios → Biblioteca</b>, activa <b>Google Drive API</b>.
    </>,
    <>
      En <b>Pantalla de consentimiento</b>: nombre «Cénit · Fisiolab», tu correo, público <b>Externo</b>. En <b>Acceso a datos</b>, añade el permiso{" "}
      <b>drive.appdata</b>. En <b>Público</b>, <b>Publicar aplicación</b>.
    </>,
    <>
      En <b>Clientes → Crear cliente</b>: tipo <b>Aplicación web</b>, con este origen y esta dirección de redirección:
    </>,
    <>
      Copia el <b>ID de cliente</b> (termina en <b>.apps.googleusercontent.com</b>) y pégalo abajo. El «secreto» no hace falta.
    </>,
  ];
  return (
    <Page title="Iniciar sesión con Google" backTo="/">
      <p>
        Para entrar con Google, la app necesita una sola vez un <b>ID de cliente</b> de Google. Es gratis, no es una contraseña y sirve para toda la
        clínica. Se crea en unos 10 minutos:
      </p>
      <Card className="flex flex-col gap-3">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
          {steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
        <CopyRow label="Origen" value={origin} />
        <CopyRow label="Redirección" value={redirectUri()} />
      </Card>
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
        Pegado aquí, vale para este dispositivo. Para que se active en todos los dispositivos de la clínica sin pegarlo en cada uno, el ID se pone una
        vez en la app publicada (archivo <code>public/cloud.json</code>).
      </p>
    </Page>
  );
}
