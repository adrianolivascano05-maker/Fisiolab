// Ajustes › Reserva online: encenderla, la dirección de la página, los tipos de cita, el horario (o los turnos de cada
// fisio), la antelación y quién sale. Se guarda en la base de la clínica (para todo el equipo) y se publica en su
// servidor: solo los tipos de cita, los nombres de los fisios y las franjas libres, nunca citas ni pacientes.
import { CalendarCheck, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { bumpData } from "../app/dataVersion";
import { logError } from "../app/errorLog";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { TextArea } from "../clinical/parts";
import { formsBase } from "../clinical/patientForms";
import { useCloud } from "../cloud/CloudGate";
import { useTeamMode } from "../cloud/teamMode";
import { getDb } from "../data/db";
import { getClinic } from "../data/privacy";
import { useStaff } from "../schedule/useStaff";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextField } from "../ui/Field";
import { QrCode } from "../ui/QrCode";
import { useToast } from "../ui/Toast";
import type { Range, Weekday, WeeklyHours } from "./availability";
import { getBookingSettings, isSlug, newProId, saveBookingSettings, slugify, type BookingKind, type BookingSettings } from "./settings";
import { publishBooking } from "./sync";

const DAYS: { id: Weekday; name: string }[] = [
  { id: 1, name: "Lunes" },
  { id: 2, name: "Martes" },
  { id: 3, name: "Miércoles" },
  { id: 4, name: "Jueves" },
  { id: 5, name: "Viernes" },
  { id: 6, name: "Sábado" },
  { id: 7, name: "Domingo" },
];
const MINUTES = [15, 20, 30, 40, 45, 50, 60, 75, 90, 120];

/** La dirección de la página de reservas de la clínica. */
export const bookingUrl = (slug: string) => `${formsBase()}reservar/${slug}`;

/** Mañana y tarde de un día: dos franjas como mucho, vacías si ese rato no se abre. */
function DayHours({ name, ranges, onChange }: { name: string; ranges: Range[]; onChange: (r: Range[]) => void }) {
  const slots: (Range | null)[] = [ranges[0] ?? null, ranges[1] ?? null];
  const set = (i: number, r: Range | null) => {
    const next = [...slots];
    next[i] = r;
    onChange(next.filter((x): x is Range => !!x && x[0] < x[1]));
  };
  return (
    <fieldset className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
      <legend className="sr-only">{name}</legend>
      <p aria-hidden="true" className="font-semibold">
        {name}
        {!ranges.length && <span className="font-normal text-text-muted"> · cerrado</span>}
      </p>
      {slots.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              className="size-5 accent-accent"
              checked={!!r}
              onChange={(e) => set(i, e.target.checked ? (i === 0 ? ["09:00", "14:00"] : ["16:00", "20:00"]) : null)}
            />
            {i === 0 ? "Mañana" : "Tarde"}
          </label>
          {r && (
            <span className="flex items-center gap-1.5">
              <input
                type="time"
                step={900}
                aria-label={`${name}, ${i === 0 ? "mañana" : "tarde"}: desde`}
                className="tap rounded-md border border-border-input bg-bg px-2"
                value={r[0]}
                onChange={(e) => set(i, [e.target.value, r[1]])}
              />
              a
              <input
                type="time"
                step={900}
                aria-label={`${name}, ${i === 0 ? "mañana" : "tarde"}: hasta`}
                className="tap rounded-md border border-border-input bg-bg px-2"
                value={r[1]}
                onChange={(e) => set(i, [r[0], e.target.value])}
              />
            </span>
          )}
        </div>
      ))}
    </fieldset>
  );
}

