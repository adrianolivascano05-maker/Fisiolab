// Recuadro para firmar con el dedo, el lápiz o el ratón. Devuelve la firma como imagen PNG (data URL) al levantar
// el dedo, o null si se borra. Trazo con grosor según la velocidad, como un bolígrafo.
import { Eraser } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./Button";

const W = 600;
const H = 200;

export function SignaturePad({ label, hint, onChange }: { label: string; hint?: string; onChange: (png: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number; t: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const id = useId();

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1B1B1D";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, t: e.timeStamp };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.fillStyle = "#1B1B1D";
    ctx.arc(last.current.x, last.current.y, 1.4, 0, Math.PI * 2);
    ctx.fill();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    const p = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    const speed = Math.hypot(p.x - last.current.x, p.y - last.current.y) / Math.max(1, p.t - last.current.t);
    ctx.lineWidth = Math.max(1.6, 3.6 - speed * 1.2);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!last.current) return;
    last.current = null;
    setEmpty(false);
    onChange(canvas.current!.toDataURL("image/png"));
  };
  const clear = () => {
    canvas.current?.getContext("2d")?.clearRect(0, 0, W, H);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-l`} className="text-sm font-semibold">
        {label}
      </span>
      {hint && (
        <span id={`${id}-h`} className="text-sm text-text-muted">
          {hint}
        </span>
      )}
      <div className="relative">
        <canvas
          ref={canvas}
          width={W}
          height={H}
          role="img"
          aria-labelledby={`${id}-l`}
          aria-describedby={hint ? `${id}-h` : undefined}
          className="aspect-[3/1] w-full touch-none rounded-md border border-border-input bg-white"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        {empty && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-6 bottom-6 border-b border-dashed border-border-input text-xs text-text-muted">
            Firme aquí
          </span>
        )}
      </div>
      {!empty && (
        <Button variant="ghost" size="sm" className="self-start" icon={<Eraser aria-hidden="true" className="size-4" />} onClick={clear}>
          Borrar la firma
        </Button>
      )}
    </div>
  );
}
