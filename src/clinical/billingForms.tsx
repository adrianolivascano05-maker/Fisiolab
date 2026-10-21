// Formularios de bonos y cobros (src/data/billing.ts), los mismos en la ficha (Bonos y cobros), en la hoja de la cita
// y al apuntar una sesión. La forma de pago empieza en la última usada en este dispositivo.
import { useState, type FormEvent } from "react";
import { euros, expiryOf, METHODS, parseEuros, type Method, type PackInput, type PackPreset, type PaymentInput } from "../data/billing";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { NumberField, SelectField, TextField } from "../ui/Field";

/** 4050 → «40,50»; 4000 → «40» (para escribir en un campo). */
export const centsText = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ",").replace(/,00$/, ""));

const LAST_METHOD = "cenit.ultimaFormaDePago";
export function lastMethod(): Method {
  try {
    const m = localStorage.getItem(LAST_METHOD);
    return METHODS.some((x) => x.id === m) ? (m as Method) : "efectivo";
  } catch {
    return "efectivo";
  }
}
export function rememberMethod(m: Method) {
  try {
    localStorage.setItem(LAST_METHOD, m);
  } catch {
    /* sin almacenamiento: se empieza en efectivo */
  }
}

function useSubmit(run: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

const pill = (on: boolean) =>
  cx(
    "inline-flex min-h-11 items-center rounded-pill border px-3 text-sm",
    on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border-input bg-bg",
    "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
  );

export function MethodPicker({ value, onChange, name = "metodo" }: { value: Method; onChange: (m: Method) => void; name?: string }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="pb-1 text-sm font-semibold">Forma de pago</legend>
      <div className="flex flex-wrap gap-2">
        {METHODS.map((m) => (
          <label key={m.id} className="relative">
            <input type="radio" name={name} checked={value === m.id} onChange={() => onChange(m.id)} className="peer sr-only" />
            <span className={pill(value === m.id)}>{m.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Vender un bono (o cambiar uno: `initial`). Con los bonos de la clínica, se elige uno y se rellena solo. */
export function PackForm({
  today,
  sessionCents,
  presets = [],
  initial,
  onSave,
}: {
  today: string;
  sessionCents: number | null;
  presets?: PackPreset[];
  initial?: PackInput;
  onSave: (input: PackInput, paid: Method | null) => Promise<void>;
}) {
  const [sessions, setSessions] = useState(String(initial?.sessions ?? presets[0]?.sessions ?? 10));
  const [title, setTitle] = useState<string | null>(initial?.title ?? presets[0]?.title ?? null);
  /** Sin tocar, el precio es el de las sesiones sueltas por el número de sesiones. */
  const [typedPrice, setPrice] = useState<string | null>(initial ? centsText(initial.priceCents) : presets[0] ? centsText(presets[0].priceCents) : null);
  const [boughtOn, setBoughtOn] = useState(initial?.boughtOn ?? today);
  const [expiresOn, setExpiresOn] = useState(initial?.expiresOn ?? (presets[0]?.months ? expiryOf(today, presets[0].months) : ""));
  const [preset, setPreset] = useState<string | null>(initial ? null : (presets[0]?.id ?? null));
  const [paid, setPaid] = useState<Method | "">("");
  const n = Number(sessions);
  const name = title ?? `Bono ${Number.isInteger(n) && n > 0 ? n : "de"} sesiones`;
  const price = typedPrice ?? (sessionCents && Number.isInteger(n) && n > 0 ? centsText(sessionCents * n) : "");
  const pick = (p: PackPreset | null) => {
    setPreset(p?.id ?? null);
    setSessions(String(p?.sessions ?? 10));
    setTitle(p?.title ?? null);
    setPrice(p ? centsText(p.priceCents) : null);
    setExpiresOn(p?.months ? expiryOf(boughtOn, p.months) : "");
  };
  const { busy, error, submit } = useSubmit(async () => {
    const cents = price.trim() ? parseEuros(price) : null;
    if (price.trim() && cents === null) throw new RangeError("El precio no es una cantidad: por ejemplo, 350 o 350,50.");
    if (paid) rememberMethod(paid);
    await onSave({ title: name, sessions: n, priceCents: cents, boughtOn, expiresOn: expiresOn || null, note: initial?.note ?? "" }, paid || null);
  });
  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      {presets.length > 0 && !initial && (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="pb-1 text-sm font-semibold">Bonos de la clínica</legend>
          <div className="flex flex-wrap gap-2">
            {[...presets, null].map((p) => (
              <label key={p?.id ?? "-"} className="relative">
                <input type="radio" name="bono" checked={preset === (p?.id ?? null)} onChange={() => pick(p)} className="peer sr-only" />
                <span className={pill(preset === (p?.id ?? null))}>{p ? `${p.title} · ${p.priceCents !== null ? euros(p.priceCents) : "sin precio"}` : "Otro"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <NumberField label="Sesiones" unit="" value={sessions} inputMode="numeric" onChange={(e) => (setSessions(e.target.value), setPreset(null))} />
      <TextField label="Nombre" value={name} onChange={(e) => setTitle(e.target.value)} />
      <NumberField label="Precio" unit="€" value={price} onChange={(e) => setPrice(e.target.value)} hint={sessionCents ? `${euros(sessionCents)} por sesión suelta.` : undefined} />
      <TextField
        label="Día de compra"
        type="date"
        value={boughtOn}
        onChange={(e) => {
          setBoughtOn(e.target.value);
          const months = presets.find((p) => p.id === preset)?.months;
          if (months && e.target.value) setExpiresOn(expiryOf(e.target.value, months));
        }}
        hint="Las sesiones desde este día gastan el bono."
      />
      <TextField label="Caduca (opcional)" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
      {!initial && (
        <SelectField label="¿Lo ha pagado ya?" value={paid} onChange={(e) => setPaid(e.target.value as Method | "")}>
          <option value="">Todavía no</option>
          {METHODS.map((m) => (
            <option key={m.id} value={m.id}>
              Sí, {m.label.toLowerCase()}
            </option>
          ))}
        </SelectField>
      )}
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block loading={busy}>
        {initial ? "Guardar los cambios" : "Guardar el bono"}
      </Button>
    </form>
  );
}

/** Apuntar un cobro. `suggested`: la cantidad que se propone (lo pendiente o el precio de la sesión). */
export function PaymentForm({
  today,
  suggested,
  concept: initialConcept = "",
  submitLabel = "Guardar el cobro",
  onSave,
}: {
  today: string;
  suggested: number | null;
  concept?: string;
  submitLabel?: string;
  onSave: (input: PaymentInput) => Promise<void>;
}) {
  const [amount, setAmount] = useState(centsText(suggested));
  const [method, setMethod] = useState<Method>(lastMethod);
  const [paidOn, setPaidOn] = useState(today);
  const [concept, setConcept] = useState(initialConcept);
  const { busy, error, submit } = useSubmit(async () => {
    const cents = parseEuros(amount);
    if (cents === null || cents <= 0) throw new RangeError("Pon cuánto se ha cobrado: por ejemplo, 40 o 40,50.");
    rememberMethod(method);
    await onSave({ amountCents: cents, method, paidOn, concept });
  });
  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      <NumberField label="Cantidad" unit="€" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <MethodPicker value={method} onChange={setMethod} />
      <TextField label="Día" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
      <TextField label="Concepto (opcional)" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Sesión, bono…" />
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block loading={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}
