// Ajustes › Para facturar (src/data/toBill.ts): la app no hace facturas. Aquí están los cobros de cada mes con lo que
// pide la factura del paciente, para hacerla con el programa de facturación de la clínica (el suyo, el de la gestoría o
// el gratuito de Hacienda), que es quien la numera y cumple Verifactu. Se descargan en Excel y, en cada cobro, se puede
// apuntar el número que le dio ese programa para saber qué falta. Las facturas que se hicieron con la app antes siguen
// en «Facturas hechas con la app», en solo lectura.
import { Download, FileText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { todayDay } from "../clinical/pageKit";
import { euros, methodLabel } from "../data/billing";
import { getDb } from "../data/db";
import { listInvoices } from "../data/invoices";
import { conceptOf, getBillingDefaults, saveBillingDefaults, toBillBetween, toBillSheet, type BillingDefaults, type ToBill } from "../data/toBill";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextField } from "../ui/Field";
import { Group, RowLink } from "../ui/Grouped";
import { useToast } from "../ui/Toast";
import { InvoiceRefSheet, type RefTarget } from "./InvoiceRefSheet";
import { saveFile } from "../app/download";
import { dayDmy, monthStart } from "../app/format";

const monthYear = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { month: "long", year: "numeric" });

async function downloadXlsx(rows: ToBill[], defaults: BillingDefaults, month: string) {
  const { writeXlsx } = await import("../export/files");
  const bytes = await writeXlsx([toBillSheet(rows, defaults)]);
  saveFile(`Cobros ${month.slice(0, 7)}.xlsx`, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function DefaultsCard({ defaults }: { defaults: BillingDefaults }) {
  const toast = useToast();
  const [draft, setDraft] = useState<BillingDefaults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const s = draft ?? defaults;
  const save = async () => {
    setError(null);
    try {
      await saveBillingDefaults(getDb(), s);
      setDraft(null);
      bumpData();
      toast("Guardado", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar.");
    }
  };
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Lo que va en el Excel sobre el IVA</h2>
      <p className="text-sm text-text-muted">Para que tu programa lo tenga a mano. Lo que corresponde en cada caso lo decide tu asesoría.</p>
      <SelectField label="IVA" value={String(s.vatRate)} onChange={(e) => setDraft({ ...s, vatRate: Number(e.target.value) })}>
        {[0, 21, 10, 4].map((r) => (
          <option key={r} value={r}>
            {r === 0 ? "Exenta de IVA" : `${r} %`}
          </option>
        ))}
      </SelectField>
      {s.vatRate === 0 && <TextField label="Motivo de la exención" value={s.exemption} onChange={(e) => setDraft({ ...s, exemption: e.target.value })} />}
      <SelectField label="Retención de IRPF" value={String(s.irpfRate)} onChange={(e) => setDraft({ ...s, irpfRate: Number(e.target.value) })}>
        {[0, 7, 15].map((r) => (
          <option key={r} value={r}>
            {r === 0 ? "Sin retención" : `${r} %`}
          </option>
        ))}
      </SelectField>
      {error && <Alert tone="danger" title={error} />}
      {draft && <Button onClick={() => void save()}>Guardar</Button>}
    </Card>
  );
}

export function ToBillPage() {
  const today = todayDay();
  const version = useDataVersion();
  const toast = useToast();
  const [month, setMonth] = useState(monthStart(today));
  const [onlyPending, setOnlyPending] = useState(false);
  const [target, setTarget] = useState<RefTarget | null>(null);
  const [downloading, setDownloading] = useState(false);
  const data = useAsync(async () => {
    const db = getDb();
    const [y, m] = month.split("-").map(Number) as [number, number];
    const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const [rows, defaults, made] = await Promise.all([toBillBetween(db, month, to), getBillingDefaults(db), listInvoices(db)]);
    return { rows, defaults, made: made.length };
  }, [month, version]);

  if (data.error) return <Page title="Para facturar" backTo="/ajustes"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Para facturar" backTo="/ajustes"><Loading /></Page>;
  const { rows, defaults, made } = data.data;
  const pending = rows.filter((r) => !r.invoice);
  const shown = onlyPending ? pending : rows;
  const total = shown.reduce((n, r) => n + r.amountCents, 0);
  const months = Array.from({ length: 13 }, (_, i) => monthStart(today, i));

  const download = async () => {
    setDownloading(true);
    try {
      await downloadXlsx(shown, defaults, month);
      toast(shown.length ? `${shown.length === 1 ? "1 cobro" : `${shown.length} cobros`} de ${monthYear(month)}` : `Sin cobros en ${monthYear(month)}`, "success");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Page title="Para facturar" backTo="/ajustes">
      <p className="text-text-muted">
        La app no hace facturas. Aquí tienes los cobros de cada mes con los datos del paciente, para hacerlas con tu programa de facturación (el tuyo, el de
        tu gestoría o el gratuito de Hacienda): es el que las numera y cumple Verifactu.
      </p>

      <Card className="flex flex-col gap-3">
        <SelectField label="Mes" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthYear(m)}
            </option>
          ))}
        </SelectField>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="size-5 accent-accent" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          <span>Solo los que faltan por facturar ({pending.length})</span>
        </label>
        <p className="font-semibold tabular-nums">
          {shown.length === 1 ? "1 cobro" : `${shown.length} cobros`} · {euros(total)}
        </p>
        <Button variant="secondary" loading={downloading} icon={<Download aria-hidden="true" className="size-5" />} onClick={() => void download()}>
          Descargar en Excel
        </Button>
      </Card>

      {shown.length === 0 ? (
        <p className="text-text-muted">{rows.length ? "Todos los cobros de este mes tienen su factura." : `Sin cobros en ${monthYear(month)}.`}</p>
      ) : (
        <ul aria-label={`Cobros de ${monthYear(month)}`} className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-col gap-1 px-3 py-2">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <Link to={`/pacientes/${r.patientId}/cobros`} className="block truncate font-semibold text-accent">
                    {r.name}
                  </Link>
                  <span className="block text-sm text-text-muted">
                    {dayDmy(r.paidOn)} · {conceptOf(r)} · {methodLabel(r.method)}
                  </span>
                  {!r.dni && <span className="block text-sm text-warning">Sin DNI en su ficha</span>}
                </span>
                <span className="font-semibold tabular-nums">{euros(r.amountCents)}</span>
              </div>
              {r.appInvoiceId ? (
                <Link to={`/facturas/${r.appInvoiceId}`} className="tap inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent">
                  <FileText aria-hidden="true" className="size-4" /> Factura {r.invoice} (hecha con la app)
                </Link>
              ) : (
                <button
                  type="button"
                  className="tap inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent"
                  aria-label={r.invoice ? `Factura ${r.invoice} del cobro de ${r.name}: cambiar` : `Apuntar nº de factura del cobro de ${r.name} del ${dayDmy(r.paidOn)}`}
                  onClick={() => setTarget({ id: r.id, amountCents: r.amountCents, paidOn: r.paidOn, invoiceRef: r.invoiceRef, name: r.name })}
                >
                  <FileText aria-hidden="true" className="size-4" /> {r.invoice ? `Factura ${r.invoice}` : "Apuntar nº de factura"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <DefaultsCard key={JSON.stringify(defaults)} defaults={defaults} />

      <InvoiceRefSheet target={target} onClose={() => setTarget(null)} />

      {made > 0 && (
        <Group>
          <RowLink
            to="/facturas/emitidas"
            icon={FileText}
            title="Facturas hechas con la app"
            subtitle={`${made === 1 ? "1 factura" : `${made} facturas`} de antes del 24-10-2026, para verlas, imprimirlas o sacar su libro`}
          />
        </Group>
      )}
    </Page>
  );
}
