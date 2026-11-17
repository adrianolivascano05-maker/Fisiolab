// La semana del paciente, solo para leer (src/data/cyclesShare.ts): sus ejercicios con lo que marcó el fisio, «Cómo se
// hace» si lo escribió, sus próximas citas y, si se marcó, la línea de fases con «estás aquí» y el objetivo general.
// No hay nada que rellenar ni que enviar.
import { CalendarCheck, Lock } from "lucide-react";
import type { FormRequest } from "../clinical/patientForms";
import type { WeekShare } from "../data/cyclesShare";
import { cx } from "../ui/cx";
import { phaseChip } from "../clinical/cycles/phaseColors";

const TZ = "Europe/Madrid";
/** «lunes 16 de noviembre» (un día AAAA-MM-DD). */
const dayText = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("es-ES", { ...o, timeZone: "UTC" });
  return `${part({ weekday: "long" })} ${part({ day: "numeric" })} de ${part({ month: "long" })}`;
};
/** «martes, 17 de noviembre, 10:00», en la hora de Madrid (la de la clínica). */
const visitText = (iso: string) => new Date(iso).toLocaleString("es-ES", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ });

/** Lo del enlace, comprobado por encima (lo escribe la app, pero se lee en el móvil del paciente). */
function weekOf(request: FormRequest): WeekShare | null {
  const w = request.week;
  if (!w || w.v !== 1 || typeof w.from !== "string" || typeof w.to !== "string" || !Array.isArray(w.sessions)) return null;
  return { ...w, sessions: w.sessions.filter((s) => Array.isArray(s?.items)) };
}

/** `preview`: dentro de la app («Así lo verá»), con los títulos un nivel más abajo. */
export function WeekView({ request, preview = false }: { request: FormRequest; preview?: boolean }) {
  const H = preview ? "h3" : "h2";
  const week = weekOf(request);
  const visits = Array.isArray(request.visits) ? request.visits.filter((v) => typeof v === "string") : [];
  const clinic = request.controller?.name || request.clinic || "tu clínica";
  // Caduca el lunes a las 0:00: vale hasta el domingo.
  const until = new Date(Date.parse(request.expiresAt) - 60_000).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
  if (!week) return <p>Este enlace no trae ejercicios. Pídeselo otra vez a tu fisioterapeuta.</p>;
  const plan = week.plan;
  return (
    <div className="flex flex-col gap-4">
      {preview ? (
        <p className="text-2xl leading-tight font-bold">{request.name ? `Hola, ${request.name}` : "Hola"}</p>
      ) : (
        <h1 className="text-2xl leading-tight font-bold">{request.name ? `Hola, ${request.name}` : "Hola"}</h1>
      )}
      <p>
        Tus ejercicios de esta semana, del <span className="whitespace-nowrap">{dayText(week.from)}</span> al <span className="whitespace-nowrap">{dayText(week.to)}</span>.
        {week.perWeek > 0 ? ` ${week.perWeek === 1 ? "1 sesión" : `${week.perWeek} sesiones`} por semana.` : ""}
      </p>
      {request.brand?.patient?.welcome && <p className="text-lg">{request.brand.patient.welcome}</p>}

      {plan && Array.isArray(plan.phases) && plan.phases.length > 0 && (
        <section aria-labelledby="h-plan" className="flex flex-col gap-2 rounded-md border border-border bg-bg p-3">
          <H id="h-plan" className="text-lg">
            Tu plan
          </H>
          {plan.goal && <p className="font-semibold">{plan.goal}</p>}
          <ol aria-label="Fases" className="flex flex-wrap gap-1.5">
            {plan.phases.map((name, i) => (
              <li
                key={`${i}-${name}`}
                aria-current={i === plan.at ? "step" : undefined}
                className={cx("rounded-md border px-3 py-1 text-sm", phaseChip(i), i === plan.at ? "border-2 font-semibold" : "border-transparent")}
              >
                {i + 1} · {name}
                {i === plan.at && <span className="block text-xs">Estás aquí · semana {plan.week + 1} de {plan.weeks}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {week.sessions.map((s, si) => (
        <section key={si} aria-label={s.label ? `Sesión ${s.label}` : "Tus ejercicios"} className="flex flex-col gap-2">
          {s.label && <H className="text-lg">Sesión {s.label}</H>}
          <ol className="flex flex-col gap-2">
            {s.items.map((it, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-md border border-border bg-bg p-3">
                <p className="font-semibold">
                  {i + 1}. {it.name}
                </p>
                {it.dose && <p className="nums">{it.dose}</p>}
                {it.how && (
                  <p className="text-sm whitespace-pre-line text-text-muted">
                    <span className="font-semibold text-text">Cómo se hace: </span>
                    {it.how}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}

      {visits.length > 0 && (
        <section aria-labelledby="h-citas" className="flex flex-col gap-2">
          <H id="h-citas" className="text-lg">
            Tus próximas citas
          </H>
          <ul className="flex flex-col gap-2">
            {visits.map((v) => (
              <li key={v} className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2">
                <CalendarCheck aria-hidden="true" className="size-5 shrink-0 text-accent" />
                <span className="min-w-0 flex-1 first-letter:uppercase">{visitText(v)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Tus datos" className="flex gap-2 rounded-md bg-bg p-3 text-sm">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-text-muted" />
        <p>
          Esta página va cifrada: solo se lee con este enlace, ni OmniClin ni el servidor por donde pasa pueden leerla. Te la manda {clinic}
          {request.controller?.email ? ` (${request.controller.email})` : ""}, responsable de tus datos: puedes pedirle verlos, corregirlos o borrarlos. No reenvíes el
          enlace. Es solo para leer: no hace falta que envíes nada.
        </p>
      </section>
      <p className="text-center text-xs text-text-muted">El enlace vale hasta el {until}.</p>
    </div>
  );
}
