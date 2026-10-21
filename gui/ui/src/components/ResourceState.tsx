import { Icon } from "./Icon";
interface Props {
  title: string; description: string; loading?: boolean; compact?: boolean;
  onRetry?: () => Promise<void>; retryLabel?: string;
}
/** The same restrained language for pending, failed and retained-resource states. */
export function ResourceState({ title, description, loading = false, compact = false, onRetry, retryLabel = "重新读取" }: Props) {
  return <div className={`resource-state ${compact ? "resource-state-compact" : ""}`} data-loading={loading} role={loading ? "status" : "alert"} aria-busy={loading}>
    <span className="resource-symbol" aria-hidden="true">{loading ? <span className="progress-spinner"/> : <Icon name="info"/>}</span>
    <div className="resource-copy"><h3>{title}</h3><p>{description}</p></div>
    {onRetry && <button type="button" className="secondary-button" disabled={loading} onClick={() => void onRetry()}><Icon name="refresh"/>{loading ? "正在读取…" : retryLabel}</button>}
  </div>;
}
