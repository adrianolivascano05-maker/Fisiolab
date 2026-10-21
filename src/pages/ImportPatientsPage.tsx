// Ajustes → Copias y exportar → Traer pacientes de otro programa (src/data/importPatients.ts): elegir un Excel o un
// CSV, revisar qué es cada columna y lo que va a pasar, e importar. La última importación se puede deshacer.
import { FileSpreadsheet, FileUp, Undo2, Users } from "lucide-react";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { fmtDate } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { FIELD_LABELS, guessFields, importPatients, LAST_IMPORT, MAX_ROWS, planImport, readTable, undoLastImport, type Field, type LastImport } from "../data/importPatients";
import { getSetting, listPatients } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const FIELDS = Object.keys(FIELD_LABELS) as Field[];

type Loaded = { file: string; table: string[][]; existing: string[] };

export function ImportPatientsPage() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [headerRow, setHeaderRow] = useState(true);
  const [withDuplicates, setWithDuplicates] = useState(false);
  const [busy, setBusy] = useState<"read" | "import" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [confirmUndo, setConfirmUndo] = useState(false);
  const last = useAsync(() => getSetting<LastImport>(getDb(), LAST_IMPORT), [done]);

  async function choose(file: File) {
    setBusy("read");
    setError(null);
    setDone(null);
    try {
      const table = await readTable(new Uint8Array(await file.arrayBuffer()), file.name);
      if (table.length < 2) throw new Error("El archivo no tiene filas de pacientes.");
      const existing = (await listPatients(getDb())).map((p) => p.name);
      setLoaded({ file: file.name, table, existing });
      setFields(guessFields(table[0]!));
      setHeaderRow(true);
      setWithDuplicates(false);
    } catch (e) {
      setError(errText(e));
      setLoaded(null);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  const plan = loaded ? planImport(loaded.table, fields, { headerRow, existing: loaded.existing }) : null;
  const toImport = plan ? plan.rows.filter((r) => withDuplicates || !r.duplicate) : [];
  const duplicates = plan ? plan.rows.filter((r) => r.duplicate).length : 0;
  const width = loaded ? Math.max(...loaded.table.slice(0, 50).map((r) => r.length)) : 0;
  const hasName = fields.includes("name") || fields.includes("lastName");

  async function run() {
    if (!loaded || !toImport.length) return;
    setBusy("import");
    try {
      await importPatients(
        getDb(),
        toImport.map((r) => r.input),
        loaded.file,
      );
      setDone(toImport.length);
      setLoaded(null);
      toast(`${plural(toImport.length, "paciente importado", "pacientes importados")}`, "success");
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
      toast(`Importación deshecha: ${plural(n, "paciente borrado", "pacientes borrados")}`, "success");
    } catch (e) {
      toast(errText(e), "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Page title="Traer pacientes" backTo="/ajustes/datos">
      <p className="text-sm text-text-muted">
        Desde el programa que usabas antes, exporta los pacientes a Excel (.xlsx) o CSV y elige aquí el archivo. Antes de importar ves qué es cada
        columna y qué va a pasar. Nada se pierde: lo que no tiene sitio en la ficha va a sus notas.
      </p>

      <input
        ref={input}
        type="file"
        accept=".csv,.txt,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        aria-label="Elegir el archivo de pacientes"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void choose(f);
        }}
      />
      <Button icon={<FileUp aria-hidden="true" className="size-5" />} loading={busy === "read"} onClick={() => input.current?.click()}>
        {loaded ? "Elegir otro archivo" : "Elegir el archivo (Excel o CSV)"}
      </Button>
      {error && <Alert tone="danger" title={error} />}

      {done !== null && (
        <Alert tone="success" title={`${plural(done, "paciente importado", "pacientes importados")}`}>
          <Link to="/pacientes" className="font-semibold underline underline-offset-2">
            Ver los pacientes
          </Link>
          . Los consentimientos no se importan: pídeselos en su próxima visita.
        </Alert>
      )}

      {loaded && plan && (
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
                    onChange={(e) => setFields(Object.assign([...fields], { [c]: e.target.value as Field }))}
                  >
                    {FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {FIELD_LABELS[f]}
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
            <Card className="flex flex-col gap-2">
              <p className="flex items-center gap-2 font-semibold">
                <Users aria-hidden="true" className="size-5 text-accent" /> Se importan {plural(toImport.length, "paciente", "pacientes")}
              </p>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
                {duplicates > 0 && (
                  <li>
                    {plural(duplicates, "ya existe", "ya existen")} con el mismo nombre (o se repite en el archivo):{" "}
                    {withDuplicates ? "se importan también." : "se saltan."}
                  </li>
                )}
                {plan.noName.length > 0 && <li>{plural(plan.noName.length, "fila sin nombre se salta", "filas sin nombre se saltan")}.</li>}
                {plan.fixes.length > 0 && (
                  <li>
                    {plural(plan.fixes.length, "valor no se ha reconocido", "valores no se han reconocido")} (fechas, sexo, peso o altura): se guardan en
                    las notas del paciente para que no se pierdan.
                  </li>
                )}
                {loaded.table.length - 1 > MAX_ROWS && <li>Solo se importan las primeras {MAX_ROWS.toLocaleString("es-ES")} filas.</li>}
                <li>Los consentimientos no se importan: pídeselos en su próxima visita.</li>
              </ul>
              {duplicates > 0 && (
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" className="size-5 accent-accent" checked={withDuplicates} onChange={(e) => setWithDuplicates(e.target.checked)} />
                  Importar también los que ya existen
                </label>
              )}
            </Card>

            {toImport.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border" tabIndex={0} role="region" aria-label="Los primeros pacientes que se importan">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <caption className="sr-only">Los primeros pacientes que se importan</caption>
                  <thead className="bg-surface">
                    <tr>
                      <th className="p-2">Nombre</th>
                      <th className="p-2">Nacimiento</th>
                      <th className="p-2">Teléfono</th>
                      <th className="p-2">Correo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {toImport.slice(0, 5).map((r) => (
                      <tr key={r.line} className="border-t border-border">
                        <td className="p-2 font-semibold">{r.input.name}</td>
                        <td className="p-2 tabular-nums">{r.input.birthDate ? fmtDate(r.input.birthDate) : "—"}</td>
                        <td className="p-2">{r.input.phone || "—"}</td>
                        <td className="p-2">{r.input.email || "—"}</td>
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
              disabled={!toImport.length || busy !== null}
              onClick={() => void run()}
            >
              Importar {plural(toImport.length, "paciente", "pacientes")}
            </Button>
          </section>
        </>
      )}

      {last.data && (
        <Card className="flex flex-col gap-2">
          <p className="text-sm">
            Última importación: {plural(last.data.ids.length, "paciente", "pacientes")} de «{last.data.file}», el {fmtDate(last.data.at)}.
          </p>
          <Button variant="secondary" icon={<Undo2 aria-hidden="true" className="size-5" />} onClick={() => setConfirmUndo(true)}>
            Deshacer la última importación
          </Button>
        </Card>
      )}
      <Sheet open={confirmUndo} onClose={() => setConfirmUndo(false)} title="¿Deshacer la importación?">
        <p>
          Se borran los pacientes de esa importación, también lo que les hayas añadido después (sesiones, mediciones, citas…). Los demás pacientes no se
          tocan.
        </p>
        <Button variant="danger" block loading={busy === "undo"} onClick={() => void undo()}>
          Borrar los pacientes importados
        </Button>
        <Button variant="secondary" block onClick={() => setConfirmUndo(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
