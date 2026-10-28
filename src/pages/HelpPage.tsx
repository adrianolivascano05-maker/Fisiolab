// «Cómo se usa»: cómo está organizada la app y dónde está cada cosa.
import { BookOpen, CalendarDays, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { SUPPORT_EMAIL } from "../app/contact";
import { Page } from "../app/Page";
import { RECORD_ONLY } from "../clinical/reportParts";
import { Card } from "../ui/Card";

// Enlaces dentro de una frase: el relleno vertical agranda la zona táctil (44 px) sin mover el texto.
const link = "py-3 font-semibold text-accent underline underline-offset-2";

const steps: { title: string; body: ReactNode }[] = [
  {
    title: "Pacientes",
    body: (
      <>
        Pulsa <b>+</b> arriba a la derecha para añadir uno (con el nombre basta). Arriba salen sus <b>próximas citas</b> y las reevaluaciones
        pendientes; debajo, todos por orden alfabético, de 50 en 50. Búscalos por nombre, teléfono o DNI, y con <b>Filtros</b> por edad, sexo,
        fisio, si tienen cita, cuándo vinieron por última vez o si tienen algo pendiente de cobrar o de firmar. En una clínica con equipo,
        el botón <b>Asignar fisio</b> de la cabecera de la ficha dice qué fisios lo llevan (uno o varios).
      </>
    ),
  },
  {
    title: "La ficha de cada paciente",
    body: (
      <>
        Arriba, sus datos y una fila con el <b>motivo</b>, su <b>próxima cita</b> y lo que <b>debe</b>. Debajo, cuatro pestañas fijas al bajar:{" "}
        <b>Resumen</b> (cómo está, lo pendiente y sus documentos), <b>Anamnesis</b>, <b>Valoración</b> (tests de exploración, cuestionarios y
        mediciones, en una página) y <b>Sesiones</b> (cada visita, la curva del dolor y su historia). <b>Editar</b>, arriba a la derecha.
      </>
    ),
  },
  {
    title: "Consentimientos",
    body: (
      <>
        En el Resumen › Legal, <b>Consentimientos informados</b>: la app propone los que necesita según su anamnesis (punción, manipulación, suelo pélvico…), con sus
        riesgos personales ya escritos si marcas sus <b>precauciones</b> en la anamnesis. Se firman con el dedo en la pantalla o se imprimen, y se
        pueden retirar.
      </>
    ),
  },
  {
    title: "Si vuelve por otro problema",
    body: (
      <>
        Debajo de su nombre, <b>Motivo</b>: crea un <b>nuevo motivo de consulta</b> con su propia anamnesis (se copian sus datos personales y
        antecedentes). La ficha enseña lo del motivo que elijas, y lo que añadas va a ese motivo. También puedes verlos <b>todos juntos</b>.
      </>
    ),
  },
  {
    title: "Añadir lo que hagas, en el orden que quieras",
    body: (
      <>
        En el Resumen, <b>Nueva sesión</b> y <b>Valorar</b>: un test de exploración, un cuestionario (se rellena entero en la app y la nota se
        calcula sola) o una medición (salto, fuerza, sprint, carrera, movilidad). En Valoración, cada bloque tiene su propio botón.
      </>
    ),
  },
  {
    title: "Protección de datos e informe",
    body: (
      <>
        En el Resumen, <b>Documentos</b> (informe, informe de alta, carta de derivación y justificante, para imprimir, guardar en PDF o en tu
        Drive) y <b>Legal</b> (consentimientos y la hoja de <b>protección de datos</b>, que se firman en la pantalla o en papel; lo que falte
        sale arriba, en «Pendiente»).
      </>
    ),
  },
  {
    title: "Informes y pruebas del paciente (PDF o fotos)",
    body: (
      <>
        Con el servidor de la clínica, en el Resumen, <b>Documentos › Archivos del paciente</b>: <b>Añadir PDF o fotos</b> (las fotos se juntan en un
        PDF; hasta 5 MB cada archivo) o <b>Pedírselos al paciente</b>, que le manda un enlace para que los suba él. En Android también puedes
        compartirlos desde WhatsApp o el correo y elegir <b>OmniClin</b>. Se guardan cifrados; al abrir uno, se descarga en el dispositivo.
      </>
    ),
  },
  {
    title: "Varias personas a la vez (en una clínica)",
    body: (
      <>
        Lo que cada uno guarda llega a los demás solo, en un minuto. Si dos personas cambian datos distintos de la misma ficha (una el teléfono, otra
        las notas), se quedan los dos. Si cambian el mismo dato, se queda el último y lo otro se guarda en <b>Ajustes › Cuenta › Cambios sustituidos</b>,
        para recuperarlo. Si algo impide sincronizar, sale abajo un aviso fijo con <b>Pulsa para sincronizar</b>; y si dos personas dan la misma hora a
        la vez, sale arriba <b>Cita doble</b>.
      </>
    ),
  },
  {
    title: "Bonos, cobros y ejercicios para casa",
    body: (
      <>
        También en el Resumen, en Cuenta: <b>Bonos y cobros</b> (vende un bono de sesiones, que se gasta solo al apuntar cada sesión, y apunta lo que te paga;
        el precio de la sesión, en Ajustes → Precios y cobros; cada cobro tiene su recibo. La app no hace facturas: en Ajustes → <b>Para facturar</b> están
        los cobros de cada mes con los datos del paciente, en Excel, para hacerlas con tu programa de facturación, y en cada cobro puedes apuntar el número
        que te dio) y <b>Ejercicios para casa</b> (su hoja, desde la biblioteca de la clínica, para
        imprimir o enviar por WhatsApp). En Valoración › Cuestionarios, el <b>mapa del dolor</b>: toca en el dibujo dónde le duele. Tus propias preguntas en la
        anamnesis, en Ajustes → Anamnesis de la clínica. Con el servidor de la clínica, <b>Enviar al móvil</b> (en Cuestionarios) o <b>Mandar su parte al paciente</b>{" "}
        (en Anamnesis) le manda por WhatsApp un cuestionario o su parte de la anamnesis: lo rellena en su móvil, sin cuenta, y llega solo a su ficha.
      </>
    ),
  },
  {
    title: "La agenda",
    body: (
      <>
        <b>Hoy</b> es el día en una lista: cada cita con <b>Atender</b> (apunta la sesión y vuelve aquí) y <b>Cobrar</b>; debajo, lo pendiente
        (reevaluaciones, lo que queda sin cobrar y quién tiene que firmar algo). <b>Día</b> y <b>Semana</b> son la rejilla: toca un hueco para dar
        una cita. <b>Envíos</b> es la bandeja con lo que toca mandar hoy, ya escrito: los recordatorios de mañana y, con el servidor de la clínica, la
        anamnesis 48 horas antes de la primera cita y los cuestionarios antes de reevaluar. Pulsa «Enviar uno tras otro» y manda cada WhatsApp con un
        toque. Lo que dice cada mensaje (y su firma) lo cambias en Ajustes → <b>Mensajes a pacientes</b>. Si alguien quiere venir antes, apúntalo en la <b>Lista de espera</b> con cuándo le viene bien (mañanas, tardes o unas horas, qué días, desde qué día puede y si es preferente): al anular una cita, la app te ofrece su hueco, y la lista se ordena y se filtra por todo eso a la vez. Desde cada paciente de la lista le escribes por WhatsApp, le das cita o entras en su ficha; con <b>«Tengo un hueco libre»</b> ves a quién le encaja un hueco que pongas tú. Para
        marcar una tarde, un día o unas vacaciones sin citas, <b>Cerrar la agenda</b> (en la Agenda): sale rayado en la rejilla. Cada fisio
        cierra la suya y quien administra, la de cualquiera o la de toda la clínica.
      </>
    ),
  },
  {
    title: "Pasar de una sección a otra",
    body: (
      <>
        La barra de abajo está siempre a mano y <b>cada pestaña recuerda dónde estabas</b>: mira un test en la Biblioteca y vuelve a la ficha con un toque
        en Pacientes. Pulsa otra vez la pestaña en la que estás para volver a su inicio. Arriba a la izquierda, <b>‹</b> vuelve a la pantalla
        anterior. La app se ve en claro u oscuro según el ajuste de tu teléfono (o como elijas en Ajustes → Aspecto), y con el nombre, los colores y el logo de tu clínica si los pones en Ajustes → Marca de la clínica; los informes y documentos, siempre en
        claro, como en papel.
      </>
    ),
  },
];

const places: { icon: typeof Users; name: string; text: string }[] = [
  { icon: Users, name: "Pacientes", text: "el buscador, las citas de hoy en una fila y la lista de tus pacientes." },
  { icon: CalendarDays, name: "Agenda", text: "hoy (atender, cobrar y lo pendiente), el día o la semana, los recordatorios y la lista de espera." },
  {
    icon: BookOpen,
    name: "Biblioteca",
    text: "los tests de exploración por articulación, los cuestionarios (qué mide cada uno, sus preguntas y sus permisos) y las mediciones. Un buscador para todo. Si llegas desde la ficha de un paciente, «Registrar el resultado», «Pasar a…» y «Medir en…» van a su ficha; si no, eliges el paciente.",
  },
  { icon: Settings, name: "Ajustes", text: "tu cuenta, los datos de la clínica, el PIN, las copias y la instalación. Un punto rojo avisa si falta algo." },
];

export function HelpPage() {
  return (
    <Page title="Cómo se usa" backTo="/ajustes">
      <p className="rounded-md bg-accent-soft p-3 text-sm">
        <b>Qué es OmniClin.</b> Una herramienta de registro y organización para tu práctica: fichas, anamnesis, mediciones, sesiones y agenda, todo a
        mano. No diagnostica ni decide tratamientos. {RECORD_ONLY}
      </p>
      <ol aria-label="Pasos" className="flex flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Card className="flex gap-3">
              <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent">
                {i + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold">{s.title}</h2>
                <p className="text-sm">{s.body}</p>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <section aria-labelledby="h-donde" className="flex flex-col gap-2">
        <h2 id="h-donde" className="text-lg">
          Dónde está cada cosa
        </h2>
        <p className="text-sm text-text-muted">En la barra de abajo (en el ordenador, en el menú de la izquierda):</p>
        <ul className="flex flex-col gap-2">
          {places.map(({ icon: Icon, name, text }) => (
            <li key={name} className="flex items-start gap-3">
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
              <span>
                <b>{name}</b>: {text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="h-trucos" className="flex flex-col gap-2">
        <h2 id="h-trucos" className="text-lg">
          Para empezar
        </h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          <li>
            ¿Quieres probarla sin pacientes reales? Carga los{" "}
            <Link to="/ajustes/datos" className={link}>
              datos de ejemplo
            </Link>{" "}
            y bórralos después. Para probarla con volumen, en una clínica de prueba vacía, carga la <b>«Clínica de prueba»</b> del
            mismo sitio: 100 pacientes inventados (o 500) con su agenda.
          </li>
          <li>
            ¿Medir a alguien sin crear su ficha? En la Biblioteca, <b>«Medir ahora, sin ficha»</b>.
          </li>
          <li>
            Cada pantalla de medición tiene su ayuda: el botón <b>«Cómo grabar y marcar»</b>.
          </li>
          <li>
            Rellena los{" "}
            <Link to="/ajustes/clinica" className={link}>
              datos de tu clínica
            </Link>{" "}
            antes de imprimir la hoja de protección de datos.
          </li>
          <li>
            En el ordenador (ventana de 1024 px o más) la app aprovecha la pantalla: el menú a la izquierda, la lista de pacientes siempre a la
            vista junto a la ficha y, al abrirla, lo de hoy. Es la misma app, con los mismos datos. Con el teclado, la tecla <b>/</b> lleva al
            buscador de pacientes.
          </li>
        </ul>
      </section>

      <section aria-labelledby="h-contacto" className="flex flex-col gap-2">
        <h2 id="h-contacto" className="text-lg">
          Contacto
        </h2>
        <p className="text-sm">
          ¿Algo no funciona? Mira los{" "}
          <Link to="/ayuda/fallos" className={link}>
            problemas frecuentes y el informe de fallo
          </Link>
          : manda en un toque lo que ha fallado en este dispositivo.
        </p>
        <p className="text-sm">
          ¿Dudas, un problema o quieres dar de alta tu clínica? Escribe a{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </Page>
  );
}
