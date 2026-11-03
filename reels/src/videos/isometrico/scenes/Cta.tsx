import { CtaComment } from "../../../components/CtaComment";
import { SceneProps } from "../../../timeline";

/** CTA: comenta «30». */
export const Cta: React.FC<SceneProps> = ({ c }) => <CtaComment c={c} word="treinta" typed="30°" stamp={{ text: "RODILLA DOBLADA", at: "doblada" }} />;
