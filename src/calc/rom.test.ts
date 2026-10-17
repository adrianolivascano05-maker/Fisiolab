import { describe, expect, it } from "vitest";
import {
  angleBetween,
  getMovement,
  longAxisFromVertical,
  movementLabel,
  movements,
  photoAngle,
  segmentFromVertical,
  summarize,
  threePointAngle,
  upFromOrientation,
  type Vec3,
} from "./rom";

const close = (a: number, b: number, digits = 6) => expect(a).toBeCloseTo(b, digits);

describe("inclinómetro", () => {
  it("dirección arriba en las posturas de referencia del móvil", () => {
    const flat = upFromOrientation(0, 0); // tumbado, pantalla al techo
    const upright = upFromOrientation(90, 0); // de pie, en vertical
    expect(flat.map((v) => Number(v.toFixed(9)))).toEqual([0, 0, 1]);
    close(upright[1], 1);
    close(upright[2], 0);
    // De lado (apaisado, gamma 90): arriba sale por el lado izquierdo de la pantalla.
    close(upFromOrientation(0, 90)[0], -1);
  });

  it("el giro desde el cero es el cambio de beta en un plano vertical", () => {
    const zero = upFromOrientation(90, 0);
    for (const deg of [10, 37.5, 90, 135, 170]) close(angleBetween(zero, upFromOrientation(90 - deg, 0)), deg);
  });

  it("el giro no depende de cómo esté orientada la pantalla sobre el segmento", () => {
    // Mismo giro de 30° alrededor de un eje horizontal, con el móvil apoyado de dos maneras distintas.
    close(angleBetween(upFromOrientation(0, 0), upFromOrientation(30, 0)), 30);
    close(angleBetween(upFromOrientation(0, 0), upFromOrientation(0, -30)), 30);
  });

  it("inclinación del borde largo respecto a la vertical (lunge)", () => {
    close(longAxisFromVertical(upFromOrientation(90, 0)), 0);
    close(longAxisFromVertical(upFromOrientation(90 - 38, 0)), 38);
    // Igual con la pantalla hacia un lado (girado sobre su eje largo) o con la gravedad con el signo contrario.
    const tilted = upFromOrientation(52, 0);
    const rolled: Vec3 = [tilted[2], tilted[1], tilted[0]];
    close(longAxisFromVertical(rolled), 38);
    close(longAxisFromVertical([-rolled[0], -rolled[1], -rolled[2]]), 38);
    expect(longAxisFromVertical([0, 0, 0])).toBeNaN();
  });
});

describe("ángulo sobre foto", () => {
  it("tres puntos: ángulo en el vértice", () => {
    close(threePointAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }), 90);
    close(threePointAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: -1, y: 0 }), 180);
    close(threePointAngle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }), 45);
  });

  it("segmento respecto a la vertical, sea cual sea el orden de los puntos", () => {
    close(segmentFromVertical({ x: 0, y: 10 }, { x: 0, y: 0 }), 0);
    close(segmentFromVertical({ x: 0, y: 0 }, { x: 10, y: 10 }), 45);
    close(segmentFromVertical({ x: 10, y: 10 }, { x: 0, y: 0 }), 45);
    expect(segmentFromVertical({ x: 3, y: 3 }, { x: 3, y: 3 })).toBeNaN();
  });

  it("convierte al valor clínico de cada movimiento", () => {
    // Flexión de cadera: hombro, trocánter y rodilla en línea = 0°; muslo en ángulo recto = 90°.
    const hip = getMovement("hip_flexion")!.photo!;
    close(photoAngle(hip, [{ x: 0, y: -10 }, { x: 0, y: 0 }, { x: 0, y: 10 }]), 0);
    close(photoAngle(hip, [{ x: 0, y: -10 }, { x: 0, y: 0 }, { x: 10, y: 0 }]), 90);
    // Abducción de cadera: brazos en escuadra = 0°.
    const abd = getMovement("hip_abduction")!.photo!;
    close(photoAngle(abd, [{ x: -10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }]), 0);
    close(photoAngle(abd, [{ x: -10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 10 }]), 45);
    // Flexión de hombro: brazo colgando = 0°; horizontal = 90°.
    const sh = getMovement("shoulder_flexion")!.photo!;
    close(photoAngle(sh, [{ x: 0, y: 10 }, { x: 0, y: 0 }, { x: 0, y: 10 }]), 0);
    close(photoAngle(sh, [{ x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 }]), 90);
    // Lunge: tibia inclinada 40° respecto a la vertical.
    const lunge = getMovement("ankle_lunge")!.photo!;
    const rad = (40 * Math.PI) / 180;
    close(photoAngle(lunge, [{ x: 0, y: 0 }, { x: 10 * Math.sin(rad), y: -10 * Math.cos(rad) }]), 40);
  });
});

describe("lecturas y catálogo", () => {
  it("media, extremos y dispersión", () => {
    expect(summarize([40, 42, 44])).toEqual({ mean: 42, min: 40, max: 44, spread: 4 });
    expect(() => summarize([])).toThrow(RangeError);
  });

  it("cada movimiento es coherente", () => {
    const ids = new Set(movements.map((m) => m.id));
    expect(ids.size).toBe(movements.length);
    for (const m of movements) {
      expect(m.id.startsWith(m.joint)).toBe(true);
      expect(m.maxDeg).toBeGreaterThan(0);
      if (m.photo) expect(m.photo.points).toHaveLength(m.photo.kind === "vertical" ? 2 : 3);
    }
    expect(movementLabel(getMovement("hip_internal_rotation")!, "left")).toBe("Cadera · rotación interna izquierda");
    expect(movementLabel(getMovement("neck_flexion")!)).toBe("Cuello · flexión");
  });
});
