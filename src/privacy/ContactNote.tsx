// Lo que sale en lugar de los botones de WhatsApp y correo cuando no hay permiso de contacto firmado como «Sí»
// (src/data/privacy.ts, mayMessage): si dijo que no, «No acepta WhatsApp ni correo»; si está sin firmar, «Falta su
// permiso de contacto: que firme la hoja de protección de datos», con el enlace a esa hoja en su ficha.
import { contactBlock } from "../data/privacy";
import { cx } from "../ui/cx";
import { Link } from "react-router";

export function ContactNote({ contact, patientId, extra, className }: { contact: boolean | null | undefined; patientId: string; extra?: string; className?: string }) {
  const text = contactBlock(contact);
  if (!text) return null;
  return (
    <p className={cx("text-sm text-text-muted", className)}>
      {text}
      {extra ? `. ${extra}` : "."}{" "}
      {contact !== false && (
        <Link to={`/pacientes/${patientId}/proteccion-datos`} className="inline-flex min-h-11 items-center font-semibold text-accent underline underline-offset-2">
          Hoja de protección de datos
        </Link>
      )}
    </p>
  );
}
