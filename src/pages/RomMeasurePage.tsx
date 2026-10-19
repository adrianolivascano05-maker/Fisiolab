import { Camera, CircleCheck, Hand, Smartphone, Trash2, Waves } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  angleBetween,
  getMovement,
  longAxisFromVertical,
  MAX_SPREAD_DEG,
  movementLabel,
  summarize,
  type Movement,
  type RomMethod,
  type Vec3,
} from "../calc/rom";
import { fmt, parseDecimal } from "../app/format";
import { LoadError, Page } from "../app/Page";
import { getDb } from "../data/db";
import { createRomTest, type Side } from "../data/repo";
import { PhotoProtractor } from "../rom/PhotoProtractor";
import { useInclinometer } from "../rom/useInclinometer";
import { Alert } from "../ui/Alert";
import { Button, IconButton } from "../ui/Button";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { NumberField } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { RomInstructions } from "./RomHelp";

const methods: { id: RomMethod; label: string; icon: typeof Camera }[] = [
  { id: "sensor", label: "Móvil", icon: Smartphone },
  { id: "photo", label: "Foto", icon: Camera },
  { id: "manual", label: "Goniómetro", icon: Hand },
];

/** S19 Movilidad: medir un movimiento con el inclinómetro, sobre una foto o a mano. */
export function RomMeasurePage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const movement = getMovement(params.get("mov") ?? "");
  const side = (params.get("lado") === "right" ? "right" : params.get("lado") === "left" ? "left" : null) as Side | null;
  const back = `/pacientes/${id}/test/movilidad`;
  if (!movement || movement.sided !== (side !== null)) {
    return <Page title="Movilidad" backTo={back}><LoadError error={new Error("Elige de nuevo el movimiento y el lado.")} /></Page>;
  }
  // La clave reinicia el estado al cambiar de movimiento o de lado.
  return <Measure key={`${movement.id}-${side}`} patientId={id} movement={movement} side={side} back={back} />;
}

