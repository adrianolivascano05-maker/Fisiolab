// Medición libre biomecánica (módulo experimental y autocontenido: ver src/free/README.md).

export interface KeyframeData {
  frameNumber: number;
  timestampSeconds: number;
  angleDegrees: number;
}

export interface Landmark3D {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type AnatomicalPlane = "sagittal" | "frontal" | "transverse";

export interface BiomechanicalMeasurement {
  id: string;
  patientId: string;
  createdAt: string;
  /** "screen": ángulo 2D en la imagen, sin compensar la perspectiva. */
  anatomicalPlane: AnatomicalPlane | "screen";
  referenceType: "plumb_line" | "axial_body";
  referenceVector: { startJoint: string; endJoint: string };
  movementVector: { startJoint: string; endJoint: string };
  initialAngleDegrees: number;
  maxAngleDegrees: number;
  deltaAngleDegrees: number;
  keyframes: KeyframeData[];
  /** Datos del vídeo, para saber de dónde salió la medición. */
  video?: { fileName: string; fps: number };
  notes?: string;
}

/** Pose de un fotograma: puntos en la imagen (0-1) y en el espacio (metros, centro en la cadera). */
export interface FramePose {
  frame: number;
  timeS: number;
  image: Landmark3D[];
  world: Landmark3D[];
}
