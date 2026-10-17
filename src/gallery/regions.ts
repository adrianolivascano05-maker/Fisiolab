import type { RegionId } from "./types";

/** Articulaciones en el orden en que se muestran (de la cabeza a los pies). */
export const regions: { id: RegionId; label: string; slug: string }[] = [
  { id: "atm", label: "Mandíbula (ATM)", slug: "atm" },
  { id: "cervical", label: "Columna cervical", slug: "cervical" },
  { id: "hombro", label: "Hombro", slug: "hombro" },
  { id: "codo", label: "Codo", slug: "codo" },
  { id: "muneca_mano", label: "Muñeca y mano", slug: "muneca-mano" },
  { id: "dorsal", label: "Columna dorsal y costillas", slug: "dorsal" },
  { id: "lumbar", label: "Columna lumbar", slug: "lumbar" },
  { id: "sacroiliaca", label: "Sacroilíaca, pelvis e ingle", slug: "sacroiliaca" },
  { id: "cadera", label: "Cadera", slug: "cadera" },
  { id: "rodilla", label: "Rodilla", slug: "rodilla" },
  { id: "tobillo_pie", label: "Tobillo y pie", slug: "tobillo-pie" },
];

export const regionBySlug = (slug: string) => regions.find((r) => r.slug === slug);
export const regionOf = (id: RegionId) => regions.find((r) => r.id === id)!;
