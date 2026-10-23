import { Download, Gauge, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, fmtDate, parseDecimal, testLabel } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { agreement, MIN_PAIRS, verdict, type Agreement } from "../calc/agreement";
import { getDb } from "../data/db";
import { getSetting } from "../data/repo";
import {
  addPair,
  candidates,
  comparisonLabels,
  countPairs,
  deletePair,
  getDelta,
  getKind,
  kinds,
  listPairs,
  pairsCsv,
  setDelta,
  type Comparison,
  type KindInfo,
  type ValidationKind,
  type ValidationPair,
} from "../data/validation";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { Card, MetricCard } from "../ui/Card";
import { NumberField, SelectField, TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import type { SensorCheck } from "./SensorCheckPage";

/** Nombres de los dos valores de cada par según lo que se compara. */
export const sides: Record<Comparison, { a: string; b: string }> = {
  reference: { a: "Cénit", b: "Referencia" },
  remark: { a: "2.ª marcación", b: "1.ª marcación" },
  ai: { a: "IA", b: "Tus marcas" },
};

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Validación: cuánto se parece Cénit a otra herramienta y cuánto se repite al volver a marcar. */
export function ValidationPage() {
  const [params, setParams] = useSearchParams();
  const kind = getKind(params.get("tipo") ?? "") ?? kinds[0]!;
  const comparison: Comparison = (["reference", "remark", "ai"] as const).find((c) => c === params.get("comparacion")) ?? "reference";
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    next.set(k, v);
    next.delete("test");
    setParams(next, { replace: true });
  };
  const data = useAsync(async () => {
    const db = getDb();
    return {
      pairs: await listPairs(db, kind.id, comparison),
      counts: await countPairs(db),
      delta: await getDelta(db, kind.id),
      sensor: kind.id === "rom_angle" ? await getSetting<SensorCheck>(db, "sensor_check") : null,
    };
  }, [kind.id, comparison]);

  return (
    <Page title="Validación" backTo="/ajustes">
      <p className="text-text-muted">
        Para saber cuánto puedes fiarte de cada medida: compara Cénit con otra herramienta y comprueba cuánto se repite al volver a marcar el mismo vídeo.
      </p>
      <SelectField label="Medida" value={kind.id} onChange={(e) => set("tipo", e.target.value)}>
        {kinds.map((k) => {
          const n = (["reference", "remark", "ai"] as const).reduce((s, c) => s + (data.data?.counts[`${k.id}:${c}`] ?? 0), 0);
          return (
            <option key={k.id} value={k.id}>
              {k.label}
              {n ? ` (${n})` : ""}
            </option>
          );
        })}
      </SelectField>
      <SelectField label="Qué se compara" value={comparison} onChange={(e) => set("comparacion", e.target.value)}>
        {(Object.keys(comparisonLabels) as Comparison[])
          .filter((c) => c === "reference" || kind.id === "jump_height" || kind.id === "bar_velocity")
          .map((c) => (
            <option key={c} value={c}>
              {comparisonLabels[c]} ({data.data?.counts[`${kind.id}:${c}`] ?? 0})
            </option>
          ))}
      </SelectField>

      {data.error ? (
        <LoadError error={data.error} />
      ) : !data.data ? (
        <Loading />
      ) : (
        <KindPanel key={`${kind.id}-${comparison}`} kind={kind} comparison={comparison} pairs={data.data.pairs} delta={data.data.delta} sensor={data.data.sensor} onChange={data.reload} preselect={params.get("test")} />
      )}
    </Page>
  );
}

