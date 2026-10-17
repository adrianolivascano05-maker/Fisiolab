import { getCodTest, isCodType } from "../calc/cod";

/** Cómo grabar y marcar sprint, cambio de dirección y carrera. Texto propio. */
export function SpeedHelp({ type }: { type: string }) {
  if (type === "running") {
    return (
      <div className="flex flex-col gap-3 text-base">
        <h3 className="font-semibold">Grabar</h3>
        <ol className="list-decimal space-y-2 pl-5">
          <li>En cinta, a velocidad constante y tras al menos un minuto corriendo.</li>
          <li>Cámara lenta (120 fps o más), de lado, quieta y a la altura de los pies. Que se vean los dos pies todo el rato.</li>
          <li>Graba unos 10 apoyos seguidos.</li>
        </ol>
        <h3 className="font-semibold">Marcar</h3>
        <p>
          En cada apoyo marca el <b>contacto</b> (el primer fotograma en que el pie toca la cinta) y el <b>despegue</b> (el primero en
          que ya no la toca), uno detrás de otro. Indica con qué pie es el primer apoyo: a partir de ahí se alternan.
        </p>
      </div>
    );
  }
  const cod = isCodType(type) ? getCodTest(type) : undefined;
  return (
    <div className="flex flex-col gap-3 text-base">
      <h3 className="font-semibold">Grabar</h3>
      {cod && <p>{cod.detail}</p>}
      <ol className="list-decimal space-y-2 pl-5">
        <li>Móvil quieto, lejos (10 m o más) y de lado al recorrido, para que se vean todas las líneas.</li>
        <li>Pon conos o picas altas en cada línea: así se ve bien cuándo las cruza el tronco.</li>
        <li>60 fps bastan; con 120 fps o más, mejor.</li>
      </ol>
      <h3 className="font-semibold">Marcar</h3>
      <p>
        Marca la <b>salida</b> (el primer movimiento) y después {cod ? "la llegada" : "cada paso por las líneas, en orden"}, cuando el
        tronco (no un brazo ni la cabeza) cruza la línea.
      </p>
      <p className="text-sm text-text-muted">
        Con una sola cámara, la línea lejana se ve con algo de paralaje: cuanto más lejos y centrado esté el móvil, menos error. Con
        fotocélulas, escribe sus tiempos directamente.
      </p>
    </div>
  );
}
