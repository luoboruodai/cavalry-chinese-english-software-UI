import { PaperArt } from "./PaperArt";

interface Props {
  text: string;
}

/** 统一空态:纸剪插画小号(灰调待命角色)+ 13px #80827f 文字,居中。 */
export function EmptyState({ text }: Props) {
  return (
    <div className="empty-block">
      <PaperArt variant="idle" width={72} />
      <p className="empty-text">{text}</p>
    </div>
  );
}
