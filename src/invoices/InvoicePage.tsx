// Una factura emitida (src/data/invoices.ts), lista para imprimir, guardar en PDF o mandar a Drive. No se cambia: si
// tiene un error, «Anular con una rectificativa» emite la rectificativa con su motivo (y después se puede hacer otra
// factura bien hecha desde el mismo cobro o en blanco).
import { Printer, Undo2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { bumpData } from "../app/dataVersion";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { TextArea } from "../clinical/parts";
import { todayDay } from "../clinical/pageKit";
import { SharePdf } from "../clinical/SharePdf";
import { DriveSaveButton } from "../cloud/DriveSaveButton";
import { safeName } from "../cloud/saveToDrive";
import { euros } from "../data/billing";
import { getDb } from "../data/db";
import { getInvoice, KIND_LABELS, rectificationOf, rectifyInvoice, type Party } from "../data/invoices";
import { memberEmail } from "../data/member";
import { getClinic } from "../data/privacy";
import { Alert } from "../ui/Alert";
import { TopBar } from "../ui/AppBar";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { issuerOf } from "./issuer";

const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

function PartyBlock({ title, party }: { title: string; party: Party }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">{title}</span>
      <span className="font-semibold">{party.name || "—"}</span>
      {party.taxId && <span>NIF {party.taxId}</span>}
      {party.address && <span>{party.address}</span>}
    </div>
  );
}

export function InvoicePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const data = useAsync(async () => {
    const db = getDb();
    const invoice = await getInvoice(db, id);
    const [rectification, original, clinic] = await Promise.all([
      invoice ? rectificationOf(db, invoice.id) : Promise.resolve(null),
      invoice?.rectifiesId ? getInvoice(db, invoice.rectifiesId) : Promise.resolve(null),
      getClinic(db),
    ]);
    return { invoice, rectification, original, clinic };
  }, [id]);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const article = useRef<HTMLElement>(null);

  const bar = (
    <div className="print:hidden">
      <TopBar title="Factura" backTo="/facturas" />
    </div>
  );
  const shell = (body: ReactNode) => (
    <>
      {bar}
      <main className="mx-auto max-w-3xl p-4">{body}</main>
    </>
  );
  if (data.error) return shell(<LoadError error={data.error} />);
  if (!data.data) return shell(<Loading />);
  const { invoice: inv, rectification, original, clinic } = data.data;
  if (!inv) return shell(<LoadError error={new Error("Esta factura no existe.")} />);

  const fileName = safeName(`Factura ${inv.code}.pdf`);
  async function pdf() {
    const { reportPdf } = await import("../clinical/reportPdf");
    return reportPdf(article.current!);
  }
  const rectify = async () => {
    setError(null);
    setSaving(true);
    try {
      const r = await rectifyInvoice(getDb(), inv.id, reason, issuerOf(clinic), memberEmail() ?? "", todayDay());
      bumpData();
      toast(`Rectificativa ${r.code} emitida`, "success");
      setAsking(false);
      navigate(`/facturas/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido emitir la rectificativa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 18mm 18mm 20mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4 print:hidden">
          {rectification && (
            <Alert tone="warning" title={`Anulada con la rectificativa ${rectification.code}`}>
              <Link className="font-semibold text-accent underline" to={`/facturas/${rectification.id}`}>
                Ver la rectificativa
              </Link>
            </Alert>
          )}
          {original && (
            <p>
              Rectifica la factura{" "}
              <Link className="font-semibold text-accent underline" to={`/facturas/${original.id}`}>
                {original.code}
              </Link>
              .
            </p>
          )}
          <Button size="lg" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
            Imprimir
          </Button>
          <SharePdf make={pdf} fileName={fileName} title={`Factura ${inv.code}`} />
          <DriveSaveButton label="Guardar en mi Drive (PDF)" make={async () => ({ name: fileName, mimeType: "application/pdf", bytes: await pdf() })} />
          {inv.patientId && (
            <Link className="tap inline-flex items-center font-semibold text-accent" to={`/pacientes/${inv.patientId}/cobros`}>
              Ir a los cobros del paciente
            </Link>
          )}
          {inv.kind !== "rectificativa" && !rectification && (
            <Button variant="secondary" icon={<Undo2 aria-hidden="true" className="size-5" />} onClick={() => setAsking(true)}>
              Anular con una rectificativa
            </Button>
          )}
        </div>

        <article
          ref={article}
          aria-label={`Factura ${inv.code}`}
          className="theme-light flex flex-col gap-6 rounded-lg border border-border bg-white p-8 text-base leading-relaxed text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-3">
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-brand-ink" style={{ fontFamily: "var(--font-display)" }}>
                {KIND_LABELS[inv.kind]}
              </span>
              <span>
                Nº <b>{inv.code}</b>
              </span>
              <span className="text-sm text-text-muted">Fecha: {longDay(inv.issuedOn)}</span>
              {inv.operationOn && <span className="text-sm text-text-muted">Fecha del servicio: {longDay(inv.operationOn)}</span>}
            </div>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <PartyBlock title="Emisor" party={inv.issuer} />
            {(inv.recipient.name || inv.recipient.taxId) && <PartyBlock title="Destinatario" party={inv.recipient} />}
          </div>
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">Conceptos</caption>
            <thead className="border-b border-border text-sm text-text-muted">
              <tr>
                <th scope="col" className="py-1 font-semibold">
                  Concepto
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Uds.
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Precio
                </th>
                <th scope="col" className="py-1 text-right font-semibold">
                  Importe
                </th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="py-1.5 pr-2">{l.concept}</td>
                  <td className="py-1.5 text-right">{l.qty}</td>
                  <td className="py-1.5 text-right">{euros(l.unitCents)}</td>
                  <td className="py-1.5 text-right">{euros(l.qty * l.unitCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 tabular-nums">
            <dt>Base imponible</dt>
            <dd className="text-right">{euros(inv.baseCents)}</dd>
            <dt>{inv.vatRate === 0 ? "IVA" : `IVA (${inv.vatRate} %)`}</dt>
            <dd className="text-right">{inv.vatRate === 0 ? "Exenta" : euros(inv.vatCents)}</dd>
            {inv.irpfRate > 0 && (
              <>
                <dt>Retención IRPF ({inv.irpfRate} %)</dt>
                <dd className="text-right">−{euros(inv.irpfCents)}</dd>
              </>
            )}
            <dt className="font-semibold">Total</dt>
            <dd className="text-right font-semibold">{euros(inv.totalCents)}</dd>
          </dl>
          {inv.exemption && <p className="text-sm">{inv.exemption.replace(/\.$/, "")}.</p>}
          {inv.reason && <p className="text-sm">{inv.reason.replace(/\.$/, "")}.</p>}
          <p className="text-xs break-all text-text-muted">Código de control: {inv.hash.slice(0, 16)}</p>
        </article>
      </main>

      <Sheet open={asking} onClose={() => setAsking(false)} title="Anular con una rectificativa">
        <div className="flex flex-col gap-3">
          <p>
            Se emite una factura rectificativa con los mismos importes en negativo que anula la {inv.code}. Después, si hace falta, haz otra factura bien hecha.
          </p>
          <TextArea label="Motivo" hint="Por ejemplo: «error en los datos del destinatario» o «la sesión no se hizo»." value={reason} onChange={setReason} />
          {error && <Alert tone="danger" title={error} />}
          <Button size="lg" block loading={saving} onClick={() => void rectify()}>
            Emitir la rectificativa
          </Button>
          <Button variant="secondary" block onClick={() => setAsking(false)}>
            No anularla
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
