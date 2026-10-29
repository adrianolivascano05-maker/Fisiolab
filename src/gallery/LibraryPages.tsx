// Biblioteca, estantes de Cuestionarios y Mediciones: qué es cada uno y cómo llevarlo a un paciente. Los tests de
// exploración siguen en GalleryPages.tsx. De los cuestionarios, solo los que se pueden pasar hoy: los de pago están
// fuera del servicio y no salen.
import { Activity, ClipboardCheck, Dumbbell, Footprints, ListChecks, Rotate3d, Timer, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { Page } from "../app/Page";
import { useQuickMeasure } from "../app/quickMeasure";
import { ForPatient } from "../clinical/RegisterInPatient";
import { formFor } from "../clinical/forms";
import { FormCredits } from "../clinical/FormCredits";
import { OfficialLink } from "../clinical/OfficialLink";
import { RangesTable } from "../clinical/RangesTable";
import { ACTIVE, getKind, TOPICS, type QuestionnaireKind } from "../clinical/questionnaires";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Group, RowButton, RowLink } from "../ui/Grouped";
import { Disclosure } from "./Disclosure";

export const LIBRARY = "/biblioteca";
export const QUESTIONNAIRES_URL = `${LIBRARY}/cuestionarios`;
export const MEASURES_URL = `${LIBRARY}/mediciones`;
export const questionnaireUrl = (id: string) => `${QUESTIONNAIRES_URL}/${id}`;

/** Sin tildes ni mayúsculas, para buscar. */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Cómo se pasa: con sus preguntas en la app, con su pantalla, o anotando la nota de la hoja oficial. */
export function questionnaireHow(k: QuestionnaireKind): string {
  if (k.inApp) return "Se contesta en la app con su propia pantalla";
  const n = formFor(k.id)?.sections.reduce((acc, s) => acc + s.items.length, 0);
  if (n) return `${n} preguntas en la app, la nota se calcula sola`;
  return "Con su hoja oficial: se anota la nota";
}

const range = (k: QuestionnaireKind) =>
  `de ${k.min} a ${k.max}${k.unit && k.unit !== "%" ? ` ${k.unit}` : k.unit === "%" ? " %" : ""}, ${k.better === "higher" ? "más es mejor" : "menos es mejor"}`;

export const questionnaireMatches = (k: QuestionnaireKind, q: string) => {
  const words = fold(q.trim()).split(/\s+/).filter(Boolean);
  return words.every((w) => fold(`${k.name} ${k.id} ${k.hint ?? ""} ${k.topic ?? ""}`).includes(w));
};

/** Los grupos del estante, como en el selector de la ficha: los que cuentan cómo lo vive, por tema y por zona. */
function shelves(list: QuestionnaireKind[]) {
  return [
    { title: "Cómo lo vive el paciente", items: list.filter((k) => k.inApp) },
    ...TOPICS.map((topic) => ({ title: topic, items: list.filter((k) => !k.inApp && k.topic === topic) })),
    { title: "Por zona del cuerpo", items: list.filter((k) => !k.inApp && !k.topic) },
  ].filter((g) => g.items.length);
}

/** Biblioteca › Cuestionarios: los que se pueden pasar, con buscador. */
export function QuestionnaireShelf() {
  const [q, setQ] = useState("");
  const list = ACTIVE.filter((k) => questionnaireMatches(k, q));
  return (
    <Page title="Cuestionarios" backTo={LIBRARY}>
      <p className="text-text-muted">Qué mide cada uno, sus preguntas o dónde conseguir su hoja oficial, y cómo se puntúa. Desde la ficha de cada uno, «Pasar a un paciente».</p>
      <TextField label="Buscar cuestionario" placeholder="Por ejemplo: rodilla, ánimo, mareo, suelo pélvico" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      {!list.length && <p className="text-text-muted">Ningún cuestionario con «{q.trim()}».</p>}
      {shelves(list).map((g) => (
        <Group key={g.title} title={g.title}>
          {g.items.map((k) => (
            <RowLink key={k.id} to={questionnaireUrl(k.id)} title={k.name} subtitle={questionnaireHow(k)} />
          ))}
        </Group>
      ))}
    </Page>
  );
}

