import { Activity, Dumbbell, Footprints, HeartPulse, Rotate3d, Timer, Zap } from "lucide-react";
import { useParams } from "react-router";
import { Page } from "../app/Page";
import { CategoryTile } from "../ui/CategoryTile";

export const categories = [
  { slug: "saltos", icon: Activity, title: "Saltos", detail: "CMJ, SJ, drop jump", phase: 1, ready: true },
  { slug: "fuerza", icon: Dumbbell, title: "Fuerza", detail: "Velocidad de barra, 1RM", phase: 3, ready: true },
  { slug: "sprint", icon: Timer, title: "Sprint", detail: "Tiempos y cambios de dirección", phase: 4 },
  { slug: "carrera", icon: Footprints, title: "Carrera", detail: "Contacto y frecuencia de paso", phase: 4 },
  { slug: "movilidad", icon: Rotate3d, title: "Movilidad", detail: "Tobillo, cadera, hombro, cuello", phase: 3, ready: true },
  { slug: "isquios", icon: Zap, title: "Nórdico", detail: "Ángulo de rotura y fuerza", phase: 3, ready: true },
  { slug: "bienestar", icon: HeartPulse, title: "Bienestar", detail: "Sueño, fatiga, estrés, dolor, ánimo", phase: 3, ready: true, to: "bienestar" },
] as const;

/** S04 Selector de test */
export function TestPickerPage() {
  const { id = "" } = useParams();
  return (
    <Page title="Nueva medición" backTo={`/pacientes/${id}`}>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((c) => (
          <CategoryTile
            key={c.slug}
            to={"to" in c ? `/pacientes/${id}/${c.to}` : `/pacientes/${id}/test/${c.slug}`}
            icon={c.icon}
            title={c.title}
            detail={"ready" in c ? c.detail : `${c.detail} · próximamente`}
          />
        ))}
      </div>
    </Page>
  );
}
