// Ajustes › Mensajes a pacientes (src/messages/templates.ts): los ocho mensajes que la app prepara para WhatsApp y
// correo, cada uno con su texto y su asunto, y una firma común al final de todos. Las fichas ({nombre}, {dia}…) se
// insertan donde está el cursor y la vista previa enseña el mensaje con un paciente de ejemplo. «?mensaje=» abre uno.
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { bumpData } from "../app/dataVersion";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { ownIdentity, useBrand } from "../brand/brand";
import { addDays, todayDay } from "../clinical/pageKit";
import { useCloud } from "../cloud/cloudContext";
import { useTeamMode } from "../cloud/teamMode";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { TextField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { dayText, hourText } from "../schedule/reminders";
import { fillTemplate, loadMessages, MESSAGES, messageSubject, messageText, saveMessages, specOf, type MessageKind, type MessageSettings, type MessageVars } from "./templates";

/** Lo que significa cada ficha, para la ayuda. */
const VAR_HELP: Record<string, string> = {
  "{nombre}": "el nombre de pila",
  "{dia}": "el día",
  "{hora}": "la hora",
  "{clinica}": "el nombre de la clínica",
  "{con}": "en un equipo, «con» quién es",
  "{enlace}": "el enlace del formulario",
  "{enlaces}": "los cuestionarios, uno por línea con su enlace",
  "{cuestionarios}": "«este cuestionario» o «estos cuestionarios»",
  "{formulario}": "qué formulario es",
  "{caduca}": "hasta cuándo vale el enlace",
};

const isKind = (v: string | null): v is MessageKind => MESSAGES.some((m) => m.kind === v);

export function MessagesPage() {
  const cloud = useCloud();
  const data = useAsync(async () => {
    const db = getDb();
    const [messages, clinic] = await Promise.all([loadMessages(db), getClinic(db)]);
    return { messages, clinicName: clinic.name || cloud?.clinic?.name || "" };
  }, []);
  if (data.error) return <Page title="Mensajes a pacientes" backTo="/ajustes"><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Mensajes a pacientes" backTo="/ajustes"><Loading /></Page>;
  return <Editor key={JSON.stringify(data.data.messages)} saved={data.data.messages} clinicName={data.data.clinicName} onSaved={data.reload} />;
}

function Editor({ saved, clinicName, onSaved }: { saved: MessageSettings; clinicName: string; onSaved: () => void }) {
  const toast = useToast();
  const brand = useBrand();
  const { team } = useTeamMode();
  const [params, setParams] = useSearchParams();
  const asked = params.get("mensaje");
  const [current, setCurrent] = useState<MessageKind>(isKind(asked) ? asked : "recordatorio");
  const [s, setS] = useState<MessageSettings>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const spec = specOf(current);
  const text = s.texts[current]?.text ?? spec.text;
  const subject = s.texts[current]?.subject ?? spec.subject;
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  const setText = (kind: MessageKind, patch: { text?: string; subject?: string }) => setS((v) => ({ ...v, texts: { ...v.texts, [kind]: { ...v.texts[kind], ...patch } } }));

  // Un paciente de ejemplo para la vista previa: mañana a las 10:00.
  const tomorrow = new Date(`${addDays(todayDay(), 1)}T10:00:00`).toISOString();
  const sample: MessageVars = {
    nombre: "Ana",
    dia: dayText(tomorrow),
    hora: hourText(tomorrow),
    clinica: ownIdentity(brand)?.name || clinicName,
    con: team ? " con Laura" : "",
    enlace: "https://ejemplo.omniclin.app/formulario/a1b2c3#clave",
    enlaces: "Índice de discapacidad cervical: https://ejemplo.omniclin.app/formulario/a1b2#clave\nOswestry: https://ejemplo.omniclin.app/formulario/c3d4#clave",
    cuestionarios: "estos cuestionarios",
    formulario: "el cuestionario «Índice de discapacidad cervical»",
    caduca: "20 de noviembre",
  };
  const preview = messageText(current, { ...s, texts: { ...s.texts, [current]: { text } } }, sample);
  const previewSubject = messageSubject(current, { ...s, texts: { ...s.texts, [current]: { subject } } }, sample);
  const unknown = [...text.matchAll(/\{[a-záéíóú]+\}/gi)].map((m) => m[0]).filter((v) => fillTemplate(v, sample) === v);

  const insert = (chip: string) => {
    const el = area.current;
    const at = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? at;
    const next = text.slice(0, at) + chip + text.slice(end);
    setText(current, { text: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + chip.length, at + chip.length);
    });
  };

  const pick = (kind: MessageKind) => {
    setCurrent(kind);
    setParams(kind === "recordatorio" ? {} : { mensaje: kind }, { replace: true });
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await saveMessages(getDb(), s);
      bumpData();
      toast("Mensajes guardados: son los mismos para toda la clínica", "success");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title="Mensajes a pacientes" backTo="/ajustes" width="record">
      <p className="text-text-muted">
        Lo que la app prepara para WhatsApp y correo. Tú lo envías con un toque desde tu móvil, como ahora; aquí decides qué dice. Las fichas entre llaves
        se sustituyen solas con los datos de cada paciente.
      </p>
      {!clinicName && !ownIdentity(brand) && (
        <p className="text-sm text-warning">
          Falta el nombre de la clínica (sale «la clínica»):{" "}
          <Link to="/ajustes/clinica" className="font-semibold underline">
            ponlo en Ajustes → Clínica
          </Link>
          .
        </p>
      )}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-6">
        <ul aria-label="Mensajes" className="flex flex-col gap-1.5">
          {MESSAGES.map((m) => {
            const changed = !!(s.texts[m.kind]?.text && s.texts[m.kind]?.text !== m.text) || !!(s.texts[m.kind]?.subject && s.texts[m.kind]?.subject !== m.subject);
            return (
              <li key={m.kind}>
                <button
                  type="button"
                  aria-pressed={m.kind === current}
                  onClick={() => pick(m.kind)}
                  className={cx("flex min-h-11 w-full flex-col rounded-md border px-3 py-2 text-left", m.kind === current ? "border-accent bg-accent-soft" : "border-border bg-bg hover:bg-surface")}
                >
                  <span className="font-semibold">
                    {m.label}
                    {changed && <span className="ml-1 text-sm font-normal text-accent">· cambiado</span>}
                  </span>
                  <span className="text-sm text-text-muted">{m.where}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg">{spec.label}</h2>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Fichas que se sustituyen solas">
              {spec.vars.map((v) => (
                <button key={v} type="button" title={VAR_HELP[v]} onClick={() => insert(v)} className="min-h-11 rounded-full bg-accent-soft px-3 font-mono text-sm font-semibold text-accent hover:bg-accent-hover hover:text-on-accent">
                  {v}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">Texto del mensaje</span>
              <textarea ref={area} rows={7} className="w-full rounded-md border border-border-input bg-bg p-3 text-base" value={text} onChange={(e) => setText(current, { text: e.target.value })} />
            </label>
            <p className="text-sm text-text-muted">{spec.vars.map((v) => `${v}: ${VAR_HELP[v]}`).join(" · ")}.</p>
            {unknown.length > 0 && <Alert tone="warning" title={`${unknown.join(", ")}: esa ficha no existe en este mensaje`}>Saldrá tal cual, con las llaves. Usa las de arriba.</Alert>}
            <TextField label="Asunto del correo" value={subject} maxLength={120} onChange={(e) => setText(current, { subject: e.target.value })} />
            {current === "ejercicios" && <p className="text-sm text-text-muted">Debajo de esta línea va la lista de ejercicios de la hoja, que no se edita aquí.</p>}
            <div className="flex flex-col gap-1 rounded-md bg-surface p-3">
              <span className="text-xs font-semibold text-text-muted uppercase">Así le llega a Ana</span>
              <p className="text-sm font-semibold">{previewSubject}</p>
              <p className="text-sm whitespace-pre-line">{preview}</p>
            </div>
            <Button variant="ghost" onClick={() => setS((v) => ({ ...v, texts: { ...v.texts, [current]: {} } }))}>
              Volver al texto de OmniClin
            </Button>
          </Card>

          <Card className="flex flex-col gap-2">
            <TextField
              label="Firma al final de todos los mensajes"
              value={s.signature}
              maxLength={160}
              placeholder="Por ejemplo: Fisioterapia Ruiz · 954 000 000"
              hint="Opcional. Se añade al final de cada mensaje, después de una línea en blanco."
              onChange={(e) => setS((v) => ({ ...v, signature: e.target.value }))}
            />
          </Card>

          {error && <Alert tone="danger" title={error} />}
          <Button size="lg" loading={saving} disabled={!dirty} onClick={() => void save()}>
            Guardar
          </Button>
        </div>
      </div>
    </Page>
  );
}
