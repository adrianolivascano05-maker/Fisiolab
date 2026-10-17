import { getExercise } from "../calc/strength";
import { BarSetup } from "../ui/illustrations/BarSetup";

/** Cómo grabar y marcar una serie de fuerza. Texto e ilustración propios. */
export function StrengthHelp({ exercise }: { exercise: string }) {
  const e = getExercise(exercise);
  return (
    <div className="flex flex-col gap-3 text-base">
      <h3 className="font-semibold">Grabar</h3>
      <BarSetup />
      <ol className="list-decimal space-y-2 pl-5">
        <li>Cámara lenta (120 fps o más), con el móvil quieto, de lado y a la altura de la barra.</li>
        <li>Que se vea la barra entera durante toda la serie, con margen arriba y abajo.</li>
        <li>Pide que cada subida sea a la máxima velocidad posible: la bajada puede ser controlada.</li>
      </ol>
      <h3 className="font-semibold">Recorrido</h3>
      <p>{e?.rom ?? "Distancia vertical que recorre la barra en la subida."} Se mide una vez: la app recuerda el último de cada ejercicio.</p>
      <h3 className="font-semibold">Marcar</h3>
      <p>
        En cada repetición, marca el <b>inicio</b> de la subida y el <b>fin</b>. {e?.rep} La velocidad media es el recorrido dividido por
        el tiempo entre las dos marcas.
      </p>
      <p className="text-sm text-text-muted">
        Un fotograma de error en una subida de medio segundo a 120 fps cambia la velocidad un 1,7 %; a 30 fps, casi un 7 %.
      </p>
    </div>
  );
}
