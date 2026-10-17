import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

type Tone = "info" | "warning" | "danger" | "success";

const tones: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: "bg-accent-soft text-text", icon: Info },
  warning: { box: "bg-warning-soft text-text", icon: TriangleAlert },
  danger: { box: "bg-danger-soft text-danger", icon: CircleX },
  success: { box: "bg-success-soft text-success", icon: CircleCheck },
};
const iconColor: Record<Tone, string> = {
  info: "text-accent",
  warning: "text-warning",
  danger: "text-danger",
  success: "text-success",
};

/** Aviso en línea (p. ej. "este vídeo no es a cámara lenta"). Los de error se anuncian al aparecer. */
export function Alert({ tone = "info", title, children }: { tone?: Tone; title: string; children?: ReactNode }) {
  const { box, icon: Icon } = tones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-3 rounded-md p-3", box)}>
      <Icon aria-hidden="true" className={cx("mt-0.5 size-5 shrink-0", iconColor[tone])} />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="text-sm">{children}</div>}
      </div>
    </div>
  );
}
