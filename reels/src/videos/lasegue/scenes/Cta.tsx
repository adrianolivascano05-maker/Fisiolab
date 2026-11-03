import { CtaComment } from "../../../components/CtaComment";
import { SceneProps } from "../../../timeline";

/** CTA: comenta «cruzado». */
export const Cta: React.FC<SceneProps> = ({ c }) => <CtaComment c={c} word="cruzado" typed="cruzado" stamp={{ text: "SIEMPRE", at: "siempre" }} />;
