import { SearchX } from "lucide-react";
import { Link } from "react-router";
import { Page } from "../app/Page";
import { EmptyState } from "../ui/EmptyState";

/** Una dirección que no existe (mal escrita o de una versión anterior). */
export function NotFoundPage() {
  return (
    <Page title="Página no encontrada" backTo="/">
      <EmptyState icon={SearchX} title="Esta página no existe">
        Puede que la dirección esté mal escrita o que la pantalla haya cambiado de sitio.
      </EmptyState>
      <Link to="/" className="text-center text-accent underline">
        Ir a Pacientes
      </Link>
    </Page>
  );
}
