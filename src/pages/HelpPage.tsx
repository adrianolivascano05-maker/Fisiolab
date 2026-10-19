// «Cómo se usa»: la app en cinco pasos, en el orden de una primera visita y su seguimiento, y dónde está cada cosa.
import { BookOpen, ChartColumn, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Page } from "../app/Page";
import { Card } from "../ui/Card";

const link = "font-semibold text-accent underline underline-offset-2";

const steps: { title: string; body: ReactNode }[] = [
  {
    title: "Crea el paciente",
    body: (
      <>
        En <b>Pacientes</b>, pulsa <b>«Nuevo paciente»</b>. Basta con el nombre; la masa y la estatura hacen falta para la fuerza y la potencia del
        salto.
      </>
    ),
  },
  {
    title: "Primera visita",
    body: (
      <>
        En su ficha, la guía <b>«Primera visita»</b> te lleva paso a paso: la hoja de <b>protección de datos</b> para que la firme, la{" "}
        <b>anamnesis</b> y la <b>exploración</b>.
      </>
    ),
  },
  {
    title: "Explora y mide",
    body: (
      <>
        <b>«Test de exploración»</b> apunta tests como el Lachman o el Neer (positivo, negativo o dudoso). <b>«Nueva medición»</b> mide saltos,
        fuerza, sprint, carrera o movilidad con el vídeo o los sensores del móvil.
      </>
    ),
  },
  {
    title: "Cierra cada visita con una sesión",
    body: (
      <>
        <b>«Nueva sesión»</b>: el dolor de ese día, qué refiere, qué haces, el plan, cuándo reevaluar y la <b>siguiente cita</b> (con tu cuenta de
        Google, se apunta sola en tu calendario).
      </>
    ),
  },
  {
    title: "Sigue su evolución y haz el informe",
    body: (
      <>
        El <b>Resumen</b> de la ficha enseña el dolor, las mediciones y los cuestionarios a lo largo del tiempo. <b>«Informe»</b> lo prepara para
        imprimir, guardar en PDF o en tu Drive.
      </>
    ),
  },
];

const places: { icon: typeof Users; name: string; text: string }[] = [
  { icon: Users, name: "Pacientes", text: "tus pacientes, las próximas citas y las reevaluaciones pendientes." },
  { icon: BookOpen, name: "Guía de tests", text: "212 tests de exploración por articulación, con cómo se hacen y lo que aportan." },
  { icon: ChartColumn, name: "Comparar", text: "un ranking de tus pacientes en cualquier medición." },
  { icon: Settings, name: "Ajustes", text: "tu cuenta, los datos de la clínica, el PIN, las copias y la instalación." },
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
            ¿Medir a alguien sin crear su ficha? En Pacientes, <b>«Medición rápida, sin ficha»</b>.
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
