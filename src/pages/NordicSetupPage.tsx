import { CircleQuestionMark } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { parseDecimal } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { createNordicTest, getPatient, saveNordicAngle, type NordicMethod } from "../data/repo";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { NumberField } from "../ui/Field";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { NordicHelp } from "./NordicHelp";

const option = (on: boolean) =>
  cx(
    "flex flex-col rounded-lg border p-3 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
    on ? "border-accent bg-accent-soft" : "border-border bg-bg",
  );

/** S20 Nórdico de isquios: por vídeo (marcar la rotura) o escribiendo el ángulo. */
export function NordicSetupPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const patient = useAsync(() => getPatient(getDb(), id), [id]);
  const [method, setMethod] = useState<NordicMethod>("video");
  const [angle, setAngle] = useState("");
  const [error, setError] = useState<string>();
  const [help, setHelp] = useState(false);
  const [saving, setSaving] = useState(false);

  const back = `/pacientes/${id}/test`;
  if (patient.error) return <Page title="Nórdico" backTo={back} tabs={false}><LoadError error={patient.error} /></Page>;
  if (patient.data === undefined) return <Page title="Nórdico" backTo={back} tabs={false}><Loading /></Page>;
  const p = patient.data;

  async function next(e: FormEvent) {
    e.preventDefault();
    if (method === "video") {
      navigate(`/pacientes/${id}/test/isquios/video?tipo=nordic`);
      return;
    }
    const a = parseDecimal(angle);
    if (a === null || Number.isNaN(a) || a < 0 || a > 90) {
      setError("Escribe la inclinación en grados (0-90).");
      return;
    }
    setSaving(true);
    try {
      const testId = await createNordicTest(getDb(), id, "manual");
      await saveNordicAngle(getDb(), testId, a);
      navigate(`/tests/${testId}`, { replace: true });
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar", "danger");
      setSaving(false);
    }
  }

  return (
    <Page title="Nórdico" backTo={back} tabs={false}>
      {p && (!p.bodyMassKg || !p.heightCm) && (
        <Alert tone="info" title="Sin masa o estatura, solo el ángulo">
          Para estimar la fuerza de los isquios hacen falta la masa y la estatura.{" "}
          <Link className="underline" to={`/pacientes/${id}/editar`}>
            Añádelas
          </Link>
          .
        </Alert>
      )}
      <form onSubmit={next} noValidate className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Cómo medir</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["video", "Vídeo", "Marcar la rotura y el ángulo"],
                ["manual", "A mano", "Escribir el ángulo"],
              ] as const
            ).map(([m, title, detail]) => (
              <label key={m} className="relative">
                <input type="radio" name="metodo" value={m} checked={method === m} onChange={() => setMethod(m)} className="peer sr-only" />
                <span className={option(method === m)}>
                  <span className="font-semibold">{title}</span>
                  <span className="text-sm text-text-muted">{detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {method === "manual" && (
          <NumberField
            label="Ángulo de rotura"
            unit="°"
            value={angle}
            onChange={(e) => {
              setAngle(e.target.value);
              setError(undefined);
            }}
            error={error}
            hint="Inclinación de la línea rodilla-cadera respecto a la vertical: 0° erguido, 90° en el suelo."
          />
        )}
        <Button variant="ghost" icon={<CircleQuestionMark aria-hidden="true" className="size-5" />} onClick={() => setHelp(true)}>
          Cómo grabar y marcar
        </Button>
        <Button type="submit" size="lg" block loading={saving}>
          {method === "video" ? "Continuar" : "Guardar"}
        </Button>
      </form>
      <Sheet open={help} onClose={() => setHelp(false)} title="Cómo grabar y marcar el nórdico">
        <NordicHelp />
      </Sheet>
    </Page>
  );
}