function KindPanel({
  kind,
  comparison,
  pairs,
  delta,
  sensor,
  onChange,
  preselect,
}: {
  kind: KindInfo;
  comparison: Comparison;
  pairs: ValidationPair[];
  delta: number;
  sensor: SensorCheck | null;
  onChange: () => void;
  preselect: string | null;
}) {
  const toast = useToast();
  const ag = agreement(pairs.map((p) => ({ a: p.impulsoValue, b: p.referenceValue })));
  const v = (n: number) => `${fmt(n, kind.digits + 1)} ${kind.unit}`;
  const side = sides[comparison];

  return (
    <>
      {comparison === "remark" && (
        <Alert tone="info" title="Cómo se llena">
          En el resultado de un salto o de una serie de fuerza, pulsa «Marcar otra vez a ciegas»: marcas el mismo vídeo sin ver las marcas
          anteriores y el par se guarda aquí. Mejor dejar pasar un día entre una marcación y otra.
        </Alert>
      )}
      {comparison === "ai" && (
        <Alert tone="info" title="Cómo se llena">
          Solo: cada vez que la IA propone las marcas y calculas el resultado, se guarda lo que daba la propuesta de la IA frente a lo que
          dan tus marcas finales. Si casi nunca tienes que moverlas, aquí lo verás.
        </Alert>
      )}

      {ag ? <Summary ag={ag} kind={kind} comparison={comparison} delta={delta} v={v} /> : <p className="text-sm text-text-muted">Con 2 pares o más verás aquí el análisis (lo recomendable son {MIN_PAIRS} o más).</p>}
      {ag && <BlandAltman pairs={pairs} ag={ag} delta={delta} kind={kind} />}

      <DeltaEditor kind={kind} delta={delta} onSaved={onChange} />

      {comparison === "reference" && <AddPairForm kind={kind} onAdded={onChange} preselect={preselect} />}

      {pairs.length > 0 && (
        <section aria-labelledby="h-pares" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id="h-pares" className="text-lg">
              Pares ({pairs.length})
            </h2>
            <Button size="sm" variant="secondary" icon={<Download aria-hidden="true" className="size-4" />} onClick={() => download(`validacion-${kind.id}-${comparison}-${new Date().toISOString().slice(0, 10)}.csv`, pairsCsv(pairs, kind.unit))}>
              CSV
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="nums w-full text-left text-sm">
              <caption className="sr-only">Pares de medidas de {kind.label.toLowerCase()}</caption>
              <thead className="bg-surface text-text-muted">
                <tr>
                  <th scope="col" className="px-2 py-2">Fecha</th>
                  <th scope="col" className="px-2 py-2 text-right">{side.a}</th>
                  <th scope="col" className="px-2 py-2 text-right">{side.b}</th>
                  <th scope="col" className="px-2 py-2 text-right">Dif.</th>
                  <th scope="col" className="px-2 py-2"><span className="sr-only">Borrar</span></th>
                </tr>
              </thead>
              <tbody>
                {pairs.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <th scope="row" className="px-2 py-1 font-normal">
                      {fmtDate(p.createdAt)}
                      <span className="block text-xs text-text-muted">{[p.patientName, p.referenceLabel, p.notes].filter(Boolean).join(" · ")}</span>
                    </th>
                    <td className="px-2 py-1 text-right">{fmt(p.impulsoValue, kind.digits + 1)}</td>
                    <td className="px-2 py-1 text-right">{fmt(p.referenceValue, kind.digits + 1)}</td>
                    <td className="px-2 py-1 text-right">{fmt(p.impulsoValue - p.referenceValue, kind.digits + 1)}</td>
                    <td className="px-1 py-1 text-right">
                      <IconButton
                        label={`Borrar el par del ${fmtDate(p.createdAt)} (${fmt(p.impulsoValue, kind.digits + 1)} y ${fmt(p.referenceValue, kind.digits + 1)})`}
                        onClick={async () => {
                          await deletePair(getDb(), p.id);
                          toast("Par borrado", "success");
                          onChange();
                        }}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <details className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        <summary className="min-h-11 cursor-pointer py-2.5 font-semibold">Cómo hacer una sesión de validación</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {kind.protocol.map((t) => (
            <li key={t}>{t}</li>
          ))}
          <li>Qué mirar: el sesgo (si Cénit da de más o de menos), los límites de acuerdo (cuánto puede fallar una medida suelta) y el ICC (por encima de 0,90, excelente; 0,75-0,90, bueno).</li>
        </ul>
      </details>

      {kind.id === "rom_angle" && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg">Sensor del móvil</h2>
          <p className="text-sm text-text-muted">
            {sensor
              ? `Última comprobación ${fmtDate(sensor.at)}: ${sensor.ok ? "correcta" : "con desviaciones"} (plano ${fmt(sensor.flat, 1)}°, vertical ${fmt(sensor.vertical, 1)}°, repetición ±${fmt(sensor.spread / 2, 1)}°).`
              : "Antes de validar la movilidad, comprueba que el sensor del móvil mide bien."}
          </p>
          <Link to="/validacion/sensor" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-input bg-bg px-4 font-semibold">
            <Gauge aria-hidden="true" className="size-5" /> Comprobar el sensor
          </Link>
        </Card>
      )}
    </>
  );
}

function Summary({ ag, kind, comparison, delta, v }: { ag: Agreement; kind: KindInfo; comparison: Comparison; delta: number; v: (n: number) => string }) {
  const read = verdict(ag, delta, v);
  const d = kind.digits + 1;
  return (
    <section aria-label="Análisis" className="flex flex-col gap-3">
      <Alert tone={read.tone === "danger" ? "danger" : read.tone === "success" ? "success" : read.tone === "warning" ? "warning" : "info"} title={read.title}>
        {read.text}
      </Alert>
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label={`Sesgo (${sides[comparison].a} − ${sides[comparison].b})`} value={fmt(ag.bias, d)} unit={kind.unit} detail={`IC 95 %: ${fmt(ag.biasCi[0], d)} a ${fmt(ag.biasCi[1], d)}`} />
        <MetricCard label="Límites de acuerdo 95 %" value={`${fmt(ag.loa[0], d)} a ${fmt(ag.loa[1], d)}`} unit={kind.unit} />
        <MetricCard label="ICC (acuerdo absoluto)" value={fmt(ag.icc, 3)} detail={ag.r === null ? undefined : `Pearson r = ${fmt(ag.r, 3)}`} />
        <MetricCard label="Error típico" value={fmt(ag.sem, d)} unit={kind.unit} detail={`${fmt(ag.cvPct, 1)} % de la media`} />
        <MetricCard label="Cambio mínimo detectable (95 %)" value={fmt(ag.mdc95, d)} unit={kind.unit} detail={comparison === "reference" ? "entre las dos herramientas" : "un cambio menor puede ser error"} />
        <MetricCard label="Pares" value={String(ag.n)} detail={`Sesgo ${fmt(ag.biasPct, 1)} % de la media`} />
      </div>
      {ag.fit && comparison === "reference" && ag.n >= 5 && (
        <p className="text-sm text-text-muted">
          Para pasar de Cénit a la referencia: referencia ≈ {fmt(ag.fit.intercept, d)} + {fmt(ag.fit.slope, 3)} × Cénit.
          {ag.proportional !== null && Math.abs(ag.proportional) > 0.1 && " El sesgo cambia con el tamaño de la medida: mira la gráfica."}
        </p>
      )}
    </section>
  );
}

function BlandAltman({ pairs, ag, delta, kind }: { pairs: ValidationPair[]; ag: Agreement; delta: number; kind: KindInfo }) {
  const pts = pairs.map((p) => ({ mean: (p.impulsoValue + p.referenceValue) / 2, diff: p.impulsoValue - p.referenceValue }));
  const d = kind.digits + 1;
  const span = Math.max(Math.abs(ag.loa[0]), Math.abs(ag.loa[1]), delta, ...pts.map((p) => Math.abs(p.diff))) * 1.2;
  const tick = { fill: "var(--color-text-muted)", fontSize: 12 };
  const label = (value: string) => ({ value, position: "insideTopRight" as const, fill: "var(--color-text-muted)", fontSize: 11 });
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-sm font-semibold">Bland-Altman: diferencia frente a la media de las dos</figcaption>
      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 12, right: 12, bottom: 16, left: -8 }}>
            <CartesianGrid stroke="var(--color-border)" />
            <ReferenceArea y1={-delta} y2={delta} fill="var(--color-accent-soft)" fillOpacity={0.7} />
            <XAxis type="number" dataKey="mean" name="Media" domain={["auto", "auto"]} tick={tick} stroke="var(--color-border)" tickFormatter={(x) => fmt(Number(x), kind.digits)} label={{ value: `Media (${kind.unit})`, position: "insideBottom", offset: -8, fill: "var(--color-text-muted)", fontSize: 12 }} />
            <YAxis type="number" dataKey="diff" name="Diferencia" domain={[-span, span]} tick={tick} stroke="var(--color-border)" tickFormatter={(x) => fmt(Number(x), kind.digits)} />
            <ReferenceLine y={0} stroke="var(--color-border-input)" />
            <ReferenceLine y={ag.bias} stroke="var(--color-text)" strokeWidth={2} label={label(`sesgo ${fmt(ag.bias, d)}`)} />
            <ReferenceLine y={ag.loa[1]} stroke="var(--color-text-muted)" strokeDasharray="6 4" label={label(`+1,96 DT ${fmt(ag.loa[1], d)}`)} />
            <ReferenceLine y={ag.loa[0]} stroke="var(--color-text-muted)" strokeDasharray="6 4" label={label(`−1,96 DT ${fmt(ag.loa[0], d)}`)} />
            <Tooltip
              formatter={(value, name) => [`${fmt(Number(value), d)} ${kind.unit}`, String(name)]}
              itemStyle={{ color: "var(--color-text)" }}
              cursor={{ strokeDasharray: "3 3" }}
            />
            <Scatter data={pts} fill="var(--color-chart-primary)" stroke="var(--color-bg)" strokeWidth={2} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-text-muted">La franja coloreada es ±{fmt(delta, kind.digits + 1)} {kind.unit}: la diferencia que has marcado como aceptable.</p>
    </figure>
  );
}

