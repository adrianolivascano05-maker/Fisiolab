// «Primeros pasos» en la pantalla de Pacientes: lo que conviene dejar listo al empezar, con lo ya hecho marcado.
// Desaparece cuando está todo hecho, o al pulsar «Ocultar».
import { Circle, CircleCheck } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useCloud } from "../cloud/CloudGate";
import { getDb } from "../data/db";
import { clinicComplete, getClinic } from "../data/privacy";
import { getLock } from "../privacy/pin";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { useInstall } from "./pwa";
import { useAsync } from "./useAsync";

const HIDE_KEY = "fisiolab.first-steps-hidden";

function hiddenByUser(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

type Step = { to: string; title: string; detail: string; done: boolean };

/** `hasPatients`: ya hay algún paciente propio (no de ejemplo ni la ficha de la medición rápida). */
export function FirstSteps({ hasPatients }: { hasPatients: boolean }) {
  const cloud = useCloud();
  const install = useInstall();
  const [hidden, setHidden] = useState(hiddenByUser);
  const clinic = useAsync(() => getClinic(getDb()), []);
  if (hidden || !clinic.data) return null;

  const steps: Step[] = [
    ...(cloud
      ? []
      : [{ to: "/cuenta", title: "Iniciar sesión con Google", detail: "Tus pacientes en tu Drive y en todos tus dispositivos.", done: false }]),
    { to: "/ajustes/clinica", title: "Los datos de tu clínica", detail: "Para la hoja de protección de datos que firma cada paciente.", done: clinicComplete(clinic.data) },
    { to: "/pacientes/nuevo", title: "Tu primer paciente", detail: "Con el nombre basta para empezar.", done: hasPatients },
    { to: "/instalar", title: "Instalar la app en este dispositivo", detail: "Se abre sin internet, como cualquier app.", done: install.state === "installed" },
    { to: "/ajustes/bloqueo", title: "Un PIN para abrirla (opcional)", detail: "Si otras personas usan este dispositivo.", done: !!getLock() },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;

  return (
    <section aria-labelledby="h-primeros">
      <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="h-primeros" className="text-lg">
          Primeros pasos
        </h2>
        <span className="nums text-sm text-text-muted">
          {done} de {steps.length} hechos
        </span>
      </div>
      <ol className="flex flex-col">
        {steps.map((s) => (
          <li key={s.to}>
            <Link to={s.to} className="flex min-h-14 items-start gap-3 rounded-md px-1 py-2 hover:bg-surface">
              {s.done ? (
                <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
              ) : (
                <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-text-muted" />
              )}
              <span className="flex flex-1 flex-col">
                <span className={cx("font-semibold", s.done && "text-text-muted")}>{s.title}</span>
                {!s.done && <span className="text-sm text-text-muted">{s.detail}</span>}
              </span>
              {s.done && <span className="pt-0.5 text-sm font-semibold text-success">Hecho</span>}
            </Link>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/ayuda" className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-2">
          Cómo se usa la app
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            try {
              localStorage.setItem(HIDE_KEY, "1");
            } catch {
              /* sin almacenamiento: se oculta solo ahora */
            }
            setHidden(true);
          }}
        >
          Ocultar
        </Button>
      </div>
      </Card>
    </section>
  );
}
