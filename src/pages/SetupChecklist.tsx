// «Pon en marcha tu clínica», arriba de Ajustes: los pasos para empezar, cada uno con su enlace y si ya está hecho,
// en vez de un punto rojo y apartados repartidos. Solo mira lo que ya hay (datos de la clínica, marca, precio, PIN,
// pacientes y copia); no guarda nada nuevo. Desaparece sola al completarla, o con «Ocultar» (en este dispositivo).
import { CircleCheck, Circle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useAsync } from "../app/useAsync";
import { ownIdentity, useBrand } from "../brand/brand";
import { useCloud } from "../cloud/cloudContext";
import { getPricing } from "../data/billing";
import { getDb } from "../data/db";
import { clinicComplete, getClinic } from "../data/privacy";
import { SEED_PREFIX } from "../data/seed";
import { getSetting } from "../data/settings";
import { getLock } from "../privacy/pin";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";

const HIDE_KEY = "omniclin.puesta-en-marcha-oculta";
const hidden = () => {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
};

export type SetupStep = { id: string; title: string; hint: string; to: string; done: boolean };

/** Los pasos y si están hechos (puro: lo prueba SetupChecklist.test.ts). */
export function setupSteps(s: { clinicReady: boolean; ownBrand: boolean; price: boolean; pin: boolean; patients: boolean; backup: boolean }): SetupStep[] {
  return [
    { id: "clinica", title: "Rellena los datos de tu clínica", hint: "Nombre, NIF y correo: salen en informes, justificantes y protección de datos", to: "/ajustes/clinica", done: s.clinicReady },
    { id: "marca", title: "Pon tu marca", hint: "Nombre, colores y logo en la app y en los documentos", to: "/ajustes/marca", done: s.ownBrand },
    { id: "precio", title: "Pon el precio de tus sesiones", hint: "Para saber qué se debe y cobrar en un toque; los bonos, también ahí", to: "/ajustes/cobros", done: s.price },
    { id: "pin", title: "Pon un PIN al móvil", hint: "Que nadie vea los pacientes si dejas el móvil", to: "/ajustes/bloqueo", done: s.pin },
    { id: "pacientes", title: "Trae a tus pacientes", hint: "Desde Excel o CSV de tu programa de antes, o uno a uno", to: "/ajustes/importar", done: s.patients },
    { id: "copia", title: "Guarda una copia fuera del móvil", hint: "Una copia fuera del móvil por si se pierde o se rompe", to: "/ajustes/datos", done: s.backup },
  ];
}

export function SetupChecklist() {
  const cloud = useCloud();
  const brand = useBrand();
  const [off, setOff] = useState(hidden);
  const data = useAsync(async () => {
    const db = getDb();
    const [clinic, pricing, lastBackup, [row]] = await Promise.all([
      getClinic(db),
      getPricing(db),
      getSetting<string>(db, "last_backup_at"),
      db.query<{ n: number }>("select count(*) as n from patients where name not like ? || '%'", [SEED_PREFIX]),
    ]);
    return { clinicReady: clinicComplete(clinic), price: pricing.sessionCents !== null, backup: !!lastBackup || !!cloud, patients: (row?.n ?? 0) > 0 };
  }, [cloud]);
  if (off || !data.data) return null;
  const steps = setupSteps({ ...data.data, ownBrand: !!ownIdentity(brand), pin: !!getLock() || !!cloud?.clinic });
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section aria-labelledby="puesta-en-marcha" className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3 lg:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="puesta-en-marcha" className="text-base">
          Pon en marcha tu clínica · {done} de {steps.length}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            try {
              localStorage.setItem(HIDE_KEY, "1");
            } catch {
              /* sin almacenamiento: se oculta mientras la app esté abierta */
            }
            setOff(true);
          }}
        >
          Ocultar
        </Button>
      </div>
      <ol className="flex flex-col">
        {steps.map((s) => (
          <li key={s.id}>
            <Link to={s.to} className="flex min-h-12 items-start gap-3 rounded-md px-1 py-2 hover:bg-surface">
              {s.done ? <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" /> : <Circle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-text-muted" />}
              <span className="flex min-w-0 flex-col">
                <span className={cx("font-semibold", s.done && "text-text-muted line-through")}>
                  {s.title}
                  <span className="sr-only">{s.done ? " (hecho)" : " (pendiente)"}</span>
                </span>
                {!s.done && <span className="text-sm text-text-muted">{s.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
