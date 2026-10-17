import type { JumpType } from "../calc/results";
import { CameraSetup } from "../ui/illustrations/CameraSetup";
import { JumpPhases } from "../ui/illustrations/JumpPhases";

/** S25 Ayuda: cómo grabar y cómo marcar cada salto. Texto e ilustraciones propios. */
export function JumpHelp({ type }: { type: JumpType }) {
  return (
    <div className="flex flex-col gap-3 text-base">
      <h3 className="font-semibold">Grabar</h3>
      <CameraSetup />
      <ol className="list-decimal space-y-2 pl-5">
        <li>Usa la cámara lenta del móvil, a 240 fps si la tiene (como mínimo 120).</li>
        <li>Apoya el móvil o pide a alguien que lo sujete quieto, a la altura de los pies y a 2-3 metros.</li>
        <li>Encuadra los pies con margen: deben verse antes, durante y después del salto.</li>
        {type === "dj" && <li>Que se vea también el cajón: hay que marcar el primer contacto al caer de él.</li>}
        <li>Pide que aterrice con las piernas estiradas, como despegó: aterrizar flexionado alarga el vuelo y la altura sale mayor.</li>
      </ol>
      <h3 className="font-semibold">Marcar</h3>
      <JumpPhases type={type} />
      <p className="text-sm text-text-muted">Usa los botones de un fotograma y la lupa de la barra para afinar.</p>
    </div>
  );
}
