import { CircleQuestionMark } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { codTests, getCodTest, type CodType } from "../calc/cod";
import { gatePresets, parseGates } from "../calc/sprint";
import { fmt, parseDecimal } from "../app/format";
import { Page } from "../app/Page";
import { getDb } from "../data/db";
import { createTimedTest, saveTimes, type Side, type TimedMethod } from "../data/repo";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { NumberField, TextField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { SpeedHelp } from "./SpeedHelp";

type SpeedType = "sprint_linear" | CodType;
const options: { type: SpeedType; label: string; detail: string }[] = [
  { type: "sprint_linear", label: "Sprint lineal", detail: "Tiempos de paso y perfil fuerza-velocidad del sprint." },
  ...codTests.map((c) => ({ type: c.type, label: c.label, detail: c.detail })),
];
const option = (on: boolean) =>
  cx(
    "flex rounded-lg border p-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
    on ? "border-accent bg-accent-soft" : "border-border bg-bg",
  );

/** S15-S16 Sprint y cambio de dirección: tipo, pasos o pierna de giro y cómo medir. */
export function SprintSetupPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const initialType = (options.find((o) => o.type === params.get("tipo"))?.type ?? "sprint_linear") as SpeedType;
  const [type, setType] = useState<SpeedType>(initialType);
  const [gatesText, setGatesText] = useState(params.get("pasos")?.replaceAll("-", ", ") ?? gatePresets[0]!);
  const [side, setSide] = useState<Side>(params.get("lado") === "right" ? "right" : "left");
  const [method, setMethod] = useState<TimedMethod>("video");
  const [times, setTimes] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<{ gates?: string; times?: string }>({});
  const [help, setHelp] = useState(false);
  const [saving, setSaving] = useState(false);

  const cod = getCodTest(type);
  const gates = type === "sprint_linear" ? parseGates(gatesText) : null;
  const timeFields = type === "sprint_linear" ? (gates ?? []) : [0];

  async function next(e: FormEvent) {
    e.preventDefault();
    const errs: typeof errors = {};
    if (type === "sprint_linear" && !gates) errs.gates = "Escribe las distancias en metros, de menor a mayor, separadas por comas (máximo 10).";
    let values: number[] = [];
    if (method === "manual" && !errs.gates) {
      values = timeFields.map((_, i) => parseDecimal(times[i] ?? "") ?? Number.NaN);
      if (values.some((v) => Number.isNaN(v) || v <= 0 || v >= 120)) errs.times = "Escribe todos los tiempos en segundos (por ejemplo 1,85).";
      else if (values.some((v, i) => i > 0 && v <= values[i - 1]!)) errs.times = "Cada paso debe llegar después del anterior.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const testSide = cod?.sided ? side : null;

    if (method === "video") {
      const q = new URLSearchParams({ tipo: type });
      if (gates) q.set("pasos", gates.join("-"));
      if (testSide) q.set("lado", testSide);
      navigate(`/pacientes/${id}/test/sprint/video?${q}`);
      return;
    }
    setSaving(true);
    try {
      const db = getDb();
      const testId = await createTimedTest(db, { patientId: id, type, side: testSide, gates: gates ?? undefined, method: "manual" });
      await saveTimes(db, testId, values);
      navigate(`/tests/${testId}`, { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
      setSaving(false);
    }
  }

  return (
    <Page title="Sprint y cambio de dirección" backTo={`/pacientes/${id}/test`}>
      <form onSubmit={next} noValidate className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Test</legend>
          {options.map((o) => (
            <label key={o.type} className="relative">
              <input type="radio" name="tipo" value={o.type} checked={type === o.type} onChange={() => setType(o.type)} className="peer sr-only" />
              <span className={cx(option(type === o.type), "flex-col")}>
                <span className="font-semibold">{o.label}</span>
                <span className="text-sm text-text-muted">{o.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {type === "sprint_linear" && (
          <div className="flex flex-col gap-2">
            <TextField
              label="Distancias de los pasos (m)"
              value={gatesText}
              onChange={(e) => setGatesText(e.target.value)}
              error={errors.gates}
              hint="Desde la salida. Con 3 pasos o más se calcula el perfil fuerza-velocidad del sprint."
              inputMode="decimal"
            />
            <div className="flex flex-wrap gap-2">
              {gatePresets.map((p) => (
                <Button key={p} size="sm" variant={p === gatesText ? "primary" : "secondary"} onClick={() => setGatesText(p)}>
                  {p.replaceAll(", ", "-")} m
                </Button>
              ))}
            </div>
          </div>
        )}

        {cod?.sided && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">Pierna con la que gira</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["left", "right"] as const).map((s) => (
                <label key={s} className="relative">
                  <input type="radio" name="lado" value={s} checked={side === s} onChange={() => setSide(s)} className="peer sr-only" />
                  <span
                    className={cx(
                      "tap flex items-center justify-center rounded-md border font-semibold peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                      side === s ? "border-accent bg-accent text-on-accent" : "border-border-input bg-bg",
                    )}
                  >
                    {s === "left" ? "Izquierda" : "Derecha"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Cómo medir</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["video", "Vídeo", "Marcar salida y líneas"],
                ["manual", "Fotocélulas", "O cronómetro: escribir tiempos"],
              ] as const
            ).map(([m, title, detail]) => (
              <label key={m} className="relative">
                <input type="radio" name="metodo" value={m} checked={method === m} onChange={() => setMethod(m)} className="peer sr-only" />
                <span className={cx(option(method === m), "flex-col")}>
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm text-text-muted">{detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {method === "manual" && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-semibold">{type === "sprint_linear" ? "Tiempo acumulado en cada paso" : "Tiempo"}</legend>
            {timeFields.map((d, i) => (
              <NumberField
                key={`${type}-${d}-${i}`}
                label={type === "sprint_linear" ? `${fmt(d, d % 1 ? 1 : 0)} m` : "Tiempo total"}
                unit="s"
                value={times[i] ?? ""}
                onChange={(e) => setTimes((t) => ({ ...t, [i]: e.target.value }))}
              />
            ))}
            {errors.times && <p className="text-sm text-danger">{errors.times}</p>}
          </fieldset>
        )}

        {method === "video" && (
          <Button variant="ghost" icon={<CircleQuestionMark aria-hidden="true" className="size-5" />} onClick={() => setHelp(true)}>
            Cómo grabar y marcar
          </Button>
        )}
        <Button type="submit" size="lg" block loading={saving}>
          {method === "video" ? "Continuar" : "Guardar"}
        </Button>
      </form>
      <Sheet open={help} onClose={() => setHelp(false)} title={`Cómo grabar y marcar: ${options.find((o) => o.type === type)!.label.toLowerCase()}`}>
        <SpeedHelp type={type} />
      </Sheet>
    </Page>
  );
}
