// «Tus próximas citas» en papel: la hoja que se le da al paciente en la consulta con sus citas pendientes (día, hora y,
// en una clínica, con quién). Sale de su calendario (Ficha › Calendario). Solo citas: nada de su salud. Se imprime o
// se guarda en PDF. Para mandárselas por WhatsApp o correo está «Sus próximas citas» en su calendario.
import { Printer } from "lucide-react";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import { fmtDate } from "../app/format";
import { safeName } from "../app/download";
import { useAsync } from "../app/useAsync";
import { appointmentsOf } from "../data/appointments";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { getPatient } from "../data/repo";
import { firstName } from "../messages/templates";
import { sheetRows, SHEET_MAX } from "../schedule/upcoming";
import { staffName, useStaff } from "../schedule/useStaff";
import { TopBar } from "../ui/AppBar";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Guard } from "./pageKit";
import { Letterhead } from "./reportParts";
import { SharePdf } from "./SharePdf";

export function UpcomingSheetPage() {
  const { id = "" } = useParams();
  const staff = useStaff();
  const data = useAsync(
    async () => {
      const db = getDb();
      const [patient, clinic, appointments] = await Promise.all([getPatient(db, id), getClinic(db), appointmentsOf(db, id)]);
      return { patient, clinic, appointments };
    },
    [id],
    { tables: ["patients", "appointments", "settings"] },
  );
  const article = useRef<HTMLElement>(null);
  /** La hora al abrir la hoja: para la lista y para la fecha del pie. */
  const [now] = useState(() => new Date());
  if (!data.data) return <Guard state={data} title="Próximas citas" back={`/pacientes/${id}/calendario`} />;
  const { patient, clinic, appointments } = data.data;
  const bar = (
    <div className="print:hidden">
      <TopBar title="Próximas citas" backTo={`/pacientes/${id}/calendario`} />
    </div>
  );
  if (!patient) return <Guard state={{ ...data, error: new Error("Este paciente no existe.") }} title="Próximas citas" back="/pacientes" />;

  const team = staff.length > 0;
  const { rows, more } = sheetRows(appointments, (email) => (team && email ? staffName(staff, email) : null), now);
  const withWhom = rows.some((r) => r.who);
  const where = clinic.name.trim();
  const today = fmtDate(now.toISOString());
  const fileName = safeName(`Próximas citas ${patient.name} ${now.toISOString().slice(0, 10)}.pdf`);
  async function pdf() {
    const { reportPdf } = await import("./reportPdf");
    return reportPdf(article.current!);
  }

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 18mm 18mm 20mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        {rows.length === 0 ? (
          <Alert tone="info" title="No tiene citas pendientes">
            Cuando le des citas, aquí sale la hoja para dársela.
          </Alert>
        ) : (
          <>
            <div className="flex flex-col gap-3 card-edge rounded-lg border bg-bg shadow-card p-4 print:hidden">
              <p className="text-sm text-text-muted">
                Para dársela en la consulta. Solo lleva sus citas (como mucho {SHEET_MAX}), nada de su salud.
              </p>
              <Button size="lg" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
                Imprimir
              </Button>
              <SharePdf make={pdf} fileName={fileName} title="Próximas citas" />
            </div>

            <article
              ref={article}
              aria-label="Tus próximas citas"
              className="relative flex flex-col gap-5 theme-light rounded-lg border border-border bg-white p-6 text-base leading-relaxed text-text shadow-card sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none"
            >
              <Letterhead clinic={clinic} title="Tus próximas citas" subtitle={patient.name} />
              <p>
                Hola, {firstName(patient.name)}. Estas son tus próximas citas de fisioterapia{where ? ` en ${where}` : ""}:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border text-sm text-text-muted">
                      <th scope="col" className="py-2 pr-3 font-semibold">
                        Día
                      </th>
                      <th scope="col" className="py-2 pr-3 font-semibold">
                        Hora
                      </th>
                      {withWhom && (
                        <th scope="col" className="py-2 font-semibold">
                          Con quién
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border">
                        <td className="py-2 pr-3 first-letter:uppercase">{r.day}</td>
                        <td className="py-2 pr-3 tabular-nums">{r.hour}</td>
                        {withWhom && <td className="py-2">{r.who ?? ""}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {more > 0 && <p className="text-sm">{more === 1 ? "Y 1 cita más después." : `Y ${more} citas más después.`}</p>}
              <p>
                Si no puedes venir a alguna, avísanos cuanto antes{clinic.phone.trim() ? ` (${clinic.phone.trim()})` : ""}.
              </p>
              <p className="text-sm text-text-muted">Hoja hecha el {today}.</p>
            </article>
          </>
        )}
      </main>
    </div>
  );
}
