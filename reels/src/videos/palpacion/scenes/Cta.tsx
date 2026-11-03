import { CtaComment } from "../../../components/CtaComment";
import { SceneProps } from "../../../timeline";

/** CTA: comenta «L4» (con sello irónico de «100 % seguro»). */
export const Cta: React.FC<SceneProps> = ({ c }) => <CtaComment c={c} word="l4" typed="L4" stamp={{ text: "100 % SEGURO", at: "seguridad" }} />;
