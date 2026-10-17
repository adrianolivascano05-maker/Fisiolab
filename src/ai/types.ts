/** Punto del modelo de pose: x, y en la imagen (0-1) o en metros; z, profundidad; visibility, 0-1. */
export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** Pose de un fotograma: puntos en la imagen (0-1) y en el espacio (metros, centro en la cadera). */
export interface PoseFrame {
  frame: number;
  image: Landmark3D[];
  world: Landmark3D[];
}
