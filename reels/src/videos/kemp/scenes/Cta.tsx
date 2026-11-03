import { CtaComment } from "../../../components/CtaComment";
import { SceneProps } from "../../../timeline";

/** CTA: comenta «Kemp». */
export const Cta: React.FC<SceneProps> = ({ c }) => <CtaComment c={c} word="kemp" typed="Kemp" stamp={{ text: "A DIARIO", at: "diario" }} />;
