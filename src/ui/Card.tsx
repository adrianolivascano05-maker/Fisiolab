import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-lg border border-border bg-bg p-4 shadow-card", className)} {...rest} />;
}

type MetricCardProps = {
  label: string;
  value: string;
  unit?: string;
  size?: "lg" | "sm";
  /** Aviso cuando el valor es poco plausible (p. ej. un CMJ de 90 cm). */
  warning?: string;
  detail?: ReactNode;
};

export function MetricCard({ label, value, unit, size = "sm", warning, detail }: MetricCardProps) {
  return (
    <Card className={cx("flex flex-col gap-1", warning && "border-warning")}>
      <span className="text-sm text-text-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={cx("nums", size === "lg" ? "text-display" : "text-xl")}>{value}</span>
        {unit && <span className="text-base text-text-muted">{unit}</span>}
      </span>
      {warning && <span className="text-sm text-warning">{warning}</span>}
      {detail && <span className="text-sm text-text-muted">{detail}</span>}
    </Card>
  );
}
