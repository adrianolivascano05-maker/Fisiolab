import { Info } from "lucide-react";
import type { Movement } from "../calc/rom";
import { Lunge } from "../ui/illustrations/Lunge";

/** Cómo se hace cada movimiento: posición del paciente y dónde va el móvil. Textos propios. */
export function RomInstructions({ movement }: { movement: Movement }) {
  return (
    <details className="rounded-lg border border-border bg-bg p-3 shadow-card">
      <summary className="flex cursor-pointer items-center gap-2 font-semibold">
        <Info aria-hidden="true" className="size-5 text-accent" /> Cómo se hace: posición y dónde va el móvil
      </summary>
      <div className="mt-2 flex flex-col gap-2 text-base">
        {movement.id === "ankle_lunge" && <Lunge />}
        <p>
          <b>Posición.</b> {movement.position}
        </p>
        <p>
          <b>Con el móvil.</b> {movement.phone} {movement.sensor === "relative" && "Pulsa «Poner a cero» en la posición de inicio."}
        </p>
        {movement.photo && (
          <p>
            <b>Con foto.</b> {movement.photo.note} Marca, en orden: {movement.photo.points.join(", ").toLowerCase()}.
          </p>
        )}
        <p className="text-sm text-text-muted">
          El móvil mide el giro respecto a la gravedad: el segmento debe moverse en un plano vertical, por eso algunas pruebas se
          hacen tumbado. Repite tres veces y guarda la media.
        </p>
      </div>
    </details>
  );
}
