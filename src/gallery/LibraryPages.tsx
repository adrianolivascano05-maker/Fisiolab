// Biblioteca, estantes de Cuestionarios y Mediciones: qué es cada uno y cómo llevarlo a un paciente. Los tests de
// exploración siguen en GalleryPages.tsx. Los permisos de los cuestionarios con dueño se marcan aquí (antes, en
// Ajustes): en la ficha de cada uno y en la lista de permisos.
import { Activity, ClipboardCheck, Dumbbell, Footprints, ListChecks, Rotate3d, Timer, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { bumpData } from "../app/dataVersion";
import { Page } from "../app/Page";
import { useQuickMeasure } from "../app/quickMeasure";
import { ForPatient } from "../clinical/RegisterInPatient";
import { formFor, usableForm } from "../clinical/forms";
import { getKind, QUESTIONNAIRES, TOPICS, type QuestionnaireKind } from "../clinical/questionnaires";
import { getDb } from "../data/db";
import { setGranted, useGranted } from "../data/questionnairePermissions";
import { Card } from "../ui/Card";
import { TextField } from "../ui/Field";
import { Group, RowButton, RowLink } from "../ui/Grouped";
import { useToast } from "../ui/Toast";
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
export function questionnaireHow(k: QuestionnaireKind, granted: readonly string[]): string {
  if (k.inApp) return "Se contesta en la app con su propia pantalla";
  const f = usableForm(k.id, granted);
  const n = f?.sections.reduce((acc, s) => acc + s.items.length, 0);
  if (n) return `${n} preguntas en la app, la nota se calcula sola`;
  if (k.license === "licencia") return "De pago: se anota la nota de la hoja oficial";
  if (k.license === "comprobar" && formFor(k.id)) return "Pendiente del permiso de su titular: se anota la nota";
  return "Se anota la nota de la hoja";
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

/** Biblioteca › Cuestionarios: todos, con buscador, y la lista de permisos. */
export function QuestionnaireShelf() {
  const granted = useGranted();
  const [q, setQ] = useState("");
  const list = QUESTIONNAIRES.filter((k) => questionnaireMatches(k, q));
  const pending = QUESTIONNAIRES.filter((k) => k.license === "comprobar" && !!formFor(k.id) && !granted.includes(k.id)).length;
  return (
    <Page title="Cuestionarios" backTo={LIBRARY}>
      <p className="text-text-muted">Qué mide cada uno, sus preguntas, cómo se puntúa y sus condiciones de uso. Desde la ficha de cada uno, «Pasar a un paciente».</p>
      <TextField label="Buscar cuestionario" placeholder="Por ejemplo: rodilla, DN4, mareo, suelo pélvico" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      {!q.trim() && (
        <Group>
          <RowLink
            to={`${QUESTIONNAIRES_URL}/permisos`}
            icon={ClipboardCheck}
            tone={pending ? "warning" : "accent"}
            title="Permisos y licencias"
            subtitle={pending ? `${pending} pendientes del permiso de su titular` : "Los que tienen dueño y a quién pedírselo"}
            warn={!!pending}
          />
        </Group>
      )}
      {!list.length && <p className="text-text-muted">Ningún cuestionario con «{q.trim()}».</p>}
      {shelves(list).map((g) => (
        <Group key={g.title} title={g.title}>
          {g.items.map((k) => (
            <RowLink key={k.id} to={questionnaireUrl(k.id)} title={k.name} subtitle={questionnaireHow(k, granted)} />
          ))}
        </Group>
      ))}
    </Page>
  );
}

/** La ficha de un cuestionario: qué mide, cómo se puntúa, sus preguntas, su permiso y «Pasar a un paciente». */
export function QuestionnaireCard() {
  const { id = "" } = useParams();
  const k = getKind(id);
  const saved = useGranted();
  const [local, setLocal] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const toast = useToast();
  if (!k) {
    return (
      <Page title="Cuestionario" backTo={QUESTIONNAIRES_URL}>
        <p className="text-text-muted">Este cuestionario no está en la Biblioteca.</p>
      </Page>
    );
  }
  const has = local ?? saved.includes(k.id);
  const granted = has ? [...saved.filter((x) => x !== k.id), k.id] : saved.filter((x) => x !== k.id);
  const form = usableForm(k.id, granted);
  const questions = form?.sections.reduce((acc, s) => acc + s.items.length, 0) ?? 0;
  const canGrant = k.license === "comprobar" && !!formFor(k.id);

  const toggle = async (on: boolean) => {
    setLocal(on);
    setBusy(true);
    try {
      await setGranted(getDb(), on ? [...saved.filter((x) => x !== k.id), k.id] : saved.filter((x) => x !== k.id));
      bumpData();
      toast(on ? `${k.name}: ya se puede rellenar en la app` : `${k.name}: solo se anota la nota`, "success");
    } finally {
      setBusy(false);
    }
  };

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
          <dd>{questionnaireHow(k, granted)}</dd>
          {k.topic && (
            <>
              <dt className="text-text-muted">Tema</dt>
              <dd>{k.topic}</dd>
            </>
          )}
        </dl>
      </Card>

      {(k.bands?.length || k.reading) && (
        <section aria-labelledby="h-lectura" className="flex flex-col gap-2">
          <h2 id="h-lectura" className="text-lg">
            Cómo se lee
          </h2>
          {k.bands && (
            <ul className="flex flex-col gap-1 text-sm">
              {k.bands.map((b, i) => (
                <li key={b.upTo}>
                  <span className="nums font-semibold">{i === 0 ? `Hasta ${b.upTo}` : `Más de ${k.bands![i - 1]!.upTo}, hasta ${b.upTo}`}</span>: {b.text}
                </li>
              ))}
            </ul>
          )}
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

      {k.license && k.license !== "libre" && (
        <section aria-labelledby="h-uso" className="flex flex-col gap-2">
          <h2 id="h-uso" className="text-lg">
            Condiciones de uso
          </h2>
          <p className="text-sm">
            <b>{k.license === "licencia" ? "De pago para uso comercial" : k.license === "comprobar" ? "Pendiente del permiso de su titular" : "Libre, con registro o permiso"}.</b>{" "}
            {k.licenseNote}
          </p>
          {canGrant && (
            <label className="flex min-h-11 items-start gap-3 rounded-lg border border-border bg-bg p-3">
              <input type="checkbox" className="mt-1 size-5 shrink-0 accent-accent" checked={has} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">Tenemos el permiso</span>
                <span className="text-sm text-text-muted">Hasta marcarlo, solo se anota la nota de la hoja oficial. Vale para todo el equipo.</span>
              </span>
            </label>
          )}
        </section>
      )}

      {form?.source && <p className="text-xs text-text-muted">{form.source}</p>}
      {k.refs && <p className="text-xs text-text-muted">{k.refs}</p>}
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
