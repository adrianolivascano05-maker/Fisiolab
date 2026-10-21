import qrcode from "qrcode-generator";
import { useMemo } from "react";
import { cx } from "./cx";

/** Código QR en SVG, negro sobre blanco (con su margen) para que lo lea cualquier cámara. */
export function QrCode({ text, label, className }: { text: string; label: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 4;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + quiet},${r + quiet}h1v1h-1z`;
    return { size: n + 2 * quiet, path: d };
  }, [text]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges" className={cx("size-52 rounded-md", className)}>
      <rect width={size} height={size} fill="#FFFFFF" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
