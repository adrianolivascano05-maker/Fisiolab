// Ficha → Bonos y cobros (src/data/billing.ts): lo que el paciente tiene pendiente, sus bonos (cuántas sesiones le
// quedan) y lo que ha pagado. Vender un bono y apuntar un cobro, en una hoja. No son facturas.
import { Plus, Trash, Wallet } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { addPayment, createPack, deletePack, deletePayment, euros, getPricing, methodLabel, METHODS, parseEuros, patientAccount, type Method, type PackState, type Payment } from "../data/billing";
import { getDb } from "../data/db";
import { getPatient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { NumberField, SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { todayDay } from "./pageKit";

const day = (d: string) => fmtDate(`${d}T12:00:00`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function BillingPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const version = useDataVersion();
  const today = todayDay();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, account, pricing] = await Promise.all([getPatient(db, id), patientAccount(db, id, today), getPricing(db)]);
    return { patient, account, pricing };
  }, [id, version, today]);
  const [sheet, setSheet] = useState<"pack" | "payment" | null>(null);
  const [dropping, setDropping] = useState<{ kind: "pack"; item: PackState } | { kind: "payment"; item: Payment } | null>(null);

  if (data.error) return <Page title="Bonos y cobros" backTo={`/pacientes/${id}`}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Bonos y cobros" backTo={`/pacientes/${id}`}><Loading /></Page>;
  const { patient, account: a, pricing } = data.data;
  if (!patient) return <Page title="Bonos y cobros" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  const packsCents = a.packs.reduce((n, p) => n + (p.priceCents ?? 0), 0);

  async function drop() {
    if (!dropping) return;
    if (dropping.kind === "pack") await deletePack(getDb(), dropping.item.id);
    else await deletePayment(getDb(), dropping.item.id);
    setDropping(null);
    bumpData();
    toast(dropping.kind === "pack" ? "Bono borrado" : "Cobro borrado", "success");
  }

  return (
    <Page title="Bonos y cobros" backTo={`/pacientes/${id}`}>
      <p className="-mt-2 font-semibold">{patient.name}</p>

      <Card className={cx("flex flex-col gap-1", a.balanceCents > 0 && "border-warning bg-warning-soft")}>
        <p className="text-sm text-text-muted">{a.balanceCents > 0 ? "Pendiente de cobro" : a.balanceCents < 0 ? "Pagado a cuenta" : "Cuenta"}</p>
        <p className="text-2xl font-semibold tabular-nums" role="status">
          {a.balanceCents === 0 ? "Al día" : euros(Math.abs(a.balanceCents))}
        </p>
        {(packsCents > 0 || a.loose.count > 0 || a.paidCents > 0) && (
          <p className="text-sm text-text-muted">
            {[
              packsCents > 0 && `Bonos ${euros(packsCents)}`,
              a.loose.count > 0 && `${plural(a.loose.count, "sesión suelta", "sesiones sueltas")} ${euros(a.loose.cents)}`,
              `cobrado ${euros(a.paidCents)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </Card>
      {pricing.sessionCents === null && (
        <p className="text-sm text-text-muted">
          Las sesiones sin bono no cuentan: pon el precio de la sesión en{" "}
          <Link to="/ajustes/cobros" className="font-semibold text-accent">
            Ajustes → Precios y cobros
          </Link>
          .
        </p>
      )}

      <section aria-labelledby="h-bonos" className="flex flex-col gap-2">
        <h2 id="h-bonos" className="text-lg">
          Bonos
        </h2>
        {a.packs.length === 0 && <p className="text-sm text-text-muted">Sin bonos. Las sesiones a partir del día de compra lo van gastando solas.</p>}
        {[...a.packs].reverse().map((p) => (
          <Card key={p.id} role="group" aria-label={p.title} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-semibold">{p.title}</p>
              <p className="text-sm text-text-muted">{p.priceCents !== null ? euros(p.priceCents) : "Sin precio"}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface" aria-hidden="true">
              <div className={cx("h-full rounded-full", p.left > 0 && !p.expired ? "bg-accent" : "bg-text-muted")} style={{ width: `${(p.used / p.sessions) * 100}%` }} />
            </div>
            <p className="text-sm">
              {p.used} de {p.sessions} usadas ·{" "}
              <span className="font-semibold">{p.expired && p.left > 0 ? `caducado con ${plural(p.left, "sesión", "sesiones")} sin usar` : p.left > 0 ? `quedan ${p.left}` : "gastado"}</span>
            </p>
            <p className="text-xs text-text-muted">
              Comprado el {day(p.boughtOn)}
              {p.expiresOn ? ` · caduca el ${day(p.expiresOn)}` : ""}
              {p.note ? ` · ${p.note}` : ""}
            </p>
            <Button size="sm" variant="ghost" className="self-start text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => setDropping({ kind: "pack", item: p })}>
              Borrar el bono
            </Button>
          </Card>
        ))}
        <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => setSheet("pack")}>
          Vender un bono
        </Button>
      </section>

      <section aria-labelledby="h-cobros" className="flex flex-col gap-2">
        <h2 id="h-cobros" className="text-lg">
          Cobros
        </h2>
        {a.payments.length === 0 ? (
          <p className="text-sm text-text-muted">Sin cobros apuntados.</p>
        ) : (
          <ul aria-label="Cobros" className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
            {a.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">{euros(p.amountCents)}</p>
                  <p className="text-sm text-text-muted">
                    {day(p.paidOn)} · {methodLabel(p.method)}
                    {p.concept ? ` · ${p.concept}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Borrar el cobro de ${euros(p.amountCents)} del ${day(p.paidOn)}`}
                  className="inline-flex size-11 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-danger"
                  onClick={() => setDropping({ kind: "payment", item: p })}
                >
                  <Trash aria-hidden="true" className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Button icon={<Wallet aria-hidden="true" className="size-5" />} onClick={() => setSheet("payment")}>
          Apuntar un cobro
        </Button>
      </section>
      <p className="text-sm text-text-muted">Es un registro de lo cobrado para llevar las cuentas de la consulta. No sustituye a las facturas.</p>

      <Sheet open={sheet === "pack"} onClose={() => setSheet(null)} title="Vender un bono">
        {sheet === "pack" && (
          <PackForm
            today={today}
            sessionCents={pricing.sessionCents}
            onSave={async (input, paid) => {
              await createPack(getDb(), id, input, paid);
              setSheet(null);
              bumpData();
              toast(paid ? "Bono vendido y cobrado" : "Bono vendido", "success");
            }}
          />
        )}
      </Sheet>
      <Sheet open={sheet === "payment"} onClose={() => setSheet(null)} title="Apuntar un cobro">
        {sheet === "payment" && (
          <PaymentForm
            today={today}
            suggested={a.balanceCents > 0 ? a.balanceCents : (pricing.sessionCents ?? null)}
            onSave={async (input) => {
              await addPayment(getDb(), id, input);
              setSheet(null);
              bumpData();
              toast("Cobro apuntado", "success");
            }}
          />
        )}
      </Sheet>
      <Sheet open={!!dropping} onClose={() => setDropping(null)} title={dropping?.kind === "pack" ? "¿Borrar este bono?" : "¿Borrar este cobro?"}>
        <p>
          {dropping?.kind === "pack"
            ? `Se borrará «${dropping.item.title}». Sus sesiones pasan a contar como sueltas; si se cobró, el cobro se queda.`
            : dropping
              ? `Se borrará el cobro de ${euros(dropping.item.amountCents)} del ${day(dropping.item.paidOn)}.`
              : ""}
        </p>
        <Button variant="danger" block onClick={() => void drop()}>
          Borrar
        </Button>
        <Button variant="secondary" block onClick={() => setDropping(null)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}

function useSubmit(run: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
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

const centsText = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2).replace(".", ",").replace(/,00$/, ""));

function PackForm({ today, sessionCents, onSave }: { today: string; sessionCents: number | null; onSave: (input: Parameters<typeof createPack>[2], paid: Method | null) => Promise<void> }) {
  const [sessions, setSessions] = useState("10");
  const [title, setTitle] = useState<string | null>(null);
  /** Sin tocar, el precio es el de las sesiones sueltas por el número de sesiones. */
  const [typedPrice, setPrice] = useState<string | null>(null);
  const [boughtOn, setBoughtOn] = useState(today);
  const [expiresOn, setExpiresOn] = useState("");
  const [paid, setPaid] = useState<Method | "">("");
  const n = Number(sessions);
  const name = title ?? `Bono ${Number.isInteger(n) && n > 0 ? n : "de"} sesiones`;
  const price = typedPrice ?? (sessionCents && Number.isInteger(n) && n > 0 ? centsText(sessionCents * n) : "");
  const { busy, error, submit } = useSubmit(async () => {
    const cents = price.trim() ? parseEuros(price) : null;
    if (price.trim() && cents === null) throw new RangeError("El precio no es una cantidad: por ejemplo, 350 o 350,50.");
    await onSave({ title: name, sessions: n, priceCents: cents, boughtOn, expiresOn: expiresOn || null, note: "" }, paid || null);
  });
  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      <NumberField label="Sesiones" unit="" value={sessions} inputMode="numeric" onChange={(e) => setSessions(e.target.value)} />
      <TextField label="Nombre" value={name} onChange={(e) => setTitle(e.target.value)} />
      <NumberField label="Precio" unit="€" value={price} onChange={(e) => setPrice(e.target.value)} hint={sessionCents ? `${euros(sessionCents)} por sesión suelta.` : undefined} />
      <TextField label="Día de compra" type="date" value={boughtOn} onChange={(e) => setBoughtOn(e.target.value)} hint="Las sesiones desde este día gastan el bono." />
      <TextField label="Caduca (opcional)" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
      <SelectField label="¿Lo ha pagado ya?" value={paid} onChange={(e) => setPaid(e.target.value as Method | "")}>
        <option value="">Todavía no</option>
        {METHODS.map((m) => (
          <option key={m.id} value={m.id}>
            Sí, {m.label.toLowerCase()}
          </option>
        ))}
      </SelectField>
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block loading={busy}>
        Guardar el bono
      </Button>
    </form>
  );
}

function PaymentForm({ today, suggested, onSave }: { today: string; suggested: number | null; onSave: (input: Parameters<typeof addPayment>[2]) => Promise<void> }) {
  const [amount, setAmount] = useState(centsText(suggested));
  const [method, setMethod] = useState<Method>("efectivo");
  const [paidOn, setPaidOn] = useState(today);
  const [concept, setConcept] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    const cents = parseEuros(amount);
    if (cents === null || cents <= 0) throw new RangeError("Pon cuánto se ha cobrado: por ejemplo, 40 o 40,50.");
    await onSave({ amountCents: cents, method, paidOn, concept });
  });
  return (
    <form className="flex flex-col gap-3" onSubmit={submit} noValidate>
      <NumberField label="Cantidad" unit="€" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Forma de pago</legend>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((m) => (
            <label key={m.id} className="relative">
              <input type="radio" name="metodo" checked={method === m.id} onChange={() => setMethod(m.id)} className="peer sr-only" />
              <span className="inline-flex min-h-11 items-center rounded-pill border border-border-input bg-bg px-3 text-sm peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:font-semibold peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus">
                {m.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextField label="Día" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
      <TextField label="Concepto (opcional)" value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Sesión, bono…" />
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block loading={busy}>
        Guardar el cobro
      </Button>
    </form>
  );
}
