// Para facturar › Facturas hechas con la app: las que se hicieron con la app antes del 24-10-2026, en solo lectura
// (src/data/invoices.ts). Por año, con sus totales, la comprobación de la numeración y de las huellas y su libro para
// la gestoría. Las facturas nuevas se hacen con el programa de facturación de la clínica (ToBillPage.tsx).
import { Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { euros } from "../data/billing";
import { getDb } from "../data/db";
import { checkInvoices, invoicesCsv, KIND_LABELS, listInvoices } from "../data/invoices";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField } from "../ui/Field";
import { saveFile } from "../app/download";
import { dayDmy } from "../app/format";

export function IssuedInvoicesPage() {
  const thisYear = Number(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const data = useAsync(async () => {
    const db = getDb();
    const all = await listInvoices(db);
    return { all, problems: await checkInvoices(all) };
  }, []);

  if (data.error) return <Page title="Facturas hechas con la app" backTo="/facturas"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Facturas hechas con la app" backTo="/facturas"><Loading /></Page>;
  const { all, problems } = data.data;
  const years = [...new Set([thisYear, ...all.map((i) => Number(i.issuedOn.slice(0, 4)))])].sort((a, b) => b - a);
  const shown = all.filter((i) => i.issuedOn.startsWith(String(year))).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.code.localeCompare(a.code));
  const sum = (k: "baseCents" | "vatCents" | "irpfCents" | "totalCents") => shown.reduce((n, i) => n + i[k], 0);

  return (
    <Page title="Facturas hechas con la app" backTo="/facturas">
      <p className="text-text-muted">
        Las que se hicieron con la app antes del 24-10-2026. Se quedan tal cual: puedes verlas, imprimirlas y sacar su libro. Si alguna tiene un error, corrígela
        con tu programa de facturación.
      </p>
      {problems.length > 0 ? (
        <Alert tone="danger" title={problems.length === 1 ? "Hay un problema en la numeración" : `Hay ${problems.length} problemas en la numeración`}>
          <ul className="list-disc pl-5">
            {problems.map((p, i) => (
              <li key={i}>{p.problem}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        all.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-success">
            <ShieldCheck aria-hidden="true" className="size-5" />
            Numeración y huellas en orden ({all.length === 1 ? "1 factura" : `${all.length} facturas`}).
          </p>
        )
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          icon={<Download aria-hidden="true" className="size-5" />}
          disabled={!shown.length}
          onClick={() => saveFile(`Facturas ${year}.csv`, invoicesCsv(shown), "text/csv;charset=utf-8")}
        >
          Descargar el libro de {year} (Excel)
        </Button>
      </div>

      <Card className="flex flex-col gap-3">
        <SelectField label="Año" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </SelectField>
        {shown.length === 0 ? (
          <p className="text-text-muted">Sin facturas en {year}.</p>
        ) : (
          <>
            <dl aria-label={`Totales de ${year}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
              <dt>{shown.length === 1 ? "1 factura" : `${shown.length} facturas`} · base imponible</dt>
              <dd className="text-right">{euros(sum("baseCents"))}</dd>
              <dt>IVA</dt>
              <dd className="text-right">{euros(sum("vatCents"))}</dd>
              {sum("irpfCents") !== 0 && (
                <>
                  <dt>Retenciones</dt>
                  <dd className="text-right">−{euros(sum("irpfCents"))}</dd>
                </>
              )}
              <dt className="font-semibold">Total</dt>
              <dd className="text-right font-semibold">{euros(sum("totalCents"))}</dd>
            </dl>
            <ul aria-label={`Facturas de ${year}`} className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {shown.map((i) => (
                <li key={i.id}>
                  <Link to={`/facturas/${i.id}`} className="flex min-h-11 items-center gap-3 px-3 py-2 hover:bg-surface">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {i.code}
                        {i.kind !== "completa" && <span className="font-normal text-text-muted"> · {KIND_LABELS[i.kind].replace("Factura ", "")}</span>}
                      </span>
                      <span className="block truncate text-sm text-text-muted">
                        {dayDmy(i.issuedOn)} · {i.recipient.name || "Sin destinatario"}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{euros(i.totalCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

    </Page>
  );
}
