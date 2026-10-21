// Ficha → Ejercicios para casa (src/data/exercises.ts): la hoja del paciente, con los ejercicios de la biblioteca de la
// clínica (o escritos a mano, o de una plantilla), su dosis, cómo hacerlos y, si hay, un vídeo (con su código QR en la
// hoja). Se imprime, se guarda en PDF o en Drive y se envía por WhatsApp o correo desde este dispositivo. Las hojas
// anteriores se quedan. La biblioteca se abre en las zonas de su anamnesis.
import { ArrowDown, ArrowUp, BookmarkPlus, ChevronDown, Download, Library, Mail, MessageCircle, Pencil, Plus, Printer, Search, Sparkles, Trash, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { bumpData, useDataVersion } from "../app/dataVersion";
import { fmtDate } from "../app/format";
import { LoadError, Loading } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { DriveSaveButton } from "../cloud/DriveSaveButton";
import { safeName } from "../cloud/saveToDrive";
import { getAnamnesis } from "../data/clinical";
import { getDb } from "../data/db";
import {
  addStarterExercises,
  DEFAULT_PLAN_NOTE,
  deletePlan,
  deleteTemplate,
  listExercises,
  listPlans,
  listTemplates,
  planText,
  savePlan,
  saveTemplate,
  type Exercise,
  type PlanInput,
  type PlanItem,
  type PlanTemplate,
} from "../data/exercises";
import { getClinic, type ClinicInfo } from "../data/privacy";
import { getPatient } from "../data/repo";
import { mailtoUrl, waPhone, whatsappUrl } from "../schedule/reminders";
import { TopBar } from "../ui/AppBar";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { TextField } from "../ui/Field";
import { QrCode } from "../ui/QrCode";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { BODY_REGIONS, clinicalSummary, regionLabel } from "./anamnesis";
import { TextArea } from "./parts";
import { Letterhead } from "./reportParts";

const link = "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 font-semibold";
const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function ExercisesPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const version = useDataVersion();
  const data = useAsync(async () => {
    const db = getDb();
    const [patient, plans, clinic, library, templates, anamnesis] = await Promise.all([
      getPatient(db, id),
      listPlans(db, id),
      getClinic(db),
      listExercises(db),
      listTemplates(db),
      getAnamnesis(db, id),
    ]);
    return { patient, plans, clinic, library, templates, regions: anamnesis ? clinicalSummary(anamnesis.answers).regions : [] };
  }, [id, version]);
  /** Hoja que se está escribiendo; `of`: la que se cambia (sin él, una nueva). */
  const [draft, setDraft] = useState<(PlanInput & { of?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [naming, setNaming] = useState(false);
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
  const { patient, plans, clinic, library, templates, regions } = data.data;
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
          <PlanEditor value={editing} library={library} templates={templates} regions={regions} onChange={(v) => setDraft({ ...v, of: editing.of })} />
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
            <Button variant="ghost" icon={<BookmarkPlus aria-hidden="true" className="size-4" />} onClick={() => setNaming(true)}>
              Guardar como plantilla
            </Button>
          </div>
        </div>

        <article
          ref={article}
          aria-label="Hoja de ejercicios"
          className="flex flex-col gap-5 rounded-lg border border-border bg-white p-6 text-base leading-relaxed text-text shadow-card sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none"
        >
          <Letterhead clinic={clinic} title="Ejercicios para casa" subtitle={`${patient.name} · ${fmtDate(plan.updatedAt)}`} />
          <ol className="flex flex-col gap-4">
            {plan.items.map((i, n) => (
              <li key={n} className="flex break-inside-avoid gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent">{n + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{i.title}</span>
                  {i.dose && <span className="text-sm font-semibold text-accent">{i.dose}</span>}
                  {i.instructions && <span className="whitespace-pre-line">{i.instructions}</span>}
                  {i.video && (
                    <a href={i.video} target="_blank" rel="noopener noreferrer" className="text-sm break-all text-accent underline">
                      Ver el vídeo
                    </a>
                  )}
                </div>
                {i.video && <QrCode text={i.video} label={`Código QR del vídeo de ${i.title}`} className="size-20 shrink-0 rounded-none" />}
              </li>
            ))}
          </ol>
          {plan.note && <p className="rounded-md bg-surface p-3 text-sm whitespace-pre-line">{plan.note}</p>}
          <HandoutFooter clinic={clinic} />
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
        <Sheet open={naming} onClose={() => setNaming(false)} title="Guardar como plantilla">
          {naming && (
            <TemplateNameForm
              suggestion={regions.length ? regionLabel(regions[0]!) : ""}
              onSave={async (name) => {
                await saveTemplate(getDb(), name, plan);
                setNaming(false);
                bumpData();
                toast(`Plantilla «${name.trim()}» guardada: úsala con otros pacientes`, "success");
              }}
            />
          )}
        </Sheet>
      </main>
    </div>
  );
}

/** El pie de la hoja para el paciente: quién se la da y cómo contactar (sin firma ni textos internos). */
function HandoutFooter({ clinic }: { clinic: ClinicInfo }) {
  const who = [clinic.professional && `${clinic.professional}, fisioterapeuta${clinic.license ? ` (nº col. ${clinic.license})` : ""}`, clinic.name].filter(Boolean).join(" · ");
  const reach = [clinic.phone, clinic.email].filter(Boolean).join(" · ");
  if (!who && !reach) return null;
  return (
    <footer className="border-t border-border pt-3 text-sm text-text-muted">
      {who && <p>{who}</p>}
      {reach && <p>Para cualquier duda: {reach}</p>}
    </footer>
  );
}

function TemplateNameForm({ suggestion, onSave }: { suggestion: string; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(suggestion);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await onSave(name);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }}
    >
      <TextField label="Nombre de la plantilla" value={name} onChange={(e) => setName(e.target.value)} hint="Por ejemplo: «Lumbalgia, fase 1». Con el mismo nombre, se cambia la que había." />
      {error && <Alert tone="danger" title={error} />}
      <Button type="submit" block>
        Guardar la plantilla
      </Button>
    </form>
  );
}

