// Simetría entre lados (barras con la referencia del 90 %) y cuestionarios (última puntuación, cambio desde el
// primero y tendencia).
import { ArrowDownRight, ArrowRight, ArrowUpRight, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { fmt, fmtDate } from "../app/format";
import type { Questionnaire } from "../data/clinical";
import { Card } from "../ui/Card";
import { cx } from "../ui/cx";
import { Sparkline } from "./parts";
import { displayName, kindOf, scoreText, type QDetails } from "./questionnaires";
import { LSI_REFERENCE, type SymmetryRow } from "./symmetry";

/** Barras de simetría: lado peor / lado mejor, con la línea del 90 %. */
export function SymmetryPanel({ rows }: { rows: SymmetryRow[] }) {
  if (!rows.length) return null;
  return (
    <ul aria-label="Simetría entre lados" className="flex flex-col gap-2">
      {rows.map((r) => {
        const low = r.lsi < LSI_REFERENCE;
        return (
          <li key={r.title}>
            <Card className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{r.title}</span>
                <span className={cx("nums shrink-0 font-semibold whitespace-nowrap", low ? "text-warning" : "text-accent")}>LSI {fmt(r.lsi, 0)} %</span>
              </div>
              <div className="relative h-3 rounded-pill bg-surface" aria-hidden="true">
                <div className={cx("h-3 rounded-pill", low ? "bg-warning" : "bg-accent")} style={{ width: `${Math.min(100, r.lsi)}%` }} />
                <div className="absolute -top-1 h-5 w-0.5 bg-text" style={{ left: `${LSI_REFERENCE}%` }} />
              </div>
              <div className="nums flex flex-wrap justify-between gap-x-3 text-sm text-text-muted">
                <span>
                  Izq. <span className={cx(r.weaker === "left" ? "font-semibold text-text" : "")}>{r.left.text}</span> · Dcha.{" "}
                  <span className={cx(r.weaker === "right" ? "font-semibold text-text" : "")}>{r.right.text}</span>
                </span>
                <span className="inline-flex items-center gap-1">
                  {low && <TriangleAlert aria-hidden="true" className="size-4 text-warning" />}
                  {r.weaker === "equal" ? "iguales" : `peor la ${r.weaker === "left" ? "izquierda" : "derecha"}`}
                  {low && ` · bajo el ${LSI_REFERENCE} %`}
                </span>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

type QGroup = { key: string; name: string; items: Questionnaire[] };

/** Registros agrupados por cuestionario (y subescala), el más reciente primero en cada grupo. */
export function questionnaireGroups(all: Questionnaire[]): QGroup[] {
  const groups = new Map<string, QGroup>();
  for (const q of all) {
    const d = q.details as QDetails;
    const name = displayName(q.kind, d);
    const key = `${q.kind}|${d.subscale ?? ""}|${d.name ?? ""}`;
    const g = groups.get(key) ?? { key, name, items: [] };
    g.items.push(q);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Una tarjeta por cuestionario: última puntuación, cambio desde el primero (mejor o peor) y tendencia. */
export function QuestionnaireTiles({ patientId, items }: { patientId: string; items: Questionnaire[] }) {
  const groups = questionnaireGroups(items);
  if (!groups.length) return null;
  return (
    <ul aria-label="Cuestionarios" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {groups.map((g) => {
        const last = g.items[0]!;
        const first = g.items.at(-1)!;
        const k = kindOf(last.kind, last.details as QDetails);
        const diff = g.items.length > 1 ? last.score - first.score : null;
        const Arrow = diff === null || diff === 0 ? ArrowRight : diff > 0 ? ArrowUpRight : ArrowDownRight;
        return (
          <li key={g.key}>
            <Link to={`/pacientes/${patientId}/cuestionarios/${last.id}`} className="block">
              <Card className="flex flex-col gap-1 hover:border-accent">
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold">{g.name}</span>
                  <span className="nums shrink-0 text-xl">{scoreText(k, last.score)}</span>
                </span>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text-muted">
                    {fmtDate(last.performedAt)} · {k.better === "higher" ? "más es mejor" : "menos es mejor"}
                  </span>
                  <Sparkline values={g.items.slice(0, 8).reverse().map((q) => q.score)} />
                </span>
                {diff !== null && (
                  <span className="nums inline-flex items-center gap-0.5 text-sm text-text-muted">
                    <Arrow aria-hidden="true" className="size-4" />
                    {scoreText(k, first.score)} → {scoreText(k, last.score)} en {g.items.length} pases ({diff > 0 ? "+" : diff < 0 ? "−" : "±"}
                    {fmt(Math.abs(diff), Number.isInteger(diff) ? 0 : 1)})
                  </span>
                )}
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
