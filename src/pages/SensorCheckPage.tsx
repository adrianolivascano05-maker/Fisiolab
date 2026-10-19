import { useState } from "react";
import { fmt } from "../app/format";
import { Page } from "../app/Page";
import { angleBetween, longAxisFromVertical } from "../calc/rom";
import { getDb } from "../data/db";
import { setSetting } from "../data/repo";
import { useInclinometer } from "../rom/useInclinometer";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { useToast } from "../ui/Toast";

export type SensorCheck = { at: string; flat: number; turned: number; vertical: number; spread: number; ok: boolean };

/** Tolerancia de cada comprobación, en grados (lo habitual que se exige a un inclinómetro clínico). */
export const SENSOR_TOL = 1;

type Step = "flat" | "turned" | "vertical" | "repeat";

const steps: { id: Step; title: string; text: string }[] = [
  { id: "flat", title: "1. Sobre una mesa", text: "Deja el móvil plano, con la pantalla hacia arriba, sobre una mesa nivelada (o el suelo). Sin tocarlo, espera a que ponga «quieto» y pulsa Leer." },
  { id: "turned", title: "2. Girado media vuelta", text: "En el mismo sitio, gíralo 180° sobre la mesa (la parte de arriba hacia abajo) y vuelve a leer. Si la mesa está algo inclinada, la diferencia entre las dos lecturas descubre el error del sensor." },
  { id: "vertical", title: "3. De pie contra un marco", text: "Apoya el canto largo del móvil contra el marco de una puerta (vertical) y lee." },
  { id: "repeat", title: "4. Repetición", text: "Vuelve a ponerlo plano en el mismo sitio 3 veces, leyendo cada vez." },
];

/** Comprobación del inclinómetro: plano, girado 180°, vertical y repetición. */
export function SensorCheckPage() {
  const toast = useToast();
  const sensor = useInclinometer();
  const [values, setValues] = useState<Partial<Record<Step, number[]>>>({});
  // Inclinación de la pantalla respecto a la horizontal (0° plano) y del canto largo respecto a la vertical.
  const tilt = sensor.up ? Math.min(angleBetween(sensor.up, [0, 0, 1]), angleBetween(sensor.up, [0, 0, -1])) : null;
  const edge = sensor.up ? longAxisFromVertical(sensor.up) : null;
  const read = (s: Step) => {
    const v = s === "vertical" ? edge : tilt;
    if (v === null || Number.isNaN(v)) return;
    setValues((x) => ({ ...x, [s]: s === "repeat" ? [...(x.repeat ?? []), v].slice(-3) : [v] }));
  };

  const flat = values.flat?.[0];
  const turned = values.turned?.[0];
  const vertical = values.vertical?.[0];
  const rep = values.repeat ?? [];
  const spread = rep.length >= 2 ? Math.max(...rep) - Math.min(...rep) : null;
  // Con la mesa algo inclinada (s) y un error del sensor (e), las lecturas son ≈ |s + e| y |s − e|.
  const offset = flat !== undefined && turned !== undefined ? Math.abs(flat - turned) / 2 : null;
  const done = offset !== null && vertical !== undefined && spread !== null && rep.length === 3;
  const ok = done && offset! <= SENSOR_TOL && vertical! <= SENSOR_TOL && spread! <= SENSOR_TOL;

  return (
    <Page title="Comprobar el sensor" backTo="/validacion?tipo=rom_angle" tabs={false}>
      <p className="text-text-muted">Antes de fiarte del inclinómetro, comprueba en 2 minutos que el sensor de este móvil mide bien. Cada lectura debería quedar a 1° o menos.</p>
      {sensor.status === "idle" || sensor.status === "denied" || sensor.status === "unavailable" ? (
        <>
          {sensor.status === "denied" && <Alert tone="warning" title="Sin permiso">Permite el acceso a los sensores de movimiento y vuelve a intentarlo.</Alert>}
          {sensor.status === "unavailable" && <Alert tone="warning" title="Sin sensor">Este dispositivo o navegador no da la inclinación.</Alert>}
          <Button size="lg" block onClick={() => void sensor.start()}>
            Activar el sensor
          </Button>
        </>
      ) : (
        <Card className="flex flex-col items-center gap-1" aria-live="polite">
          <span className="text-sm text-text-muted">Pantalla respecto a la horizontal · canto largo respecto a la vertical</span>
          <span className="nums text-display">
            {fmt(tilt, 1)}° · {fmt(edge, 1)}°
          </span>
          <span className={sensor.stable ? "text-sm font-semibold text-success" : "text-sm text-text-muted"}>{sensor.stable ? "Quieto" : "Moviéndose…"}</span>
        </Card>
      )}

      {steps.map((s) => {
        const got = values[s.id] ?? [];
        return (
          <Card key={s.id} className="flex flex-col gap-2">
            <h2 className="text-lg">{s.title}</h2>
            <p className="text-sm text-text-muted">{s.text}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="nums text-sm">{got.length ? got.map((v) => `${fmt(v, 1)}°`).join(" · ") : "Sin leer"}</span>
              <Button variant="secondary" disabled={sensor.status !== "live" || !sensor.stable} onClick={() => read(s.id)}>
                Leer{s.id === "repeat" ? ` (${rep.length}/3)` : ""}
              </Button>
            </div>
          </Card>
        );
      })}

      {done && (
        <>
          <Alert tone={ok ? "success" : "warning"} title={ok ? "El sensor mide bien" : "El sensor se desvía"}>
            Error del sensor ≈ {fmt(offset, 1)}°, vertical {fmt(vertical, 1)}°, repetición ±{fmt(spread! / 2, 1)}°.{" "}
            {ok ? "Puedes usar el inclinómetro con confianza." : "Usa el goniómetro o la foto para la movilidad, o repite la comprobación sobre una superficie firme."}
          </Alert>
          <Button
            onClick={async () => {
              const check: SensorCheck = { at: new Date().toISOString(), flat: flat!, turned: turned!, vertical: vertical!, spread: spread!, ok };
              await setSetting(getDb(), "sensor_check", check);
              toast("Comprobación guardada", "success");
            }}
          >
            Guardar la comprobación
          </Button>
        </>
      )}
    </Page>
  );
}
