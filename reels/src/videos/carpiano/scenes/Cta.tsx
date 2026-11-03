import { CtaComment } from "../../../components/CtaComment";
import { SceneProps } from "../../../timeline";

/** CTA: comenta «mano» o «fibro». */
export const Cta: React.FC<SceneProps> = ({ c }) => <CtaComment c={c} word="fibro" typed="fibro" stamp={{ text: "¿QUÉ VA PRIMERO?", at: "primero" }} />;
