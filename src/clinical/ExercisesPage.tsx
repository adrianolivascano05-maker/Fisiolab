// Ficha → Ejercicios para casa (src/data/exercises.ts): la hoja del paciente, con los ejercicios de la biblioteca de la
// clínica (o escritos a mano), su dosis y cómo hacerlos. Se imprime, se guarda en PDF o en Drive y se envía por
// WhatsApp o correo desde este dispositivo. Las hojas anteriores se quedan.
import { ArrowDown, ArrowUp, Download, Library, Mail, MessageCircle, Pencil, Plus, Printer, Trash, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { DriveSaveButton } from "../cloud/DriveSaveButton";
import { safeName } from "../cloud/saveToDrive";
import { getDb } from "../data/db";
import { DEFAULT_PLAN_NOTE, deletePlan, listExercises, listPlans, planText, savePlan, type Exercise, type PlanInput, type PlanItem } from "../data/exercises";
import { getClinic } from "../data/privacy";
import { getPatient } from "../data/repo";
import { mailtoUrl, waPhone, whatsappUrl } from "../schedule/reminders";
import { TopBar } from "../ui/AppBar";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { BODY_REGIONS, regionLabel } from "./anamnesis";
import { TextArea } from "./parts";
import { Letterhead, SignatureLine } from "./reportParts";

const link = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold";

export function ExercisesPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const version = useDataVersion();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, plans, clinic, library] = await Promise.all([getPatient(db, id), listPlans(db, id), getClinic(db), listExercises(db)]);
    return { patient, plans, clinic, library };
  }, [id, version]);
  /** Hoja que se está escribiendo; `of`: la que se cambia (sin él, una nueva). */
  const [draft, setDraft] = useState<(PlanInput & { of?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const article = useRef<HTMLElement>(null);

  const bar = (
    <div className="print:hidden">
      <TopBar title="Ejercicios para casa" backTo={`/pacientes/${id}`} />
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
  const { patient, plans, clinic, library } = data.data;
  if (!patient) return shell(<LoadError error={new Error("Este paciente no existe.")} />);

  const shown = plans.find((p) => p.id === params.get("hoja")) ?? plans[0] ?? null;
  const editing = draft ?? (plans.length === 0 ? { items: [], note: DEFAULT_PLAN_NOTE } : null);
  const fileName = safeName(`Ejercicios ${patient.name} ${(shown?.updatedAt ?? new Date().toISOString()).slice(0, 10)}.pdf`);

  async function save() {
    if (!editing) return;
    setBusy(true);
    try {
      const pid = await savePlan(getDb(), id, editing, editing.of);
      setDraft(null);
      setParams(pid === plans[0]?.id || !editing.of ? {} : { hoja: pid }, { replace: true });
      bumpData();
      toast("Hoja de ejercicios guardada", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function pdf() {
    const { reportPdf } = await import("./reportPdf");
    return reportPdf(article.current!);
  }

  if (editing) {
    return (
      <>
        {bar}
        <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12">
          <p className="font-semibold">{patient.name}</p>
          <PlanEditor value={editing} library={library} onChange={(v) => setDraft({ ...v, of: editing.of })} />
          <div className="sticky bottom-0 -mx-4 flex gap-2 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
            {plans.length > 0 && (
              <Button variant="secondary" size="lg" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
            )}
            <Button size="lg" block loading={busy} onClick={() => void save()}>
              Guardar la hoja
            </Button>
          </div>
        </main>
      </>
    );
  }

  const plan = shown!;
  const phone = waPhone(patient.phone);
  const contact = patient.privacy.consents?.contact;
  const text = planText(plan, patient.name, clinic.name);
  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{"@page { size: A4; margin: 16mm 16mm 18mm; } @media print { body { background: white; } }"}</style>
      {bar}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-4 pb-12 print:max-w-none print:p-0">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-4 print:hidden">
          <div className="flex flex-wrap gap-2">
            {contact !== false && phone && (
              <a href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" className={cx(link, "bg-accent text-on-accent hover:bg-accent-hover")}>
                <MessageCircle aria-hidden="true" className="size-5" /> Enviar por WhatsApp
              </a>
            )}
            {contact !== false && patient.email && (
              <a href={mailtoUrl(patient.email, "Tus ejercicios para casa", text)} className={cx(link, "border border-border bg-bg hover:bg-surface")}>
                <Mail aria-hidden="true" className="size-5" /> Correo
              </a>
            )}
          </div>
          {contact === false && <p className="text-sm text-text-muted">No acepta WhatsApp ni correo: dásela impresa.</p>}
          <Button variant="secondary" icon={<Printer aria-hidden="true" className="size-5" />} onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button
            variant="secondary"
            icon={<Download aria-hidden="true" className="size-5" />}
            onClick={async () => {
              const bytes = await pdf();
              const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
              const a = document.createElement("a");
              a.href = url;
              a.download = fileName;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 2000);
            }}
          >
            Descargar en PDF
          </Button>
          <DriveSaveButton label="Guardar en mi Drive (PDF)" make={async () => ({ name: fileName, mimeType: "application/pdf", bytes: await pdf() })} />
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="ghost" icon={<Pencil aria-hidden="true" className="size-4" />} onClick={() => setDraft({ items: plan.items, note: plan.note, of: plan.id })}>
              Cambiar esta hoja
            </Button>
            <Button variant="ghost" icon={<Plus aria-hidden="true" className="size-4" />} onClick={() => setDraft({ items: plan.items, note: plan.note })}>
              Hoja nueva a partir de esta
            </Button>
          </div>
        </div>

        <article
          ref={article}
          aria-label="Hoja de ejercicios"
          className="flex flex-col gap-5 rounded-lg border border-border bg-white p-8 text-base leading-relaxed text-text shadow-card print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <Letterhead clinic={clinic} title="Ejercicios para casa" subtitle={`${patient.name} · ${fmtDate(plan.updatedAt)}`} />
          <ol className="flex flex-col gap-4">
            {plan.items.map((i, n) => (
              <li key={n} className="flex break-inside-avoid gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">{n + 1}</span>
                <div className="flex flex-col">
                  <span className="font-semibold">{i.title}</span>
                  {i.dose && <span className="text-sm font-semibold text-accent">{i.dose}</span>}
                  {i.instructions && <span className="whitespace-pre-line">{i.instructions}</span>}
                </div>
              </li>
            ))}
          </ol>
          {plan.note && <p className="rounded-md bg-surface p-3 text-sm whitespace-pre-line">{plan.note}</p>}
          <SignatureLine name={clinic.professional} license={clinic.license} date={fmtDate(plan.updatedAt)} />
        </article>

        {plans.length > 1 && (
          <section aria-labelledby="h-anteriores" className="flex flex-col gap-2 print:hidden">
            <h2 id="h-anteriores" className="text-lg">
              Todas sus hojas
            </h2>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
              {plans.map((p) => (
                <li key={p.id}>
                  <Link
                    to={p.id === plans[0]!.id ? "." : `?hoja=${p.id}`}
                    aria-current={p.id === plan.id ? "page" : undefined}
                    className={cx("flex min-h-12 items-center justify-between gap-3 px-3 hover:bg-surface", p.id === plan.id && "font-semibold")}
                  >
                    <span>{fmtDate(p.updatedAt)}</span>
                    <span className="text-sm text-text-muted">{p.items.length === 1 ? "1 ejercicio" : `${p.items.length} ejercicios`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <Button variant="ghost" className="self-start text-danger print:hidden" icon={<Trash aria-hidden="true" className="size-4" />} onClick={() => setConfirm(true)}>
          Borrar esta hoja
        </Button>
        <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Borrar esta hoja?">
          <p>Se borrará la hoja de ejercicios del {fmtDate(plan.updatedAt)}.</p>
          <Button
            variant="danger"
            block
            onClick={async () => {
              await deletePlan(getDb(), plan.id);
              setConfirm(false);
              setParams({}, { replace: true });
              bumpData();
              toast("Hoja borrada", "success");
            }}
          >
            Borrar
          </Button>
          <Button variant="secondary" block onClick={() => setConfirm(false)}>
            Cancelar
          </Button>
        </Sheet>
      </main>
    </div>
  );
}

function PlanEditor({ value, library, onChange }: { value: PlanInput; library: Exercise[]; onChange: (v: PlanInput) => void }) {
  const [picking, setPicking] = useState(false);
  const setItem = (n: number, patch: Partial<PlanItem>) => onChange({ ...value, items: value.items.map((x, i) => (i === n ? { ...x, ...patch } : x)) });
  const move = (n: number, by: -1 | 1) => {
    const items = [...value.items];
    [items[n], items[n + by]] = [items[n + by]!, items[n]!];
    onChange({ ...value, items });
  };
  return (
    <div className="flex flex-col gap-4">
      {value.items.length === 0 && <Alert tone="info" title="Añade los ejercicios">De la biblioteca de la clínica o escritos a mano. Luego se imprime o se envía.</Alert>}
      <ol aria-label="Ejercicios de la hoja" className="flex flex-col gap-3">
        {value.items.map((i, n) => (
          <li key={n} className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-muted">{n + 1}.</span>
              <div className="min-w-0 flex-1">
                <TextField label={`Ejercicio ${n + 1}`} value={i.title} onChange={(e) => setItem(n, { title: e.target.value })} />
              </div>
            </div>
            <TextField label="Dosis" value={i.dose} placeholder="3 series de 10, una vez al día" onChange={(e) => setItem(n, { dose: e.target.value })} />
            <TextArea label="Cómo se hace" value={i.instructions} rows={3} onChange={(v) => setItem(n, { instructions: v })} />
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" disabled={n === 0} icon={<ArrowUp aria-hidden="true" className="size-4" />} onClick={() => move(n, -1)}>
                Subir
              </Button>
              <Button size="sm" variant="ghost" disabled={n === value.items.length - 1} icon={<ArrowDown aria-hidden="true" className="size-4" />} onClick={() => move(n, 1)}>
                Bajar
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" icon={<X aria-hidden="true" className="size-4" />} onClick={() => onChange({ ...value, items: value.items.filter((_, k) => k !== n) })}>
                Quitar
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Library aria-hidden="true" className="size-5" />} onClick={() => setPicking(true)}>
          Añadir de la biblioteca
        </Button>
        <Button variant="secondary" icon={<Plus aria-hidden="true" className="size-5" />} onClick={() => onChange({ ...value, items: [...value.items, { title: "", dose: "", instructions: "" }] })}>
          Escribir uno
        </Button>
      </div>
      <TextArea label="Indicaciones" value={value.note} rows={3} onChange={(note) => onChange({ ...value, note })} />
      <Sheet open={picking} onClose={() => setPicking(false)} title="Biblioteca de ejercicios">
        {picking && (
          <LibraryPicker
            library={library}
            onAdd={(picked) => {
              onChange({ ...value, items: [...value.items, ...picked.map((e) => ({ title: e.title, dose: e.dose, instructions: e.instructions }))] });
              setPicking(false);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function LibraryPicker({ library, onAdd }: { library: Exercise[]; onAdd: (picked: Exercise[]) => void }) {
  const [region, setRegion] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  if (!library.length)
    return (
      <p className="text-sm">
        La biblioteca está vacía. Créala en{" "}
        <Link to="/ajustes/ejercicios" className="font-semibold text-accent">
          Ajustes → Biblioteca de ejercicios
        </Link>
        , con unos ejemplos para empezar si quieres.
      </p>
    );
  const regions = BODY_REGIONS.filter((r) => library.some((e) => e.region === r.id));
  const shown = library.filter((e) => !region || e.region === region);
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Zona" className="flex flex-wrap gap-2">
        {[{ id: "", label: "Todas" }, ...regions].map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={region === r.id}
            className={cx("tap rounded-full border px-3 text-sm", region === r.id ? "border-accent bg-accent font-semibold text-on-accent" : "border-border bg-bg hover:bg-surface")}
            onClick={() => setRegion(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
        {shown.map((e) => (
          <li key={e.id}>
            <label className="flex min-h-12 cursor-pointer items-start gap-3 px-3 py-2 hover:bg-surface">
              <input
                type="checkbox"
                className="mt-1 size-5 accent-accent"
                checked={picked.includes(e.id)}
                onChange={() => setPicked(picked.includes(e.id) ? picked.filter((x) => x !== e.id) : [...picked, e.id])}
              />
              <span className="flex flex-col">
                <span className="font-semibold">{e.title}</span>
                <span className="text-sm text-text-muted">{[e.region && regionLabel(e.region), e.dose].filter(Boolean).join(" · ")}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <Button block disabled={!picked.length} onClick={() => onAdd(library.filter((e) => picked.includes(e.id)))}>
        {picked.length ? `Añadir ${picked.length === 1 ? "1 ejercicio" : `${picked.length} ejercicios`}` : "Elige los ejercicios"}
      </Button>
    </div>
  );
}
