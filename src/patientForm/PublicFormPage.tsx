// Lo que ve el paciente al abrir el enlace (…/formulario/<id>#<clave>): sin cuenta, sin PIN y sin la base de la app.
// Baja el formulario cifrado del servidor de la clínica, lo descifra con la clave del enlace, lo rellena y manda sus
// respuestas cifradas con la misma clave (src/clinical/patientForms.ts). Lo que va escribiendo se guarda en su móvil
// hasta que lo envía, por si cierra la página sin querer. Si se le piden sus informes y pruebas, los sube (PDF o fotos,
// que se pasan a PDF) cifrados con la misma clave, uno a uno, y al enviar se dice cuáles son.
import { FileText, Lock, Send, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AnswerValue } from "../data/clinical";
import { FieldInput } from "../clinical/FieldInput";
import { FormFill, formResult } from "../clinical/FormFill";
import { formFor, type Answers as FormAnswers } from "../clinical/forms";
import { ANAMNESIS_KIND, DOCS_KIND, DOCS_PER_LINK, formWhat, seal, unseal, type FormRequest, type SentDoc } from "../clinical/patientForms";
import { sizeText } from "../data/documents";
import { sealDoc } from "../documents/docCrypto";
import { prepareFiles } from "../documents/prepare";
import { errorText, serverUrl } from "../app/publicServer";
import { applyBrand } from "../brand/brand";
import { brandFromForm } from "../brand/form";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Logo } from "../ui/Logo";

type Phase = { kind: "loading" } | { kind: "error"; text: string } | { kind: "form"; request: FormRequest } | { kind: "answered" } | { kind: "sent" };

const draftKey = (id: string) => `cenit.formulario.${id}`;
/** Lo escrito en el móvil se borra en cuanto ya no hace falta (puede ser un móvil compartido). */
const dropDraft = (id: string) => {
  try {
    localStorage.removeItem(draftKey(id));
  } catch {
    /* nada */
  }
};

/** El id del formulario en la dirección y la clave, después de «#». */
function fromUrl() {
  const id = /\/formulario\/([A-Za-z0-9_-]{22,64})\/?$/.exec(location.pathname)?.[1] ?? "";
  return { id, key: location.hash.slice(1) };
}