function DeltaEditor({ kind, delta, onSaved }: { kind: KindInfo; delta: number; onSaved: () => void }) {
  const toast = useToast();
  const [text, setText] = useState(fmt(delta, kind.digits + 1));
  useEffect(() => setText(fmt(delta, kind.digits + 1)), [delta, kind.digits]);
  const value = parseDecimal(text);
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await setDelta(getDb(), kind.id as ValidationKind, value ?? NaN);
          toast("Guardado", "success");
          onSaved();
        } catch (err) {
          toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
        }
      }}
    >
      <div className="flex-1">
        <NumberField label="Diferencia que importa en tu clínica" unit={kind.unit} value={text} onChange={(e) => setText(e.target.value)} hint="Por debajo de esto, dos medidas se consideran iguales." />
      </div>
      <Button type="submit" variant="secondary" disabled={value === delta}>
        Guardar
      </Button>
    </form>
  );
}

function AddPairForm({ kind, onAdded, preselect }: { kind: KindInfo; onAdded: () => void; preselect: string | null }) {
  const toast = useToast();
  const list = useAsync(() => candidates(getDb(), kind.id), [kind.id]);
  const [testId, setTestId] = useState(preselect ?? "");
  const [impulso, setCénit] = useState("");
  const [reference, setReference] = useState("");
  const [label, setLabel] = useState(kind.references[0] ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const chosen = list.data?.find((c) => c.testId === testId);
  useEffect(() => {
    if (chosen) setCénit(fmt(chosen.value, kind.digits + 1));
  }, [chosen, kind.digits]);
  const a = parseDecimal(impulso);
  const b = parseDecimal(reference);
  const ok = a !== null && b !== null && Number.isFinite(a) && Number.isFinite(b);

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg">Añadir una medida</h2>
      {kind.metric && (
        <SelectField label="Resultado de Cénit (opcional)" value={testId} onChange={(e) => setTestId(e.target.value)} hint="Elige el test y su valor se copia solo.">
          <option value="">Escribir el valor a mano</option>
          {list.data?.map((c) => (
            <option key={c.testId} value={c.testId}>
              {c.patientName} · {testLabel(c.type)} · {fmtDate(c.performedAt)} · {fmt(c.value, kind.digits + 1)} {kind.unit}
            </option>
          ))}
        </SelectField>
      )}
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Cénit" unit={kind.unit} value={impulso} onChange={(e) => setCénit(e.target.value)} />
        <NumberField label="Referencia" unit={kind.unit} value={reference} onChange={(e) => setReference(e.target.value)} />
      </div>
      <TextField label="Con qué se midió la referencia" value={label} onChange={(e) => setLabel(e.target.value)} list={`refs-${kind.id}`} />
      <datalist id={`refs-${kind.id}`}>
        {kind.references.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <TextField label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button
        disabled={!ok}
        loading={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await addPair(getDb(), {
              kind: kind.id,
              comparison: "reference",
              referenceLabel: label,
              impulsoValue: a!,
              referenceValue: b!,
              patientId: chosen?.patientId ?? null,
              testId: chosen?.testId ?? null,
              notes,
            });
            toast("Par añadido", "success");
            setTestId("");
            setCénit("");
            setReference("");
            setNotes("");
            onAdded();
          } catch (e) {
            toast(e instanceof Error ? e.message : "No se pudo guardar", "danger");
          } finally {
            setSaving(false);
          }
        }}
      >
        Añadir par
      </Button>
    </Card>
  );
}
