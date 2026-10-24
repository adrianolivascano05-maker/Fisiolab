// Lo que ve el paciente al abrir el enlace de su cita (…/cita/<código>): cuándo es y un botón para anularla, sin cuenta
// ni contraseña (el código del enlace hace de llave). Al anularla, el hueco queda libre en la página de reservas al
// momento y la clínica lo ve en su agenda la próxima vez que abra la app.
import { CalendarX2 } from "lucide-react";
import { useEffect, useState } from "react";
import { errorText, failText, serverUrl } from "../app/publicServer";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Logo } from "../ui/Logo";

type Cita = { startsAt: string; with: string; clinic: string; cancelled: boolean; past: boolean; slug: string | null; pro?: string | null };
type Phase = { kind: "loading" } | { kind: "error"; text: string } | { kind: "ready"; cita: Cita };

const BASE = import.meta.env.BASE_URL;
const TZ = "Europe/Madrid";
const when = (iso: string) =>
  `${new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })} a las ${new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}`;

/** Su página de reservas, con el mismo fisio ya elegido si se sabe. */
const bookAgain = (c: Cita) => `${BASE}reservar/${c.slug}${c.pro ? `?con=${encodeURIComponent(c.pro)}` : ""}`;
const withName = (c: Cita) => c.with.replace(/^con /, "");

const tokenFromUrl = () => /\/cita\/([A-Za-z0-9_-]{20,64})\/?$/.exec(location.pathname)?.[1] ?? "";

export function PublicCancelPage() {
  const [token] = useState(tokenFromUrl);
  const [phase, setPhase] = useState<Phase>(() => (token ? { kind: "loading" } : { kind: "error", text: "El enlace está incompleto. Ábrelo tal como te llegó, entero." }));
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Tu cita · Cénit";
    if (!token) return;
    void (async () => {
      try {
        const base = await serverUrl();
        const res = await fetch(`${base}/v1/citas/${token}`, { cache: "no-store" });
        if (!res.ok) throw new Error((await errorText(res)) || "No se ha podido abrir tu cita.");
        setPhase({ kind: "ready", cita: (await res.json()) as Cita });
      } catch (e) {
        setPhase({ kind: "error", text: failText(e) });
      }
    })();
  }, [token]);

  const cancel = async () => {
    if (phase.kind !== "ready") return;
    setError(null);
    setSending(true);
    try {
      const base = await serverUrl();
      const res = await fetch(`${base}/v1/citas/${token}/anular`, { method: "POST" });
      if (!res.ok) throw new Error((await errorText(res)) || "No se ha podido anular. Prueba otra vez.");
      setPhase({ kind: "ready", cita: { ...phase.cita, cancelled: true } });
      setAsking(false);
    } catch (e) {
      setError(failText(e));
    } finally {
      setSending(false);
    }
  };

  const cita = phase.kind === "ready" ? phase.cita : null;
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b-2 border-highlight bg-brand text-on-brand">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Logo onDark />
          {cita?.clinic && <p className="min-w-0 truncate font-semibold">{cita.clinic}</p>}
        </div>
      </header>
      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5 pb-16">
        {phase.kind === "loading" && <p className="text-text-muted">Abriendo tu cita…</p>}
        {phase.kind === "error" && <Alert tone="danger" title={phase.text} />}
        {cita && (
          <>
            <h1 className="text-2xl leading-tight font-bold">Tu cita</h1>
            <Card className="flex flex-col gap-1">
              <p className={cita.cancelled ? "text-lg font-semibold line-through" : "text-lg font-semibold"}>{when(cita.startsAt)}</p>
              {cita.with && <p>{cita.with.startsWith("con ") ? cita.with[0]!.toUpperCase() + cita.with.slice(1) : `Con ${cita.with}`}</p>}
              {cita.clinic && <p className="text-text-muted">{cita.clinic}</p>}
            </Card>
            {cita.cancelled ? (
              <Alert tone="success" title="Cita anulada">
                Ya está: la clínica lo verá en su agenda y el hueco queda libre para otra persona.
                {cita.slug && (
                  <>
                    {" "}
                    Si quieres otra,{" "}
                    <a className="text-accent underline" href={bookAgain(cita)}>
                      {cita.pro && cita.with ? `pide otra cita con ${withName(cita)}` : "pide cita aquí"}
                    </a>
                    .
                  </>
                )}
              </Alert>
            ) : cita.past ? (
              <Alert tone="info" title="Esta cita ya ha pasado">
                Si quieres cambiar algo, escribe o llama a la clínica.
              </Alert>
            ) : asking ? (
              <Card className="flex flex-col gap-3">
                <p className="font-semibold">¿Seguro que quieres anularla?</p>
                <p className="text-sm text-text-muted">El hueco quedará libre para otra persona.</p>
                {error && <Alert tone="danger" title={error} />}
                <div className="flex flex-wrap gap-2">
                  <Button variant="danger" loading={sending} onClick={() => void cancel()}>
                    Sí, anular la cita
                  </Button>
                  <Button variant="secondary" onClick={() => setAsking(false)}>
                    No, la mantengo
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                <p>¿No puedes venir? Anúlala aquí y el hueco quedará libre para otra persona.</p>
                <Button variant="secondary" size="lg" block icon={<CalendarX2 aria-hidden="true" className="size-5" />} onClick={() => setAsking(true)}>
                  Anular la cita
                </Button>
                {cita.slug && (
                  <p className="text-sm text-text-muted">
                    ¿Prefieres otro día? Anula esta y{" "}
                    <a className="text-accent underline" href={bookAgain(cita)}>
                      {cita.pro && cita.with ? `pide otra con ${withName(cita)}` : "pide otra cita"}
                    </a>
                    .
                  </p>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
