// Lo que ve el paciente al abrir el enlace (…/formulario/<id>#<clave>): sin cuenta, sin PIN y sin la base de la app.
// Baja el formulario cifrado del servidor de la clínica, lo descifra con la clave del enlace, lo rellena y manda sus
// respuestas cifradas con la misma clave (src/clinical/patientForms.ts). Lo que va escribiendo se guarda en su móvil
// hasta que lo envía, por si cierra la página sin querer.
import { Lock, Send } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { AnswerValue } from "../data/clinical";
import { FieldInput } from "../clinical/FieldInput";
import { FormFill, formResult } from "../clinical/FormFill";
import { formFor, type Answers as FormAnswers } from "../clinical/forms";
import { ANAMNESIS_KIND, formWhat, seal, unseal, type FormRequest } from "../clinical/patientForms";
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
    document.title = "Formulario · Cénit";
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
        // La marca de la clínica que trae el formulario (o la de Cénit): colores, logo, favicon y título.
        const brand = brandFromForm(request.brand);
        applyBrand(brand, false);
        document.title = `Formulario · ${brand?.name ?? "Cénit"}`;
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
    if (!given) return setError("Contesta al menos una pregunta.");
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
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Logo onDark />
          {/* Con marca, el nombre ya va en el logo; si la clínica se llama distinto en Ajustes › Clínica, también. */}
          {request?.clinic && request.clinic !== request.brand?.name && <p className="min-w-0 truncate font-semibold">{request.clinic}</p>}
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
            <p>
              {request.clinic || "Tu clínica"} te pide que rellenes {formWhat(request.kind)}.{" "}
              {request.kind === ANAMNESIS_KIND ? "Contesta lo que sepas; lo demás lo hablaréis en la consulta." : form?.instructions}
            </p>
            <p className="flex gap-2 rounded-md bg-bg p-3 text-sm text-text-muted">
              <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              Tus respuestas salen cifradas de tu móvil y solo las puede leer tu fisioterapeuta, que las guardará en tu historia clínica. Si tienes dudas,
              pregunta en la clínica.
            </p>
            {request.sections?.map((s) => (
              <Card key={s.id} className="flex flex-col gap-4">
                <h2 className="text-lg">{s.title}</h2>
                {s.fields.map((f) => (
                  <FieldInput key={f.id} field={f} value={answers[f.id] as AnswerValue | undefined} onChange={(v) => setAnswers((a) => ({ ...a, [f.id]: v }))} />
                ))}
              </Card>
            ))}
            {form && <FormFill form={form} answers={answers as FormAnswers} onChange={(a) => setAnswers(a)} />}
            {request.kind !== ANAMNESIS_KIND && !form && <Alert tone="danger" title="Este cuestionario no está en esta versión de la app." />}
            {error && <Alert tone="danger" title={error} />}
            <Button type="submit" size="lg" block loading={sending} icon={<Send aria-hidden="true" className="size-5" />}>
              Enviar
            </Button>
            <p className="text-center text-xs text-text-muted">
              El enlace vale hasta el {new Date(request.expiresAt).toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" })}.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
