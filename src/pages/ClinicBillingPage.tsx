// Ajustes → Precios y cobros (src/data/billing.ts): el precio de la sesión suelta, los bonos que vende la clínica (para
// venderlos con un toque), lo cobrado este mes y el anterior por forma de pago, el Excel de cobros para la gestoría y
// quién tiene algo pendiente (con un toque, su cuenta).
import { Download, Pencil, Plus, Trash } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { centsText } from "../clinical/billingForms";
import { todayDay } from "../clinical/pageKit";
import {
  collectedBetween,
  euros,
  getPackPresets,
  getPricing,
  methodLabel,
  parseEuros,
  paymentsBetween,
  pendingAccounts,
  setPackPresets,
  setSessionPrice,
  type PackPreset,
} from "../data/billing";
import { getDb } from "../data/db";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NumberField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

/** El día 1 del mes de `d` (AAAA-MM-DD), `back` meses antes (negativo: después). */
const monthStart = (d: string, back = 0) => {
  const [y, m] = d.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 - back, 1)).toISOString().slice(0, 10);
};
const monthName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { month: "long" });
const monthYear = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

export function ClinicBillingPage() {
  const toast = useToast();
  const version = useDataVersion();
  const today = todayDay();
  const data = useAsync(async () => {
    const db = getDb();
    const thisMonth = monthStart(today);
    const [pricing, presets, debtors, now, last] = await Promise.all([
      getPricing(db),
      getPackPresets(db),
      pendingAccounts(db, today),
      collectedBetween(db, thisMonth, monthStart(today, -1)),
      collectedBetween(db, monthStart(today, 1), thisMonth),
    ]);
    return { pricing, presets, debtors, now, last };
  }, [version, today]);
  /** Lo escrito; null mientras no se toca (se ve el precio guardado). */
  const [typed, setPrice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PackPreset | null>(null);
  const [month, setMonth] = useState(monthStart(today));
  const [downloading, setDownloading] = useState(false);
  const saved = data.data?.pricing;
  const price = typed ?? (saved?.sessionCents != null ? centsText(saved.sessionCents) : "");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = price.trim() ? parseEuros(price) : null;
    if (price.trim() && cents === null) return setError("No es una cantidad: por ejemplo, 40 o 42,50.");
    // Desde hoy: las sesiones de antes se quedan con el precio que tenían.
    await setSessionPrice(getDb(), cents, today);
    setPrice(null);
    bumpData();
    toast(cents === null ? "Sin precio de sesión" : `Sesión suelta: ${euros(cents)}`, "success");
  }

  async function savePresets(next: PackPreset[], done: string) {
    await setPackPresets(getDb(), next);
    bumpData();
    toast(done, "success");
  }

  async function download() {
    setDownloading(true);
    try {
      const [y, m] = month.split("-").map(Number) as [number, number];
      const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      const rows = await paymentsBetween(getDb(), month, to);
      const { writeXlsx } = await import("../export/files");
      const total = rows.reduce((n, r) => n + r.amountCents, 0);
      const bytes = await writeXlsx([
        {
          name: "Cobros",
          header: ["Día", "Paciente", "Concepto", "Forma de pago", "Cantidad (€)"],
          rows: [...rows.map((r) => [r.paidOn.split("-").reverse().join("/"), r.name, r.concept, methodLabel(r.method), r.amountCents / 100]), ["", "", "", "Total", total / 100]],
        },
      ]);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cobros ${month.slice(0, 7)}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(rows.length ? `${rows.length === 1 ? "1 cobro" : `${rows.length} cobros`} de ${monthYear(month)}` : `Sin cobros en ${monthYear(month)}`, "success");
    } finally {
      setDownloading(false);
    }
  }

  const d = data.data;
  const pending = d?.debtors.reduce((n, x) => n + x.balanceCents, 0) ?? 0;
  const presets = d?.presets ?? [];
  const months = Array.from({ length: 13 }, (_, i) => monthStart(today, i));
  return (
    <Page title="Precios y cobros" backTo="/ajustes">
      <p className="text-sm text-text-muted">
        Bonos, cobros y lo pendiente de cada paciente, en su ficha (Bonos y cobros). Aquí, los precios y el resumen de la clínica. No son facturas.
      </p>

      <Card className="flex flex-col gap-3">
        <form className="flex flex-col gap-3" onSubmit={save} noValidate>
          <NumberField
            label="Precio de la sesión suelta"
            unit="€"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            disabled={!saved}
            hint={
              saved?.since
                ? "Un precio nuevo vale desde hoy: las sesiones de antes se quedan con el suyo."
                : "Las sesiones sin bono contarán para cobrar a partir de hoy (las de antes no)."
            }
          />
          {saved && saved.periods.length > 0 && (
            <ul aria-label="Precios de la sesión" className="flex flex-col gap-0.5 text-sm text-text-muted">
              {[...saved.periods].reverse().map((p) => (
                <li key={p.since}>
                  Desde el {fmtDate(`${p.since}T12:00:00`)}: {p.cents === null ? "sin precio (no cuentan)" : euros(p.cents)}
                </li>
              ))}
            </ul>
          )}
          {error && <Alert tone="danger" title={error} />}
          <Button type="submit" disabled={!saved}>
            Guardar el precio
          </Button>
        </form>
      </Card>

      <section aria-labelledby="h-bonos-clinica" className="flex flex-col gap-2">
        <h2 id="h-bonos-clinica" className="text-lg">
          Bonos de la clínica
        </h2>
        <p className="text-sm text-text-muted">Los que vendes siempre: al vender un bono a un paciente, se eligen con un toque.</p>
        {presets.length > 0 && (
          <ul aria-label="Bonos de la clínica" className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
            {presets.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-1 pr-1 pl-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.title}</span>
                  <span className="block text-sm text-text-muted">
                    {[`${p.sessions} sesiones`, p.priceCents !== null ? euros(p.priceCents) : "sin precio", p.months ? `caduca a los ${p.months === 1 ? "1 mes" : `${p.months} meses`}` : "no caduca"].join(" · ")}
                  </span>
                </span>
                <button type="button" aria-label={`Cambiar ${p.title}`} className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface" onClick={() => setEditing(p)}>
                  <Pencil aria-hidden="true" className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label={`Quitar ${p.title}`}
                  className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-danger"
                  onClick={() => void savePresets(presets.filter((x) => x.id !== p.id), `${p.title}: quitado`)}
                >
                  <Trash aria-hidden="true" className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="secondary"
          icon={<Plus aria-hidden="true" className="size-5" />}
          onClick={() => setEditing({ id: crypto.randomUUID(), title: "", sessions: 10, priceCents: saved?.sessionCents ? saved.sessionCents * 10 : null, months: null })}
        >
          Añadir un bono
        </Button>
      </section>

      {d && (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Tile label={`Cobrado en ${monthName(monthStart(today))}`} value={euros(d.now.totalCents)} detail={d.now.byMethod.map((m) => `${methodLabel(m.method)} ${euros(m.cents)}`).join(" · ") || "Nada todavía"} />
            <Tile label={`Cobrado en ${monthName(monthStart(today, 1))}`} value={euros(d.last.totalCents)} detail={d.last.byMethod.map((m) => `${methodLabel(m.method)} ${euros(m.cents)}`).join(" · ") || "Nada"} />
          </dl>

          <Card className="flex flex-col gap-3">
            <h2 className="font-semibold">Cobros para la gestoría</h2>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Mes</span>
              <select className="h-12 rounded-md border border-border-input bg-bg px-3" value={month} onChange={(e) => setMonth(e.target.value)}>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthYear(m)}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="secondary" loading={downloading} icon={<Download aria-hidden="true" className="size-5" />} onClick={() => void download()}>
              Descargar en Excel
            </Button>
          </Card>

          <section aria-labelledby="h-pendiente" className="flex flex-col gap-2">
            <h2 id="h-pendiente" className="text-lg">
              Pendiente de cobro{pending > 0 ? `: ${euros(pending)}` : ""}
            </h2>
            {d.debtors.length === 0 ? (
              <p className="text-sm text-text-muted">Nadie tiene nada pendiente.</p>
            ) : (
              <ul aria-label="Pendiente de cobro" className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
                {d.debtors.map((x) => (
                  <li key={x.patientId}>
                    <Link to={`/pacientes/${x.patientId}/cobros`} className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-surface">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{x.name}</span>
                        <span className="block text-sm text-text-muted">{x.lastPaidOn ? `Último cobro el ${fmtDate(`${x.lastPaidOn}T12:00:00`)}` : "Sin cobros"}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{euros(x.balanceCents)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing && presets.some((p) => p.id === editing.id) ? "Cambiar el bono" : "Nuevo bono de la clínica"}>
        {editing && (
          <PresetForm
            initial={editing}
            onSave={async (p) => {
              const exists = presets.some((x) => x.id === p.id);
              await savePresets(exists ? presets.map((x) => (x.id === p.id ? p : x)) : [...presets, p], exists ? "Bono cambiado" : "Bono añadido");
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </Page>
  );
}

function PresetForm({ initial, onSave }: { initial: PackPreset; onSave: (p: PackPreset) => Promise<void> }) {
  const [sessions, setSessions] = useState(String(initial.sessions));
  const [title, setTitle] = useState(initial.title);
  const [price, setPrice] = useState(centsText(initial.priceCents));
  const [months, setMonths] = useState(initial.months ? String(initial.months) : "");
  const [error, setError] = useState<string | null>(null);
  const n = Number(sessions);
  const name = title || `Bono ${Number.isInteger(n) && n > 0 ? n : "de"} sesiones`;
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const cents = price.trim() ? parseEuros(price) : null;
        if (price.trim() && cents === null) return setError("El precio no es una cantidad: por ejemplo, 350 o 350,50.");
        const m = months.trim() ? Number(months) : null;
        try {
          await onSave({ id: initial.id, title: name, sessions: n, priceCents: cents, months: m });
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }}
    >
      <NumberField label="Sesiones" unit="" inputMode="numeric" value={sessions} onChange={(e) => setSessions(e.target.value)} />
      <TextField label="Nombre" value={name} onChange={(e) => setTitle(e.target.value)} />
      <NumberField label="Precio" unit="€" value={price} onChange={(e) => setPrice(e.target.value)} />
      <NumberField label="Caduca a los (opcional)" unit="meses" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} hint="Vacío: no caduca." />
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block>
        Guardar
      </Button>
    </form>
  );
}

function Tile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-bg p-3">
      <dt className="text-sm text-text-muted first-letter:uppercase">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      <dd className="text-xs text-text-muted">{detail}</dd>
    </div>
  );
}
