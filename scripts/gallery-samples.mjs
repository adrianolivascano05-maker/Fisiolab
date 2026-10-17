export const samples = [
  { name: "De pie, lateral", spec: { view: "side", posture: "standing" } },
  { name: "Sentado: extensión de rodilla", spec: { view: "side", posture: "sitting", to: { r_knee: 0 }, pain: ["lumbar"], arrows: [{ at: "r_foot", dir: "anterior", kind: "move" }] } },
  { name: "Supino: SLR", spec: { view: "side", posture: "supine", to: { r_hip: 70 }, hands: ["r_shank@0.9", "r_thigh@0.9"], arrows: [{ at: "r_shank@0.9", dir: "anterior", kind: "move", label: "flexión" }], pain: ["lumbar"] } },
  { name: "Prono: Ely", spec: { view: "side", posture: "prone", joints: { r_knee: 120 }, hands: ["r_shank@0.9"], arrows: [{ at: "r_shank@0.9", dir: "anterior", label: "flexión" }] } },
  { name: "Decúbito lateral: Ober", spec: { view: "front", posture: "sidelying", joints: { l_hip: 20 }, to: { l_hip: -10 }, hands: ["l_shank@0.9", "pelvis"], arrows: [{ at: "l_knee", dir: "caudal", kind: "move" }] } },
  { name: "De frente 90/90", spec: { view: "front", posture: "standing", joints: { r_shoulder: 90, r_elbow: 90 }, hands: ["r_wrist"], arrows: [{ at: "r_forearm@0.8", rotate: "ccw", label: "RE" }], pain: ["r_shoulder"] } },
  { name: "Supino desde arriba: FABER", spec: { view: "front", posture: "supine", joints: { r_hip: 40, r_knee: -60 }, hands: ["r_knee", "l_hip"], arrows: [{ at: "r_knee", dir: "posterior", label: "hacia la camilla" }], pain: ["r_hip"] } },
  { name: "Cuadrupedia", spec: { view: "side", posture: "quadruped" } },
  { name: "Lachman (supino, rodilla 20°)", spec: { view: "side", posture: "supine", joints: { r_hip: 20, r_knee: 25 }, hands: ["r_thigh@0.85", "r_shank@0.15"], arrows: [{ at: "r_shank@0.15", dir: "anterior", label: "anterior" }], pain: ["r_knee"] } },
  { name: "Neer (de pie)", spec: { view: "side", posture: "standing", joints: { r_shoulder: 10 }, to: { r_shoulder: 170 }, hands: ["r_forearm@0.5", "r_shoulder"], arrows: [{ at: "r_elbow", dir: "cranial", kind: "move" }], pain: ["r_shoulder"] } },
  { name: "Spurling (sentado, frente)", spec: { view: "front", posture: "sitting", joints: { neck: 25 }, hands: ["head"], arrows: [{ at: "head", dir: "caudal", label: "compresión" }], pain: ["r_upperarm@0.5"] } },
  { name: "Cajón anterior tobillo", spec: { view: "side", posture: "supine", joints: { r_hip: 30, r_knee: 60, r_ankle: -15 }, hands: ["r_shank@0.85", "r_foot@0.3"], arrows: [{ at: "r_foot@0.3", dir: "anterior" }], pain: ["r_ankle"] } },
];
