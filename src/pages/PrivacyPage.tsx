import { Page } from "../app/Page";

/** Privacidad: qué datos trata la app y dónde están. Texto propio de Fisiolab. */
export function PrivacyPage() {
  return (
    <Page title="Privacidad" backTo="/ajustes">
      <article className="flex flex-col gap-3 text-base">
        <p>
          Esta app la usa la clínica Fisiolab para medir el rendimiento de sus pacientes. Responsable del tratamiento:
          Fisiolab.
        </p>
        <h2 className="text-lg">Qué datos guarda</h2>
        <p>
          Nombre, fecha de nacimiento, sexo, medidas corporales y notas de cada paciente, y los resultados de sus tests
          (marcas del vídeo y valores calculados). Los vídeos <b>no</b> se guardan: se quedan en la galería del móvil.
        </p>
        <h2 className="text-lg">Dónde están</h2>
        <p>
          Solo en el almacenamiento de este dispositivo. La app no tiene servidor, ni cuentas, ni envía los datos a
          nadie. Las copias de seguridad y los CSV son archivos que descarga quien usa la app y que la clínica debe
          guardar con las mismas precauciones que la historia clínica.
        </p>
        <h2 className="text-lg">Proveedores</h2>
        <p>
          El alojamiento web solo sirve los archivos de la app. Como cualquier web, registra la dirección IP de quien la
          descarga. No recibe datos de pacientes. No hay analítica, ni publicidad, ni cookies.
        </p>
        <h2 className="text-lg">Derechos</h2>
        <p>
          Para borrar a un paciente y todos sus datos: ficha del paciente → editar → «Borrar paciente». Para entregarle
          sus datos: exportar CSV en Ajustes. Para cualquier solicitud, contacta con Fisiolab.
        </p>
        <p className="text-sm text-text-muted">
          Los resultados son una ayuda para el seguimiento y no sustituyen el juicio clínico. Esto no es asesoramiento
          legal: la clínica debe revisarlo con su delegado de protección de datos.
        </p>
      </article>
    </Page>
  );
}
