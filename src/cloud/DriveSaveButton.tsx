// Botón «Guardar en mi Drive»: hace el archivo, lo sube a la carpeta «OmniClin» y enseña el enlace.
// Sin la cuenta de Google conectada no aparece.
import { CloudUpload, ExternalLink } from "lucide-react";
import { useState } from "react";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { useCloud } from "./CloudGate";
import { FOLDER_NAME } from "./drive";
import { NeedsLogin, saveToDrive } from "./saveToDrive";

export function DriveSaveButton({ label, make }: { label: string; make: () => Promise<{ name: string; mimeType: string; bytes: Uint8Array }> }) {
  const cloud = useCloud();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ name: string; link?: string } | null>(null);
  const [login, setLogin] = useState<string | null>(null);
  if (!cloud) return null;
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        icon={<CloudUpload aria-hidden="true" className="size-5" />}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setSaved(null);
          setLogin(null);
          try {
            const file = await make();
            const f = await saveToDrive(getDb(), file);
            setSaved({ name: file.name, link: f.webViewLink });
            toast(`Guardado en tu Drive, carpeta «${FOLDER_NAME}»`, "success");
          } catch (e) {
            if (e instanceof NeedsLogin) setLogin(e.message);
            else toast(e instanceof Error ? e.message : String(e), "danger");
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {saved && (
        <p role="status" className="flex flex-wrap items-center gap-x-2 text-sm">
          <span>
            «{saved.name}» está en tu Drive, carpeta «{FOLDER_NAME}».
          </span>
          {saved.link && (
            <a href={saved.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent underline">
              Abrir en Drive <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          )}
        </p>
      )}
      {login && (
        <div role="alert" className="flex flex-col gap-2 rounded-md bg-warning-soft p-3 text-sm">
          <p>{login}</p>
          <Button size="sm" onClick={cloud.reconnect}>
            Volver a entrar con Google
          </Button>
        </div>
      )}
    </div>
  );
}
