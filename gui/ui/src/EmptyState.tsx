import { PaperArt } from "./PaperArt";
interface Props { text: string; description: string }
/** Quiet empty collection: a readable title and next-step context, not a disabled-looking row. */
export function EmptyState({ text, description }: Props) {
  return <div className="empty-block">
    <div className="empty-art" aria-hidden="true"><PaperArt variant="idle" width={80} /></div>
    <div className="empty-copy"><h3 className="empty-title">{text}</h3><p className="empty-description">{description}</p></div>
  </div>;
}
