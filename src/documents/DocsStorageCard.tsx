// Ajustes › Copias y exportar: lo que ocupan los archivos de los pacientes en el servidor de la clínica (con el tope
// de 10 GB) y, para el móvil, borrar de aquí los ya subidos (se vuelven a bajar al abrirlos).
import { HardDrive } from "lucide-react";
import { useState } from "react";
import { getDb } from "../data/db";
import { sizeText } from "../data/documents";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useToast } from "../ui/Toast";
import { freeDeviceSpace } from "./docSync";
import { useDocsServer, useDocsUsage } from "./DocSync";

export function DocsStorageCard() {
  const toast = useToast();
  const { space } = useDocsServer();
  const { usage } = useDocsUsage();
  const [busy, setBusy] = useState(false);
  if (!space || !usage?.enabled) return null;
  const nearly = usage.total >= usage.warnAt;
  return (
    <Card className="flex flex-col gap-3">
      <h3 className="font-semibold">Archivos de los pacientes</h3>
      <p className="text-sm text-text-muted">
        {usage.count === 1 ? "1 archivo" : `${usage.count} archivos`} de esta clínica: {sizeText(usage.used)}. El almacén de archivos del servidor lleva{" "}
        {sizeText(usage.total)} de {sizeText(usage.cap)}; al llegar al tope no se guardan más (así nunca se paga).
      </p>
      {nearly && <p className="text-sm font-semibold text-warning">Casi lleno: borra los archivos que ya no hagan falta.</p>}
      <Button
        variant="secondary"
        loading={busy}
        icon={<HardDrive aria-hidden="true" className="size-5" />}
        onClick={async () => {
          setBusy(true);
          try {
            const n = await freeDeviceSpace(getDb(), space);
            toast(n ? `Borrados de este dispositivo: ${n === 1 ? "1 archivo" : `${n} archivos`}. Siguen en el servidor.` : "No había archivos que borrar de este dispositivo", "success");
          } finally {
            setBusy(false);
          }
        }}
      >
        Liberar espacio en este dispositivo
      </Button>
    </Card>
  );
}
