// La explicación de una pantalla, plegada tras «¿Cómo funciona?»: quien ya la conoce no la lee cada vez.
import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";

export function HowItWorks({ children }: { children: ReactNode }) {
  return (
    <details className="group">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-accent [&::-webkit-details-marker]:hidden">
        <CircleHelp aria-hidden="true" className="size-4" /> ¿Cómo funciona?
      </summary>
      <p className="pb-1 text-sm text-text-muted">{children}</p>
    </details>
  );
}
