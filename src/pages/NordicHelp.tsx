import { NordicSetup } from "../ui/illustrations/NordicSetup";

/** Cómo grabar y marcar el nórdico. Texto e ilustración propios. */
export function NordicHelp() {
  return (
    <div className="flex flex-col gap-3 text-base">
      <h3 className="font-semibold">Grabar</h3>
      <NordicSetup />
      <ol className="list-decimal space-y-2 pl-5">
        <li>De rodillas sobre una colchoneta, con los tobillos bien sujetos (un compañero o un apoyo fijo).</li>
        <li>Móvil de lado, quieto, recto y a la altura de la rodilla, a unos 3 m. Que se vea el cuerpo entero.</li>
        <li>Pide que baje despacio, con la cadera estirada (rodilla, cadera y hombro en línea) y frenando todo lo posible.</li>
        <li>Basta con 30 o 60 fps: la caída es lenta.</li>
      </ol>
      <h3 className="font-semibold">Marcar</h3>
      <p>
        Busca el <b>último fotograma en que aún frena la caída</b>, justo antes de que se desplome, y pulsa Rotura. Después toca la
        rodilla y la cadera en ese fotograma: el ángulo es la inclinación respecto a la vertical (0° erguido, 90° en el suelo).
      </p>
      <p className="text-sm text-text-muted">
        Con el peso y la estatura del paciente, la app estima el momento de fuerza de los isquios en ese punto, por pierna. Es una
        estimación con proporciones corporales medias, útil para comparar al mismo paciente en el tiempo.
      </p>
    </div>
  );
}
