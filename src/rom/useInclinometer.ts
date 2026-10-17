import { useCallback, useEffect, useRef, useState } from "react";
import { angleBetween, smooth, upFromOrientation, type Vec3 } from "../calc/rom";

export type SensorStatus = "idle" | "waiting" | "live" | "denied" | "unavailable";

/** Sin datos en este tiempo tras activarlo, el dispositivo no tiene sensor (o el navegador no lo da). */
const NO_DATA_MS = 2500;
/** La lectura se da por estable si en el último segundo no se ha movido más de esto. */
const STABLE_DEG = 1;
const TICK_MS = 100;

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * Inclinómetro con los sensores del móvil. Devuelve la dirección "arriba" en los ejes del móvil,
 * suavizada, y si está quieto. Usa `deviceorientation` (fusiona acelerómetro y giroscopio) y, si no
 * llega, la gravedad de `devicemotion`. Se queda con la primera fuente que da datos: las dos no
 * tienen por qué usar el mismo signo y mezclarlas falsearía el ángulo.
 */
export function useInclinometer() {
  const [status, setStatus] = useState<SensorStatus>("idle");
  const [up, setUp] = useState<Vec3 | null>(null);
  const [stable, setStable] = useState(false);
  const latest = useRef<Vec3 | null>(null);
  const source = useRef<"orientation" | "motion" | null>(null);
  const cleanup = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    stop();
    // iPhone: hay que pedir permiso desde un toque del usuario.
    for (const api of [globalThis.DeviceOrientationEvent, globalThis.DeviceMotionEvent] as (PermissionApi | undefined)[]) {
      if (typeof api?.requestPermission === "function") {
        try {
          if ((await api.requestPermission()) !== "granted") {
            setStatus("denied");
            return;
          }
        } catch {
          setStatus("denied");
          return;
        }
      }
    }
    latest.current = null;
    source.current = null;
    setUp(null);
    setStable(false);
    setStatus("waiting");

    const take = (kind: "orientation" | "motion", v: Vec3) => {
      if (source.current && source.current !== kind) return;
      source.current = kind;
      latest.current = smooth(latest.current, v);
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      take("orientation", upFromOrientation(e.beta, e.gamma));
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (g?.x == null || g.y == null || g.z == null) return;
      take("motion", [g.x, g.y, g.z]);
    };
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("devicemotion", onMotion);

    const history: Vec3[] = [];
    const tick = window.setInterval(() => {
      const v = latest.current;
      if (!v) return;
      history.push(v);
      if (history.length > 1000 / TICK_MS) history.shift();
      setUp(v);
      setStatus("live");
      setStable(history.length >= 1000 / TICK_MS && history.every((h) => angleBetween(h, v) <= STABLE_DEG));
    }, TICK_MS);
    const timeout = window.setTimeout(() => {
      if (!latest.current) setStatus("unavailable");
    }, NO_DATA_MS);

    cleanup.current = () => {
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("devicemotion", onMotion);
      window.clearInterval(tick);
      window.clearTimeout(timeout);
    };
  }, [stop]);

  return { status, up, stable, start, stop };
}
