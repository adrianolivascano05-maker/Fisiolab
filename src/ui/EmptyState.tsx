import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-input px-6 py-10 text-center">
      <Icon aria-hidden="true" className="size-8 text-text-muted" />
      <p className="text-lg">{title}</p>
      {children && <p className="text-sm text-text-muted">{children}</p>}
      {action}
    </div>
  );
}
