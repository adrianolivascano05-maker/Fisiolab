// Usar la app en otros dispositivos: el enlace (copiar o compartir), un código QR para abrirla desde otro móvil o
// la tablet, y cómo instalarla en cada sistema. Es una web instalable: no hay que pasar por ninguna tienda.
import qrcode from "qrcode-generator";
import { Check, Copy, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Page } from "../app/Page";
import { InstallSteps, useInstall } from "../app/pwa";
import { useCloud } from "../cloud/CloudGate";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

/** Código QR en SVG, negro sobre blanco (con su margen) para que lo lea cualquier cámara. */
function QrCode({ text, label }: { text: string; label: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 4;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet},${r + quiet}h1v1h-1z`;
    return { size: n + 2 * quiet, path: d };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges" className="size-52 rounded-md">
      <rect width={size} height={size} fill="#FFFFFF" />
      <path d={path} fill="#000000" />
    </svg>
  );
}

const devices: { title: string; steps: string[] }[] = [
  {
    title: "Ordenador con Chrome o Edge (Windows, Mac o Linux)",
    steps: ["Abre el enlace.", "Pulsa el icono de instalar de la barra de direcciones (una pantalla con una flecha) o, en el menú ⋮, «Instalar Cénit».", "Queda como un programa más, con su icono."],
  },
  { title: "Mac con Safari", steps: ["Abre el enlace en Safari.", "Menú Archivo → «Añadir al Dock»."] },
  { title: "iPad o iPhone", steps: ["Abre el enlace en Safari.", "Pulsa Compartir y elige «Añadir a pantalla de inicio»."] },
  { title: "Tablet o móvil Android", steps: ["Abre el enlace en Chrome.", "Menú ⋮ → «Instalar aplicación» (o «Añadir a pantalla de inicio»)."] },
];

export function InstallPage() {
  const install = useInstall();
  const cloud = useCloud();
  const url = new URL(import.meta.env.BASE_URL, location.origin).href;
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator.share === "function";
  return (
    <Page title="Instalar la app" backTo="/ajustes">
      <p>
        Cénit es una web que se instala: se abre con este enlace en cualquier móvil, tablet u ordenador, y desde ahí se añade como app. No hace falta
        ninguna tienda.
      </p>
      <h2 className="text-lg">En este dispositivo</h2>
      <Card className="flex flex-col gap-2">
        <InstallSteps {...install} />
        {install.state !== "installed" && <p className="text-sm text-text-muted">Instalada se abre sin internet y el navegador cuida mejor sus datos.</p>}
      </Card>

      <h2 className="text-lg">En otro dispositivo</h2>
      <Card className="flex flex-col items-center gap-3">
        <QrCode text={url} label={`Código QR con el enlace de la app: ${url}`} />
        <p className="text-center text-sm text-text-muted">Escanéalo con la cámara de la tablet o del otro móvil.</p>
        <code className="max-w-full break-all rounded-md bg-surface px-3 py-2 text-center text-sm">{url}</code>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            variant="secondary"
            icon={copied ? <Check aria-hidden="true" className="size-5" /> : <Copy aria-hidden="true" className="size-5" />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* sin portapapeles: el enlace está a la vista */
              }
            }}
          >
            {copied ? "Enlace copiado" : "Copiar enlace"}
          </Button>
          {canShare && (
            <Button
              variant="secondary"
              icon={<Share2 aria-hidden="true" className="size-5" />}
              onClick={() => void navigator.share({ title: "Cénit · Fisiolab", text: "La app de Cénit · Fisiolab", url }).catch(() => {})}
            >
              Enviar el enlace
            </Button>
          )}
        </div>
      </Card>

      <h2 className="text-lg">Cómo instalarla en cada uno</h2>
      <ul className="flex flex-col gap-2">
        {devices.map((d) => (
          <li key={d.title}>
            <Card className="flex flex-col gap-1.5">
              <h3 className="font-semibold">{d.title}</h3>
              <ol className="list-decimal pl-5 text-sm">
                {d.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-sm text-text-muted">Firefox en el ordenador no instala webs como apps: ábrela en Chrome o Edge, o úsala en una pestaña.</p>

      <h2 className="text-lg">Tus pacientes en el otro dispositivo</h2>
      <p className="text-sm">
        {cloud
          ? `Entra con tu cuenta de Google (${cloud.account.email}) y aparecen tus pacientes: se guardan en tu Google Drive.`
          : "Si inicias sesión con Google en los dos, tienes los mismos pacientes en todos. Sin cuenta, cada dispositivo guarda los suyos: para pasarlos, usa la copia de seguridad de Ajustes."}
      </p>

    </Page>
  );
}
