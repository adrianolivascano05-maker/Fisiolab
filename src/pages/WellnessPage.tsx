import { HeartPulse, Trash } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compareToBaseline, lowItems, wellnessItems, wellnessTotal, type WellnessItem, type WellnessScores } from "../calc/wellness";
import { fmt, fmtDate, fmtDateShort, parseDecimal } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { deleteWellness, getPatient, listWellness, saveWellness, type WellnessEntry } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { NumberField, TextField } from "../ui/Field";
import { Scale } from "../ui/Scale";
import { useToast } from "../ui/Toast";

const day = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
const itemLabel = Object.fromEntries(wellnessItems.map((i) => [i.id, i.label])) as Record<WellnessItem, string>;
const itemShort = Object.fromEntries(wellnessItems.map((i) => [i.id, i.short])) as Record<WellnessItem, string>;
type Answers = Record<WellnessItem, number | null>;
const empty: Answers = { fatigue: null, sleep: null, soreness: null, stress: null, mood: null };

/** S21 Bienestar: cuestionario diario y su evolución. */
export function WellnessPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const data = useAsync(async () => ({ patient: await getPatient(getDb(), id), entries: await listWellness(getDb(), id) }), [id]);
  const [answers, setAnswers] = useState<Answers>(empty);
  const [pain, setPain] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [painError, setPainError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const todayEntry = data.data?.entries.find((e) => day(e.performedAt) === day(new Date().toISOString())) ?? null;
  // Si ya respondió hoy, el formulario empieza con sus respuestas para poder corregirlas.
  useEffect(() => {
    if (!todayEntry) return;
    setAnswers({ fatigue: todayEntry.fatigue, sleep: todayEntry.sleep, soreness: todayEntry.soreness, stress: todayEntry.stress, mood: todayEntry.mood });
    setPain(todayEntry.pain === null ? "" : String(todayEntry.pain));
    setNotes(todayEntry.notes);
  }, [todayEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = "Bienestar";
  const back = `/pacientes/${id}/mediciones`;
  if (data.error) return <Page title={title} backTo={back} tabs={false}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title={title} backTo={back} tabs={false}><Loading /></Page>;
  const { patient, entries } = data.data;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const missing = wellnessItems.filter((i) => answers[i.id] === null);
    const p = parseDecimal(pain);
    const badPain = p !== null && (Number.isNaN(p) || !Number.isInteger(p) || p < 0 || p > 10);
    setError(missing.length ? `Falta responder: ${missing.map((i) => i.label.toLowerCase()).join(", ")}.` : null);
    setPainError(badPain ? "Un número entero de 0 a 10, o déjalo vacío." : undefined);
    if (missing.length || badPain) return;
    setSaving(true);
    try {
      await saveWellness(getDb(), id, { ...(answers as WellnessScores), pain: p, notes });
      toast(todayEntry ? "Bienestar de hoy actualizado" : "Bienestar guardado", "success");
      data.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title={title} backTo={back} tabs={false}>
      <p className="text-text-muted">{patient?.name}</p>
      {todayEntry && <TodaySummary entry={todayEntry} previous={entries.filter((e) => e.id !== todayEntry.id)} />}

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <h2 className="text-lg">{todayEntry ? "Corregir lo de hoy" : "¿Cómo está hoy?"}</h2>
        <p className="text-sm text-text-muted">De 1 a 5, donde 5 es siempre lo mejor. Mejor antes de la sesión.</p>
        {wellnessItems.map((i) => (
          <Scale key={i.id} label={i.label} value={answers[i.id]} onChange={(v) => setAnswers((a) => ({ ...a, [i.id]: v }))} lowLabel={`1 · ${i.low}`} highLabel={`${i.high} · 5`} />
        ))}
        <NumberField
          label="Dolor de la lesión (opcional)"
          unit="/ 10"
          value={pain}
          onChange={(e) => {
            setPain(e.target.value);
            setPainError(undefined);
          }}
          error={painError}
          hint="0 = sin dolor, 10 = el peor imaginable. No suma en el total."
        />
        <TextField label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} />
        {error && <Alert tone="danger" title="Cuestionario incompleto">{error}</Alert>}
        <Button type="submit" size="lg" block loading={saving}>
          {todayEntry ? "Actualizar el de hoy" : "Guardar"}
        </Button>
      </form>

      <History entries={entries} onDelete={async (e) => {
        await deleteWellness(getDb(), e.id);
        toast("Registro borrado", "success");
        if (e.id === todayEntry?.id) {
          setAnswers(empty);
          setPain("");
          setNotes("");
        }
        data.reload();
      }} />
    </Page>
  );
}

function TodaySummary({ entry, previous }: { entry: WellnessEntry; previous: WellnessEntry[] }) {
  const total = wellnessTotal(entry);
  const low = lowItems(entry);
  // Media de los 30 días anteriores.
  const since = Date.now() - 30 * 24 * 3600 * 1000;
  const base = compareToBaseline(total, previous.filter((e) => new Date(e.performedAt).getTime() >= since).map(wellnessTotal));
  return (
    <section aria-label="Resumen de hoy" className="flex flex-col gap-3">
      <Card className={base?.low ? "flex flex-col gap-1 border-warning" : "flex flex-col gap-1"}>
        <span className="text-sm text-text-muted">Bienestar de hoy</span>
        <span className="flex items-baseline gap-1">
          <span className="nums text-display">{total}</span>
          <span className="text-base text-text-muted">/ 25</span>
        </span>
        {base ? (
          <span className={base.low ? "text-sm text-warning" : "text-sm"}>
            {base.low ? "Por debajo de lo habitual" : "Dentro de lo habitual"}: su media de los últimos 30 días es {fmt(base.mean, 1)} ({base.diff >= 0 ? "+" : "−"}
            {fmt(Math.abs(base.diff), 1)}).
          </span>
        ) : (
          <span className="text-sm text-text-muted">Con 3 días más se podrá comparar con su media.</span>
        )}
        {entry.pain !== null && <span className="text-sm">Dolor de la lesión: {entry.pain} / 10</span>}
      </Card>
      {low.length > 0 && (
        <Alert tone="warning" title="Conviene preguntar antes de la sesión">
          Respuestas de 1 o 2: {low.map((i) => `${itemLabel[i].toLowerCase()} (${entry[i]})`).join(", ")}.
        </Alert>
      )}
    </section>
  );
}

function History({ entries, onDelete }: { entries: WellnessEntry[]; onDelete: (e: WellnessEntry) => void }) {
  if (entries.length === 0) {
    return (
      <EmptyState icon={HeartPulse} title="Sin registros todavía">
        Rellenarlo cada día de sesión permite ver cuándo se sale de lo habitual.
      </EmptyState>
    );
  }
  const chart = [...entries].reverse().map((e) => ({ date: fmtDateShort(e.performedAt), total: wellnessTotal(e) }));
  return (
    <section aria-labelledby="h-historial" className="flex flex-col gap-2">
      <h2 id="h-historial" className="text-lg">
        Evolución
      </h2>
      {chart.length > 1 && (
        <figure className="h-56 w-full" aria-label="Gráfica del total de bienestar en el tiempo, de 5 a 25">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} stroke="var(--color-border)" />
              <YAxis domain={[5, 25]} ticks={[5, 10, 15, 20, 25]} tick={{ fill: "var(--color-text-muted)", fontSize: 12 }} stroke="var(--color-border)" />
              <Tooltip formatter={(v) => [`${v} / 25`, "Total"]} itemStyle={{ color: "var(--color-text)" }} />
              <Line type="monotone" dataKey="total" name="Total" stroke="var(--color-chart-primary)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-chart-primary)", stroke: "var(--color-bg)", strokeWidth: 2 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </figure>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="nums w-full text-left text-sm">
          <caption className="sr-only">Registros de bienestar</caption>
          <thead className="bg-surface text-text-muted">
            <tr>
              <th scope="col" className="px-2 py-2">Fecha</th>
              <th scope="col" className="px-2 py-2 text-right">Total</th>
              <th scope="col" className="px-2 py-2">Bajos (1-2)</th>
              <th scope="col" className="px-2 py-2 text-right">Dolor</th>
              <th scope="col" className="px-2 py-2">
                <span className="sr-only">Borrar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const low = lowItems(e);
              return (
                <tr key={e.id} className="border-t border-border">
                  <th scope="row" className="whitespace-nowrap px-2 py-1 font-normal">{fmtDateShort(e.performedAt)}</th>
                  <td className="px-2 py-1 text-right font-semibold">{wellnessTotal(e)}</td>
                  <td className="px-2 py-1">{low.length ? low.map((i) => itemShort[i]).join(", ") : "—"}</td>
                  <td className="px-2 py-1 text-right">{e.pain ?? "—"}</td>
                  <td className="px-1 py-1 text-right">
                    <IconButton label={`Borrar el registro del ${fmtDate(e.performedAt)}`} onClick={() => onDelete(e)}>
                      <Trash aria-hidden="true" className="size-4 text-danger" />
                    </IconButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
