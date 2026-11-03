import { interpolate, useCurrentFrame } from "remotion";
import { Option } from "../../../components/Engage";
import { pop } from "../../../components/Pictograms";
import { Punch } from "../../../components/Punch";
import { Stage } from "../../../components/Stage";
import { CLAMP, COLORS, STICKER_SM } from "../../../config";
import { SceneProps, wordAt } from "../../../timeline";
import { DATA } from "../config";
import { PGBrush } from "../Pictos";

/** Hallazgo: probablemente el «relleno» — proteoglicanos que atrapan agua; tardan 2-3 días en fabricarse y romperse: el mismo ritmo. */
export const Hallazgo: React.FC<SceneProps> = ({ c }) => {
  const frame = useCurrentFrame();
  const [s0, s1] = c.s;
  const rell = wordAt(s0, "relleno");
  const pg = wordAt(s0, "proteoglicanos");
  const agua = wordAt(s0, "agua");
  const tardan = wordAt(s1, "tardan");
  const fab = wordAt(s1, "fabricarse");
  const romp = wordAt(s1, "romperse");
  const ritmo = wordAt(s1, "ritmo");
  const fill = interpolate(frame, [agua - 2, agua + 16, romp, romp + 14], [0, 1, 1, 0.15], CLAMP);
  return (
    <Punch dur={c.dur} shakeAt={[agua, ritmo]} amount={0.5}>
      <Stage gap={22} justify="flex-start">
        <div style={{ display: "flex", gap: 12, scale: "0.58", transformOrigin: "top center", height: 70, marginTop: 4 }}>
          {DATA.quiz.map((o, i) => (
            <Option key={o} label={o} at={0} pressAt={i === 0 ? 0 : i === 2 ? pg : undefined} wrongAt={i === 0 ? rell : i === 1 ? rell + 4 : undefined} color={i === 2 ? COLORS.green : COLORS.cyan} />
          ))}
        </div>
        <div style={{ fontWeight: 900, fontSize: 70, color: COLORS.ink, opacity: frame >= rell ? 1 : 0, scale: String(pop(frame, rell)) }}>
          probablemente, el <span style={{ color: COLORS.cyan }}>relleno</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <PGBrush at={pg} fill={fill} size={300} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, opacity: frame >= pg ? 1 : 0 }}>
            <div style={{ fontWeight: 900, fontSize: 52, color: COLORS.orange }}>proteoglicanos</div>
            <div style={{ fontWeight: 800, fontSize: 38, color: COLORS.ink, opacity: frame >= agua ? 1 : 0 }}>moléculas que <span style={{ color: COLORS.cyan }}>atrapan agua</span></div>
          </div>
        </div>
        {frame >= tardan ? (
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {[
              { t: "fabricarse", at: fab, col: COLORS.cyan },
              { t: "romperse", at: romp, col: COLORS.orange },
            ].map((x) => (
              <div key={x.t} style={{ padding: "14px 26px", borderRadius: 18, fontWeight: 900, fontSize: 40, color: COLORS.ink, backgroundColor: COLORS.paper, border: `2px solid ${frame >= x.at ? x.col : COLORS.line}`, boxShadow: STICKER_SM, opacity: frame >= x.at ? 1 : 0.3 }}>{x.t}</div>
            ))}
            <div style={{ padding: "14px 30px", borderRadius: 18, fontWeight: 900, fontSize: 54, color: COLORS.paper, backgroundColor: COLORS.orange, scale: String(pop(frame, tardan)) }}>2-3 días</div>
          </div>
        ) : null}
        {frame >= ritmo ? (
          <div style={{ fontWeight: 900, fontSize: 56, color: COLORS.green, scale: String(pop(frame, ritmo)), opacity: interpolate(frame, [ritmo, ritmo + 4], [0, 1], CLAMP) }}>= EL MISMO RITMO</div>
        ) : null}
      </Stage>
    </Punch>
  );
};
