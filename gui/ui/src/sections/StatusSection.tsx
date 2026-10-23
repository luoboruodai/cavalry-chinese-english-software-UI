import { ConfirmDialog } from "../components/ConfirmDialog";
import { SearchSelect } from "../components/SearchSelect";
import type { CavalryUpdateController } from "../hooks/useCavalryUpdate";
import { Icon } from "../components/Icon";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BuildInfo, CavalryInstall, StatusInfo, View } from "../api";
import { langLabel, stateLabel } from "../labels";
import { SectionHeader } from "../SectionHeader";
import { PaperArt } from "../PaperArt";
import { ResourceState } from "../components/ResourceState";

interface Props {
  status: StatusInfo | null;
  buildInfo: BuildInfo | null;
  installs: CavalryInstall[];
  loadError: string | null;
  loading: boolean;
  switching: boolean;
  onRetry: () => Promise<void>;
  onApply: () => Promise<string | null>;
  onRestoreLatest: () => Promise<string | null>;
  onLaunchCavalry: () => Promise<string | null>;
  onNavigate: (view: View) => void;
  onSelectCavalry: (path: string) => Promise<string | null>;
  onBrowseCavalry: () => Promise<string | null>;
  update: CavalryUpdateController;
  operationBusy: boolean;
}

type Pending = "apply" | "restore" | null;

