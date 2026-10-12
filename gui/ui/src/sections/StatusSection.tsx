import { useEffect, useState } from "react";
import type { BuildInfo, StatusInfo, View } from "../api";
import { langLabel, stateLabel } from "../labels";
import { SectionHeader } from "../SectionHeader";
import { PaperArt } from "../PaperArt";

interface Props {
  status: StatusInfo | null;
  buildInfo: BuildInfo | null;
  loadError: string | null;
  onApply: () => Promise<string | null>;
  onRestoreLatest: () => Promise<string | null>;
  onNavigate: (view: View) => void;
}

type Pending = "apply" | "restore" | null;

export function StatusSection({
  status,
  buildInfo,
  loadError,
  onApply,
  onRestoreLatest,
  onNavigate,
}: Props) {
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) setPending(null); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [busy]);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!status && !loadError) {
    return (
      <>
        <SectionHeader
          title="状态"
          desc="Cavalry 双语补丁的安装与检测。"
        />
        <div className="card" aria-busy="true">
          <div className="skeleton-row">
            <span className="skeleton-bar" style={{ width: "30%" }} />
            <span className="skeleton-bar" style={{ width: "18%" }} />
            <span className="skeleton-bar" style={{ width: "24%" }} />
          </div>
        </div>
      </>
    );
  }

  const detected = status?.detected ?? false;
  const applied = status?.state === "ours";

  const hero = applied
    ? "双语已应用"
    : detected
      ? "未应用补丁"
      : "未检测到 Cavalry";

  const summary: Array<[string, string]> = [
    ["Cavalry 版本", status?.cavalryVersion ?? (detected ? "未知" : "—")],
    ["语言", detected ? langLabel(status?.lang) : "—"],
    ["状态", detected ? stateLabel(status?.state) : "未检测到"],
  ];

  const details: Array<[string, string]> = [
    ["签名标识", status?.signing?.identifier ?? "—"],
    [
      "运行时摘要",
      buildInfo?.dylibExists && buildInfo.dylibSha12
        ? buildInfo.dylibSha12
        : "未找到",
    ],
    ["最新备份", status?.latestBackup ?? "暂无备份"],
  ];

  const run = async (kind: NonNullable<Pending>) => {
    setBusy(true);
    await (kind === "apply" ? onApply() : onRestoreLatest());
    setBusy(false);
    setPending(null);
  };

  const busyLabel =
    pending === "apply"
      ? "正在应用…"
      : pending === "restore"
        ? "正在还原…"
        : null;

  const confirmText =
    pending === "apply"
      ? "确认应用已保存的排版和字体？请先保存工程并退出 Cavalry。"
      : pending === "restore"
        ? "还原到最近的备份状态？不会强制退出 Cavalry。"
        : null;

  const primaryLabel = applied ? "应用更新" : "应用双语补丁";

  return (
    <>
      <SectionHeader
        title="状态"
        desc="Cavalry 双语补丁的安装与检测。"
      />

      <div className="card summary-card">
        <div className="summary-main">
          <h2 className="summary-hero">{hero}</h2>
          <div className="meta-grid">
            {summary.map(([key, value]) => (
              <div className="meta-cell" key={key}>
                <div className="k">{key}</div>
                <div className="v">{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="summary-art" aria-hidden>
          <PaperArt variant={applied ? "applied" : "idle"} width={140} />
        </div>
      </div>

      {status?.compatibility && <p className="notice" role="status">{status.compatibility.message}</p>}
      {status?.running && <p className="notice">Cavalry 正在运行。请保存工作并自行退出后，刷新状态再应用；工具不会关闭你的工程。</p>}
      {status?.pendingSettings && <p className="notice">运行时、节点词典或已保存的设置有更新，尚未应用到 Cavalry。</p>}
      {buildInfo && !buildInfo.dylibExists && <p className="field-error">缺少随附注入器，请重新安装完整工具包。不会尝试修改 Cavalry。</p>}
      <div className="status-actions">
        <div className="action-row">
          {detected && (
            <button
              type="button"
              className="cta-coral"
              disabled={busy || !!loadError || status?.compatibility?.canApply !== true || status?.running || !buildInfo?.dylibExists}
              onClick={() => setPending("apply")}
            >
              <span>{busy ? (busyLabel ?? "处理中…") : primaryLabel}</span>
              <span className={`dot ${busy ? "busy" : ""}`} aria-hidden />
            </button>
          )}
          <button type="button" className="secondary-button" disabled={busy || !status?.latestBackup || status?.running} onClick={() => setPending("restore")}>还原最近备份</button>
          <button
            type="button"
            className="inline-link"
            onClick={() => onNavigate("backup")}
          >
            查看备份 →
          </button>
        </div>
        <div className={`confirm-wrap ${confirmText ? "open" : ""}`}>
          <div className="confirm-inner">
            <div className="confirm-strip">
              <span>{busy ? (busyLabel ?? "处理中…") : confirmText}</span>
              {!busy && pending && (
                <>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => void run(pending)}
                  >
                    确认
                  </button>
                  <button
                    type="button"
                    className="inline-link"
                    onClick={() => setPending(null)}
                  >
                    取消
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="details-ghost">
        <button
          type="button"
          className="ghost-toggle"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          <span className="chevron" aria-hidden>
            ▸
          </span>
          技术细节
        </button>
        {detailsOpen && (
          <div className="details-ghost-body">
            {details.map(([key, value]) => (
              <div className="detail-row" key={key}>
                <span className="k">{key}</span>
                <span className="v">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loadError && <p className="error-text">{loadError}</p>}
    </>
  );
}
