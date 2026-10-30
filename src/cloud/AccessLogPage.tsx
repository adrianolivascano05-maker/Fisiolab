// Ajustes → Equipo → Registro de accesos (src/data/accessLog.ts, migración 035): quién abrió qué ficha, la exportó o
// imprimió su historia. Solo para quien administra la clínica. Se filtra por paciente o por persona y se descarga en
// CSV. Al abrirlo se poda lo de más de 2 años (en este dispositivo; la poda no viaja como borrado).
import { Download } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router";
import { saveFile } from "../app/download";
import { fmtDateTime } from "../app/format";
import { Page } from "../app/Page";
import { useAsync } from "../app/useAsync";
import { accessCsv, accessMembers, ACTION_LABELS, KEEP_ACCESS_YEARS, listAccess, pruneAccessLog } from "../data/accessLog";
import { getDb } from "../data/db";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { SelectField, TextField } from "../ui/Field";
import { useCloud } from "./cloudContext";

export function AccessLogPage() {
  const cloud = useCloud();
  const [params] = useSearchParams();
  const patientId = params.get("paciente") ?? "";
  const [name, setName] = useState("");
  const [member, setMember] = useState("");
  const admin = !cloud?.clinic || cloud.clinic.role === "admin";
  const members = useAsync(async () => {
    await pruneAccessLog(getDb());
    return accessMembers(getDb());
  }, []);
  const rows = useAsync(() => listAccess(getDb(), { patientId: patientId || undefined, patientName: name || undefined, member: member || undefined }), [patientId, name, member]);
  if (!admin) return <Navigate to="/ajustes/equipo" replace />;
  const patientName = patientId ? (rows.data?.[0]?.patientName ?? null) : null;
  return (
    <Page title="Registro de accesos" backTo={patientId ? `/pacientes/${patientId}` : "/ajustes/equipo"}>
      <p className="text-sm text-text-muted">
        Quién abrió cada ficha, la exportó o imprimió su historia: una anotación por persona, paciente, acción y día. Solo se añade; lo de más de{" "}
        {KEEP_ACCESS_YEARS} años se borra solo. Lo ve quien administra la clínica. Es un registro de buena fe, no a prueba de manipulación.
      </p>
      <Card className="flex flex-col gap-3">
        {patientId ? (
          <p className="text-sm">
            Solo {patientName ? <strong>{patientName}</strong> : "este paciente"}.{" "}
            <Link to="/ajustes/equipo/accesos" className="font-semibold text-accent underline underline-offset-2">
              Ver todos
            </Link>
          </p>
        ) : (
          <TextField label="Paciente" placeholder="Parte del nombre" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <SelectField label="Persona" value={member} onChange={(e) => setMember(e.target.value)}>
          <option value="">Todas</option>
          {(members.data ?? []).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SelectField>
        <Button
          variant="secondary"
          icon={<Download aria-hidden="true" className="size-5" />}
          disabled={!rows.data?.length}
          onClick={() => saveFile(`omniclin-registro-de-accesos-${new Date().toISOString().slice(0, 10)}.csv`, accessCsv(rows.data ?? []), "text/csv;charset=utf-8")}
        >
          Descargar en CSV
        </Button>
      </Card>
      {rows.data && rows.data.length === 0 && <p className="text-sm text-text-muted">Ningún acceso anotado{name || member || patientId ? " con ese filtro" : " todavía"}.</p>}
      {rows.data && rows.data.length > 0 && (
        <ul aria-label="Accesos" className="flex flex-col divide-y divide-border rounded-lg border border-border bg-bg">
          {rows.data.map((r) => (
            <li key={r.id} className="flex flex-col gap-0.5 px-3 py-2">
              <span className="font-semibold">
                {r.patientName ? (
                  <Link to={`/pacientes/${r.patientId}`} className="text-accent underline underline-offset-2">
                    {r.patientName}
                  </Link>
                ) : (
                  "Paciente borrado"
                )}
                {" · "}
                {ACTION_LABELS[r.action] ?? r.action}
              </span>
              <span className="text-sm text-text-muted">
                {r.member} · {fmtDateTime(r.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