function Measure({ patientId, movement, side, back }: { patientId: string; movement: Movement; side: Side | null; back: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [method, setMethod] = useState<RomMethod>("sensor");
  const [readings, setReadings] = useState<number[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [wall, setWall] = useState("");
  const [wallError, setWallError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const onPhotoAngle = useCallback((a: number | null) => setCurrent(a), []);

  const add = (value: number) => {
    setReadings((r) => [...r, Math.round(value * 10) / 10]);
  };

  async function save() {
    const w = movement.id === "ankle_lunge" ? parseDecimal(wall) : null;
    if (w !== null && (Number.isNaN(w) || w < 0 || w > 40)) {
      setWallError("Escribe la distancia en centímetros (0-40) o déjala vacía.");
      return;
    }
    setSaving(true);
    try {
      const testId = await createRomTest(getDb(), { patientId, movement: movement.id, side, method, readings, wallDistanceCm: w });
      toast("Medición guardada", "success");
      navigate(`/tests/${testId}`, { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
      setSaving(false);
    }
  }

  const summary = readings.length ? summarize(readings) : null;

  return (
    <Page title={movementLabel(movement, side)} backTo={back} tabs={false}>
      <RomInstructions movement={movement} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold">Cómo medir</legend>
        <div className="grid grid-cols-3 gap-2">
          {methods.map((m) => {
            const unavailable = m.id === "photo" && !movement.photo;
            const locked = readings.length > 0 && m.id !== method;
            return (
              <label key={m.id} className="relative">
                <input
                  type="radio"
                  name="metodo"
                  value={m.id}
                  checked={method === m.id}
                  disabled={unavailable || locked}
                  onChange={() => {
                    setMethod(m.id);
                    setCurrent(null);
                  }}
                  className="peer sr-only"
                />
                <span
                  className={cx(
                    "tap flex flex-col items-center justify-center gap-1 rounded-md border py-2 text-sm font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-50",
                    method === m.id ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg",
                  )}
                >
                  <m.icon aria-hidden="true" className="size-5" />
                  {m.label}
                </span>
              </label>
            );
          })}
        </div>
        {readings.length > 0 && <p className="text-sm text-text-muted">Para cambiar de método, borra antes las lecturas.</p>}
        {!movement.photo && <p className="text-sm text-text-muted">Este movimiento no se puede medir bien en una sola foto.</p>}
      </fieldset>

      {method === "sensor" && <SensorPanel movement={movement} onRead={add} />}
      {method === "photo" && movement.photo && (
        <>
          <PhotoProtractor spec={movement.photo} onAngle={onPhotoAngle} />
          {current !== null && <PhotoReading angle={current} movement={movement} onRead={add} />}
        </>
      )}
      {method === "manual" && <ManualPanel movement={movement} onRead={add} />}

      {readings.length > 0 && (
        <section aria-labelledby="h-lecturas" className="flex flex-col gap-2">
          <h2 id="h-lecturas" className="text-lg">
            Lecturas
          </h2>
          <ul className="flex flex-col gap-1">
            {readings.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded-md border border-border px-3">
                <span>
                  {i + 1}.ª lectura: <span className="nums font-semibold">{fmt(r, 0)}°</span>
                </span>
                <IconButton label={`Borrar la lectura ${i + 1}`} onClick={() => setReadings((rs) => rs.filter((_, j) => j !== i))}>
                  <Trash2 aria-hidden="true" className="size-5" />
                </IconButton>
              </li>
            ))}
          </ul>
          {summary && readings.length > 1 && (
            <p className="nums">
              Media: <span className="font-semibold">{fmt(summary.mean, 0)}°</span>
            </p>
          )}
          {summary && summary.spread > MAX_SPREAD_DEG && (
            <Alert tone="warning" title={`Las lecturas difieren ${fmt(summary.spread, 0)}°`}>
              Si no fue a propósito, borra la que se aleja y repítela.
            </Alert>
          )}
          {summary && summary.max > movement.maxDeg && (
            <Alert tone="warning" title="Valor poco habitual">
              Revisa la posición del móvil o los puntos de la foto.
            </Alert>
          )}
        </section>
      )}

      {movement.id === "ankle_lunge" && (
        <NumberField
          label="Distancia del dedo gordo a la pared (opcional)"
          unit="cm"
          value={wall}
          onChange={(e) => {
            setWall(e.target.value);
            setWallError(undefined);
          }}
          error={wallError}
          hint="La máxima a la que la rodilla aún toca la pared sin levantar el talón."
        />
      )}

      <Button size="lg" block disabled={readings.length === 0} loading={saving} onClick={save}>
        {readings.length > 1 ? `Guardar la media de ${readings.length} lecturas` : "Guardar"}
      </Button>
      {readings.length === 0 && <p className="text-center text-sm text-text-muted">Registra al menos una lectura. Con tres, la media es más fiable.</p>}
    </Page>
  );
}

function BigAngle({ value, label }: { value: number | null; label: string }) {
  return (
    <p className="flex flex-col items-center" data-testid="angulo-actual">
      <span className="text-sm text-text-muted">{label}</span>
      <span className="nums text-display">{value === null || Number.isNaN(value) ? "—" : `${fmt(value, 0)}°`}</span>
    </p>
  );
}

function SensorPanel({ movement, onRead }: { movement: Movement; onRead: (v: number) => void }) {
  const { status, up, stable, start } = useInclinometer();
  const [zero, setZero] = useState<Vec3 | null>(null);
  const relative = movement.sensor === "relative";
  const value = !up ? null : relative ? (zero ? angleBetween(zero, up) : null) : longAxisFromVertical(up);

  if (status === "idle" || status === "denied" || status === "unavailable") {
    return (
      <Card className="flex flex-col gap-3">
        <p>
          {relative
            ? "Apoya el móvil sobre el segmento, ponlo a cero en la posición de inicio y registra el ángulo al final del movimiento."
            : "Apoya el móvil y registra la inclinación respecto a la vertical."}
        </p>
        {status === "denied" && (
          <Alert tone="warning" title="Sin permiso para el sensor">
            Permite el acceso al movimiento del móvil en los ajustes del navegador, o mide con una foto o con el goniómetro.
          </Alert>
        )}
        {status === "unavailable" && (
          <Alert tone="warning" title="Este dispositivo no da la inclinación">
            Pasa a «Foto» o «Goniómetro». En un ordenador no hay sensor: usa el móvil.
          </Alert>
        )}
        <Button block icon={<Smartphone aria-hidden="true" className="size-5" />} onClick={() => void start()}>
          {status === "idle" ? "Activar el inclinómetro" : "Volver a intentarlo"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      {status === "waiting" ? (
        <p aria-busy="true" className="text-center text-text-muted">
          Esperando al sensor…
        </p>
      ) : (
        <>
          <BigAngle value={value} label={relative ? (zero ? "Desde el cero" : "Pon a cero para empezar") : "Respecto a la vertical"} />
          <p className={cx("flex items-center justify-center gap-1 text-sm", stable ? "text-success" : "text-text-muted")}>
            {stable ? <CircleCheck aria-hidden="true" className="size-4" /> : <Waves aria-hidden="true" className="size-4" />}
            {stable ? "Estable" : "Mantén el móvil quieto"}
          </p>
        </>
      )}
      {relative && (
        <Button variant={zero ? "secondary" : "primary"} block disabled={!up} onClick={() => setZero(up)}>
          {zero ? "Volver a poner a cero" : "Poner a cero"}
        </Button>
      )}
      <Button
        variant={relative && !zero ? "secondary" : "primary"}
        size="lg"
        block
        disabled={value === null || Number.isNaN(value)}
        onClick={() => value !== null && onRead(value)}
      >
        Registrar lectura
      </Button>
    </Card>
  );
}

function PhotoReading({ angle, movement, onRead }: { angle: number; movement: Movement; onRead: (v: number) => void }) {
  const negative = angle < 0;
  return (
    <Card className="flex flex-col gap-3">
      <BigAngle value={angle} label={movement.photo?.kind === "vertical" ? "Respecto a la vertical" : "Ángulo del movimiento"} />
      {negative && <p className="text-sm text-warning">El ángulo sale negativo: revisa el orden de los puntos.</p>}
      <Button size="lg" block disabled={negative} onClick={() => onRead(angle)}>
        Registrar lectura
      </Button>
    </Card>
  );
}

function ManualPanel({ movement, onRead }: { movement: Movement; onRead: (v: number) => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  function submit(e: FormEvent) {
    e.preventDefault();
    const v = parseDecimal(text);
    if (v === null || Number.isNaN(v) || v < 0 || v > 200) {
      setError("Escribe el ángulo en grados (0-200).");
      return;
    }
    onRead(v);
    setText("");
    setError(undefined);
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <NumberField
        label="Ángulo medido"
        unit="°"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(undefined);
        }}
        error={error}
        hint={movement.sensor === "vertical" ? "Inclinación de la tibia respecto a la vertical." : "Desde la posición de inicio."}
      />
      <Button type="submit" variant="secondary" block>
        Registrar lectura
      </Button>
    </form>
  );
}
