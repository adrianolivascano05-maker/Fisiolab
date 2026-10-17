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
        <li>
          No uses la «súper cámara lenta» (960 fps) de algunos Android: solo graba una fracción de segundo y parte de
          los fotogramas son inventados.
        </li>
        <li>Apoya el móvil o pide a alguien que lo sujete quieto, a la altura de los pies y a 2-3 metros.</li>
        <li>Encuadra los pies con margen: deben verse antes, durante y después del salto.</li>
        {type === "dj" && <li>Que se vea también el cajón: hay que marcar el primer contacto al caer de él.</li>}
        {type === "rj_10_5" && <li>Graba los 10 rebotes enteros, sin cortar: la cámara lenta del móvil suele permitir unos 10-15 s.</li>}
        {type === "single_leg" && <li>Graba primero una pierna y después la otra, en dos vídeos.</li>}
        <li>Pide que aterrice con las piernas estiradas, como despegó: aterrizar flexionado alarga el vuelo y la altura sale mayor.</li>
      </ol>
      <h3 className="font-semibold">Marcar</h3>
      <JumpPhases type={type} />
      {type === "rj_10_5" && (
        <p>
          En los saltos repetidos se marcan, uno tras otro, el despegue y el aterrizaje de cada salto. El contacto es el
          tiempo entre un aterrizaje y el despegue siguiente. Si te equivocas, «Deshacer» quita la última marca.
        </p>
      )}
      {(type === "cmj" || type === "cmj_arms") && (
        <p>
          Opcional: marca también el <b>inicio</b>, el primer fotograma en que empieza a bajar. Con él se calculan el tiempo
          hasta el despegue y el RSI modificado.
        </p>
      )}
      <p className="text-sm text-text-muted">Usa los botones de un fotograma y la lupa de la barra para afinar.</p>
    </div>
  );
}
