// De un cuestionario de solo nota: dónde se consigue su hoja oficial (o a quién pedir el permiso). La app no tiene su
// texto: se pasa en papel o en su web y se anota la nota.
import { ExternalLink } from "lucide-react";
import type { QuestionnaireKind } from "./questionnaires";

export function OfficialLink({ link }: { link: NonNullable<QuestionnaireKind["link"]> }) {
  return (
    <p className="text-sm">
      <span className="text-text-muted">Hoja oficial: </span>
      {link.url ? (
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent underline underline-offset-2">
          {link.label} <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      ) : (
        <span className="font-semibold">{link.label}</span>
      )}
    </p>
  );
}
