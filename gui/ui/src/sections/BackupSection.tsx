import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { BackupInfo } from "../api";
import { SectionHeader } from "../SectionHeader";
import { EmptyState } from "../EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { ResourceState } from "../components/ResourceState";

interface Props {
  backups: BackupInfo[];
  loaded: boolean;
  loading: boolean;
  loadError: string | null;
  onRetry: () => Promise<void>;
  onRestore: (backupDir: string) => Promise<string | null>;
  onDelete: (backupDir: string) => Promise<string | null>;
  operationBusy: boolean;
}
type Selection = { kind: "restore" | "delete"; backup: BackupInfo };

export function BackupSection({ backups, loaded, loading, loadError, onRetry, onRestore, onDelete, operationBusy }: Props) {
  const count = useRef<HTMLSpanElement>(null);
  const retryFocus = useRef(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  useLayoutEffect(() => {
    if (retryFocus.current && loaded && !loading && !loadError) { count.current?.focus(); retryFocus.current = false; }
  }, [loaded, loading, loadError]);
  const retry = () => { retryFocus.current = true; return onRetry(); };
  const recoverable = backups.filter(backup => backup.recoverable !== false).length;
  return <>
    <SectionHeader title="备份" desc="每次应用前保留快照，需要时还原。" />
    <div className="collection-toolbar list-overview"><span className="collection-count" ref={count} tabIndex={-1}><Icon name="restore" />本机快照 <b>{loaded ? backups.length : "—"}</b></span><span className="sr-only" role="status">{loading ? "正在读取快照…" : loaded ? `${recoverable} 个可还原${backups.length > recoverable ? ` · ${backups.length - recoverable} 个旧版` : ""}` : "尚未读取"}</span></div>
    {loaded && loadError && <ResourceState compact title={loading ? "正在重新读取快照…" : "备份列表未能刷新"} description="保留上次读取的快照，列表可能不是最新状态。" loading={loading} onRetry={retry} retryLabel="重新读取备份"/>}
    {!loaded ? <div className="collection-panel"><ResourceState title={loading ? "正在读取备份…" : "备份读取失败"} description={loading ? "已有文件不会被修改。" : "未确认是否存在快照。请重新读取；已有备份不会被删除。"} loading={loading} onRetry={loadError ? retry : undefined} retryLabel="重新读取备份"/></div> : backups.length === 0 ? <div className="collection-panel"><EmptyState text="暂无备份" description="应用双语时会自动保留快照，之后可在这里还原或管理。" /></div> : <ul className="collection-panel backup-cards" aria-label="备份快照">
      {backups.map((backup,index) => <li className="backup-row" data-legacy={backup.recoverable === false} key={backup.path} style={{ "--row-delay": `${Math.min(index, 8) * 45.5}ms` } as CSSProperties}>
        <span className={`backup-symbol ${backup.recoverable === false ? "legacy" : ""}`}><Icon name="restore" /></span>
        <div className="backup-meta">
          <div className="backup-title"><time className="time">{backup.time}</time><span className="chip">{backup.version}</span>{backup.recoverable === false && <span className="legacy-label">旧版</span>}</div>
          <div className="backup-subtitle"><span>{backup.recoverable === false ? "旧版快照 · 仅可保留或删除" : backup.kind}</span><span className="snapshot-id" title={backup.name}>{backup.name}</span></div>
        </div>
        <div className="backup-actions">
          <button type="button" className="row-action" title={backup.recoverable === false ? "旧版快照暂不可自动还原" : "还原这份快照"} aria-label={`还原备份 ${backup.name}`} disabled={operationBusy || loading || backup.recoverable === false} onClick={() => setSelection({ kind: "restore", backup })}><span className="row-action-content"><Icon name="restore" /><span>还原</span></span></button>
          <button type="button" className="row-action danger-quiet" aria-label={`删除备份 ${backup.name}`} disabled={operationBusy || loading} onClick={() => setSelection({ kind: "delete", backup })}><span className="row-action-content"><Icon name="trash" /><span>删除</span></span></button>
        </div>
      </li>)}
    </ul>}
    {selection && <ConfirmDialog title={selection.kind === "delete" ? "删除备份？" : "还原备份？"} confirmLabel={selection.kind === "delete" ? "移至废纸篓" : "确认还原"} danger={selection.kind === "delete"} onCancel={() => setSelection(null)} onConfirm={() => (selection.kind === "delete" ? onDelete : onRestore)(selection.backup.path)}>
      <p>{selection.kind === "delete" ? "仅将这份快照移至废纸篓，其他备份和 Cavalry 不受影响。" : "恢复这份快照保存的状态。请先保存工程并退出目标 Cavalry。"}</p>
      <div className="dialog-snapshot"><strong>{selection.backup.time} · {selection.backup.version}</strong><span>{selection.backup.name}</span></div>
    </ConfirmDialog>}
  </>;
}