function PlanEditor({
  value,
  library,
  templates,
  regions,
  onChange,
}: {
  value: PlanInput;
  library: Exercise[];
  templates: PlanTemplate[];
  regions: string[];
  onChange: (v: PlanInput) => void;
}) {
  const [picking, setPicking] = useState<"library" | "template" | null>(null);
  /** El ejercicio que se ve abierto para cambiarlo (los demás, plegados en una línea). */
  const [open, setOpen] = useState<number | null>(null);
  /** Al quitar un ejercicio, el foco va a «Añadir de la biblioteca» (el botón que tenía desaparece). */
  const addRef = useRef<HTMLButtonElement>(null);
  const setItem = (n: number, patch: Partial<PlanItem>) => onChange({ ...value, items: value.items.map((x, i) => (i === n ? { ...x, ...patch } : x)) });
  const move = (n: number, by: -1 | 1) => {
    const items = [...value.items];
    [items[n], items[n + by]] = [items[n + by]!, items[n]!];
    onChange({ ...value, items });
    setOpen(open === n ? n + by : open);
  };
  const add = (items: PlanItem[], note?: string) => onChange({ items: [...value.items, ...items], note: note && !value.note.trim() ? note : value.note });
  return (
    <div className="flex flex-col gap-4">
      {value.items.length === 0 && <Alert tone="info" title="Añade los ejercicios">De la biblioteca de la clínica, de una plantilla o escritos a mano. Luego se imprime o se envía.</Alert>}
      <ol aria-label="Ejercicios de la hoja" className="flex flex-col gap-2">
        {value.items.map((i, n) => (
          <li key={n} className="flex flex-col rounded-lg border border-border bg-bg">
            <div className="flex items-center gap-2 py-1 pr-1 pl-3">
              <span className="font-semibold text-text-muted">{n + 1}.</span>
              <button type="button" aria-expanded={open === n} className="flex min-h-11 min-w-0 flex-1 flex-col items-start text-left" onClick={() => setOpen(open === n ? null : n)}>
                <span className="font-semibold">{i.title || "Ejercicio sin nombre"}</span>
                {i.dose && <span className="text-sm text-text-muted">{i.dose}</span>}
              </button>
              <ChevronDown aria-hidden="true" className={cx("size-5 shrink-0 text-text-muted transition-transform", open === n && "rotate-180")} />
            </div>
            {open === n && (
              <div className="flex flex-col gap-2 px-3 pb-3">
                <TextField label={`Ejercicio ${n + 1}`} value={i.title} onChange={(e) => setItem(n, { title: e.target.value })} />
                <TextField label="Dosis" value={i.dose} placeholder="3 series de 10, una vez al día" onChange={(e) => setItem(n, { dose: e.target.value })} />
                <TextArea label="Cómo se hace" value={i.instructions} rows={4} onChange={(v) => setItem(n, { instructions: v })} />
                <TextField label="Vídeo (enlace, opcional)" inputMode="url" value={i.video ?? ""} placeholder="https://…" onChange={(e) => setItem(n, { video: e.target.value })} hint="Sale con su código QR en la hoja." />
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" disabled={n === 0} icon={<ArrowUp aria-hidden="true" className="size-4" />} onClick={() => move(n, -1)}>
                    Subir
                  </Button>
                  <Button size="sm" variant="ghost" disabled={n === value.items.length - 1} icon={<ArrowDown aria-hidden="true" className="size-4" />} onClick={() => move(n, 1)}>
                    Bajar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    icon={<X aria-hidden="true" className="size-4" />}
                    onClick={() => {
                      onChange({ ...value, items: value.items.filter((_, k) => k !== n) });
                      setOpen(null);
                      addRef.current?.focus();
                    }}
                  >
                    Quitar
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button ref={addRef} icon={<Library aria-hidden="true" className="size-5" />} onClick={() => setPicking("library")}>
          Añadir de la biblioteca
        </Button>
        {templates.length > 0 && (
          <Button variant="secondary" icon={<BookmarkPlus aria-hidden="true" className="size-5" />} onClick={() => setPicking("template")}>
            Usar una plantilla
          </Button>
        )}
        <Button
          variant="secondary"
          icon={<Plus aria-hidden="true" className="size-5" />}
          onClick={() => {
            add([{ title: "", dose: "", instructions: "" }]);
            setOpen(value.items.length);
          }}
        >
          Escribir uno
        </Button>
      </div>
      <TextArea label="Indicaciones" value={value.note} rows={3} onChange={(note) => onChange({ ...value, note })} />
      <Sheet open={picking === "library"} onClose={() => setPicking(null)} title="Biblioteca de ejercicios">
        {picking === "library" && (
          <LibraryPicker
            library={library}
            regions={regions}
            onAdd={(picked) => {
              add(picked.map((e) => ({ title: e.title, dose: e.dose, instructions: e.instructions, ...(e.video ? { video: e.video } : {}) })));
              setPicking(null);
            }}
          />
        )}
      </Sheet>
      <Sheet open={picking === "template"} onClose={() => setPicking(null)} title="Plantillas">
        {picking === "template" && (
          <ul aria-label="Plantillas" className="flex flex-col divide-y divide-border rounded-md border border-border">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-2 pr-1">
                <button
                  type="button"
                  className="flex min-h-14 min-w-0 flex-1 flex-col items-start px-3 py-2 text-left hover:bg-surface"
                  onClick={() => {
                    add(t.items, t.note);
                    setPicking(null);
                  }}
                >
                  <span className="font-semibold">{t.title}</span>
                  <span className="text-sm text-text-muted">{t.items.map((i) => i.title).join(", ")}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Borrar la plantilla ${t.title}`}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface hover:text-danger"
                  onClick={async () => {
                    await deleteTemplate(getDb(), t.id);
                    bumpData();
                  }}
                >
                  <Trash aria-hidden="true" className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

function LibraryPicker({ library, regions, onAdd }: { library: Exercise[]; regions: string[]; onAdd: (picked: Exercise[]) => void }) {
  // Empieza en las zonas de su anamnesis (si la biblioteca tiene ejercicios de ellas).
  const [zones, setZones] = useState<string[]>(() => regions.filter((r) => library.some((e) => e.region === r)));
  const [q, setQ] = useState("");
  /** En el orden en que se tocan: así salen en la hoja. */
  const [picked, setPicked] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  if (!library.length)
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">La biblioteca de la clínica está vacía. Empieza con unos ejemplos (revísalos y adáptalos) o escribe los tuyos en Ajustes → Biblioteca de ejercicios.</p>
        <Button
          loading={adding}
          icon={<Sparkles aria-hidden="true" className="size-5" />}
          onClick={async () => {
            setAdding(true);
            await addStarterExercises(getDb());
            bumpData();
          }}
        >
          Añadir los ejemplos
        </Button>
      </div>
    );
  const available = BODY_REGIONS.filter((r) => library.some((e) => e.region === r.id));
  const shown = library.filter((e) => (!zones.length || zones.includes(e.region)) && (!q.trim() || fold(`${e.title} ${e.instructions}`).includes(fold(q.trim()))));
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          aria-label="Buscar un ejercicio"
          placeholder="Buscar un ejercicio"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-11 w-full rounded-lg border border-border-input bg-bg pr-3 pl-10 text-base"
        />
      </div>
      <div role="group" aria-label="Zona" className="flex flex-wrap gap-2">
        {available.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={zones.includes(r.id)}
            className={cx("tap rounded-full border px-3 text-sm", zones.includes(r.id) ? "border-accent bg-accent font-semibold text-on-accent" : "border-border bg-bg hover:bg-surface")}
            onClick={() => setZones(zones.includes(r.id) ? zones.filter((x) => x !== r.id) : [...zones, r.id])}
          >
            {r.label}
          </button>
        ))}
        {zones.length > 0 && (
          <button type="button" className="tap rounded-full px-3 text-sm text-accent underline" onClick={() => setZones([])}>
            Todas
          </button>
        )}
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
                <span className="text-sm text-text-muted">{[e.region && regionLabel(e.region), e.dose, e.video && "con vídeo"].filter(Boolean).join(" · ")}</span>
              </span>
            </label>
          </li>
        ))}
        {!shown.length && <li className="px-3 py-2 text-sm text-text-muted">Ningún ejercicio con eso.</li>}
      </ul>
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur">
        <Button block disabled={!picked.length} onClick={() => onAdd(picked.map((pid) => library.find((e) => e.id === pid)!).filter(Boolean))}>
          {picked.length ? `Añadir ${picked.length === 1 ? "1 ejercicio" : `${picked.length} ejercicios`}` : "Elige los ejercicios"}
        </Button>
      </div>
    </div>
  );
}
