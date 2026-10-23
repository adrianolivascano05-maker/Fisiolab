import { Activity, Dumbbell, Footprints, Rotate3d, Timer, Zap } from "lucide-react";
import { useParams } from "react-router";
import { Page } from "../app/Page";
import { CategoryTile } from "../ui/CategoryTile";

const categories = [
  { slug: "saltos", icon: Activity, title: "Saltos", detail: "CMJ, SJ, drop jump" },
  { slug: "fuerza", icon: Dumbbell, title: "Fuerza", detail: "Velocidad de barra, 1RM" },
  { slug: "sprint", icon: Timer, title: "Sprint", detail: "Tiempos y cambios de dirección" },
  { slug: "carrera", icon: Footprints, title: "Carrera", detail: "Contacto y frecuencia de paso" },
  { slug: "movilidad", icon: Rotate3d, title: "Movilidad", detail: "Tobillo, cadera, hombro, cuello" },
  { slug: "isquios", icon: Zap, title: "Nórdico", detail: "Ángulo de rotura y fuerza" },
] as const;

/** S04 Selector de test */
export function TestPickerPage() {
  const { id = "" } = useParams();
  return (
    <Page title="Nueva medición" backTo={`/pacientes/${id}`}>
      {/* El bienestar diario es un cuestionario: está en Valoración › Cuestionarios. */}
      <div className="grid grid-cols-2 gap-3">
        {categories.map((c) => (
          <CategoryTile
            key={c.slug}
            to={`/pacientes/${id}/test/${c.slug}`}
            icon={c.icon}
            title={c.title}
            detail={c.detail}
          />
        ))}
      </div>
    </Page>
  );
}
