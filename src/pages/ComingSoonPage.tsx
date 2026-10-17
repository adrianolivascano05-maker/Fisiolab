import { Hourglass } from "lucide-react";
import { Link, useParams } from "react-router";
import { Page } from "../app/Page";
import { EmptyState } from "../ui/EmptyState";
import { categories } from "./TestPickerPage";

/** Pantallas de fases posteriores (S09-S21): la ruta existe y explica cuándo llega. */
export function ComingSoonPage({ title, phase }: { title?: string; phase?: number }) {
  const { id, categoria } = useParams();
  const cat = categories.find((c) => c.slug === categoria);
  const name = title ?? cat?.title ?? "Esta pantalla";
  const back = id ? `/pacientes/${id}/test` : "/";
  return (
    <Page title={name} backTo={back}>
      <EmptyState icon={Hourglass} title="Todavía no está disponible">
        {name} llega en la fase {phase ?? cat?.phase ?? 2} de la construcción. De momento puedes medir saltos, fuerza, movilidad y bienestar.
      </EmptyState>
      <Link to={back} className="text-center text-accent underline">
        Volver
      </Link>
    </Page>
  );
}
