// Nueva factura (src/data/invoices.ts): desde un cobro (lo trae ya escrito: el paciente, el concepto y lo cobrado) o
// en blanco, por ejemplo para una mutua o una empresa. Al emitirla recibe el siguiente número de la serie de quien la
// hace y ya no se puede cambiar: por eso se repasa antes en una hoja.
import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { bumpData } from "../app/dataVersion";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { centsText } from "../clinical/billingForms";
import { todayDay } from "../clinical/pageKit";
import { euros, getPayment, parseEuros } from "../data/billing";
import { getDb } from "../data/db";
import { getInvoiceSettings, getSeriesMap, invoiceProblem, issueInvoice, totalsOf, type InvoiceInput, type InvoiceLine } from "../data/invoices";
import { memberEmail } from "../data/member";
import { getClinic } from "../data/privacy";
import { getPatient } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { issuerOf } from "./issuer";

/** Una línea mientras se escribe: el precio como texto («45», «45,50»). */
type DraftLine = { concept: string; qty: string; price: string };
const VAT_RATES = [0, 21, 10, 4];
const IRPF_RATES = [0, 7, 15];

export function InvoiceFormPage() {
  const [params] = useSearchParams();
  const patientId = params.get("paciente");
  const paymentId = params.get("cobro");
  const navigate = useNavigate();
  const toast = useToast();
  const today = todayDay();
  const who = memberEmail() ?? "";
  const loaded = useAsync(async () => {
    const db = getDb();
    const [clinic, settings, patient, payment, series] = await Promise.all([
      getClinic(db),
      getInvoiceSettings(db),
      patientId ? getPatient(db, patientId) : Promise.resolve(null),
      paymentId ? getPayment(db, paymentId) : Promise.resolve(null),
      getSeriesMap(db),
    ]);
    return { clinic, settings, patient, payment, letter: series[who] ?? null };
  }, [patientId, paymentId]);
  const [draft, setDraft] = useState<{
    kind: InvoiceInput["kind"];
    issuedOn: string;
    operationOn: string;
    name: string;
    taxId: string;
    address: string;
    lines: DraftLine[];
    vatRate: number;
    exemption: string;
    irpfRate: number;
  } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loaded.error) return <Page title="Nueva factura" backTo="/facturas"><LoadError error={loaded.error} /></Page>;
  if (!loaded.data) return <Page title="Nueva factura" backTo="/facturas"><Loading /></Page>;
  const { clinic, settings, patient, payment, letter } = loaded.data;
  const backTo = patientId ? `/pacientes/${patientId}/cobros` : "/facturas";

  // Lo que se propone al abrir: lo del paciente y lo del cobro. El precio va sin IVA: si hay IVA, se saca de lo cobrado.
  const d = draft ?? {
    kind: "completa" as const,
    issuedOn: today,
    operationOn: payment && payment.paidOn !== today ? payment.paidOn : "",
    name: patient?.name ?? "",
    taxId: patient?.dni ?? "",
    address: patient?.address ?? "",
    lines: [
      {
        concept: payment?.concept.trim() || "Sesión de fisioterapia",
        qty: "1",
        price: payment ? centsText(Math.round(payment.amountCents / (1 + settings.vatRate / 100))) : "",
      },
    ],
    vatRate: settings.vatRate,
    exemption: settings.exemption,
    irpfRate: settings.irpfRate,
  };
  const set = (p: Partial<typeof d>) => {
    setDraft({ ...d, ...p });
    setError(null);
  };
  const setLine = (i: number, p: Partial<DraftLine>) => set({ lines: d.lines.map((l, j) => (j === i ? { ...l, ...p } : l)) });

  const lines: InvoiceLine[] = d.lines.map((l) => ({ concept: l.concept, qty: Number(l.qty), unitCents: parseEuros(l.price) ?? 0 }));
  const input: InvoiceInput = {
    kind: d.kind,
    issuedOn: d.issuedOn,
    operationOn: d.operationOn || null,
    patientId,
    paymentId,
    recipient: { name: d.name, taxId: d.taxId, address: d.address },
    lines,
    vatRate: d.vatRate,
    exemption: d.exemption,
    irpfRate: d.irpfRate,
  };
  const issuer = issuerOf(clinic);
  const t = totalsOf(lines, d.vatRate, d.irpfRate);

  const review = () => {
    const problem = invoiceProblem(input, issuer, today);
    if (problem) return setError(problem);
    setConfirming(true);
  };
  const issue = async () => {
    setSaving(true);
    try {
      const inv = await issueInvoice(getDb(), input, issuer, who, today);
      bumpData();
      toast(`Factura ${inv.code} emitida`, "success");
      navigate(`/facturas/${inv.id}`, { replace: true });
    } catch (e) {
      setConfirming(false);
      setError(e instanceof Error ? e.message : "No se ha podido emitir la factura.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Nueva factura" backTo={backTo}>
      {!issuer.name || !issuer.taxId ? (
        <Alert tone="warning" title="Faltan los datos de la clínica">
          Para facturar hacen falta el nombre (o razón social) y el NIF de la clínica, y conviene el domicilio: rellénalos en Ajustes › Clínica y protección de
          datos.
        </Alert>
      ) : null}
      {payment && (
        <p className="text-text-muted">
          Del cobro de {euros(payment.amountCents)} del {payment.paidOn.split("-").reverse().join("/")}.
        </p>
      )}

      <Card className="flex flex-col gap-3">
        <SelectField label="Tipo de factura" value={d.kind} onChange={(e) => set({ kind: e.target.value as InvoiceInput["kind"] })}>
          <option value="completa">Completa (con los datos de quien la recibe)</option>
          <option value="simplificada">Simplificada (hasta 400 €)</option>
        </SelectField>
        <TextField label="Fecha de la factura" type="date" max={today} value={d.issuedOn} onChange={(e) => set({ issuedOn: e.target.value })} />
        <TextField
          label="Fecha del servicio (si es otro día)"
          type="date"
          max={today}
          value={d.operationOn}
          onChange={(e) => set({ operationOn: e.target.value })}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">A quién</h2>
        <TextField label={d.kind === "simplificada" ? "Nombre o razón social (si quieres)" : "Nombre o razón social"} value={d.name} onChange={(e) => set({ name: e.target.value })} />
        <TextField label="NIF, DNI o NIE" autoCapitalize="characters" value={d.taxId} onChange={(e) => set({ taxId: e.target.value })} />
        <TextField label="Domicilio" autoComplete="street-address" value={d.address} onChange={(e) => set({ address: e.target.value })} />
        <p className="text-sm text-text-muted">Qué datos de quien la recibe tienen que salir depende del caso (paciente, empresa, mutua): confírmalo con tu asesoría.</p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Qué se factura</h2>
        {d.lines.map((l, i) => (
          <fieldset key={i} className="flex flex-col gap-2 border-b border-border pb-3 last:border-b-0">
            <legend className="sr-only">Línea {i + 1}</legend>
            <TextField label={`Concepto ${d.lines.length > 1 ? i + 1 : ""}`.trim()} value={l.concept} onChange={(e) => setLine(i, { concept: e.target.value })} />
            <div className="flex items-end gap-2">
              <div className="w-24 shrink-0">
                <TextField label="Unidades" inputMode="numeric" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value.replace(/\D/g, "") })} />
              </div>
              <div className="min-w-0 flex-1">
                <TextField label="Precio sin IVA (€)" inputMode="decimal" value={l.price} onChange={(e) => setLine(i, { price: e.target.value })} />
              </div>
              {d.lines.length > 1 && (
                <IconButton label={`Quitar la línea ${i + 1}`} onClick={() => set({ lines: d.lines.filter((_, j) => j !== i) })}>
                  <Trash2 aria-hidden="true" className="size-5" />
                </IconButton>
              )}
            </div>
          </fieldset>
        ))}
        <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => set({ lines: [...d.lines, { concept: "", qty: "1", price: "" }] })}>
          Añadir una línea
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Impuestos</h2>
        <SelectField label="IVA" value={String(d.vatRate)} onChange={(e) => set({ vatRate: Number(e.target.value) })}>
          {VAT_RATES.map((r) => (
            <option key={r} value={r}>
              {r === 0 ? "Exenta de IVA" : `${r} %`}
            </option>
          ))}
        </SelectField>
        {d.vatRate === 0 && <TextField label="Motivo de la exención" value={d.exemption} onChange={(e) => set({ exemption: e.target.value })} />}
        <SelectField label="Retención de IRPF" hint="Solo si la factura es para una empresa o profesional que tenga que retener." value={String(d.irpfRate)} onChange={(e) => set({ irpfRate: Number(e.target.value) })}>
          {IRPF_RATES.map((r) => (
            <option key={r} value={r}>
              {r === 0 ? "Sin retención" : `${r} %`}
            </option>
          ))}
        </SelectField>
        <dl aria-label="Importes" className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
          <dt>Base imponible</dt>
          <dd className="text-right">{euros(t.baseCents)}</dd>
          <dt>{d.vatRate === 0 ? "IVA (exenta)" : `IVA (${d.vatRate} %)`}</dt>
          <dd className="text-right">{euros(t.vatCents)}</dd>
          {d.irpfRate > 0 && (
            <>
              <dt>Retención IRPF ({d.irpfRate} %)</dt>
              <dd className="text-right">−{euros(t.irpfCents)}</dd>
            </>
          )}
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{euros(t.totalCents)}</dd>
        </dl>
      </Card>

      {error && <Alert tone="danger" title={error} />}
      <Button size="lg" block icon={<ReceiptText aria-hidden="true" className="size-5" />} onClick={review}>
        Revisar y emitir
      </Button>

      <Sheet open={confirming} onClose={() => setConfirming(false)} title="¿Emitir la factura?">
        <div className="flex flex-col gap-3">
          <p>
            {d.kind === "simplificada" ? "Factura simplificada" : "Factura"} de <b>{euros(t.totalCents)}</b>
            {d.name.trim() ? ` a ${d.name.trim()}` : ""}, con fecha {d.issuedOn.split("-").reverse().join("/")}.
          </p>
          <p>
            Lleva el siguiente número de {letter ? `tu serie ${letter}${d.issuedOn.slice(0, 4)}` : "tu serie (se te asigna una letra la primera vez)"}. Una vez
            emitida no se puede cambiar ni borrar: si hay un error, se anula con una factura rectificativa.
          </p>
          <Button size="lg" block loading={saving} onClick={() => void issue()}>
            Emitir la factura
          </Button>
          <Button variant="secondary" block onClick={() => setConfirming(false)}>
            Seguir revisando
          </Button>
        </div>
      </Sheet>
    </Page>
  );
}
