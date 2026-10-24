// Ajustes › Facturas: las facturas del año con sus totales, la comprobación de la numeración y de las huellas, el
// libro de facturas para la gestoría y lo que se propone al hacer una (IVA, exención, retención y la serie de cada
// uno). No es Verifactu: lo dice y remite a la asesoría.
import { Download, Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { bumpData } from "../app/dataVersion";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { euros } from "../data/billing";
import { getDb } from "../data/db";
import {
  checkInvoices,
  getInvoiceSettings,
  mySeriesLetter,
  invoicesCsv,
  KIND_LABELS,
  listInvoices,
  saveInvoiceSettings,
  setSeriesLetter,
  type InvoiceSettings,
} from "../data/invoices";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function SettingsCard({ settings, letter }: { settings: InvoiceSettings; letter: string | null }) {
  const toast = useToast();
  const [draft, setDraft] = useState<InvoiceSettings | null>(null);
  const [series, setSeries] = useState(letter ?? "");
  const [error, setError] = useState<string | null>(null);
  const s = draft ?? settings;
  const save = async () => {
    setError(null);
    try {
      await saveInvoiceSettings(getDb(), s);
      if (series.trim() && series.trim().toUpperCase() !== letter) await setSeriesLetter(getDb(), series);
      setDraft(null);
      bumpData();
      toast("Guardado", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar.");
    }
  };
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Lo que se propone al hacer una factura</h2>
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
      <TextField
        label="Serie de este dispositivo"
        hint={
          letter
            ? "Las facturas que se hacen aquí se numeran en esta serie (más el año). Cada dispositivo tiene la suya: así nunca se repite un número, ni sin conexión. Solo se puede cambiar a una letra que no use nadie más."
            : "Se asigna sola con la primera factura de este dispositivo (A, B, C…). Si prefieres otra, escríbela aquí."
        }
        maxLength={3}
        autoCapitalize="characters"
        value={series}
        onChange={(e) => setSeries(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
      />
      {error && <Alert tone="danger" title={error} />}
      <Button onClick={() => void save()}>Guardar</Button>
    </Card>
  );
}

export function InvoicesPage() {
  const thisYear = Number(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const data = useAsync(async () => {
    const db = getDb();
    const [all, settings, letter] = await Promise.all([listInvoices(db), getInvoiceSettings(db), mySeriesLetter(db)]);
    return { all, settings, letter, problems: await checkInvoices(all) };
  }, []);

  if (data.error) return <Page title="Facturas" backTo="/ajustes"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Facturas" backTo="/ajustes"><Loading /></Page>;
  const { all, settings, letter, problems } = data.data;
  const years = [...new Set([thisYear, ...all.map((i) => Number(i.issuedOn.slice(0, 4)))])].sort((a, b) => b - a);
  const shown = all.filter((i) => i.issuedOn.startsWith(String(year))).sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.code.localeCompare(a.code));
  const sum = (k: "baseCents" | "vatCents" | "irpfCents" | "totalCents") => shown.reduce((n, i) => n + i[k], 0);

  return (
    <Page title="Facturas" backTo="/ajustes">
      <p className="text-text-muted">
        Se hacen desde cada cobro del paciente (Bonos y cobros › Hacer la factura) o aquí, en blanco. Una vez emitida no se cambia: si hay un error, se anula con
        una rectificativa.
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
        <Link
          to="/facturas/nueva"
          className="tap inline-flex items-center gap-2 rounded-md bg-accent px-4 font-semibold text-on-accent hover:bg-accent-hover"
        >
          <Plus aria-hidden="true" className="size-5" />
          Nueva factura
        </Link>
        <Button
          variant="secondary"
          icon={<Download aria-hidden="true" className="size-5" />}
          disabled={!shown.length}
          onClick={() => download(invoicesCsv(shown), `Facturas ${year}.csv`)}
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
                        {i.issuedOn.split("-").reverse().join("/")} · {i.recipient.name || "Sin destinatario"}
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

      <SettingsCard settings={settings} letter={letter} />

      <Card className="flex flex-col gap-2 text-sm">
        <h2 className="text-lg font-semibold">Qué hace y qué no</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          <li>Numera cada factura de forma correlativa dentro de su serie: una por dispositivo y año (A2026, B2026…) y las rectificativas aparte (RA2026…). Así dos dispositivos nunca repiten número, ni sin conexión.</li>
          <li>Guarda cada factura tal como se emitió, con una huella encadenada a la anterior: si alguien la cambia, aquí arriba sale el aviso.</li>
          <li>
            <b>No está adaptada a Verifactu</b> (el registro con el formato de Hacienda, su código QR y el envío a la AEAT). Cuando te toque, habrá que
            adaptarla.
          </li>
          <li>Que la fisioterapia vaya exenta de IVA, si hace falta retención y qué datos del paciente deben salir depende de cada caso: revísalo con tu asesoría antes de empezar a facturar con la app.</li>
        </ul>
      </Card>
    </Page>
  );
}
