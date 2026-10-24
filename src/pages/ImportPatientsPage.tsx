// Ajustes → Importar datos (traer datos de otro programa): los pacientes (src/data/importPatients.ts), sus citas y
// su historial de sesiones (src/data/importRecords.ts), desde un Excel o un CSV. Primero se elige qué se trae, después
// el archivo; se revisa qué es cada columna y lo que va a pasar, y se importa. La última importación se puede deshacer.
import { CalendarDays, FileSpreadsheet, FileUp, NotebookPen, Undo2, Users } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { fmtDate, fmtDateTime, plural } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { STATUS_LABELS } from "../data/appointments";
import { getDb } from "../data/db";
import { FIELD_LABELS, guessFields, importPatients, LAST_IMPORT, MAX_ROWS, planImport, readTable, undoLastImport, type Field, type LastImport } from "../data/importPatients";
import { existingKeys, guessRecordFields, importRecords, planRecords, RECORD_FIELD_LABELS, RECORD_FIELDS, type RecordField, type RecordKind } from "../data/importRecords";
import { getSetting, listPatients } from "../data/repo";
import { useStaff } from "../schedule/useStaff";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { SelectField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Kind = "patients" | RecordKind;
const KINDS: { id: Kind; title: string; text: string; icon: typeof Users; one: string; many: string }[] = [
  { id: "patients", title: "Pacientes", text: "Nombre, contacto, nacimiento… Empieza por aquí.", icon: Users, one: "paciente", many: "pacientes" },
  { id: "appointments", title: "Citas", text: "Las que vienen (para que la agenda no empiece vacía) y las pasadas.", icon: CalendarDays, one: "cita", many: "citas" },
  { id: "sessions", title: "Historial de sesiones", text: "La fecha y las notas de cada visita anterior.", icon: NotebookPen, one: "sesión", many: "sesiones" },
];

type Loaded = { file: string; table: string[][]; patients: { id: string; name: string }[]; existing: Set<string> };

export function ImportPatientsPage() {
  const toast = useToast();
  const staff = useStaff();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("patients");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fields, setFields] = useState<string[]>([]);
  const [headerRow, setHeaderRow] = useState(true);
  const [withDuplicates, setWithDuplicates] = useState(false);
  const [createMissing, setCreateMissing] = useState(true);
  const [busy, setBusy] = useState<"read" | "import" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const last = useAsync(() => getSetting<LastImport>(getDb(), LAST_IMPORT), [done]);
  const meta = KINDS.find((k) => k.id === kind)!;

  async function choose(file: File) {
    setBusy("read");
    setError(null);
    setDone(null);
    try {
      const table = await readTable(new Uint8Array(await file.arrayBuffer()), file.name);
      if (table.length < 2) throw new Error("El archivo no tiene filas.");
      const patients = (await listPatients(getDb())).map((p) => ({ id: p.id, name: p.name }));
      const existing = kind === "patients" ? new Set<string>() : await existingKeys(getDb(), kind);
      setLoaded({ file: file.name, table, patients, existing });
      setFields(kind === "patients" ? guessFields(table[0]!) : guessRecordFields(kind, table[0]!));
      setHeaderRow(true);
      setWithDuplicates(false);
      setCreateMissing(true);
    } catch (e) {
      setError(errText(e));
      setLoaded(null);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  // Lo que va a pasar, según qué se trae.
  const patientPlan = loaded && kind === "patients" ? planImport(loaded.table, fields as Field[], { headerRow, existing: loaded.patients.map((p) => p.name) }) : null;
  const recordPlan =
    loaded && kind !== "patients"
      ? planRecords(kind, loaded.table, fields as RecordField[], { headerRow, patients: loaded.patients, existing: loaded.existing, staff })
      : null;
  const patientRows = patientPlan ? patientPlan.rows.filter((r) => withDuplicates || !r.duplicate) : [];
  const recordRows = recordPlan ? recordPlan.rows.filter((r) => !r.duplicate && (r.patientId || createMissing)) : [];
  const count = kind === "patients" ? patientRows.length : recordRows.length;
  const duplicates = (patientPlan?.rows ?? recordPlan?.rows ?? []).filter((r) => r.duplicate).length;
  const width = loaded ? Math.max(...loaded.table.slice(0, 50).map((r) => r.length)) : 0;
  const hasName = fields.some((f) => ["name", "lastName", "patient"].includes(f));
  const hasDate = kind === "patients" || fields.includes("date");
  const options: { id: string; label: string }[] =
    kind === "patients"
      ? (Object.keys(FIELD_LABELS) as Field[]).map((f) => ({ id: f, label: FIELD_LABELS[f] }))
      : RECORD_FIELDS[kind].map((f) => ({ id: f, label: RECORD_FIELD_LABELS[f] }));

  async function run() {
    if (!loaded || !count) return;
    setBusy("import");
    try {
      if (kind === "patients") {
        await importPatients(
          getDb(),
          patientRows.map((r) => r.input),
          loaded.file,
        );
        setDone(plural(count, "paciente importado", "pacientes importados"));
      } else {
        const r = await importRecords(getDb(), kind, recordPlan!, loaded.file, { createMissing });
        setDone(
          `${plural(r.records, `${meta.one} importada`, `${meta.many} importadas`)}${r.patients ? ` y ${plural(r.patients, "paciente nuevo", "pacientes nuevos")}` : ""}`,
        );
      }
      setLoaded(null);
      toast("Importación hecha", "success");
    } catch (e) {
      toast(errText(e), "danger");
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    setBusy("undo");
    try {
      const n = await undoLastImport(getDb());
      setConfirmUndo(false);
      setDone(null);
      last.reload();
      toast(`Importación deshecha: ${plural(n, "registro borrado", "registros borrados")}`, "success");
    } catch (e) {
      toast(errText(e), "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page title="Traer datos" backTo="/ajustes">
      <p className="text-sm text-text-muted">
        Desde el programa que usabas antes, exporta a Excel (.xlsx) o CSV y elige aquí el archivo. Antes de importar ves qué es cada columna y qué va a
        pasar. Nada se pierde: lo que no tiene sitio va a las notas.
      </p>

      <section aria-labelledby="h-que" className="flex flex-col gap-2">
        <h2 id="h-que" className="text-lg">
          Qué traes
        </h2>
        <div role="radiogroup" aria-labelledby="h-que" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              className={cx(
                "flex items-start gap-3 rounded-lg border p-3 text-left",
                kind === k.id ? "border-accent bg-accent-soft" : "border-border bg-bg hover:bg-surface",
              )}
              onClick={() => {
                setKind(k.id);
                setLoaded(null);
                setDone(null);
                setError(null);
              }}
            >
              <k.icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
              <span className="flex flex-col">
                <span className="font-semibold">{k.title}</span>
                <span className="text-sm text-text-muted">{k.text}</span>
              </span>
            </button>
          ))}
        </div>
        {kind !== "patients" && (
          <p className="text-sm text-text-muted">
            Cada fila se une a su paciente por el nombre. Si traes también los pacientes, impórtalos primero: así se unen con todos sus datos.
          </p>
        )}
      </section>

      <input
        ref={input}
        type="file"
        accept=".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        aria-label={`Elegir el archivo de ${meta.title.toLowerCase()}`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choose(f);
        }}
      />
      <Button icon={<FileUp aria-hidden="true" className="size-5" />} loading={busy === "read"} onClick={() => input.current?.click()}>
        {loaded ? "Elegir otro archivo" : `Elegir el archivo de ${meta.title.toLowerCase()} (Excel o CSV)`}
      </Button>
      {error && <Alert tone="danger" title={error} />}

      {done && (
        <Alert tone="success" title={done}>
          <Link to={kind === "appointments" ? "/agenda" : "/pacientes"} className="font-semibold underline underline-offset-2">
            {kind === "appointments" ? "Ver la agenda" : "Ver los pacientes"}
          </Link>
          {kind === "patients" ? ". Los consentimientos no se importan: pídeselos en su próxima visita." : "."}
        </Alert>
      )}

      {loaded && (
        <>
          <section aria-labelledby="h-columnas" className="flex flex-col gap-3">
            <h2 id="h-columnas" className="text-lg">
              Qué es cada columna
            </h2>
            <p className="text-sm text-text-muted">
              {loaded.file}: {plural(loaded.table.length - (headerRow ? 1 : 0), "fila", "filas")}. Cambia lo que no esté bien.
            </p>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="size-5 accent-accent" checked={headerRow} onChange={(e) => setHeaderRow(e.target.checked)} />
              La primera fila son los títulos
            </label>
            <Card className="flex flex-col gap-4">
              {Array.from({ length: width }, (_, c) => {
                const title = headerRow ? loaded.table[0]?.[c] || `Columna ${c + 1}` : `Columna ${c + 1}`;
                const samples = loaded.table
                  .slice(headerRow ? 1 : 0)
                  .map((r) => r[c] ?? "")
                  .filter(Boolean)
                  .slice(0, 2);
                return (
                  <SelectField
                    key={c}
                    label={title}
                    hint={samples.length ? `Por ejemplo: ${samples.join(" · ")}` : "Vacía"}
                    value={fields[c] ?? "ignore"}
                    onChange={(e) => setFields(Object.assign([...fields], { [c]: e.target.value }))}
                  >
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </SelectField>
                );
              })}
            </Card>
          </section>

          <section aria-labelledby="h-resumen" className="flex flex-col gap-3">
            <h2 id="h-resumen" className="text-lg">
              Qué va a pasar
            </h2>
            {!hasName && <Alert tone="warning" title="Falta la columna del nombre: indica cuál es el nombre (y, si van aparte, los apellidos)." />}
            {!hasDate && <Alert tone="warning" title="Falta la columna de la fecha: indica cuál es (y, si va aparte, la hora)." />}
            <Card className="flex flex-col gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <meta.icon aria-hidden="true" className="size-5 text-accent" /> Se importan {plural(count, meta.one, meta.many)}
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {duplicates > 0 &&
                  (kind === "patients" ? (
                    <li>
                      {plural(duplicates, "ya existe", "ya existen")} con el mismo nombre (o se repite en el archivo): {withDuplicates ? "se importan también." : "se saltan."}
                    </li>
                  ) : (
                    <li>{plural(duplicates, `${meta.one} ya está`, `${meta.many} ya están`)} (mismo paciente a la misma hora): se saltan.</li>
                  ))}
                {patientPlan && patientPlan.noName.length > 0 && <li>{plural(patientPlan.noName.length, "fila sin nombre se salta", "filas sin nombre se saltan")}.</li>}
                {patientPlan && patientPlan.fixes.length > 0 && (
                  <li>
                    {plural(patientPlan.fixes.length, "valor no se ha reconocido", "valores no se han reconocido")} (fechas, sexo, peso o altura): se guardan en
                    las notas del paciente para que no se pierdan.
                  </li>
                )}
                {recordPlan && recordPlan.noPatient.length > 0 && <li>{plural(recordPlan.noPatient.length, "fila sin paciente se salta", "filas sin paciente se saltan")}.</li>}
                {recordPlan && recordPlan.badDate.length > 0 && (
                  <li>
                    {plural(recordPlan.badDate.length, "fila sin una fecha que se entienda se salta", "filas sin una fecha que se entienda se saltan")} (líneas{" "}
                    {recordPlan.badDate.slice(0, 5).join(", ")}
                    {recordPlan.badDate.length > 5 ? "…" : ""}).
                  </li>
                )}
                {recordPlan && recordPlan.newPatients.length > 0 && (
                  <li>
                    {plural(recordPlan.newPatients.length, "paciente no está en Cénit", "pacientes no están en Cénit")} ({recordPlan.newPatients.slice(0, 3).join(", ")}
                    {recordPlan.newPatients.length > 3 ? "…" : ""}): {createMissing ? "se crean con su nombre." : `sus ${meta.many} se saltan.`}
                  </li>
                )}
                {recordPlan && recordPlan.unknownPeople.length > 0 && (
                  <li>
                    {plural(recordPlan.unknownPeople.length, "profesional no está en el equipo", "profesionales no están en el equipo")} (
                    {recordPlan.unknownPeople.slice(0, 3).join(", ")}): sus citas quedan sin asignar.
                  </li>
                )}
                {kind === "appointments" && <li>Las citas pasadas quedan como atendidas, salvo que el archivo diga otra cosa (anulada, no vino).</li>}
                {loaded.table.length - 1 > MAX_ROWS && kind === "patients" && <li>Solo se importan las primeras {MAX_ROWS.toLocaleString("es-ES")} filas.</li>}
                {kind === "patients" && <li>Los consentimientos no se importan: pídeselos en su próxima visita.</li>}
              </ul>
              {kind === "patients" && duplicates > 0 && (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5 accent-accent" checked={withDuplicates} onChange={(e) => setWithDuplicates(e.target.checked)} />
                  Importar también los que ya existen
                </label>
              )}
              {recordPlan && recordPlan.newPatients.length > 0 && (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5 accent-accent" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
                  Crear los pacientes que no están
                </label>
              )}
            </Card>

            {count > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border" tabIndex={0} role="region" aria-label={`Las primeras ${meta.many} que se importan`}>
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-surface">
                    {kind === "patients" ? (
                      <tr>
                        <th className="p-2">Nombre</th>
                        <th className="p-2">Nacimiento</th>
                        <th className="p-2">Teléfono</th>
                        <th className="p-2">Correo</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="p-2">Paciente</th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">{kind === "appointments" ? "Cita" : "Notas"}</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {kind === "patients"
                      ? patientRows.slice(0, 5).map((r) => (
                          <tr key={r.line} className="border-t border-border">
                            <td className="p-2 font-semibold">{r.input.name}</td>
                            <td className="p-2 tabular-nums">{r.input.birthDate ? fmtDate(r.input.birthDate) : "—"}</td>
                            <td className="p-2">{r.input.phone || "—"}</td>
                            <td className="p-2">{r.input.email || "—"}</td>
                          </tr>
                        ))
                      : recordRows.slice(0, 5).map((r) => (
                          <tr key={r.line} className="border-t border-border">
                            <td className="p-2 font-semibold">{r.patientName}</td>
                            <td className="p-2 tabular-nums">{fmtDateTime(r.startsAt)}</td>
                            <td className="p-2">
                              {r.appointment
                                ? `${r.appointment.minutes} min · ${STATUS_LABELS[r.appointment.status]}${r.appointment.assignedTo ? ` · ${staff.find((s) => s.email === r.appointment!.assignedTo)?.name ?? ""}` : ""}`
                                : [r.session!.pain !== null ? `Dolor ${r.session!.pain}/10` : "", r.session!.treatment || r.session!.subjective].filter(Boolean).join(" · ").slice(0, 80) || "—"}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}

            <Button
              size="lg"
              icon={<FileSpreadsheet aria-hidden="true" className="size-5" />}
              loading={busy === "import"}
              disabled={!count || busy !== null}
              onClick={() => void run()}
            >
              Importar {plural(count, meta.one, meta.many)}
            </Button>
          </section>
        </>
      )}

      {last.data && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm">
            Última importación: «{last.data.file}», el {fmtDate(last.data.at)}
            {last.data.appointments ? ` (${plural(last.data.appointments.length, "cita", "citas")})` : last.data.sessions ? ` (${plural(last.data.sessions.length, "sesión", "sesiones")})` : ""}
            {last.data.ids.length ? ` · ${plural(last.data.ids.length, "paciente", "pacientes")}` : ""}.
          </p>
          <Button variant="secondary" icon={<Undo2 aria-hidden="true" className="size-5" />} onClick={() => setConfirmUndo(true)}>
            Deshacer la última importación
          </Button>
        </Card>
      )}
      <Sheet open={confirmUndo} onClose={() => setConfirmUndo(false)} title="¿Deshacer la importación?">
        <p>
          Se borra lo que trajo esa importación: sus pacientes (también lo que les hayas añadido después), citas o sesiones. Lo demás no se toca.
        </p>
        <Button variant="danger" block loading={busy === "undo"} onClick={() => void undo()}>
          Borrar lo importado
        </Button>
        <Button variant="secondary" block onClick={() => setConfirmUndo(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
