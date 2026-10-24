// Lo que ve el paciente en …/reservar/<dirección de la clínica>: sin cuenta, sin PIN y sin la base de la app. Como en
// las apps de reservas: elige qué cita quiere, con quién (o con cualquiera, el primer hueco libre), el día en un
// calendario del mes con los días que tienen hueco y la hora; después deja sus datos, que salen cifrados para la clínica
// (src/booking/crypto.ts): el servidor no puede leerlos. Del servidor solo baja lo publicado (tipos de cita, fisios y
// franjas libres; nunca citas ni pacientes). Con …?con=<fisio> el fisio ya viene elegido (el enlace de cada uno). Con la
// reserva hecha le da el enlace para anularla, que también le llegará con la confirmación por WhatsApp.
import { CalendarPlus, Check, ChevronLeft, ChevronRight, Copy, Lock, Phone, Send, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
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
import type { BookingKind, BookingPayload, PublicBookingInfo } from "./settings";

/** Lo publicado y cuándo se ha bajado (para no ofrecer horas que ya no tienen la antelación mínima). */
type Published = { page: PublicBookingInfo; publicKey: JsonWebKey; windows: Window[]; at: number };
type Done = { id: string; startsAt: string; minutes: number; pro: string; cancelUrl: string };
type Phase = { kind: "loading" } | { kind: "error"; text: string } | { kind: "ready"; data: Published } | { kind: "done"; data: Published; done: Done };
type Pro = PublicBookingInfo["pros"][number];

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
const proFromUrl = () => new URLSearchParams(location.search).get("con") ?? "";

const TZ = "Europe/Madrid";
const dayLong = (iso: string) => new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const hour = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const noon = (day: string) => new Date(`${day}T12:00:00Z`);
const monthOf = (day: string) => day.slice(0, 7);
const monthTitle = (month: string) => noon(`${month}-01`).toLocaleDateString("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });
const addMonths = (month: string, n: number) => {
  const d = noon(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const euros = (cents: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);
const kindHint = (k: BookingKind) => [`${k.minutes} min`, k.priceCents != null ? euros(k.priceCents) : null].filter(Boolean).join(" · ");

/** Las semanas de un mes, de lunes a domingo, con huecos vacíos antes del día 1 y después del último. */
function weeksOf(month: string): (string | null)[][] {
  const first = noon(`${month}-01`);
  const offset = (first.getUTCDay() + 6) % 7;
  const days: (string | null)[] = Array.from({ length: offset }, () => null);
  for (const d = new Date(first); d.toISOString().slice(0, 7) === month; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  while (days.length % 7) days.push(null);
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7));
}

/** La inicial de un fisio en un círculo de su color (como su foto en otras apps). */
function Avatar({ pro }: { pro?: Pro }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
      style={{ background: pro?.color ?? "var(--color-accent)" }}
    >
      {pro ? pro.name.trim().charAt(0).toUpperCase() : <UsersRound className="size-5" />}
    </span>
  );
}

/** Una opción grande de la lista (tipo de cita o fisio). */
function OptionCard({ title, hint, lead, onClick }: { title: string; hint?: string; lead?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2 text-left hover:border-accent">
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {hint && <span className="block text-sm text-text-muted">{hint}</span>}
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-text-muted" />
    </button>
  );
}

/** Lo ya elegido, arriba, con «Cambiar». */
function Chosen({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      <span className="min-w-0 flex-1 text-sm">
        <span className="text-text-muted">{label}: </span>
        <b>{value}</b>
      </span>
      <button type="button" onClick={onChange} aria-label={`Cambiar ${label.toLowerCase()}`} className="tap shrink-0 rounded-md px-2 text-sm font-semibold text-accent hover:bg-surface">
        Cambiar
      </button>
    </div>
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
  /** El fisio elegido: su id, «» para cualquiera, o null si aún no se ha elegido. Con …?con=, ya viene. */
  const [proPick, setProPick] = useState<string | null>(() => proFromUrl() || null);
  const [month, setMonth] = useState<string | null>(null);
  const [dayPick, setDay] = useState<string | null>(null);
  const [atPick, setAt] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mine] = useState(() => readMine(slug));
  const top = useRef<HTMLDivElement>(null);

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
  // Con un solo fisio (o sin equipo) no se pregunta; con varios, uno o «cualquiera» («»).
  const askPro = pros.length > 1;
  const pro = askPro ? (proPick === "" || pros.some((p) => p.id === proPick) ? proPick : null) : (pros[0]?.id ?? "");
  const proOf = (id: string) => pros.find((p) => p.id === id);

  // Las horas libres para ese tipo de cita y ese fisio, por días.
  const byDay = useMemo(() => {
    const out = new Map<string, { at: string; pro: string }[]>();
    if (!data || !kind || pro === null) return out;
    const notBefore = new Date(Math.max(data.at, Date.now()) + data.page.minNoticeHours * 3_600_000).toISOString();
    for (const t of startTimes(data.windows, kind.minutes, data.page.step || 15, notBefore, pro || undefined)) {
      const d = madridDayOf(t.at);
      out.set(d, [...(out.get(d) ?? []), t]);
    }
    return out;
  }, [data, kind, pro]);
  const days = [...byDay.keys()];
  // El día elegido, o el primero con hueco; el mes que se ve, el de ese día (o el que se haya pasado con las flechas).
  const day = dayPick && byDay.has(dayPick) ? dayPick : (days[0] ?? null);
  const shownMonth = month ?? (day ? monthOf(day) : null);
  const times = day ? (byDay.get(day) ?? []) : [];
  const at = atPick && times.some((t) => t.at === atPick) ? atPick : null;
  const firstMonth = days[0] ? monthOf(days[0]) : null;
  const lastMonth = days.length ? monthOf(days.at(-1)!) : null;

  // Por qué paso va: lo que falta por elegir.
  const stage = !kind ? "kind" : pro === null ? "pro" : !at ? "when" : "data";
  const goTop = () => setTimeout(() => top.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 30);
  const stepNo = { kind: 1, pro: 2, when: askPro ? 3 : 2, data: askPro ? 4 : 3 }[stage] - (kinds.length === 1 ? 1 : 0);
  const steps = (askPro ? 4 : 3) - (kinds.length === 1 ? 1 : 0);

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
      // Ese hueco ya no está (lo ha cogido otro o se ha pasado la antelación): se vuelve a la hora con los huecos al día.
      if (res.status === 409 || res.status === 400) {
        const text = (await errorText(res)) || "Ese hueco se acaba de ocupar: elige otra hora.";
        setAt(null);
        setError(text);
        await load();
        goTop();
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

  const doneWith = phase.kind === "done" ? proOf(phase.done.pro) : undefined;

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
              {doneWith ? ` con ${doneWith.name}` : ""}, en {phase.data.page.clinic || "la clínica"}.
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
              {doneWith && pros.length > 1 && (
                <p className="text-sm text-text-muted">
                  Para las siguientes citas, tu fisio te las irá dando en la consulta; también puedes{" "}
                  <a className="text-accent underline" href={`${BASE}reservar/${slug}?con=${doneWith.id}`}>
                    pedir otra cita con {doneWith.name}
                  </a>
                  .
                </p>
              )}
            </Card>
            <Contact page={phase.data.page} />
          </>
        )}

        {phase.kind === "ready" && page && (
          <div className="flex flex-col gap-5">
            <div ref={top} className="flex flex-col gap-2 scroll-mt-4">
              <h1 className="text-2xl leading-tight font-bold">Pide tu cita</h1>
              {stage === "kind" && page.intro && <p className="whitespace-pre-line">{page.intro}</p>}
              {stage === "kind" && <Contact page={page} />}
              <p className="text-sm text-text-muted">
                Paso {stepNo} de {steps}
              </p>
            </div>

            {mine.length > 0 && stage === "kind" && (
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

            {/* Lo ya elegido, con «Cambiar». */}
            {((kind && kinds.length > 1) || (askPro && pro !== null) || at) && (
              <Card className="flex flex-col divide-y divide-border py-1">
                {kind && kinds.length > 1 && (
                  <Chosen
                    label="Cita"
                    value={`${kind.label} (${kindHint(kind)})`}
                    onChange={() => {
                      setKindId(null);
                      setAt(null);
                    }}
                  />
                )}
                {askPro && pro !== null && (
                  <Chosen
                    label="Con"
                    value={pro ? (proOf(pro)?.name ?? "") : "Cualquiera"}
                    onChange={() => {
                      setProPick(null);
                      setAt(null);
                      setDay(null);
                      setMonth(null);
                    }}
                  />
                )}
                {at && <Chosen label="Cuándo" value={`${dayLong(at)} a las ${hour(at)}`} onChange={() => setAt(null)} />}
              </Card>
            )}

            {error && stage !== "data" && <Alert tone="danger" title={error} />}

            {stage === "kind" && (
              <section aria-labelledby="h-tipo" className="flex flex-col gap-2">
                <h2 id="h-tipo" className="text-lg font-semibold">
                  ¿Qué cita quieres?
                </h2>
                {kinds.map((k) => (
                  <OptionCard
                    key={k.id}
                    title={k.label}
                    hint={kindHint(k)}
                    onClick={() => {
                      setKindId(k.id);
                      setError(null);
                      goTop();
                    }}
                  />
                ))}
              </section>
            )}

            {stage === "pro" && (
              <section aria-labelledby="h-fisio" className="flex flex-col gap-2">
                <h2 id="h-fisio" className="text-lg font-semibold">
                  ¿Con quién?
                </h2>
                <OptionCard title="Cualquiera" hint="El primer hueco libre del equipo" lead={<Avatar />} onClick={() => setProPick("")} />
                {pros.map((p) => (
                  <OptionCard key={p.id} title={p.name} hint={p.bio} lead={<Avatar pro={p} />} onClick={() => setProPick(p.id)} />
                ))}
              </section>
            )}

            {stage === "when" && days.length === 0 && (
              <Alert tone="info" title={pro ? `${proOf(pro)?.name ?? "Este fisio"} no tiene huecos libres por internet ahora mismo` : "Ahora mismo no quedan huecos libres por internet"}>
                {pro && askPro ? "Prueba con «Cualquiera» o llama o escribe a la clínica." : "Llama o escribe a la clínica: te pueden apuntar en su lista de espera y avisarte si se libera uno."}
              </Alert>
            )}

            {stage === "when" && days.length > 0 && shownMonth && day && (
              <section aria-labelledby="h-cuando" className="flex flex-col gap-3">
                <h2 id="h-cuando" className="text-lg font-semibold">
                  Elige día y hora
                </h2>
                {/* Sin márgenes de más: a 360 px caben los 7 días de 44 px. */}
                <div className="flex flex-col gap-1 rounded-lg border border-border bg-bg p-1">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      aria-label="Mes anterior"
                      disabled={!firstMonth || shownMonth <= firstMonth}
                      onClick={() => setMonth(addMonths(shownMonth, -1))}
                      className="tap flex items-center justify-center rounded-md hover:bg-surface disabled:opacity-30"
                    >
                      <ChevronLeft aria-hidden="true" className="size-6" />
                    </button>
                    <p className="font-semibold first-letter:uppercase" aria-live="polite">
                      {monthTitle(shownMonth)}
                    </p>
                    <button
                      type="button"
                      aria-label="Mes siguiente"
                      disabled={!lastMonth || shownMonth >= lastMonth}
                      onClick={() => setMonth(addMonths(shownMonth, 1))}
                      className="tap flex items-center justify-center rounded-md hover:bg-surface disabled:opacity-30"
                    >
                      <ChevronRight aria-hidden="true" className="size-6" />
                    </button>
                  </div>
                  <table className="w-full table-fixed border-collapse text-center" aria-label={`Días de ${monthTitle(shownMonth)}`}>
                    <thead>
                      <tr className="text-xs text-text-muted">
                        {["L", "M", "X", "J", "V", "S", "D"].map((d, i) => (
                          <th key={d} scope="col" className="py-1 font-semibold">
                            <abbr title={["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"][i]} className="no-underline">
                              {d}
                            </abbr>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeksOf(shownMonth).map((week, wi) => (
                        <tr key={wi}>
                          {week.map((d, di) => {
                            if (!d) return <td key={di} />;
                            const free = byDay.get(d)?.length ?? 0;
                            const chosen = d === day;
                            const name = `${dayLong(`${d}T12:00:00Z`)}${free ? `, ${free === 1 ? "1 hora libre" : `${free} horas libres`}` : ", sin huecos"}`;
                            return (
                              <td key={di}>
                                <button
                                  type="button"
                                  aria-label={name}
                                  aria-pressed={chosen}
                                  disabled={!free}
                                  onClick={() => {
                                    setDay(d);
                                    setAt(null);
                                  }}
                                  data-day={d}
                                  className={cx(
                                    "tap mx-auto flex items-center justify-center rounded-full text-base tabular-nums",
                                    chosen ? "bg-accent font-bold text-on-accent" : free ? "font-semibold text-text hover:bg-accent-soft" : "text-text-muted opacity-40",
                                  )}
                                >
                                  {Number(d.slice(8))}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-col gap-3">
                  <p className="font-semibold first-letter:uppercase">{dayLong(`${day}T12:00:00Z`)}</p>
                  {[
                    { label: "Mañana", list: times.filter((t) => Number(hour(t.at).slice(0, 2)) < 14) },
                    { label: "Tarde", list: times.filter((t) => Number(hour(t.at).slice(0, 2)) >= 14) },
                  ]
                    .filter((g) => g.list.length)
                    .map((g) => (
                      <div key={g.label} role="group" aria-label={`${g.label}: horas libres`} className="flex flex-col gap-2">
                        <p className="text-sm text-text-muted">{g.label}</p>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                          {g.list.map((t) => (
                            <button
                              key={t.at}
                              type="button"
                              onClick={() => {
                                setAt(t.at);
                                setError(null);
                                goTop();
                              }}
                              className="tap rounded-md border border-border-input bg-bg font-semibold tabular-nums hover:border-accent"
                            >
                              {hour(t.at)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {stage === "data" && kind && at && (
              <form onSubmit={submit} noValidate>
                <Card className="flex flex-col gap-4">
                  <h2 className="text-lg font-semibold">Tus datos</h2>
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
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
