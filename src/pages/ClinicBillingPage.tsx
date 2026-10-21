// Ajustes → Precios y cobros (src/data/billing.ts): el precio de la sesión suelta, lo cobrado este mes y el anterior
// por forma de pago, y quién tiene algo pendiente (con un toque, su cuenta).
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { collectedBetween, euros, getPricing, methodLabel, parseEuros, pendingAccounts, setPricing } from "../data/billing";
import { getDb } from "../data/db";
import { todayDay } from "../clinical/pageKit";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { NumberField } from "../ui/Field";
import { useToast } from "../ui/Toast";

const monthStart = (d: string, back = 0) => {
  const [y, m] = d.split("-").map(Number) as [number, number];
  const t = new Date(y, m - 1 - back, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-01`;
};
const monthName = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { month: "long" });

export function ClinicBillingPage() {
  const toast = useToast();
  const version = useDataVersion();
  const today = todayDay();
  const data = useAsync(async () => {
    const db = getDb();
    const thisMonth = monthStart(today);
    const [pricing, debtors, now, last] = await Promise.all([
      getPricing(db),
      pendingAccounts(db, today),
      collectedBetween(db, thisMonth, monthStart(today, -1)),
      collectedBetween(db, monthStart(today, 1), thisMonth),
    ]);
    return { pricing, debtors, now, last };
  }, [version, today]);
  /** Lo escrito; null mientras no se toca (se ve el precio guardado). */
  const [typed, setPrice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saved = data.data?.pricing;
  const price = typed ?? (saved?.sessionCents != null ? (saved.sessionCents / 100).toFixed(2).replace(".", ",").replace(/,00$/, "") : "");

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = price.trim() ? parseEuros(price) : null;
    if (price.trim() && cents === null) return setError("No es una cantidad: por ejemplo, 40 o 42,50.");
    // El día desde el que cuentan las sesiones sueltas se fija la primera vez (cambiar el precio no lo mueve).
    await setPricing(getDb(), { sessionCents: cents, since: cents === null ? null : (saved?.since ?? today) });
    setPrice(null);
    bumpData();
    toast(cents === null ? "Sin precio de sesión" : `Sesión suelta: ${euros(cents)}`, "success");
  }

  const d = data.data;
  const pending = d?.debtors.reduce((n, x) => n + x.balanceCents, 0) ?? 0;
  return (
    <Page title="Precios y cobros" backTo="/ajustes">
      <p className="text-sm text-text-muted">
        Bonos, cobros y lo pendiente de cada paciente, en su ficha (Bonos y cobros). Aquí, el precio de la sesión y el resumen de la clínica. No son facturas.
      </p>

      <Card className="flex flex-col gap-3">
        <form className="flex flex-col gap-3" onSubmit={save} noValidate>
          <NumberField
            label="Precio de la sesión suelta"
            unit="€"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            hint={
              saved?.since
                ? `Cuentan para cobrar las sesiones sin bono desde el ${fmtDate(`${saved.since}T12:00:00`)}.`
                : "Las sesiones sin bono contarán para cobrar a partir de hoy (las de antes no)."
            }
          />
          {error && <Alert tone="danger" title={error} />}
          <Button type="submit">Guardar el precio</Button>
        </form>
      </Card>

      {d && (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Tile label={`Cobrado en ${monthName(monthStart(today))}`} value={euros(d.now.totalCents)} detail={d.now.byMethod.map((m) => `${methodLabel(m.method)} ${euros(m.cents)}`).join(" · ") || "Nada todavía"} />
            <Tile label={`Cobrado en ${monthName(monthStart(today, 1))}`} value={euros(d.last.totalCents)} detail={d.last.byMethod.map((m) => `${methodLabel(m.method)} ${euros(m.cents)}`).join(" · ") || "Nada"} />
          </dl>

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
    </Page>
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