export function BookingSettingsPage() {
  const cloud = useCloud();
  const toast = useToast();
  const staff = useStaff();
  const { team } = useTeamMode();
  const online = !!(cloud?.clinic && cloud.clinics);
  const loaded = useAsync(async () => {
    const db = getDb();
    const [s, clinic] = await Promise.all([getBookingSettings(db), getClinic(db)]);
    return { ...s, slug: s.slug || slugify(clinic.name || cloud?.clinic?.name || "mi-clinica") };
  }, []);
  const [draft, setDraft] = useState<BookingSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<string | null>(null);

  if (loaded.error) return <Page title="Reserva online" backTo="/ajustes"><LoadError error={loaded.error} /></Page>;
  if (!loaded.data) return <Page title="Reserva online" backTo="/ajustes"><Loading /></Page>;
  const s = draft ?? loaded.data;
  const set = (p: Partial<BookingSettings>) => {
    setDraft({ ...s, ...p });
    setError(null);
  };
  const setKind = (i: number, p: Partial<BookingKind>) => set({ kinds: s.kinds.map((k, j) => (j === i ? { ...k, ...p } : k)) });
  const setDay = (d: Weekday, r: Range[]) => {
    const hours: WeeklyHours = { ...s.hours };
    if (r.length) hours[d] = r;
    else delete hours[d];
    set({ hours });
  };
  const savedSlug = loaded.data.enabled ? loaded.data.slug : null;
  const liveSlug = published ?? (draft ? null : savedSlug);

  const save = async () => {
    setError(null);
    if (!isSlug(s.slug)) return setError("La dirección solo puede llevar letras sin tilde, números y guiones (de 3 a 40), sin guion al principio ni al final.");
    const kinds = s.kinds.map((k) => ({ ...k, label: k.label.trim() })).filter((k) => k.label);
    if (s.enabled && !kinds.length) return setError("Pon al menos un tipo de cita.");
    if (s.enabled && team && !s.pros.length) return setError("Elige quién sale en la reserva.");
    if (s.enabled && !team && !Object.keys(s.hours).length) return setError("Pon el horario: al menos un día con mañana o tarde.");
    setSaving(true);
    const next = { ...s, kinds };
    try {
      const db = getDb();
      await saveBookingSettings(db, next);
      const r = await publishBooking(db, cloud, team, true);
      setDraft(null);
      loaded.reload();
      setPublished(r === "published" ? next.slug : null);
      bumpData();
      toast(r === "published" ? "Guardado: la página ya está publicada" : next.enabled ? "Guardado" : "Guardado: la reserva por internet está apagada", "success");
    } catch (e) {
      logError("reserva online (ajustes)", e);
      setError(e instanceof Error ? e.message : "No se ha podido guardar. Revisa la conexión.");
    } finally {
      setSaving(false);
    }
  };

  const url = liveSlug ? bookingUrl(liveSlug) : null;
  return (
    <Page title="Reserva online" backTo="/ajustes">
      <p className="text-text-muted">
        Tus pacientes piden cita desde una página de la clínica, a cualquier hora, en los huecos libres de la agenda. Les llega la confirmación por WhatsApp con un
        enlace para anularla.
      </p>
      {!online ? (
        <Alert tone="info" title="Hace falta el servidor de la clínica">
          Para la reserva online tienes que trabajar en una clínica con el servidor de Cénit (el mismo de los formularios para el paciente):{" "}
          <Link to="/ajustes/cuenta" className="py-3 font-semibold underline underline-offset-2">
            Ajustes › Cuenta de Google
          </Link>
          .
        </Alert>
      ) : (
        <>
          {url && (
            <Card className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <CalendarCheck aria-hidden="true" className="size-5 text-success" />
                Tu página está publicada
              </h2>
              <a className="break-all text-accent underline" href={url} target="_blank" rel="noreferrer">
                {url}
              </a>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<Copy aria-hidden="true" className="size-5" />} onClick={() => void navigator.clipboard?.writeText(url).then(() => toast("Enlace copiado", "success"))}>
                  Copiar el enlace
                </Button>
                <a
                  className="tap inline-flex items-center gap-2 rounded-md border border-border-input bg-bg px-4 font-semibold hover:bg-surface"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink aria-hidden="true" className="size-5" />
                  Ver la página
                </a>
              </div>
              <p className="text-sm text-text-muted">Ponlo en tu web, en Google, en Instagram o en el WhatsApp de la clínica. Este código lo abre con la cámara del móvil:</p>
              <QrCode text={url} label="Código QR de la página de reservas" className="size-40" />
            </Card>
          )}

          <Card className="flex flex-col gap-4">
            <label className="flex min-h-11 items-center gap-3 font-semibold">
              <input type="checkbox" className="size-5 accent-accent" checked={s.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
              Reserva por internet encendida
            </label>
            <TextField
              label="Dirección de la página"
              hint={`Queda así: ${bookingUrl(s.slug || "…")}`}
              value={s.slug}
              autoCapitalize="none"
              spellCheck={false}
              onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
            />
            <TextArea label="Unas palabras de bienvenida (si quieres)" hint="Por ejemplo, dónde estáis o qué traer el primer día." value={s.intro} onChange={(v) => set({ intro: v.slice(0, 500) })} />
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Tipos de cita</h2>
            {s.kinds.map((k, i) => (
              <div key={k.id} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <TextField label={`Tipo ${i + 1}`} value={k.label} onChange={(e) => setKind(i, { label: e.target.value.slice(0, 60) })} />
                </div>
                <div className="w-28 shrink-0">
                  <SelectField label="Duración" value={String(k.minutes)} onChange={(e) => setKind(i, { minutes: Number(e.target.value) })}>
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </SelectField>
                </div>
                <IconButton label={`Quitar ${k.label || `el tipo ${i + 1}`}`} onClick={() => set({ kinds: s.kinds.filter((_, j) => j !== i) })}>
                  <Trash2 aria-hidden="true" className="size-5" />
                </IconButton>
              </div>
            ))}
            <Button
              variant="secondary"
              icon={<Plus aria-hidden="true" className="size-5" />}
              onClick={() => set({ kinds: [...s.kinds, { id: newProId().toLowerCase().replace(/[^a-z0-9]/g, "") || "tipo", label: "", minutes: 45 }] })}
            >
              Añadir un tipo de cita
            </Button>
          </Card>

          {team && (
            <Card className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">Quién sale en la reserva</h2>
              <p className="text-sm text-text-muted">Cada uno, en los huecos de sus turnos de la agenda. Si alguien no tiene turnos puestos, en el horario de abajo.</p>
              {staff.map((m) => {
                const on = s.pros.find((p) => p.email === m.email);
                return (
                  <label key={m.email} className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-5 accent-accent"
                      checked={!!on}
                      onChange={(e) => set({ pros: e.target.checked ? [...s.pros, { email: m.email, id: newProId(), name: m.name }] : s.pros.filter((p) => p.email !== m.email) })}
                    />
                    {m.name}
                  </label>
                );
              })}
            </Card>
          )}

          <Card className="flex flex-col">
            <h2 className="text-lg font-semibold">Horario de la clínica</h2>
            <p className="text-sm text-text-muted">
              {team ? "Para quien no tenga turnos puestos en la agenda." : "Se ofrecen los huecos de este horario que no tengan ya cita."}
            </p>
            {DAYS.map((d) => (
              <DayHours key={d.id} name={d.name} ranges={s.hours[d.id] ?? []} onChange={(r) => setDay(d.id, r)} />
            ))}
          </Card>

          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Cuándo se puede reservar</h2>
            <SelectField label="Con cuánta antelación como mínimo" value={String(s.minNoticeHours)} onChange={(e) => set({ minNoticeHours: Number(e.target.value) })}>
              {[1, 2, 4, 12, 24, 48].map((h) => (
                <option key={h} value={h}>
                  {h === 1 ? "1 hora" : `${h} horas`}
                </option>
              ))}
            </SelectField>
            <SelectField label="Hasta cuántos días vista" value={String(s.days)} onChange={(e) => set({ days: Number(e.target.value) })}>
              {[7, 14, 30, 60].map((d) => (
                <option key={d} value={d}>
                  {d} días
                </option>
              ))}
            </SelectField>
            <SelectField label="Las citas empiezan" value={String(s.step)} onChange={(e) => set({ step: Number(e.target.value) })}>
              <option value="15">Cada cuarto de hora (10:00, 10:15…)</option>
              <option value="30">Cada media hora (10:00, 10:30…)</option>
              <option value="60">A la hora en punto</option>
            </SelectField>
          </Card>

          {error && <Alert tone="danger" title={error} />}
          <Button size="lg" block loading={saving} onClick={() => void save()}>
            Guardar
          </Button>

          <details className="rounded-md bg-surface p-3 text-sm">
            <summary className="tap flex cursor-pointer items-center font-semibold">Cómo funciona</summary>
            <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
              <li>La app calcula los huecos libres con el horario (o los turnos) menos las citas de la agenda, y los publica en el servidor de la clínica. Al servidor no van citas ni pacientes.</li>
              <li>Lo que escribe el paciente sale cifrado de su móvil y solo lo puede abrir la clínica. El servidor no puede leerlo y lo borra en cuanto la app lo recoge.</li>
              <li>Las reservas entran en la agenda en cuanto hay un dispositivo de la clínica con la app abierta (se mira cada dos minutos). Si es un paciente nuevo, se le abre la ficha con lo que dejó.</li>
              <li>La confirmación por WhatsApp, con el enlace para anular y, si es su primera cita, su anamnesis, sale en Agenda › Envíos.</li>
              <li>Si un paciente anula, el hueco vuelve a salir libre en la página al momento; si tienes lista de espera, es buen momento para mirarla.</li>
            </ul>
          </details>
        </>
      )}
    </Page>
  );
}