/** La ficha de un cuestionario: qué mide, cómo se puntúa, sus preguntas o su hoja oficial, y «Pasar a un paciente». */
export function QuestionnaireCard() {
  const { id = "" } = useParams();
  const k = getKind(id);
  const [open, setOpen] = useState(false);
  if (!k || k.retired) {
    return (
      <Page title="Cuestionario" backTo={QUESTIONNAIRES_URL}>
        <p className="text-text-muted">{k ? `${k.name} está fuera del servicio: es de pago y ya no está en la app.` : "Este cuestionario no está en la Biblioteca."}</p>
      </Page>
    );
  }
  const form = formFor(k.id);
  const questions = form?.sections.reduce((acc, s) => acc + s.items.length, 0) ?? 0;

  return (
    <Page title={k.name} backTo={QUESTIONNAIRES_URL} backLabel="Cuestionarios" large>
      {k.hint && <p>{k.hint}</p>}
      <Card className="flex flex-col gap-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-text-muted">Puntuación</dt>
          <dd>{range(k)}</dd>
          {k.subscales && (
            <>
              <dt className="text-text-muted">Subescalas</dt>
              <dd>{k.subscales.join(", ")}</dd>
            </>
          )}
          <dt className="text-text-muted">Cómo se pasa</dt>
          <dd>{questionnaireHow(k)}</dd>
          {k.topic && (
            <>
              <dt className="text-text-muted">Tema</dt>
              <dd>{k.topic}</dd>
            </>
          )}
        </dl>
      </Card>

      {(k.ranges || k.reading) && (
        <section aria-labelledby="h-lectura" className="flex flex-col gap-2">
          <h2 id="h-lectura" className="text-lg">
            Cómo se lee
          </h2>
          {k.ranges && <RangesTable ranges={k.ranges} />}
          {k.reading && <p className="text-sm">{k.reading}</p>}
        </section>
      )}

      <ForPatient
        to={(pid) => `/pacientes/${pid}/cuestionarios/nuevo?tipo=${encodeURIComponent(k.id)}`}
        label="Pasar a un paciente"
        labelFor={(name) => `Pasar a ${name}`}
        icon={<ListChecks aria-hidden="true" className="size-5" />}
      />

      {form && questions > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-bg">
          <Disclosure title={`Ver las ${questions} preguntas`} open={open} onToggle={setOpen}>
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-text-muted">{form.instructions}</p>
              {form.sections.map((s) => (
                <section key={s.title} aria-label={s.title} className="flex flex-col gap-1">
                  {form.sections.length > 1 && <h3 className="font-semibold">{s.title}</h3>}
                  <ol className="flex list-decimal flex-col gap-1 pl-5">
                    {s.items.map((it) => (
                      <li key={it.id}>{it.text}</li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      {k.link && <OfficialLink link={k.link} />}

      {form ? <FormCredits form={form} refs={k.refs} /> : k.refs && <p className="text-xs text-text-muted">{k.refs}</p>}
    </Page>
  );
}

export type Measure = { slug: string; icon: LucideIcon; title: string; what: string };

/** Las mediciones que se hacen en la app (las mismas que «Nueva medición» en la ficha). */
export const MEASURES: Measure[] = [
  {
    slug: "saltos",
    icon: Activity,
    title: "Saltos",
    what: "CMJ, CMJ con brazos, SJ, drop jump, unipodal, 10/5 y horizontal. Se marcan el despegue y el aterrizaje en un vídeo a cámara lenta: altura por el tiempo de vuelo, RSI del drop jump, perfil fuerza-velocidad y asimetría entre piernas.",
  },
  {
    slug: "fuerza",
    icon: Dumbbell,
    title: "Fuerza",
    what: "Velocidad media de la barra por vídeo o con un encoder, en 6 ejercicios: pérdida de velocidad en la serie, perfil carga-velocidad con el 1RM estimado y cargas por % del 1RM.",
  },
  {
    slug: "sprint",
    icon: Timer,
    title: "Sprint y cambio de dirección",
    what: "Sprint lineal con tiempos de paso (vídeo o fotocélulas), tramos y perfil fuerza-velocidad. Cambio de dirección: 5-0-5, 5+5, V-Cut e Illinois, con la asimetría entre giros.",
  },
  {
    slug: "carrera",
    icon: Footprints,
    title: "Carrera en cinta",
    what: "Tiempo de contacto y de vuelo, frecuencia, factor de apoyo, longitud del paso y asimetría por pie, marcando los apoyos en el vídeo.",
  },
  {
    slug: "movilidad",
    icon: Rotate3d,
    title: "Movilidad",
    what: "14 movimientos de tobillo (lunge), cadera, hombro y cuello, con el inclinómetro del móvil, sobre una foto o con goniómetro; resumen por lados y evolución.",
  },
  { slug: "isquios", icon: Zap, title: "Nórdico", what: "Ángulo de rotura en el vídeo (o escrito a mano) y momento estimado de cada pierna." },
];

export const measureMatches = (m: Measure, q: string) => {
  const words = fold(q.trim()).split(/\s+/).filter(Boolean);
  return words.every((w) => fold(`${m.title} ${m.what}`).includes(w));
};

/** Biblioteca › Mediciones: qué es cada una; medirla en un paciente o ahora, sin ficha. */
export function MeasurementShelf() {
  const quick = useQuickMeasure();
  return (
    <Page title="Mediciones" backTo={LIBRARY}>
      <p className="text-text-muted">Se hacen con la cámara o los sensores del móvil y quedan en la ficha del paciente, con su evolución.</p>
      {MEASURES.map((m) => (
        <Card key={m.slug} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-lg">
            <m.icon aria-hidden="true" className="size-5 text-accent" /> {m.title}
          </h2>
          <p className="text-sm">{m.what}</p>
          <ForPatient
            to={(pid) => `/pacientes/${pid}/test/${m.slug}`}
            label="Medir en un paciente"
            labelFor={(name) => `Medir en ${name}`}
          />
          <button
            type="button"
            disabled={quick.busy}
            onClick={() => void quick.start(m.slug)}
            className="tap self-center rounded-md px-2 text-sm font-semibold text-accent hover:bg-surface disabled:opacity-60"
            aria-label={`Medir ahora, sin ficha: ${m.title}`}
          >
            Medir ahora, sin ficha
          </button>
        </Card>
      ))}
      <Group footer="Sin ficha, la medición queda en la ficha «Medición rápida»: luego puedes cambiarle el nombre y los datos.">
        <RowButton icon={Zap} title="Medir ahora, sin ficha" subtitle="Elegir el tipo de medición" busy={quick.busy} onClick={() => void quick.start()} />
        <RowLink to="/validacion" icon={ClipboardCheck} title="Validación de las mediciones" subtitle="Compararlas con una plataforma, un encoder o un goniómetro" />
      </Group>
    </Page>
  );
}
