import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { fmtDate } from "../app/format";
import { CONSENTS, type PatientPrivacy } from "../data/privacy";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";

/** En la ficha del paciente: si ya se le dio la información y qué consentimientos dio. */
export function PrivacyCard({ patientId, privacy }: { patientId: string; privacy: PatientPrivacy }) {
  const answered = CONSENTS.filter((c) => privacy.consents?.[c.id] !== undefined);
  return (
    <Link to={`/pacientes/${patientId}/proteccion-datos`} className="block">
      <Card className={cx("flex items-start gap-3 hover:border-accent", !privacy.informedAt && "border-warning bg-warning-soft")}>
        {privacy.informedAt ? (
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
        ) : (
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
        )}
        <span className="flex flex-col">
          <span className="font-semibold">
            {privacy.informedAt ? `Protección de datos: informado el ${fmtDate(`${privacy.informedAt}T12:00:00`)}` : "Falta darle la información de protección de datos"}
          </span>
          <span className="text-sm text-text-muted">
            {answered.length
              ? answered.map((c) => `${c.label}: ${privacy.consents![c.id] ? "sí" : "no"}`).join(" · ")
              : "Hoja para imprimir y firmar, y sus consentimientos opcionales."}
          </span>
        </span>
      </Card>
    </Link>
  );
}