export function PublicFormPage() {
  const [{ id, key }] = useState(fromUrl);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [answers, setAnswers] = useState<Record<string, unknown>>(() => {
    try {
      return JSON.parse(localStorage.getItem(draftKey(id)) ?? "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Formulario · OmniClin";
    if (!id || !key) {
      setPhase({ kind: "error", text: "El enlace está incompleto. Ábrelo tal como te llegó, entero." });
      return;
    }
    void (async () => {
      try {
        const base = await serverUrl();
        const res = await fetch(`${base}/v1/formularios/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error((await errorText(res)) || "No se ha podido abrir el formulario.");
        const r = (await res.json()) as { request: string; answered: boolean };
        if (r.answered) {
          dropDraft(id);
          return setPhase({ kind: "answered" });
        }
        let request: FormRequest;
        try {
          request = await unseal<FormRequest>(r.request, key);
        } catch {
          throw new Error("El enlace está incompleto o mal copiado. Ábrelo tal como te llegó, entero.");
        }
        // La marca de la clínica que trae el formulario (o la de OmniClin): colores, logo, favicon y título.
        const brand = brandFromForm(request.brand);
        applyBrand(brand, false);
        document.title = `Formulario · ${brand?.name ?? "OmniClin"}`;
        setPhase({ kind: "form", request });
      } catch (e) {
        setPhase({ kind: "error", text: e instanceof Error && e.message !== "Failed to fetch" ? e.message : "No hay conexión. Prueba otra vez en un momento." });
      }
    })();
  }, [id, key]);

  // Lo que va escribiendo se guarda en el móvil hasta que lo envía.
  useEffect(() => {
    if (phase.kind !== "form") return;
    try {
      localStorage.setItem(draftKey(id), JSON.stringify(answers));
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }, [answers, id, phase.kind]);

  const request = phase.kind === "form" ? phase.request : null;
  const form = request && request.kind !== ANAMNESIS_KIND ? formFor(request.kind) : undefined;
  const result = form ? formResult(form, answers as FormAnswers) : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!request) return;
    setError(null);
    const given = Object.values(answers).some((v) => v !== null && v !== "" && v !== undefined && !(Array.isArray(v) && !v.length));
    if (!given) return setError(request.kind === DOCS_KIND ? "Sube al menos un archivo." : "Contesta al menos una pregunta.");
    if (result && "missing" in result) return setError(`${result.missing}. Contéstalas para poder enviarlo.`);
    setSending(true);
    try {
      const base = await serverUrl();
      const res = await fetch(`${base}/v1/formularios/${id}/respuesta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: await seal({ v: 1, answers }, key) }),
      });
      if (res.status === 409) {
        dropDraft(id);
        return setPhase({ kind: "answered" });
      }
      if (!res.ok) throw new Error((await errorText(res)) || "No se ha podido enviar. Prueba otra vez.");
      dropDraft(id);
      setPhase({ kind: "sent" });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "No hay conexión. Lo que has escrito sigue aquí: prueba otra vez en un momento.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b-2 border-highlight bg-brand text-on-brand">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
          <Logo onDark />
          {/* Con marca, el nombre ya va en el logo; si la clínica se llama distinto en Ajustes › Clínica, también. */}
          {request?.clinic && request.clinic !== request.brand?.name && <p className="min-w-0 truncate font-semibold">{request.clinic}</p>}
          {request?.brand?.slogan && <p className="w-full text-sm opacity-90">{request.brand.slogan}</p>}
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5 pb-16">
        {phase.kind === "loading" && <p className="text-text-muted">Abriendo el formulario…</p>}
        {phase.kind === "error" && <Alert tone="danger" title={phase.text} />}
        {phase.kind === "answered" && (
          <Alert tone="success" title="Este formulario ya se envió">
            Tu fisioterapeuta ya tiene tus respuestas. Si quieres cambiar algo, díselo en la consulta.
          </Alert>
        )}
        {phase.kind === "sent" && (
          <Alert tone="success" title="¡Gracias! Ya lo tiene tu fisioterapeuta">
            Puedes cerrar esta página.
          </Alert>
        )}
        {request && (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <h1 className="text-2xl leading-tight font-bold">{request.name ? `Hola, ${request.name}` : "Hola"}</h1>
            {request.brand?.patient?.welcome && <p className="text-lg">{request.brand.patient.welcome}</p>}
            {request.kind === DOCS_KIND ? (
              <p>
                {request.clinic || "Tu clínica"} te pide {formWhat(request.kind)}: informes de tu médico, resonancias, radiografías, analíticas… Súbelos aquí en
                PDF o haciéndoles una foto.
              </p>
            ) : (
              <p>
                {request.clinic || "Tu clínica"} te pide que rellenes {formWhat(request.kind)}.{" "}
                {request.kind === ANAMNESIS_KIND ? "Contesta lo que sepas; lo demás lo hablaréis en la consulta." : form?.instructions}
              </p>
            )}
            <p className="flex gap-2 rounded-md bg-bg p-3 text-sm text-text-muted">
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {request.kind === DOCS_KIND
                ? "Tus archivos salen cifrados de tu móvil y solo los puede abrir tu fisioterapeuta, que los guardará en tu historia clínica. Si tienes dudas, pregunta en la clínica."
                : "Tus respuestas salen cifradas de tu móvil y solo las puede leer tu fisioterapeuta, que las guardará en tu historia clínica. Si tienes dudas, pregunta en la clínica."}
            </p>
            {request.kind === DOCS_KIND && (
              <DocsUpload
                formId={id}
                linkKey={key}
                max={request.maxDocs ?? DOCS_PER_LINK}
                docs={Array.isArray(answers.docs) ? (answers.docs as SentDoc[]) : []}
                onChange={(docs) => {
                  setError(null);
                  setAnswers((a) => ({ ...a, docs }));
                }}
              />
            )}
            {request.sections?.map((s) => (
              <Card key={s.id} className="flex flex-col gap-4">
                <h2 className="text-lg">{s.title}</h2>
                {s.fields.map((f) => (
                  <FieldInput key={f.id} field={f} value={answers[f.id] as AnswerValue | undefined} onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))} />
                ))}
              </Card>
            ))}
            {form && <FormFill form={form} answers={answers as FormAnswers} onChange={(a) => setAnswers(a)} />}
            {request.kind !== ANAMNESIS_KIND && request.kind !== DOCS_KIND && !form && <Alert tone="danger" title="Este cuestionario no está en esta versión de la app." />}
            {error && <Alert tone="danger" title={error} />}
            <Button type="submit" size="lg" block loading={sending} icon={<Send aria-hidden="true" className="size-5" />}>
              Enviar
            </Button>
            <p className="text-center text-xs text-text-muted">
              El enlace vale hasta el {new Date(request.expiresAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" })}.
            </p>
          </form>
        )}
        {request?.brand?.contact && (
          <p className="text-center text-sm text-text-muted">
            ¿Dudas? {request.clinic || request.brand.name}: {request.brand.contact}
          </p>
        )}
      </main>
    </div>
  );
}

/**
 * Los archivos del paciente: cada uno se prepara (las fotos elegidas a la vez, en un PDF), se cifra con la clave del
 * enlace y se sube a su número (1, 2…) hasta el máximo. Quitar uno libera su número: el siguiente lo sustituye.
 */
function DocsUpload({ formId, linkKey, max, docs, onChange }: { formId: string; linkKey: string; max: number; docs: SentDoc[]; onChange: (docs: SentDoc[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  // Lo último que hay (aunque aún no se haya vuelto a pintar) y la fila: si elige más mientras sube, va después.
  const latest = useRef(docs);
  latest.current = docs;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const add = (files: File[]) => {
    if (!files.length) return;
    queue.current = queue.current.then(() => upload(files));
  };
  const upload = async (files: File[]) => {
    setProblems([]);
    setBusy("Preparando…");
    const out: string[] = [];
    let current = latest.current;
    try {
      const { ready, problems } = await prepareFiles(files, `Fotos del ${new Date().toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}`);
      out.push(...problems);
      const base = await serverUrl();
      for (const f of ready) {
        const n = Array.from({ length: max }, (_, i) => i + 1).find((x) => !current.some((d) => d.n === x));
        if (!n) {
          out.push(`Ya has subido ${max}, el máximo. Quita alguno para subir otro.`);
          break;
        }
        setBusy(`Subiendo «${f.name}»…`);
        const res = await fetch(`${base}/v1/formularios/${formId}/documentos/${n}`, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: (await sealDoc(f.bytes, linkKey)) as BodyInit,
        });
        if (!res.ok) {
          out.push((await errorText(res)) || `No se ha podido subir «${f.name}». Prueba otra vez.`);
          continue;
        }
        current = [...current, { n, name: f.name, size: f.bytes.byteLength }];
        latest.current = current;
        onChange(current);
      }
    } catch (e) {
      out.push(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "No hay conexión. Prueba otra vez en un momento.");
    } finally {
      setProblems(out);
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg">Tus archivos</h2>
      {docs.length > 0 && (
        <ul aria-label="Tus archivos" className="flex flex-col divide-y divide-border">
          {docs.map((d) => (
            <li key={d.n} className="flex min-h-14 items-center gap-3 py-1">
              <FileText aria-hidden="true" className="size-6 shrink-0 text-accent" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold break-words">{d.name}</span>
                <span className="text-sm text-text-muted">{sizeText(d.size)} · subido</span>
              </span>
              <Button size="sm" variant="ghost" aria-label={`Quitar ${d.name}`} icon={<X aria-hidden="true" className="size-4" />} onClick={() => onChange(docs.filter((x) => x.n !== d.n))}>
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept="application/pdf,.pdf,image/*"
        className="sr-only"
        aria-label="Elegir archivos (PDF o fotos)"
        tabIndex={-1}
        onChange={(e) => add([...(e.target.files ?? [])])}
      />
      {docs.length < max && (
        <Button variant="secondary" loading={busy !== null} icon={<Upload aria-hidden="true" className="size-5" />} onClick={() => input.current?.click()}>
          {docs.length ? "Añadir otro" : "Añadir un PDF o fotos"}
        </Button>
      )}
      {busy && <p role="status" className="text-sm text-text-muted">{busy}</p>}
      <p className="text-sm text-text-muted">
        Hasta {max} archivos de 5 MB como mucho. Si haces varias fotos de un mismo informe, elígelas a la vez: van juntas en un PDF. Cuando estén todos, pulsa «Enviar».
      </p>
      {problems.length > 0 && (
        <Alert tone="warning" title={problems.length === 1 ? problems[0]! : "Algunos archivos no se han subido"}>
          {problems.length > 1 && (
            <ul className="list-disc pl-5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
    </Card>
  );
}
