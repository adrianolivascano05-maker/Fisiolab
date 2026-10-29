// Pasar un cuestionario en la app (o apuntar uno hecho en papel), con su puntuación y el mapa del dolor.
import { Plus, Send, Trash } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { decimalText, fmt, fmtDate, parseDecimal } from "../app/format";
import { LoadError, Page } from "../app/Page";
import { deleteQuestionnaire, getAnamnesis, getQuestionnaire, listQuestionnaires, saveQuestionnaire, type Questionnaire } from "../data/clinical";
import { getDb } from "../data/db";
import { getPatient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NumberField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { clinicalSummary } from "./anamnesis";
import { fold } from "./redFlags";
import { BodyMapInput } from "./BodyMapParts";
import { parseMarks } from "./bodyMap";
import { Chips, NumberScale, TextArea } from "./parts";
import { bandText, byRegions, displayName, getKind, kindOf, mapScore, OTHER, psfsScore, QUESTIONNAIRES, scoreText, TOPICS, type Better, type QDetails } from "./questionnaires";
import { formFor, type Answers as FormAnswers } from "./forms";
import { FormCredits } from "./FormCredits";
import { FormFill, formResult } from "./FormFill";
import { OfficialLink } from "./OfficialLink";
import { SENDABLE } from "./patientForms";
import { Guard, localInput, useLoad } from "./pageKit";

// ---------- Cuestionarios ----------

/** Mapa del dolor: el dibujo y su nota (la intensidad más alta), que se ve al marcar. */
function PainMapScore({ marks, onChange }: { marks: string[]; onChange: (v: string[]) => void }) {
  const parsed = parseMarks(marks);
  let top: number | null = null;
  try {
    top = mapScore(parsed);
  } catch {
    top = null;
  }
  return (
    <>
      <BodyMapInput label="Zonas" hint="Toca en el dibujo dónde le duele o lo nota, o elígelo de la lista. Después pon la intensidad de cada zona." value={marks} onChange={onChange} />
      <p className="nums text-lg" aria-live="polite">
        Intensidad más alta: <span className="font-semibold">{top === null ? "—" : `${top}/10`}</span>
      </p>
    </>
  );
}

type PsfsActivity = { name: string; score: number | null };

export function QuestionnaireFormPage() {
  const { id = "", qid } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useLoad(`${id}|${qid ?? ""}`, async () => {
    const db = getDb();
    const [patient, record, all, anamnesis] = await Promise.all([getPatient(db, id), qid ? getQuestionnaire(db, qid) : null, listQuestionnaires(db, id), getAnamnesis(db, id)]);
    return { patient, record, all, anamnesis };
  });
  const [when, setWhen] = useState(() => localInput(new Date().toISOString()));
  const [score, setScore] = useState("");
  const [subscale, setSubscale] = useState<string[]>([]);
  const [activities, setActivities] = useState<PsfsActivity[]>([{ name: "", score: null }]);
  const [groc, setGroc] = useState<number | null>(null);
  const [marks, setMarks] = useState<string[]>([]);
  const [other, setOther] = useState<{ name: string; min: string; max: string; better: Better }>({ name: "", min: "0", max: "100", better: "higher" });
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<FormAnswers>({});
  // Los que tienen el cuestionario entero en la app se rellenan aquí; también se puede anotar solo la nota.
  const [mode, setMode] = useState<"fill" | "score">("fill");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const kind = data.data?.record?.kind ?? params.get("tipo") ?? "";
  const prefilled = useRef("");

  useEffect(() => {
    const q = data.data?.record;
    if (!q) return;
    const d = q.details as QDetails;
    setWhen(localInput(q.performedAt));
    setScore(decimalText(q.score));
    setSubscale(d.subscale ? [d.subscale] : []);
    if (d.activities?.length) setActivities(d.activities);
    if (q.kind === "groc") setGroc(q.score);
    if (d.marks) setMarks(d.marks);
    if (q.kind === OTHER) setOther({ name: d.name ?? "", min: decimalText(d.min ?? 0), max: decimalText(d.max ?? 100), better: d.better ?? "higher" });
    setAnswers(d.answers ?? {});
    setMode(d.answers ? "fill" : "score");
    setNotes(q.notes);
  }, [data.data?.record]);

  // Una PSFS nueva empieza con las actividades de la anterior: se puntúan las mismas para ver el cambio.
  useEffect(() => {
    if (qid || kind !== "psfs" || !data.data || prefilled.current === kind) return;
    prefilled.current = kind;
    const prev = data.data.all.find((q) => q.kind === "psfs");
    const names = (prev?.details as QDetails | undefined)?.activities?.map((a) => a.name) ?? [];
    if (names.length) setActivities(names.map((name) => ({ name, score: null })));
  }, [qid, kind, data.data]);

  const back = `/pacientes/${id}/cuestionarios`;
  if (!data.data) return <Guard state={data} title="Cuestionario" back={back} />;
  const { patient, record, all, anamnesis } = data.data;
  if (qid && !record) return <Page title="Cuestionario" backTo={back}><LoadError error={new Error("Este cuestionario no existe.")} /></Page>;

  if (!kind) {
    const regions = anamnesis ? clinicalSummary(anamnesis.answers).regions : [];
    const choose = (tipo: string) => setParams({ tipo }, { replace: true });
    const option = (k: { id: string; name: string; text: string; tag?: string }) => (
      <li key={k.id}>
        <button type="button" onClick={() => choose(k.id)} className="w-full text-left">
          <Card className="flex items-center gap-3 hover:border-accent">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{k.name}</span>
              <span className="text-sm text-text-muted">{k.text}</span>
            </span>
            {k.tag && <span className="shrink-0 rounded-pill bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{k.tag}</span>}
          </Card>
        </button>
      </li>
    );
    const describe = (k: (typeof QUESTIONNAIRES)[number]) => {
      const f = formFor(k.id);
      const n = f?.sections.reduce((acc, sec) => acc + sec.items.length, 0);
      const range = k.unit && k.unit !== "%" ? k.unit : `de ${k.min} a ${k.max}, ${k.better === "higher" ? "más es mejor" : "menos es mejor"}`;
      const how = n ? `${n} preguntas` : "Con su hoja oficial: anotas la nota";
      return `${how} · ${range}`;
    };
    // Buscar por nombre, sigla o para qué sirve, sin tildes.
    const q = fold(search.trim());
    const matches = (k: (typeof QUESTIONNAIRES)[number]) => !q || q.split(/\s+/).every((w) => fold(`${k.name} ${k.id} ${k.hint ?? ""} ${k.topic ?? ""}`).includes(w));
    const ranked = byRegions(regions).filter(({ kind: k }) => !k.inApp && matches(k));
    // De su zona primero; después la evolución que cuenta el paciente, los generales por tema y el resto por zona.
    const groups = [
      { title: "De su zona", items: ranked.filter((r) => r.forRegion).map(({ kind: k }) => option({ id: k.id, name: k.name, text: describe(k), tag: "Su zona" })) },
      { title: "Cómo lo vive el paciente", items: QUESTIONNAIRES.filter((k) => k.inApp && matches(k)).map((k) => option({ id: k.id, name: k.name, text: k.hint ?? "" })) },
      ...TOPICS.map((topic) => ({
        title: topic,
        items: ranked.filter((r) => !r.forRegion && r.kind.topic === topic).map(({ kind: k }) => option({ id: k.id, name: k.name, text: describe(k) })),
      })),
      {
        title: "Por zona del cuerpo",
        items: [
          ...ranked.filter((r) => !r.forRegion && !r.kind.topic).map(({ kind: k }) => option({ id: k.id, name: k.name, text: describe(k) })),
          ...(q ? [] : [option({ id: OTHER, name: "Otro cuestionario", text: "Escribe su nombre y su rango." })]),
        ],
      },
    ].filter((g) => g.items.length);
    return (
      <Page title="Nuevo cuestionario" backTo={back} tabs={false}>
        <p className="text-text-muted">{patient?.name}: elige el cuestionario. Se rellena aquí y la nota se calcula sola.</p>
        <TextField label="Buscar cuestionario" placeholder="Por ejemplo: rodilla, DN4, mareo, suelo pélvico" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
        {!groups.length && <p className="text-text-muted">Ningún cuestionario con «{search.trim()}».</p>}
        {groups.map((g) => (
          <section key={g.title} aria-label={g.title} className="flex flex-col gap-2">
            <h2 className="text-lg">{g.title}</h2>
            <ul className="flex flex-col gap-2">{g.items}</ul>
          </section>
        ))}
      </Page>
    );
  }

  const known = getKind(kind);
  // Los de pago están fuera del servicio: no se pasan ni se anotan; lo guardado antes se ve como registro antiguo.
  const retired = !!known?.retired;
  const form = retired ? undefined : formFor(kind);
  const filling = !!form && mode === "fill";
  const result = filling ? formResult(form, answers) : null;
  const otherMin = parseDecimal(other.min);
  const otherMax = parseDecimal(other.max);
  // Con subescala elegida (FABQ, WOMAC…), su propio rango.
  const k = kindOf(kind, { name: other.name, min: otherMin ?? undefined, max: otherMax ?? undefined, better: other.better, subscale: !filling ? subscale[0] : undefined });
  // La nota anotada a mano, leída con los tramos del catálogo (los de solo nota que los tienen).
  const typed = parseDecimal(score);
  const scoreBand = !filling && known && typed !== null && !Number.isNaN(typed) ? bandText(known, typed) : null;
  const details: QDetails =
    kind === "mapa_dolor" ? { marks }
    : kind === "psfs" ? { activities: activities.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), score: a.score ?? Number.NaN })) }
    : filling ? { answers, ...(result && "ok" in result && result.ok.subscores ? { subscores: result.ok.subscores } : {}), ...(result && "ok" in result && result.ok.text ? { text: result.ok.text } : {}) }
    : known?.subscales ? { subscale: subscale[0] }
    : kind === OTHER ? { name: other.name.trim(), min: otherMin ?? undefined, max: otherMax ?? undefined, better: other.better }
    : scoreBand ? { text: scoreBand }
    : {};
  const sameAs = (q: Questionnaire) => q.kind === kind && displayName(q.kind, q.details as QDetails) === displayName(kind, details);
  const previous = all.find((q) => q.id !== qid && sameAs(q) && (!record || q.performedAt < record.performedAt));
  const prevPsfs = all.find((q) => q.kind === "psfs" && q.id !== qid && (!record || q.performedAt < record.performedAt));
  const prevScore = (name: string) => (prevPsfs?.details as QDetails | undefined)?.activities?.find((a) => a.name === name.trim())?.score;
  // La media solo cuando cada actividad escrita tiene su puntuación.
  const named = activities.filter((a) => a.name.trim());
  const unrated = named.filter((a) => a.score === null).length;
  const psfsMean = named.length && !unrated ? named.reduce((s, a) => s + a.score!, 0) / named.length : null;

  const computeScore = (): number => {
    if (kind === "psfs") {
      if (activities.some((a) => a.name.trim() && a.score === null)) throw new RangeError("Puntúa cada actividad de 0 a 10.");
      return psfsScore(activities.map((a) => ({ name: a.name, score: a.score ?? Number.NaN })));
    }
    if (kind === "mapa_dolor") return mapScore(parseMarks(marks));
    if (kind === "groc") {
      if (groc === null) throw new RangeError("Marca cómo está respecto al inicio.");
      return groc;
    }
    if (filling) {
      if (!result || "missing" in result) throw new RangeError(result && "missing" in result ? result.missing : "Contesta el cuestionario.");
      if (result.ok.score === null) throw new RangeError("Este cuestionario solo tiene subescalas.");
      return result.ok.score;
    }
    if (known?.subscales && !subscale.length) throw new RangeError("Elige la subescala.");
    if (kind === OTHER) {
      if (!other.name.trim()) throw new RangeError("Escribe el nombre del cuestionario.");
      if (otherMin === null || otherMax === null || Number.isNaN(otherMin) || Number.isNaN(otherMax) || otherMin >= otherMax) throw new RangeError("Revisa el rango: el mínimo tiene que ser menor que el máximo.");
    }
    const v = parseDecimal(score);
    if (v === null) throw new RangeError("Escribe la puntuación.");
    if (Number.isNaN(v)) throw new RangeError("La puntuación tiene que ser un número.");
    if (v < k.min || v > k.max) throw new RangeError(`La puntuación va de ${k.min} a ${k.max}.`);
    return v;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const performedAt = new Date(when).toISOString();
      if (filling && known?.subscales) await saveSubscales(performedAt);
      else await saveQuestionnaire(getDb(), id, { kind, performedAt, score: computeScore(), details, notes }, qid);
      toast(qid ? "Cuestionario guardado" : "Cuestionario registrado", "success");
      navigate(back, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };
  // KOOS, HOOS: una nota por subescala, cada una en su registro (así se ve la evolución de cada una), unidas por
  // `group` y con las mismas respuestas. Al editar, se cambian las del grupo; la subescala que ya no se pueda
  // calcular se borra.
  const saveSubscales = async (performedAt: string) => {
    if (!result || "missing" in result) throw new RangeError(result && "missing" in result ? result.missing : "Contesta el cuestionario.");
    const db = getDb();
    const group = (record?.details as QDetails | undefined)?.group ?? crypto.randomUUID();
    const siblings = all.filter((q) => q.kind === kind && (q.details as QDetails).group === group);
    if (record && !siblings.some((q) => q.id === record.id)) siblings.push(record);
    const subs = result.ok.subscores ?? [];
    for (const sub of subs) {
      const prev = siblings.find((q) => (q.details as QDetails).subscale === sub.name);
      await saveQuestionnaire(db, id, { kind, performedAt, score: sub.score, details: { subscale: sub.name, answers, group }, notes }, prev?.id);
    }
    for (const q of siblings) if (!subs.some((sub) => sub.name === (q.details as QDetails).subscale)) await deleteQuestionnaire(db, q.id);
  };
  const remove = async () => {
    if (!qid) return;
    await deleteQuestionnaire(getDb(), qid);
    toast("Cuestionario borrado");
    navigate(back, { replace: true });
  };
  const setActivity = (i: number, a: Partial<PsfsActivity>) => setActivities((list) => list.map((x, j) => (j === i ? { ...x, ...a } : x)));

  return (
    <Page title={qid ? "Editar cuestionario" : "Nuevo cuestionario"} backTo={back} tabs={false}>
      <p className="text-text-muted">{patient?.name}</p>
      <Card className="flex flex-col gap-2">
        <span className="text-lg font-semibold">{kind === OTHER ? "Otro cuestionario" : k.name}</span>
        {known?.hint && <p className="text-sm text-text-muted">{known.hint}</p>}
        {form && (
          <Chips
            label="Cómo"
            options={["fill", "score"]}
            render={(o) => (o === "fill" ? "Rellenarlo aquí" : "Solo anotar la nota")}
            value={[mode]}
            onChange={(v) => v[0] && setMode(v[0] as "fill" | "score")}
          />
        )}
        {retired && (
          <Alert tone="info" title={record ? "Registro antiguo" : "Fuera del servicio"}>
            {record
              ? "Este cuestionario es de pago y ya no está en la app: aquí se ve lo que se guardó, pero no se puede cambiar."
              : "Este cuestionario es de pago y ya no está en la app: no se puede pasar ni anotar."}
          </Alert>
        )}
        {!retired && !known?.inApp && kind !== OTHER && !filling && <p className="text-sm text-text-muted">Pásalo con su hoja oficial y escribe aquí la puntuación total.</p>}
        {known?.reading && <p className="text-sm">{known.reading}</p>}
        {known?.link && <OfficialLink link={known.link} />}
        {form ? <FormCredits form={form} refs={known?.refs} /> : known?.refs && <p className="text-xs text-text-muted">{known.refs}</p>}
        {previous && (
          <p className="text-sm">
            La última vez: <span className="nums font-semibold">{scoreText(k, previous.score)}</span> el {fmtDate(previous.performedAt)}
          </p>
        )}
        {retired && record && (
          <p className="nums text-lg">
            {fmtDate(record.performedAt)}: <span className="font-semibold">{scoreText(k, record.score)}</span>
            {(record.details as QDetails).subscale && <span className="text-text-muted"> · {(record.details as QDetails).subscale}</span>}
          </p>
        )}
        {retired && record?.notes && <p className="text-sm">{record.notes}</p>}
        {!qid && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setParams({}, { replace: true })}>
              Cambiar de cuestionario
            </Button>
            {!!form && SENDABLE.some((x) => x.id === kind) && (
              <Link
                to={`/pacientes/${id}/formularios?enviar=${kind}`}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-bg px-3 text-sm font-semibold hover:bg-surface"
              >
                <Send aria-hidden="true" className="size-4" /> Que lo rellene en su móvil
              </Link>
            )}
          </div>
        )}
      </Card>
      {retired ? (
        record && (
          <Button variant="ghost" className="text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => setConfirm(true)}>
            Borrar cuestionario
          </Button>
        )
      ) : (
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <TextField label="Fecha y hora" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        {kind === OTHER && (
          <>
            <TextField label="Nombre del cuestionario" value={other.name} onChange={(e) => setOther({ ...other, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Mínimo" inputMode="decimal" value={other.min} onChange={(e) => setOther({ ...other, min: e.target.value })} />
              <TextField label="Máximo" inputMode="decimal" value={other.max} onChange={(e) => setOther({ ...other, max: e.target.value })} />
            </div>
            <Chips
              label="Qué es mejor"
              options={["higher", "lower"]}
              render={(o) => (o === "higher" ? "Más puntuación" : "Menos puntuación")}
              value={[other.better]}
              onChange={(v) => v[0] && setOther({ ...other, better: v[0] as Better })}
            />
          </>
        )}
        {known?.subscales && !filling && <Chips label="Subescala" options={known.subscales} value={subscale} onChange={setSubscale} />}
        {filling && form && <FormFill form={form} answers={answers} onChange={setAnswers} />}
        {filling && result && (
          <Card className="flex flex-col gap-2 border-accent" aria-live="polite">
            <h2 className="text-lg">Resultado</h2>
            {"missing" in result ? (
              <p className="text-text-muted">{result.missing}</p>
            ) : (
              <>
                {result.ok.score !== null && (
                  <p className="nums text-[2rem] leading-tight font-bold" aria-label={`Nota: ${scoreText(k, result.ok.score)}`}>
                    {scoreText(k, result.ok.score)}
                  </p>
                )}
                {result.ok.text && <p className="font-semibold">{result.ok.text}</p>}
                {result.ok.subscores && (
                  <ul className="nums flex flex-col gap-1">
                    {result.ok.subscores.map((sub) => (
                      <li key={sub.name} className="flex justify-between gap-2">
                        <span>{sub.name}</span>
                        <span className="font-semibold">
                          {known?.subscales
                            ? scoreText(kindOf(kind, { subscale: sub.name }), sub.score)
                            : `${fmt(sub.score, Number.isInteger(sub.score) ? 0 : 1)}${sub.max ? `/${sub.max}` : " %"}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </Card>
        )}
        {kind === "psfs" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold">Actividades</legend>
            <ol className="flex flex-col gap-3">
              {activities.map((a, i) => {
                const prev = qid ? undefined : prevScore(a.name);
                return (
                  <li key={i}>
                    <Card className="flex flex-col gap-3">
                      <TextField label={`Actividad ${i + 1}`} placeholder="Por ejemplo: bajar escaleras" value={a.name} onChange={(e) => setActivity(i, { name: e.target.value })} />
                      <NumberScale label={`Cómo hace la actividad ${i + 1}`} from={0} to={10} value={a.score} onChange={(score) => setActivity(i, { score })} ends={["0 no puede", "10 como antes"]} />
                      {prev !== undefined && <p className="nums -mt-1 text-sm text-text-muted">La última vez: {prev}/10</p>}
                      {activities.length > 1 && (
                        <Button variant="ghost" size="sm" className="self-start text-danger" onClick={() => setActivities((list) => list.filter((_, j) => j !== i))}>
                          Quitar la actividad {i + 1}
                        </Button>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ol>
            {activities.length < 5 && (
              <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setActivities((list) => [...list, { name: "", score: null }])}>
                Añadir actividad
              </Button>
            )}
            <p className="nums text-lg" aria-live="polite">
              Media: <span className="font-semibold">{psfsMean === null ? "—" : `${fmt(psfsMean)}/10`}</span>
              {unrated > 0 && <span className="text-sm text-text-muted"> · falta puntuar {unrated === 1 ? "una actividad" : `${unrated} actividades`}</span>}
            </p>
          </fieldset>
        )}
        {kind === "mapa_dolor" && <PainMapScore marks={marks} onChange={setMarks} />}
        {kind === "groc" && (
          <NumberScale label="Respecto al inicio del tratamiento, ¿cómo está ahora?" from={-7} to={7} value={groc} onChange={setGroc} ends={["−7 muchísimo peor", "+7 muchísimo mejor"]} hint="0 igual" />
        )}
        {!known?.inApp && !filling && (
          <NumberField
            label="Puntuación"
            unit={k.unit ?? `/${fmt(k.max, Number.isInteger(k.max) ? 0 : 1)}`}
            hint={`De ${fmt(k.min, 0)} a ${fmt(k.max, 0)} · ${k.better === "higher" ? "más es mejor" : "menos es mejor"}`}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        )}
        {scoreBand && <p className="font-semibold" aria-live="polite">{scoreBand}</p>}
        <TextArea label="Notas" value={notes} onChange={setNotes} rows={2} />
        {error && <Alert tone="danger" title={error} />}
        <Button type="submit" size="lg" block loading={saving}>
          {qid ? "Guardar cambios" : "Guardar cuestionario"}
        </Button>
        {qid && (
          <Button variant="ghost" className="text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => setConfirm(true)}>
            Borrar cuestionario
          </Button>
        )}
      </form>
      )}
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Borrar este cuestionario?">
        <p>Se borrará el registro del {fmtDate(record?.performedAt ?? new Date().toISOString())}.</p>
        <Button variant="danger" block onClick={remove}>
          Borrar
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
