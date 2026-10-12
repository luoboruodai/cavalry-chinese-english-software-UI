import { useEffect, useState } from "react";
import type { BackupInfo } from "../api";
import { SectionHeader } from "../SectionHeader";
import { EmptyState } from "../EmptyState";

interface Props {
  backups: BackupInfo[];
  onRestore: (backupDir: string) => Promise<string | null>;
}

export function BackupSection({ backups, onRestore }: Props) {
  const [confirmPath, setConfirmPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setConfirmPath(null); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [busy]);

  const run = async (path: string) => {
    setBusy(true);
    await onRestore(path);
    setBusy(false);
    setConfirmPath(null);
  };

  return (
    <>
      <SectionHeader
        title="备份"
        desc="还原前校验快照完整性，恢复当时的状态，而非一律变回英文。旧版无清单备份仅保留。"
      />

      {backups.length === 0 ? (
        <div className="card">
          <EmptyState text="暂无备份" />
        </div>
      ) : (
        <div className="backup-list">
          {backups.map((backup) =>
            confirmPath === backup.path ? (
              <div className="backup-row confirming" key={backup.path}>
                <span>
                  {busy
                    ? "正在还原…"
                    : `确认还原 ${backup.time}（${backup.version}）？`}
                </span>
                {!busy && (
                  <>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => void run(backup.path)}
                    >
                      确认
                    </button>
                    <button
                      type="button"
                      className="inline-link"
                      onClick={() => setConfirmPath(null)}
                    >
                      取消
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="backup-row" key={backup.path}>
                <span className="time">{backup.time}</span>
                <span className="chip">{backup.version}</span>
                <span className="kind">{backup.kind}</span>
                <span className="spacer" />
                <button
                  type="button"
                  className="inline-link"
                  disabled={busy || backup.recoverable === false}
                  onClick={() => setConfirmPath(backup.path)}
                >
                  还原
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </>
  );
}
