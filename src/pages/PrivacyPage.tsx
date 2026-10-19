import { Link } from "react-router";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";

/** Privacidad: qué datos trata la app y dónde están. Texto propio de Fisiolab. */
export function PrivacyPage() {
  const cloud = useCloud();
  const clinic = useAsync(() => getClinic(getDb()), []);
  const owner = clinic.data?.name || "la clínica Fisiolab";
  return (
    <Page title="Privacidad" backTo="/ajustes">
      <article className="flex flex-col gap-3 text-base">
        <p>
          Esta app la usa {owner} para la historia clínica y las mediciones de sus pacientes. Responsable del tratamiento: {owner}.
        </p>
        <h2 className="text-lg">Qué datos guarda</h2>
        <p>
          Nombre, fecha de nacimiento, sexo, medidas corporales y notas de cada paciente; su anamnesis, exploración, sesiones y cuestionarios; los
          resultados de sus tests (marcas del vídeo y valores calculados); y cuándo se le dio la información de protección de datos y qué consentimientos
          opcionales dio. Los vídeos <b>no</b> se guardan: se quedan en la galería del móvil.
        </p>
        <h2 className="text-lg">Dónde están</h2>
        {cloud ? (
          <p>
            En el almacenamiento de este dispositivo y en el Google Drive de cada fisioterapeuta, en una carpeta oculta que solo usa esta app (cada uno
            entra con su cuenta de Google y solo ve sus pacientes). Esa copia se puede cifrar con una contraseña de la clínica (Ajustes → Cuenta). La app no
            tiene servidor propio: el dispositivo habla directamente con Google Drive. Las copias de seguridad y los CSV son archivos que descarga quien usa
            la app y que la clínica debe guardar con las mismas precauciones que la historia clínica.
          </p>
        ) : (
          <p>
            Solo en el almacenamiento de este dispositivo. La app no tiene servidor, ni cuentas, ni envía los datos a nadie. Las copias de seguridad y los
            CSV son archivos que descarga quien usa la app y que la clínica debe guardar con las mismas precauciones que la historia clínica.
          </p>
        )}
        <h2 className="text-lg">Proveedores</h2>
        <p>
          El alojamiento web solo sirve los archivos de la app. Como cualquier web, registra la dirección IP de quien la descarga. No recibe datos de
          pacientes. No hay analítica, ni publicidad, ni cookies.
          {cloud &&
            " Google guarda la copia de la carpeta de la app en el Drive de cada fisioterapeuta, los informes y resultados que se guardan a la vista en su carpeta «Cénit · Fisiolab», y el día, la hora y el nombre (o las iniciales) de las citas en el calendario «Cénit · Citas»; para entrar, Google ve el nombre y el correo de quien entra. Para historias clínicas hace falta un contrato de encargado del tratamiento con Google, que tienen las cuentas de Google Workspace de la clínica y no las de Gmail normales."}
        </p>
        <h2 className="text-lg">Seguridad</h2>
        <p>
          Protege cada dispositivo con PIN o huella y, si lo comparte más gente, activa el bloqueo de la app (Ajustes → Bloqueo de la app). Con la nube,
          activa la verificación en dos pasos de la cuenta de Google. Si se pierde un dispositivo sin bloqueo o alguien entra en una cuenta, la clínica
          tiene 72 horas para avisar a la Agencia Española de Protección de Datos.
        </p>
        <h2 className="text-lg">Derechos y conservación</h2>
        <p>
          Cada paciente recibe la información de protección de datos (ficha del paciente → Protección de datos). Para entregarle sus datos: su informe en
          PDF o el CSV de Ajustes. Para borrarlo: ficha del paciente → editar → «Borrar paciente»; la app avisa si aún no ha pasado el plazo de
          conservación de la historia clínica ({clinic.data?.retentionYears ?? 5} años desde la última atención), porque la ley obliga a guardarla aunque
          el paciente pida borrarla. Los datos de la clínica se rellenan en{" "}
          <Link to="/ajustes#proteccion-datos" className="font-semibold text-accent underline">
            Ajustes → Protección de datos
          </Link>
          .
        </p>
        <p className="text-sm text-text-muted">
          Los resultados son una ayuda para el seguimiento y no sustituyen el juicio clínico. Esto no es asesoramiento legal: la clínica debe revisarlo con
          su delegado de protección de datos.
        </p>
      </article>
    </Page>
  );
}
