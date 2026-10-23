// Ficha → Bonos y cobros (src/data/billing.ts): lo que el paciente tiene pendiente, sus bonos (cuántas sesiones le
// quedan) y lo que ha pagado. Vender un bono y cobrar, en una hoja. No son facturas.
import { FileText, Pencil, Plus, RotateCw, Trash, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { addPayment, createPack, deletePack, deletePayment, euros, getPackPresets, getPricing, methodLabel, parseEuros, patientAccount, setSessionPrice, updatePack, type PackState, type Payment } from "../data/billing";
import { getDb } from "../data/db";
import { getPatient } from "../data/repo";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { Sheet } from "../ui/Sheet";
import { TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { PackForm, PaymentForm } from "./billingForms";
import { todayDay } from "./pageKit";

const day = (d: string) => fmtDate(`${d}T12:00:00`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Cuántos meses duraba un bono (para renovarlo igual); null si no caducaba. */
const monthsOf = (p: PackState) => (p.expiresOn ? Math.max(1, Math.round((Date.parse(p.expiresOn) - Date.parse(p.boughtOn)) / (30.44 * 86_400_000))) : null);

export function BillingPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const version = useDataVersion();
  const today = todayDay();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, account, pricing, presets] = await Promise.all([getPatient(db, id), patientAccount(db, id, today), getPricing(db), getPackPresets(db)]);
    return { patient, account, pricing, presets };
  }, [id, version, today]);
  const [sheet, setSheet] = useState<"pack" | "payment" | null>(null);
  /** El bono que se cambia (corregir un dato) o el que se renueva (uno igual desde hoy). */
  const [editing, setEditing] = useState<PackState | null>(null);
  const [renewing, setRenewing] = useState<PackState | null>(null);
  const [dropping, setDropping] = useState<{ kind: "pack"; item: PackState } | { kind: "payment"; item: Payment } | null>(null);

  if (data.error) return <Page title="Bonos y cobros" backTo={`/pacientes/${id}`}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Bonos y cobros" backTo={`/pacientes/${id}`}><Loading /></Page>;
  const { patient, account: a, pricing, presets } = data.data;
  if (!patient) return <Page title="Bonos y cobros" backTo="/"><LoadError error={new Error("Este paciente no existe.")} /></Page>;
  const packsCents = a.packs.reduce((n, p) => n + (p.priceCents ?? 0), 0);
  // Sin precio de la sesión nunca puesto, las sueltas no cuentan: «Al día» engañaría.
  const unpriced = pricing.sessionCents === null && pricing.since === null;

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
          {a.balanceCents === 0 ? (unpriced && packsCents === 0 ? "Sin precio de sesión" : "Al día") : euros(Math.abs(a.balanceCents))}
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
        {a.balanceCents > 0 && (
          <Button className="mt-1 self-start" icon={<Wallet aria-hidden="true" className="size-5" />} onClick={() => setSheet("payment")}>
            Cobrar {euros(a.balanceCents)}
          </Button>
        )}
      </Card>
      {pricing.sessionCents === null && (unpriced ? <SessionPriceInline today={today} /> : (
        <p className="text-sm text-text-muted">
          Las sesiones sin bono no cuentan: pon el precio de la sesión en{" "}
          <Link to="/ajustes/cobros" className="font-semibold text-accent">
            Ajustes → Precios y cobros
          </Link>
          .
        </p>
      ))}

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
            <div className="flex flex-wrap gap-1">
              {(p.left <= 1 || p.expired) && (
                <Button size="sm" variant="secondary" icon={<RotateCw aria-hidden="true" className="size-4" />} onClick={() => setRenewing(p)}>
                  Renovar
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<Pencil aria-hidden="true" className="size-4" />} onClick={() => setEditing(p)}>
                Cambiar
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => setDropping({ kind: "pack", item: p })}>
                Borrar
              </Button>
            </div>
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
                <Link
                  to={`/pacientes/${id}/recibo/${p.id}`}
                  aria-label={`Recibo del cobro de ${euros(p.amountCents)} del ${day(p.paidOn)}`}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-semibold text-accent hover:bg-surface"
                >
                  <FileText aria-hidden="true" className="size-5" /> Recibo
                </Link>
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
          Cobrar
        </Button>
      </section>
      <p className="text-sm text-text-muted">Es un registro de lo cobrado para llevar las cuentas de la consulta. No sustituye a las facturas.</p>

      <Sheet open={sheet === "pack" || !!renewing} onClose={() => (setSheet(null), setRenewing(null))} title={renewing ? `Renovar «${renewing.title}»` : "Vender un bono"}>
        {(sheet === "pack" || renewing) && (
          <PackForm
            today={today}
            sessionCents={pricing.sessionCents}
            // Renovar: el mismo bono, desde hoy (con su precio y su duración).
            presets={renewing ? [{ id: "renovar", title: renewing.title, sessions: renewing.sessions, priceCents: renewing.priceCents, months: monthsOf(renewing) }, ...presets] : presets}
            onSave={async (input, paid) => {
              await createPack(getDb(), id, input, paid);
              setSheet(null);
              setRenewing(null);
              bumpData();
              toast(paid && input.priceCents ? "Bono vendido y cobrado" : "Bono vendido", "success");
            }}
          />
        )}
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Cambiar el bono">
        {editing && (
          <PackForm
            today={today}
            sessionCents={pricing.sessionCents}
            initial={editing}
            onSave={async (input) => {
              await updatePack(getDb(), editing.id, input);
              setEditing(null);
              bumpData();
              toast("Bono cambiado", "success");
            }}
          />
        )}
      </Sheet>
      <Sheet open={sheet === "payment"} onClose={() => setSheet(null)} title="Cobrar">
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

/** El precio de la sesión suelta, aquí mismo, la primera vez (después se cambia en Ajustes → Precios y cobros). */
function SessionPriceInline({ today }: { today: string }) {
  const toast = useToast();
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const cents = parseEuros(price);
    if (cents === null) return setError("Escribe el precio, por ejemplo 40.");
    await setSessionPrice(getDb(), cents, today);
    bumpData();
    toast(`Precio de la sesión: ${euros(cents)}`, "success");
  };
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-sm">
        Aún no has puesto el precio de la sesión, así que las sesiones sin bono no cuentan como pendientes. Ponlo aquí: vale desde hoy para todos los
        pacientes (lo cambias cuando quieras en{" "}
        <Link to="/ajustes/cobros" className="font-semibold text-accent">
          Ajustes → Precios y cobros
        </Link>
        ).
      </p>
      <div className="flex items-end gap-2">
        <TextField label="Precio de la sesión (€)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} error={error ?? undefined} />
        <Button onClick={() => void save()}>Guardar</Button>
      </div>
    </Card>
  );
}
