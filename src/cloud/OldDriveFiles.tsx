// Ajustes → Cuenta de Google: la app ya no guarda archivos en Google Drive. A quien guardó alguno con «Guardar en mi
// Drive» (antes de la revisión del 29-10-2026), se le avisa de que siguen en su Drive, sin cifrar, y de dónde están,
// hasta que dice que ya lo ha revisado. La app ya no tiene permiso para verlos ni borrarlos.
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { memberKey } from "../data/member";
import { getSetting, setSetting } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";

/** El id de la carpeta donde se guardaban (ajuste de cada persona). */
const FOLDER_KEY = "drive_folder_id";

export function OldDriveFiles() {
  const folder = useAsync(() => getSetting<string>(getDb(), memberKey(FOLDER_KEY)), []);
  const [done, setDone] = useState(false);
  if (done || !folder.data) return null;
  return (
    <Alert tone="warning" title="Archivos que guardaste antes en tu Google Drive">
      <div className="flex flex-col gap-2">
        <p>
          La app ya no guarda nada en Google Drive. Los informes, recibos y demás documentos que guardaste con «Guardar en mi Drive» siguen en tu
          Drive, en la carpeta «OmniClin» (o «Cénit · Fisiolab»): son copias sin cifrar con datos de pacientes y la app ya no puede verlas ni
          borrarlas. Si no las necesitas, bórralas desde Drive.
        </p>
        <a
          href={`https://drive.google.com/drive/folders/${encodeURIComponent(folder.data)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-accent underline underline-offset-2"
        >
          Abrir la carpeta en Drive <ExternalLink aria-hidden="true" className="size-4" />
        </a>
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          onClick={async () => {
            await setSetting(getDb(), memberKey(FOLDER_KEY), null);
            setDone(true);
          }}
        >
          Ya lo he revisado
        </Button>
      </div>
    </Alert>
  );
}
