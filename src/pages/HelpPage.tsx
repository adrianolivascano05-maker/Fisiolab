// «Cómo se usa»: cómo está organizada la app y dónde está cada cosa.
import { BookOpen, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Page } from "../app/Page";
import { Card } from "../ui/Card";

const link = "font-semibold text-accent underline underline-offset-2";

const steps: { title: string; body: ReactNode }[] = [
  {
    title: "Pacientes",
    body: (
      <>
        Pulsa <b>+</b> arriba a la derecha para añadir uno (con el nombre basta). Arriba salen sus <b>próximas citas</b> y las reevaluaciones
        pendientes; debajo, todos por orden alfabético, con el buscador.
      </>
    ),
  },
  {
    title: "La ficha de cada paciente",
    body: (
      <>
        Sus datos y su próxima cita arriba, y las pestañas <b>Resumen, Anamnesis, Exploración, Mediciones y Sesiones</b>, que se quedan fijas al
        bajar: de una a otra con un toque. <b>Editar</b>, arriba a la derecha.
      </>
    ),
  },
  {
    title: "Añadir lo que hagas, en el orden que quieras",
    body: (
      <>
        En el Resumen, <b>Añadir</b>: una sesión, una medición (salto, fuerza, sprint, carrera, movilidad), un test de exploración o un cuestionario.
        Cada pestaña tiene además su propio botón para añadir.
      </>
    ),
  },
  {
    title: "Protección de datos e informe",
    body: (
      <>
        En el Resumen, debajo de Añadir: la hoja de <b>protección de datos</b> para que la firme (sale en naranja hasta que se la des) y el{" "}
        <b>informe</b> para imprimir, guardar en PDF o en tu Drive.
      </>
    ),
  },
  {
    title: "Pasar de una sección a otra",
    body: (
      <>
        La barra de abajo está siempre a mano y <b>cada pestaña recuerda dónde estabas</b>: mira un test en la Guía y vuelve a la ficha con un toque
        en Pacientes. Pulsa otra vez la pestaña en la que estás para volver a su inicio. Arriba a la izquierda, <b>‹</b> vuelve a la pantalla
        anterior.
      </>
    ),
  },
];

const places: { icon: typeof Users; name: string; text: string }[] = [
  { icon: Users, name: "Pacientes", text: "tus pacientes, sus próximas citas y las reevaluaciones pendientes." },
  { icon: BookOpen, name: "Guía de tests", text: "212 tests de exploración por articulación. Desde un test, «Registrar el resultado» lo apunta en el paciente que estabas viendo." },
  { icon: Settings, name: "Ajustes", text: "tu cuenta, los datos de la clínica, el PIN, las copias y la instalación. Un punto rojo avisa si falta algo." },
];

export function HelpPage() {
  return (
    <Page title="Cómo se usa" backTo="/ajustes">
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
        <p className="text-sm text-text-muted">En la barra de abajo:</p>
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
            y bórralos después.
          </li>
          <li>
            ¿Medir a alguien sin crear su ficha? En Pacientes, <b>«Medición rápida»</b>.
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
        </ul>
      </section>
    </Page>
  );
}