export function StatusSection({
  status,
  buildInfo,
  installs,
  loadError,
  loading,
  switching,
  onRetry,
  onApply,
  onRestoreLatest,
  onLaunchCavalry,
  onNavigate,
  onSelectCavalry,
  onBrowseCavalry,
  update,
  operationBusy: busy,
}: Props) {
  const heroHeading = useRef<HTMLHeadingElement>(null);
  const retryFocus = useRef(false);
  const switchFocus = useRef(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const blocked = busy || loading || switching;
  const runtimeMissing = !buildInfo || (status?.cavalryVersion === "2.8.0" ? !buildInfo.dylib280Exists || !buildInfo.cavalry280AssetsExists : !buildInfo.dylibExists);
  const actionHint = switching ? "正在切换目标，完成后可继续操作。" : loadError ? "状态尚未确认，请先重新检测。" : loading ? "正在确认当前状态…" : status?.pendingSettings ? "有待应用的更改。" : status?.compatibility?.canApply === true ? "应用前会创建可还原快照。" : null;
  const compatibilityBlocked = status?.compatibility?.canApply === false;
  const actionDescription = [actionHint && "status-action-hint", compatibilityBlocked && "status-compatibility-hint", runtimeMissing && "status-runtime-hint", status?.running && "status-running-hint"].filter(Boolean).join(" ") || undefined;
  const [pending, setPending] = useState<Pending>(null);
  const [targetPath, setTargetPath] = useState("");
  const selectedInstall = installs.find(item => item.selected) ?? installs.find(item => item.path === status?.appPath);
  const selectedTarget = selectedInstall?.path ?? status?.appPath ?? "";
  useEffect(() => { if (!targetPath || !installs.some(item => item.path === targetPath)) setTargetPath(selectedInstall?.path ?? installs[0]?.path ?? ""); }, [installs, selectedInstall?.path, targetPath]);

  useLayoutEffect(() => {
    if (retryFocus.current && !blocked && !loadError && status) { heroHeading.current?.focus(); retryFocus.current = false; }
    if (switchFocus.current && !blocked) { document.getElementById("cavalry-target")?.focus(); switchFocus.current = false; }
  }, [blocked, loadError, status, selectedTarget, switchError]);
  const retry = () => { retryFocus.current = true; return onRetry(); };
  const switchTarget = async () => {
    if (blocked) return;
    switchFocus.current = true; setSwitchError(null);
    const message = await onSelectCavalry(targetPath);
    setSwitchError(message);
  };
  const browseTarget = async () => {
    if (blocked) return;
    switchFocus.current = true; setSwitchError(null);
    const message = await onBrowseCavalry();
    setSwitchError(message);
  };

  const targetPanel = (
<section className="target-card" aria-label="Cavalry 注入目标">
        <div className="target-card-head">
          <div>
            <h3>当前注入目标</h3>
            <p>选择本机已安装的 Cavalry 版本；切换只影响下一次应用双语。</p>
          </div>
          <span className="target-count">{installs.length ? `${installs.length} 个本机版本` : "未发现版本"}</span>
        </div>
        {switchError && <ResourceState compact title="未完成目标切换" description={switchError}/>}
        <div className="target-card-controls">
          <SearchSelect id="cavalry-target" label="Cavalry 目标版本" hideLabel value={targetPath} options={installs.map(item=>({value:item.path,label:item.displayName,detail:[item.path,item.running?"正在运行":"未运行",item.selected?"当前目标":""].filter(Boolean).join(" · ")}))} onChange={path => { setTargetPath(path); setSwitchError(null); }} disabled={!installs.length || blocked} placeholder="未发现可用 Cavalry" searchPlaceholder="搜索已安装版本…" emptyText="没有匹配的本机版本" className="target-select"/>
          <button type="button" className="secondary-button target-switch-button" aria-busy={switching} aria-label={switching ? "正在切换 Cavalry" : switchError ? "重试切换 Cavalry" : "切换 Cavalry"} disabled={!targetPath || targetPath === selectedTarget || blocked} onClick={() => void switchTarget()}>{switching && <span className="progress-spinner button-spinner" aria-hidden="true"/>}{switching ? "正在切换…" : switchError ? "重试切换" : "切换 Cavalry"}</button>
          <button type="button" className="secondary-button target-browse-button" aria-label="选择 Cavalry 安装路径" disabled={blocked} onClick={()=>void browseTarget()}><Icon name="folder"/>选择路径…</button>
          <button type="button" className="secondary-button update-link" aria-label="软件更新" onClick={update.show}><Icon name="download"/>{update.busy?"下载中…":"软件更新"}{update.hasUpdate&&!update.busy&&<span className="update-dot" role="status" aria-label={`发现新版本 ${update.release?.version}`}/>}</button>
        </div>
        {selectedTarget && <p className="target-card-note">当前路径：{selectedTarget}</p>}
        {switching ? <p className="target-switch-state" role="status">正在确认新目标，完成后即可继续操作。</p> : targetPath !== selectedTarget && targetPath ? <p className="target-switch-state" role="status">尚未切换 · {selectedInstall ? `当前目标仍为 ${selectedInstall.displayName}` : selectedTarget ? "当前目标未在本机找到" : "当前目标尚未确认"}</p> : null}
      </section>
  );

  if (!status) return <>
    <SectionHeader title="状态" desc="Cavalry 双语补丁的安装与检测。"/>
    <div className="collection-panel"><ResourceState title={loading ? "正在检测 Cavalry…" : "暂时无法检测 Cavalry"} description={loading ? "正在确认本机版本和运行状态。" : installs.length ? "尚未确认安装和运行状态。可重新检测，或切换下方的本机版本。" : "尚未确认安装和运行状态。请重新检测，不会修改 Cavalry。"} loading={loading} onRetry={loadError ? retry : undefined} retryLabel="重新检测"/></div>
    {installs.length > 0 && targetPanel}
  </>;

  const detected = status?.detected ?? false;
  const applied = status?.state === "ours";
  const canLaunch = applied && !status?.running && !blocked && !loadError;

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

  const primaryLabel = "应用双语";

  return (
    <>
      <SectionHeader
        title="状态"
        desc="Cavalry 双语补丁的安装与检测。"
      />

      {loadError && <ResourceState compact title={loading ? "正在重新检测 Cavalry…" : "状态未能刷新"} description="保留上次检测结果，重新确认前不能应用或还原。" loading={loading || switching} onRetry={retry} retryLabel="重新检测"/>}

      <div className="card summary-card">
        <div className="summary-main">
          <h2 className="summary-hero" ref={heroHeading} tabIndex={-1}>{hero}</h2>
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

      {targetPanel}

      {!detected && status?.appPath && (
        <p className="notice" role="status">
          未检测到 Cavalry；已检查路径：{status.appPath}
        </p>
      )}
      {buildInfo && runtimeMissing && <span className="sr-only" id="status-runtime-hint">缺少当前版本对应的注入器，请重新安装完整工具包。不会尝试修改 Cavalry。</span>}
      {compatibilityBlocked && <span className="sr-only" id="status-compatibility-hint">当前版本暂不支持应用双语，现有 Cavalry 不受影响。</span>}
      {status?.running && <span className="sr-only" id="status-running-hint">目标 Cavalry 正在运行，退出后可应用双语。</span>}
      <div className="status-actions">
        {actionHint && <span className="sr-only" id="status-action-hint">{actionHint}</span>}
        <div className="action-row">
          {detected && (
            <button
              type="button"
              className="cta-coral"
              aria-describedby={actionDescription}
              disabled={blocked || !!loadError || status?.compatibility?.canApply !== true || status?.running || runtimeMissing}
              onClick={() => setPending("apply")}
            >
              <span>{busy ? "处理中…" : primaryLabel}</span>
              {!applied && <span className={`dot ${busy ? "busy" : ""}`} aria-hidden />}
            </button>
          )}
          <button type="button" className="secondary-button" disabled={blocked || !!loadError || !status?.latestBackup || status?.running} onClick={() => setPending("restore")}>还原最近备份</button>
          <button type="button" className="secondary-button" disabled={!canLaunch} title={canLaunch ? "启动当前已应用双语的 Cavalry" : "只有已确认应用双语的安装才能启动"} onClick={() => void onLaunchCavalry()}><Icon name="play"/>启动 Cavalry</button>
          <button
            type="button"
            className="inline-link"
            onClick={() => onNavigate("backup")}
          >
            查看备份 →
          </button>
        </div>
      </div>
      {pending && <ConfirmDialog
        title={pending === "apply" ? "应用双语？" : "还原最近备份？"}
        icon={pending === "apply" ? "info" : "restore"}
        confirmLabel={pending === "apply" ? "确认应用" : "确认还原"}
        onCancel={() => setPending(null)}
        onConfirm={pending === "apply" ? onApply : onRestoreLatest}
      >
        <p>{pending === "apply" ? "将使用已保存的排版和字体，并在应用前保留快照。请先保存工程并退出目标 Cavalry。" : "将恢复最近快照保存的状态。请先保存工程并退出目标 Cavalry。"}</p>
        <div className="dialog-snapshot"><strong>Cavalry {status?.cavalryVersion ?? "当前目标"}</strong><span>{pending === "apply" ? "只修改当前选择的版本，不会自动关闭 Cavalry。" : `最近快照：${status?.latestBackup ?? "暂无备份"}`}</span></div>
      </ConfirmDialog>}

    </>
  );
}
