import { LAYOUT, SAFE, fontFamily } from "../theme";

/** Área del titular (dentro de las zonas seguras), centrada. */
export const Stage: React.FC<{ children: React.ReactNode; gap?: number; justify?: string }> = ({ children, gap = 36, justify = "center" }) => (
  <div
    style={{
      position: "absolute",
      left: SAFE.side,
      right: SAFE.side,
      top: LAYOUT.headTop,
      height: LAYOUT.headBottom - LAYOUT.headTop,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: justify,
      gap,
      fontFamily,
    }}
  >
    {children}
  </div>
);
