import { CtaComment } from "../../../components/CtaComment";
import { SceneProps } from "../../../timeline";

/** CTA: comenta «día 2». */
export const Cta: React.FC<SceneProps> = ({ c }) => <CtaComment c={c} word="día" typed="día 2" stamp={{ text: "TRAS EL PARTIDO", at: "partidos" }} />;
