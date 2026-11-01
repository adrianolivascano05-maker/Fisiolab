import { interpolate, useCurrentFrame } from "remotion";
import { CLAMP, COLORS } from "../config";
import { LAYOUT, fontFamily } from "../theme";

/** Etiqueta discreta de fuente durante los datos. */
export const SourceTag: React.FC<{ from: number; to: number; text: string }> = ({ from, to, text }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: LAYOUT.sourceY,
        textAlign: "center",
        fontFamily,
        fontWeight: 600,
        fontSize: 26,
        letterSpacing: 0.5,
        color: COLORS.muted,
        opacity: interpolate(frame, [from, from + 10, to - 10, to], [0, 1, 1, 0], CLAMP),
      }}
    >
      {text}
    </div>
  );
};
