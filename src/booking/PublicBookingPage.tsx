// Lo que ve el paciente en …/reservar/<dirección de la clínica>: sin cuenta, sin PIN y sin la base de la app. Baja del
// servidor de la clínica los tipos de cita y las franjas libres (nunca citas ni pacientes), elige tipo, fisio, día y
// hora, y manda sus datos cifrados para la clínica (src/booking/crypto.ts): el servidor no puede leerlos. Con la
// reserva hecha le da el enlace para anularla, que también le llegará con la confirmación por WhatsApp.
import { CalendarPlus, Check, Copy, Lock, Phone, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { errorText, failText, serverUrl } from "../app/publicServer";
import { openIcs } from "../clinical/calendar";
import { TextArea } from "../clinical/parts";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { TextField } from "../ui/Field";
import { Logo } from "../ui/Logo";
import { madridDayOf, startTimes, type Window } from "./availability";
import { newCancelToken, sealForClinic, tokenHash } from "./crypto";
import type { BookingPayload, PublicBookingInfo } from "./settings";

/** Lo publicado y cuándo se ha bajado (para no ofrecer horas que ya no tienen la antelación mínima). */
type Published = { page: PublicBookingInfo; publicKey: JsonWebKey; windows: Window[]; at: number };
type Done = { id: string; startsAt: string; minutes: number; pro: string; cancelUrl: string };
type Phase = { kind: "loading" } | { kind: "error"; text: string } | { kind: "ready"; data: Published } | { kind: "done"; data: Published; done: Done };

const BASE = import.meta.env.BASE_URL;
/** Las citas reservadas en este móvil (solo la fecha y su enlace para anular), para encontrarlas al volver. */
const MINE_KEY = "cenit.reservas";
type Mine = { slug: string; startsAt: string; cancelUrl: string };

function readMine(slug: string): Mine[] {
  try {
    const all = JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]") as Mine[];
    return all.filter((m) => m.slug === slug && Date.parse(m.startsAt) > Date.now());
  } catch {
    return [];
  }
}
function saveMine(m: Mine) {
  try {
    const all = (JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]") as Mine[]).filter((x) => Date.parse(x.startsAt) > Date.now());
    localStorage.setItem(MINE_KEY, JSON.stringify([...all, m].slice(-5)));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

const slugFromUrl = () => /\/reservar\/([a-z0-9-]{3,40})\/?$/.exec(location.pathname)?.[1] ?? "";

const TZ = "Europe/Madrid";
const dayLong = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
/** «2026-10-26» → «lun» y «26 oct». */
function dayParts(day: string) {
  const d = new Date(`${day}T12:00:00Z`);
  return {
    weekday: d.toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" }).replace(".", ""),
    date: d.toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", ""),
  };
}

/** Un grupo de opciones como botones grandes (radio por dentro, para el lector de pantalla y el teclado). */
function Choice<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  columns,
}: {
  legend: string;
  name: string;
  value: T | null;
  options: { id: T; label: ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  columns: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-lg font-semibold">{legend}</legend>
      <div className={cx("grid gap-2", columns)}>
        {options.map((o) => (
          <label key={o.id} className="relative">
            <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)} className="peer sr-only" />
            <span
              className={cx(
                "flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-md border px-2 py-1.5 text-center leading-tight",
                "border-border-input bg-bg peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent",
                "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
              )}
            >
              <span className="font-semibold">{o.label}</span>
              {o.hint && <span className="text-sm opacity-80">{o.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Contact({ page }: { page: PublicBookingInfo }) {
  const c = page.contact;
  if (!c?.phone && !c?.email) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {c.phone && (
        <a className="tap inline-flex items-center gap-1.5 text-accent underline" href={`tel:${c.phone.replace(/\s/g, "")}`}>
          <Phone aria-hidden="true" className="size-4" />
          {c.phone}
        </a>
      )}
      {c.email && (
        <a className="tap inline-flex items-center text-accent underline" href={`mailto:${c.email}`}>
          {c.email}
        </a>
      )}
    </p>
  );
}

export function PublicBookingPage() {
  const [slug] = useState(slugFromUrl);
  const [phase, setPhase] = useState<Phase>(() => (slug ? { kind: "loading" } : { kind: "error", text: "La dirección está incompleta. Ábrela tal como te llegó." }));
  const [kindId, setKindId] = useState<string | null>(null);
  const [proId, setProId] = useState<string | null>(null);
  const [dayPick, setDay] = useState<string | null>(null);
  const [atPick, setAt] = useState<string | null>(null);
  const [allDays, setAllDays] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mine] = useState(() => readMine(slug));
  const timesRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    try {
      const base = await serverUrl();
      const res = await fetch(`${base}/v1/reservas/${slug}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await errorText(res)) || "No se ha podido abrir la página de reservas.");
      const data = { ...((await res.json()) as Omit<Published, "at">), at: Date.now() };
      setPhase({ kind: "ready", data });
      document.title = `Pedir cita · ${data.page.clinic || "Cénit"}`;
    } catch (e) {
      setPhase({ kind: "error", text: failText(e) });
    }
  }, [slug]);

  useEffect(() => {
    document.title = "Pedir cita · Cénit";
    void load();
  }, [load]);

  const data = phase.kind === "ready" || phase.kind === "done" ? phase.data : null;
  const page = data?.page;
  const kinds = page?.kinds ?? [];
  const pros = page?.pros ?? [];
  const kind = kinds.find((k) => k.id === kindId) ?? (kinds.length === 1 ? kinds[0] : undefined);
  // Con un solo fisio no se pregunta; con varios, «me da igual» (vacío) o uno.
  const askPro = pros.length > 1;
  const pro = askPro ? proId : (pros[0]?.id ?? "");

  // Las horas libres para ese tipo de cita y ese fisio, por días.
  const byDay = useMemo(() => {
    const out = new Map<string, { at: string; pro: string }[]>();
    if (!data || !kind || pro === null) return out;
    const notBefore = new Date(data.at + data.page.minNoticeHours * 3_600_000).toISOString();
    for (const t of startTimes(data.windows, kind.minutes, data.page.step || 15, notBefore, pro || undefined)) {
      const d = madridDayOf(t.at);
      out.set(d, [...(out.get(d) ?? []), t]);
    }
    return out;
  }, [data, kind, pro]);
  const days = [...byDay.keys()];
  const shownDays = allDays ? days : days.slice(0, 12);
  // Si cambia lo de antes (el tipo, el fisio o los huecos), el día y la hora que ya no valen se vuelven a elegir.
  const day = dayPick && byDay.has(dayPick) ? dayPick : null;
  const times = day ? (byDay.get(day) ?? []) : [];
  const at = atPick && times.some((t) => t.at === atPick) ? atPick : null;

  const show = (ref: RefObject<HTMLDivElement | null>) => setTimeout(() => ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data || !kind || !at || pro === null) return;
    setError(null);
    const name = form.name.trim();
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (name.length < 3) return setError("Escribe tu nombre y apellidos.");
    if (phoneDigits.length < 9) return setError("Escribe tu móvil: la clínica te confirma la cita por WhatsApp.");
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("El correo no parece correcto. Revísalo o déjalo en blanco.");
    if (!consent) return setError("Marca que has leído la información sobre tus datos.");
    setSending(true);
    try {
      const cancelToken = newCancelToken();
      const payload: BookingPayload = { v: 1, name, phone: form.phone.trim(), email: form.email.trim(), note: form.note.trim(), cancelToken, consentAt: new Date().toISOString() };
      const base = await serverUrl();
      const res = await fetch(`${base}/v1/reservas/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: kind.id, startsAt: at, pro, payload: await sealForClinic(data.publicKey, payload), cancelHash: await tokenHash(cancelToken) }),
      });
      if (res.status === 409) {
        setAt(null);
        setError((await errorText(res)) || "Ese hueco se acaba de ocupar: elige otra hora.");
        void load();
        show(timesRef);
        return;
      }
      if (!res.ok) throw new Error((await errorText(res)) || "No se ha podido reservar. Prueba otra vez.");
      const r = (await res.json()) as Omit<Done, "cancelUrl">;
      const cancelUrl = `${location.origin}${BASE}cita/${cancelToken}`;
      saveMine({ slug, startsAt: r.startsAt, cancelUrl });
      setPhase({ kind: "done", data, done: { ...r, cancelUrl } });
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(failText(err, "No hay conexión. Lo que has escrito sigue aquí: prueba otra vez en un momento."));
    } finally {
      setSending(false);
    }
  };

  const proName = (id: string) => pros.find((p) => p.id === id)?.name ?? "";

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b-2 border-highlight bg-brand text-on-brand">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Logo onDark />
          {page?.clinic && <p className="min-w-0 truncate font-semibold">{page.clinic}</p>}
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5 pb-16">
        {phase.kind === "loading" && <p className="text-text-muted">Buscando huecos libres…</p>}
        {phase.kind === "error" && <Alert tone="danger" title={phase.text} />}

        {phase.kind === "done" && (
          <>
            <Alert tone="success" title="¡Cita reservada!">
              {dayLong(phase.done.startsAt)} a las {hour(phase.done.startsAt)}
              {proName(phase.done.pro) ? ` con ${proName(phase.done.pro)}` : ""}, en {phase.data.page.clinic || "la clínica"}.
            </Alert>
            <Card className="flex flex-col gap-3">
              <h1 className="text-xl font-bold">Y ahora</h1>
              <p>La clínica te mandará la confirmación por WhatsApp. Si antes de la cita tienen que pedirte algo (como un formulario), te llegará también.</p>
              <p className="font-semibold">Si no puedes venir, anúlala aquí (guarda este enlace):</p>
              <a href={phase.done.cancelUrl} className="break-all text-accent underline">
                {phase.done.cancelUrl}
              </a>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  icon={copied ? <Check aria-hidden="true" className="size-5" /> : <Copy aria-hidden="true" className="size-5" />}
                  onClick={() => {
                    void navigator.clipboard?.writeText(phase.done.cancelUrl).then(() => setCopied(true));
                  }}
                >
                  {copied ? "Copiado" : "Copiar el enlace"}
                </Button>
                <Button
                  variant="secondary"
                  icon={<CalendarPlus aria-hidden="true" className="size-5" />}
                  onClick={() =>
                    openIcs(
                      {
                        uid: `${phase.done.id}@cenit-reserva`,
                        start: phase.done.startsAt,
                        minutes: phase.done.minutes,
                        title: `Cita en ${phase.data.page.clinic || "la clínica"}`,
                        description: `Si no puedes venir, anúlala aquí: ${phase.done.cancelUrl}`,
                      },
                      "cita.ics",
                    )
                  }
                >
                  Añadir a mi calendario
                </Button>
              </div>
            </Card>
            <Contact page={phase.data.page} />
          </>
        )}

        {phase.kind === "ready" && page && (
          <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl leading-tight font-bold">Pide tu cita</h1>
              {page.intro && <p className="whitespace-pre-line">{page.intro}</p>}
              <Contact page={page} />
            </div>

            {mine.length > 0 && (
              <Alert tone="info" title={mine.length === 1 ? "Ya tienes una cita reservada desde este móvil" : "Ya tienes citas reservadas desde este móvil"}>
                <ul className="flex flex-col gap-1">
                  {mine.map((m) => (
                    <li key={m.cancelUrl}>
                      {dayLong(m.startsAt)} a las {hour(m.startsAt)} ·{" "}
                      <a className="text-accent underline" href={m.cancelUrl}>
                        Verla o anularla
                      </a>
                    </li>
                  ))}
                </ul>
              </Alert>
            )}

            {kinds.length > 1 && (
              <Choice
                legend="¿Qué cita quieres?"
                name="tipo"
                value={kind?.id ?? null}
                options={kinds.map((k) => ({ id: k.id, label: k.label, hint: `${k.minutes} min` }))}
                onChange={(v) => setKindId(v)}
                columns="grid-cols-1 sm:grid-cols-2"
              />
            )}

            {kind && askPro && (
              <Choice
                legend="¿Con quién?"
                name="fisio"
                value={proId}
                options={[{ id: "", label: "Me da igual" }, ...pros.map((p) => ({ id: p.id, label: p.name }))]}
                onChange={(v) => setProId(v)}
                columns="grid-cols-2 sm:grid-cols-3"
              />
            )}

            {kind && pro !== null && days.length === 0 && (
              <Alert tone="info" title="Ahora mismo no quedan huecos libres por internet">
                Llama o escribe a la clínica: te pueden apuntar en su lista de espera y avisarte si se libera uno.
              </Alert>
            )}

            {kind && pro !== null && days.length > 0 && (
              <div className="flex flex-col gap-2">
                <Choice
                  legend="¿Qué día?"
                  name="dia"
                  value={day}
                  options={shownDays.map((d) => {
                    const p = dayParts(d);
                    return { id: d, label: `${p.weekday} ${p.date}`, hint: `${byDay.get(d)?.length ?? 0} ${byDay.get(d)?.length === 1 ? "hora" : "horas"}` };
                  })}
                  onChange={(v) => {
                    setDay(v);
                    setAt(null);
                    show(timesRef);
                  }}
                  columns="grid-cols-3 sm:grid-cols-4"
                />
                {!allDays && days.length > shownDays.length && (
                  <Button variant="ghost" onClick={() => setAllDays(true)}>
                    Ver más días
                  </Button>
                )}
              </div>
            )}

            <div ref={timesRef}>
              {day && times.length > 0 && (
                <Choice
                  legend={`¿A qué hora? (${dayLong(`${day}T12:00:00Z`)})`}
                  name="hora"
                  value={at}
                  options={times.map((t) => ({ id: t.at, label: hour(t.at) }))}
                  onChange={(v) => {
                    setAt(v);
                    show(formRef);
                  }}
                  columns="grid-cols-4 sm:grid-cols-6"
                />
              )}
            </div>

            <div ref={formRef}>
              {at && kind && (
                <Card className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">Tus datos</h2>
                  <p className="text-sm">
                    {kind.label}: {dayLong(at)} a las {hour(at)}
                    {pro ? ` con ${proName(pro)}` : ""}.
                  </p>
                  <TextField label="Nombre y apellidos" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <TextField
                    label="Móvil"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    hint="Para confirmarte la cita por WhatsApp."
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <TextField label="Correo (si quieres)" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <TextArea label="¿Qué te pasa? (si quieres)" hint="Unas palabras bastan; lo demás lo hablaréis en la consulta." value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
                  <details className="rounded-md bg-bg p-3 text-sm">
                    <summary className="tap flex cursor-pointer items-center gap-2 font-semibold">
                      <Lock aria-hidden="true" className="size-4 shrink-0" />
                      Tus datos: quién los recibe y para qué
                    </summary>
                    <div className="mt-2 flex flex-col gap-2">
                      <p>
                        Los recibe {page.clinic || "la clínica"}
                        {page.contact?.taxId ? ` (${page.contact.taxId})` : ""}
                        {page.contact?.address ? `, ${page.contact.address}` : ""}, para darte la cita, avisarte de ella y, si vienes, abrir tu historia clínica.
                      </p>
                      <p>Salen cifrados de tu móvil: solo la clínica puede leerlos. El servidor que guarda la reserva no puede.</p>
                      <p>
                        Puedes pedir verlos, corregirlos o borrarlos
                        {page.contact?.email ? ` escribiendo a ${page.contact.email}` : " en la clínica"}
                        {page.contact?.dpo ? `; delegado de protección de datos: ${page.contact.dpo}` : ""}.
                      </p>
                    </div>
                  </details>
                  <label className="flex min-h-11 items-center gap-3">
                    <input type="checkbox" className="size-5 shrink-0 accent-accent" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    He leído para qué son mis datos
                  </label>
                  {error && <Alert tone="danger" title={error} />}
                  <Button type="submit" size="lg" block loading={sending} icon={<Send aria-hidden="true" className="size-5" />}>
                    Reservar la cita
                  </Button>
                </Card>
              )}
              {!at && error && <Alert tone="danger" title={error} />}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
