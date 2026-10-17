import { Download, Trash } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { fmt, fmtDateTime } from "../app/format";
import { LoadError, Loading, Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { getDb } from "../data/db";
import { getPatient } from "../data/repo";
import { Button } from "../ui/Button";
import { Card, MetricCard } from "../ui/Card";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";
import { AngleChart, download } from "./FreeMeasurePage";
import { jointLabel } from "./joints";
import { deleteMeasurement, getMeasurement, reportCsv } from "./store";

const planeText = { sagittal: "plano sagital", frontal: "plano frontal", transverse: "plano transversal", screen: "pantalla (2D)" } as const;

/** Una medición libre guardada: resumen, curva del ángulo, informe y borrado. */
export function FreeDetailPage() {
  const { id = "", mid = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const data = useAsync(async () => ({ patient: await getPatient(getDb(), id), m: await getMeasurement(getDb(), mid) }), [id, mid]);
  const back = `/pacientes/${id}/medicion-libre`;
  if (data.error) return <Page title="Medición libre" backTo={back}><LoadError error={data.error} /></Page>;
  if (!data.data) return <Page title="Medición libre" backTo={back}><Loading /></Page>;
  const { patient, m } = data.data;
  if (!m || !patient) return <Page title="Medición libre" backTo={back}><LoadError error={new Error("Esta medición no existe.")} /></Page>;
  const ref = m.referenceType === "plumb_line" ? "la plomada (vertical)" : `${jointLabel(m.referenceVector.startJoint)} → ${jointLabel(m.referenceVector.endJoint)}`;

  return (
    <Page title={`Medición libre · ${patient.name}`} backTo={back}>
      <p className="text-sm text-text-muted">
        {fmtDateTime(m.createdAt)} · {planeText[m.anatomicalPlane]}
        {m.video && ` · ${m.video.fileName}`}
      </p>
      <Card className="flex flex-col gap-1">
        <span className="font-semibold">
          {jointLabel(m.movementVector.startJoint)} → {jointLabel(m.movementVector.endJoint)}
        </span>
        <span className="text-sm text-text-muted">respecto a {ref}</span>
      </Card>
      <div className="grid grid-cols-3 gap-2">
        <MetricCard stacked label="Inicial" value={fmt(m.initialAngleDegrees, 0)} unit="°" />
        <MetricCard stacked label="Máximo" value={fmt(m.maxAngleDegrees, 0)} unit="°" />
        <MetricCard stacked label="Amplitud Δθ" value={fmt(m.deltaAngleDegrees, 0)} unit="°" />
      </div>
      <AngleChart keyframes={m.keyframes} />
      <p className="text-xs text-text-muted">{m.keyframes.length} fotogramas medidos. Estimación experimental con IA desde una sola cámara.</p>
      <Button icon={<Download aria-hidden="true" className="size-5" />} onClick={() => download(`medicion-libre-${m.createdAt.slice(0, 10)}.csv`, reportCsv(m, patient.name, jointLabel))}>
        Exportar reporte
      </Button>
      <Button variant="ghost" className="text-danger" icon={<Trash aria-hidden="true" className="size-5" />} onClick={() => setConfirm(true)}>
        Borrar esta medición
      </Button>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="¿Borrar esta medición?">
        <p>No se puede deshacer.</p>
        <Button
          variant="danger"
          block
          onClick={async () => {
            await deleteMeasurement(getDb(), m.id);
            toast("Medición borrada", "success");
            navigate(back, { replace: true });
          }}
        >
          Borrar
        </Button>
        <Button variant="secondary" block onClick={() => setConfirm(false)}>
          Cancelar
        </Button>
      </Sheet>
    </Page>
  );
}
