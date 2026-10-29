import { Link } from "react-router";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { useCloud } from "../cloud/cloudContext";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { SUPPORT_EMAIL } from "../app/contact";

/** Privacidad: qué datos trata la app y dónde están. Texto propio de Fisiolab. */
export function PrivacyPage() {
  const cloud = useCloud();
  const clinic = useAsync(() => getClinic(getDb()), []);
  const owner = clinic.data?.name || "la clínica Fisiolab";
  const server = cloud?.sync.store.kind === "server";
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
          opcionales dio. Si la clínica usa el servidor de OmniClin, también los archivos que se añaden a su ficha (informes y pruebas en PDF o en foto),
          los suba la clínica o el propio paciente con su enlace. Los vídeos <b>no</b> se guardan: se quedan en la galería del móvil.
        </p>
        <h2 className="text-lg">Dónde están</h2>
        {server ? (
          <p>
            En el almacenamiento de este dispositivo y, cifrados, en el servidor de la clínica (Cloudflare, en la Unión Europea). Antes de salir del
            dispositivo se cifran con la contraseña de la clínica: ni el servidor ni quien lo gestiona pueden leerlos; solo ven el nombre de la clínica y el
            correo de cada persona del equipo. Cada uno entra con su cuenta de Google. Los archivos de los pacientes se cifran igual, cada uno con su propia
            clave, y se guardan en el almacén de archivos del servidor (también de Cloudflare, en la Unión Europea) y en el dispositivo donde se añaden o se abren. Las
            copias de seguridad, los CSV y los archivos que se abren son archivos que descarga quien usa la app y que la clínica debe guardar con las mismas
            precauciones que la historia clínica.
          </p>
        ) : cloud ? (
          <p>
            En el almacenamiento de este dispositivo y en el Google Drive de cada fisioterapeuta, en una carpeta oculta que solo usa esta app (cada uno
            entra con su cuenta de Google y solo ve sus pacientes). Esa copia se puede cifrar con una contraseña de la clínica (Ajustes → Cuenta de Google). La app no
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
          {server &&
            " Cloudflare aloja el servidor de la clínica en la Unión Europea y solo guarda copias cifradas, los formularios cifrados de los pacientes y sus archivos cifrados; su contrato de encargado del tratamiento (DPA) forma parte de sus condiciones. Google solo sirve para entrar (ve el nombre y el correo de quien entra) y, si se usan, para guardar informes en el Drive de cada fisioterapeuta y las citas en su Google Calendar."}
          {cloud &&
            !server &&
            " Google guarda la copia de la carpeta de la app en el Drive de cada fisioterapeuta, los informes y resultados que se guardan a la vista en su carpeta «OmniClin», y el día, la hora y el nombre (o las iniciales) de las citas en el calendario «OmniClin · Citas»; para entrar, Google ve el nombre y el correo de quien entra. Para historias clínicas hace falta un contrato de encargado del tratamiento con Google, que tienen las cuentas de Google Workspace de la clínica y no las de Gmail normales."}
        </p>
        {/* Siempre, aunque la app lleve la marca de la clínica: quién hace el programa y qué puede ver. */}
        <h2 className="text-lg">Quién hace el programa</h2>
        <p>
          Esta app es OmniClin, aunque lleve el nombre, los colores o el logo de {owner}. OmniClin hace el programa y no puede ver los
          datos de los pacientes.{" "}
          {server
            ? "Si el servidor de la clínica lo gestiona OmniClin (u otra persona o empresa que no sea la clínica), quien lo gestione es encargado del tratamiento: la clínica tiene que firmar con él un contrato de encargado (artículo 28 del RGPD)."
            : "Si la clínica pasa a usar un servidor que gestiona otra persona o empresa, esa persona o empresa será encargada del tratamiento y habrá que firmar con ella un contrato de encargado (artículo 28 del RGPD)."}{" "}
          Contacto:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="py-3 font-semibold text-accent underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <h2 className="text-lg">Seguridad</h2>
        <p>
          Protege cada dispositivo con PIN o huella y, si lo comparte más gente, activa el bloqueo de la app (Ajustes → Bloqueo con PIN). Con la nube,
          activa la verificación en dos pasos de la cuenta de Google. Si se pierde un dispositivo sin bloqueo o alguien entra en una cuenta, la clínica
          tiene 72 horas para avisar a la Agencia Española de Protección de Datos.
        </p>
        <h2 className="text-lg">Derechos y conservación</h2>
        <p>
          Cada paciente recibe la información de protección de datos (ficha del paciente → Protección de datos). Para entregarle sus datos: su informe en
          PDF o el CSV de Ajustes. Para borrarlo: ficha del paciente → editar → «Borrar paciente»; la app avisa si aún no ha pasado el plazo de
          conservación de la historia clínica ({clinic.data?.retentionYears ?? 5} años desde la última atención), porque la ley obliga a guardarla aunque
          el paciente pida borrarla. Los datos de la clínica se rellenan en{" "}
          <Link to="/ajustes/clinica" className="font-semibold text-accent underline">
            Ajustes → Clínica y protección de datos
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
