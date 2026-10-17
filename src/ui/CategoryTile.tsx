import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

type CategoryTileProps = { to: string; icon: LucideIcon; title: string; detail: string };

/** Casilla de la cuadrícula de categorías del selector de test (S04). */
export function CategoryTile({ to, icon: Icon, title, detail }: CategoryTileProps) {
  return (
    <Link
      to={to}
      className="flex min-h-28 flex-col justify-between gap-2 rounded-lg border border-border bg-bg p-4 shadow-card hover:border-accent"
    >
      <Icon aria-hidden="true" className="size-6 text-accent" />
      <span className="flex flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-text-muted">{detail}</span>
      </span>
    </Link>
  );
}
