// Justificante de pago de un cobro (src/data/billing.ts): quién pagó, cuánto (en número y en letra), cuándo, por qué y
// cómo. Lo pide el paciente para su seguro o su empresa. No es una factura y lo dice. El DNI se escribe aquí y no se
// guarda. Se imprime, se guarda en PDF o va a Drive.
import { Download, Printer } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router";
import { fmtDate } from "../app/format";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { DriveSaveButton } from "../cloud/DriveSaveButton";
import { safeName } from "../cloud/saveToDrive";
import { euros, eurosInWords, getPayment, methodLabel } from "../data/billing";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { getPatient } from "../data/repo";
import { TopBar } from "../ui/AppBar";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { Letterhead, SignatureLine } from "./reportParts";

const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

export function ReceiptPage() {
  const { id = "", pid = "" } = useParams();
  const toast = useToast();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, clinic, payment] = await Promise.all([getPatient(db, id), getClinic(db), getPayment(db, pid)]);
    return { patient, clinic, payment };
  }, [id, pid]);
  const [idDoc, setIdDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const article = useRef<HTMLElement>(null);

  const bar = (
    <div className="print:hidden">
      <TopBar title="Justificante de pago" backTo={`/pacientes/${id}/cobros`} />
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
  const { patient, clinic, payment } = data.data;
  if (!patient || !payment || payment.patientId !== id) return shell(<LoadError error={new Error("Este cobro no existe.")} />);

  const physio = clinic.professional;
  const issuer = clinic.name || physio;
  const fileName = safeName(`Justificante de pago ${patient.name} ${payment.paidOn}.pdf`);
  async function pdf() {
    const { reportPdf } = await import("./reportPdf");
    return reportPdf(article.current!);
  }

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 18mm 18mm 20mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <form className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4 print:hidden" onSubmit={(e) => e.preventDefault()}>
          <TextField label="DNI o NIE del paciente (opcional)" value={idDoc} onChange={(e) => setIdDoc(e.target.value)} hint="Sale en el justificante; no se guarda." />
          {!issuer && <p className="text-sm text-warning">Faltan los datos de la clínica: rellénalos en Ajustes → Clínica para que salgan en el justificante.</p>}
          <Button size="lg" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button
            variant="secondary"
            loading={busy}
            icon={<Download aria-hidden="true" className="size-5" />}
            onClick={async () => {
              setBusy(true);
              try {
                const bytes = await pdf();
                const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e), "danger");
              } finally {
                setBusy(false);
              }
            }}
          >
            Descargar en PDF
          </Button>
          <DriveSaveButton label="Guardar en mi Drive (PDF)" make={async () => ({ name: fileName, mimeType: "application/pdf", bytes: await pdf() })} />
        </form>

        <article
          ref={article}
          aria-label="Justificante de pago"
          className="flex flex-col gap-6 rounded-lg border border-border bg-white p-8 text-base leading-relaxed text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <Letterhead clinic={clinic} title="Justificante de pago" subtitle={fmtDate(new Date().toISOString())} />
          <p>
            {issuer ? <b>{issuer}</b> : "La clínica"}
            {clinic.taxId ? `, con NIF ${clinic.taxId},` : ""} ha recibido de <b>{patient.name}</b>
            {idDoc.trim() ? `, con DNI/NIE ${idDoc.trim()},` : ""} la cantidad de <b>{euros(payment.amountCents)}</b> ({eurosInWords(payment.amountCents)}) el{" "}
            <b>{longDay(payment.paidOn)}</b>, en concepto de {payment.concept.trim() || "servicios de fisioterapia"}.
          </p>
          <p>Forma de pago: {methodLabel(payment.method).toLowerCase()}.</p>
          <p className="text-sm text-text-muted">Este documento justifica el pago y no es una factura.</p>
          <SignatureLine name={physio} license={clinic.license} date={fmtDate(new Date().toISOString())} />
        </article>
      </main>
    </div>
  );
}
