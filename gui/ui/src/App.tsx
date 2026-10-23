import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  api,
  errorText,
  isMock,
  type BackupInfo,
  type BuildInfo,
  type ConfigInfo,
  type CavalryInstall,
  type ReportReceipt,
  type StatusInfo,
  type View,
} from "./api";
import { StatusSection } from "./sections/StatusSection";
import { TypeSection } from "./sections/TypeSection";
import { BackupSection } from "./sections/BackupSection";
import { LogSection } from "./sections/LogSection";
import { langLabel, stateLabel } from "./labels";
import { ToastNotice, type Notice } from "./components/ToastNotice";
import { useCavalryUpdate } from "./hooks/useCavalryUpdate";
import { UpdateDialog } from "./components/UpdateDialog";
import { Icon } from "./components/Icon";

export interface LogEntry {
  time: string;
  text: string;
}


function nowStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

const NAV_ITEMS: Array<{ view: View; label: string; icon: string }> = [
  { view: "status", label: "状态", icon: "icon-circle" },
  { view: "type", label: "排版", icon: "icon-square" },
  { view: "backup", label: "备份", icon: "icon-triangle" },
  { view: "log", label: "日志", icon: "icon-diamond" },
];

/** Hash 深链:#status / #type / #backup / #log(截图脚本与浏览器直开用)。 */
function viewFromHash(): View {
  if (typeof window === "undefined") return "status";
  const hash = window.location.hash.replace("#", "");
  return hash === "type" || hash === "backup" || hash === "log"
    ? hash
    : "status";
}

export default function App() {
  const [view, setViewState] = useState<View>(viewFromHash);
  const contentRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => { contentRef.current?.scrollTo({ top: 0 }); }, [view]);
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const statusRequest = useRef<Promise<void> | null>(null);
  const targetSwitchRequest = useRef<Promise<string | null> | null>(null);
  const [targetSwitching, setTargetSwitching] = useState(false);
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const configRequest = useRef<Promise<void> | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [backupsLoaded, setBackupsLoaded] = useState(false);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [backupsError, setBackupsError] = useState<string | null>(null);
  const backupsRequest = useRef<Promise<void> | null>(null);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [cavalryInstalls, setCavalryInstalls] = useState<CavalryInstall[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(isMock ? "cb-mock-operation-log-v1" : "cb-operation-log-v1");
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed.filter(e => typeof e?.time === "string" && typeof e?.text === "string").slice(0, 200) : [];
      }
    } catch { /* A damaged log never prevents starting the tool. */ }
    return isMock ? [
      { time: nowStamp(), text: "应用双语补丁失败 — Operation not permitted (os error 1)，备份 /Users/example/.cavalry-bilingual/backups/2.7.2-1757938382" },
      { time: nowStamp(), text: "配置已保存 — 模板 {zh}（{en}） · 语言 简体中文 · 字体跟随系统" },
      { time: nowStamp(), text: "已还原备份 /Users/example/.cavalry-bilingual/backups/2.7.1-1756884120" },
    ] : [];
  });
  const [operationBusy, setOperationBusy] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(isMock ? "cb-mock-operation-log-v1" : "cb-operation-log-v1", JSON.stringify(logs)); }
    catch { /* Operation failures still remain visible during this session. */ }
  }, [logs]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [refreshPulse, setRefreshPulse] = useState(0);
  const [toasts, setToasts] = useState<Notice[]>([]);
  const toastId = useRef(0);

  const addLog = useCallback((text: string) => {
    setLogs((prev) => [{ time: nowStamp(), text }, ...prev].slice(0, 200));
  }, []);

  const setView = useCallback((next: View) => {
    setViewState(next);
    if (typeof window !== "undefined" && window.location.hash !== `#${next}`) {
      window.history.replaceState(null, "", `#${next}`);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHashChange = () => setViewState(viewFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(notice => notice.id !== id));
  }, []);
  const pushToast = useCallback((kind: Notice["kind"], body: string, title?: string, delayMs = 0) => {
    const id = ++toastId.current;
    setToasts(prev => [...prev.slice(-2), { id, kind, body, delayMs, title: title ?? (kind === "success" ? "已完成" : kind === "error" ? "操作未完成" : "状态提醒") }]);
  }, []);
  const onOfficialDownload = useCallback((path: string) => {
    addLog(`已下载 Cavalry 官方版本：${path}`);
    pushToast("success", "官方安装包已下载，可在软件更新中打开下载位置。");
  }, [addLog, pushToast]);
  const onOfficialDownloadFailed = useCallback((reason: string) => addLog(`下载 Cavalry 官方版本失败 — ${reason}`), [addLog]);
  const update = useCavalryUpdate(cavalryInstalls, onOfficialDownload, onOfficialDownloadFailed);
  const statusNoticeSignature = useRef("");
  const runtimeNoticeSignature = useRef("");
  useEffect(() => {
    if (view !== "status" || !status) return;
    const signature = JSON.stringify([status.appPath, status.running, status.pendingSettings, status.compatibility?.message, targetSwitching, statusError]);
    if (signature === statusNoticeSignature.current) return;
    statusNoticeSignature.current = signature;
    const notices: Array<[Notice["kind"], string, string]> = [];
    if (status.compatibility) notices.push(["info", `${status.compatibility.message}${status.compatibility.canApply ? " 应用前会创建可还原快照。" : ""}`, "兼容性检查"]);
    if (targetSwitching) notices.push(["info", "正在切换目标，完成后可继续操作。", "目标切换"]);
    if (statusError) notices.push(["error", "状态尚未确认，请先重新检测。", "状态检测"]);
    if (status.running) notices.push(["info", "请保存工程并退出目标 Cavalry，再应用双语。", "Cavalry 正在运行"]);
    if (status.pendingSettings) notices.push(["info", "排版或运行时有更改，可在退出 Cavalry 后应用。", "有待应用的更新"]);
    notices.forEach(([kind, body, title], index) => pushToast(kind, body, title, index * 100));
  }, [view, status, targetSwitching, statusError, pushToast]);
  useEffect(() => {
    if (view !== "status" || !status || !buildInfo) return;
    const missing = status.cavalryVersion === "2.8.0" ? !buildInfo.dylib280Exists || !buildInfo.cavalry280AssetsExists : !buildInfo.dylibExists;
    const signature = JSON.stringify([status.appPath, status.cavalryVersion, missing]);
    if (signature === runtimeNoticeSignature.current) return;
    runtimeNoticeSignature.current = signature;
    if (missing) pushToast("error", "缺少当前版本对应的注入器，请重新安装完整工具包。不会尝试修改 Cavalry。", "运行时检查");
  }, [view, status, buildInfo, pushToast]);

  const recordFontReadError = useCallback((message: string) => addLog(`读取字体列表失败 — ${message}`), [addLog]);

  const loadConfig = useCallback((): Promise<void> => {
    if (configRequest.current) return configRequest.current;
    setConfigLoading(true);
    const request = api.getConfig().then(value => { setConfig(value); setConfigError(null); })
      .catch(reason => { const message = errorText(reason); setConfigError(message); addLog(`读取配置失败 — ${message}`); })
      .finally(() => { configRequest.current = null; setConfigLoading(false); });
    configRequest.current = request;
    return request;
  }, [addLog]);

  const loadBackups = useCallback((): Promise<void> => {
    if (backupsRequest.current) return backupsRequest.current;
    setBackupsLoading(true);
    const request = api.listBackups().then(value => { setBackups(value); setBackupsLoaded(true); setBackupsError(null); })
      .catch(reason => { const message = errorText(reason); setBackupsError(message); addLog(`备份读取失败 — ${message}`); })
      .finally(() => { backupsRequest.current = null; setBackupsLoading(false); });
    backupsRequest.current = request;
    return request;
  }, [addLog]);

  const loadStatus = useCallback((): Promise<void> => {
    if (statusRequest.current) return statusRequest.current;
    const request = api.getStatus().then(value => { setStatus(value); setStatusError(null); })
      .catch(reason => { const message = errorText(reason); setStatusError(message); addLog(`检测 Cavalry 失败 — ${message}`); })
      .finally(() => { statusRequest.current = null; });
    statusRequest.current = request;
    return request;
  }, [addLog]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadStatus(),
      loadBackups(),
      api.listCavalryInstalls().then(setCavalryInstalls).catch(() => addLog("Cavalry 版本列表读取失败 — 保留当前目标，请稍后刷新。")),
    ]);
    setRefreshing(false);
  }, [addLog, loadBackups, loadStatus]);

  const retryConfig = useCallback(async () => { await loadConfig(); await refresh(); }, [loadConfig, refresh]);
  useEffect(() => {
    void refresh();
    void loadConfig();
    api.getBuildInfo().then(setBuildInfo).catch(reason => addLog(`读取构建信息失败 — ${errorText(reason)}`));
  }, [refresh, loadConfig, addLog]);

  const handleApply = useCallback(async (): Promise<string | null> => {
    setOperationBusy(true);
    try {
      const result = await api.applyPatch();
      addLog(
        `已应用双语补丁（${stateLabel(result.stateBefore)} → ${stateLabel("ours")}），备份 ${result.backupDir}`,
      );
      pushToast("success", `补丁已应用，备份已创建${result.assetStringsUpdated ? `；更新 ${result.assetStringsUpdated} 个节点展示字符串` : ""}。`);
      await refresh();
      return null;
    } catch (error) {
      const message = errorText(error);
      addLog(`应用双语补丁失败 — ${message}`);
      pushToast("error", "应用双语未完成，请查看当前弹窗中的原因后重试。");
      return message;
    }
    finally { setOperationBusy(false); }
  }, [addLog, pushToast, refresh]);

  const handleRestore = useCallback(
    async (backupDir: string): Promise<string | null> => {
      setOperationBusy(true);
      try {
        const result = await api.restoreBackup(backupDir);
        addLog(
          `已还原备份 ${result.backupDir}（恢复 ${result.restored.length} 项，移除 ${result.removed.length} 项）`,
        );
        pushToast("success", "备份已还原，Cavalry 恢复为所选版本。");
        await refresh();
        return null;
      } catch (error) {
        const message = errorText(error);
        addLog(`还原失败 — ${message}`);
        pushToast("error", "备份还原未完成，请查看当前弹窗中的原因后重试。");
        return message;
      } finally { setOperationBusy(false); }
    },
    [addLog, pushToast, refresh],
  );

  const handleDeleteBackup = useCallback(async (backupDir: string): Promise<string | null> => {
    setOperationBusy(true);
    try {
      await api.deleteBackup(backupDir);
      addLog(`备份已移至废纸篓：${backupDir}`);
      pushToast("success", "备份已移至废纸篓，可从系统中恢复。");
      await refresh();
      return null;
    } catch (error) {
      const message = errorText(error);
      addLog(`删除备份失败 — ${message}`);
      pushToast("error", "未能删除备份，请刷新后重试。");
      return message;
    } finally { setOperationBusy(false); }
  }, [addLog, pushToast, refresh]);

  const handleClearLogs = useCallback(async (): Promise<string | null> => {
    try {
      localStorage.setItem(isMock ? "cb-mock-operation-log-v1" : "cb-operation-log-v1", "[]");
      setLogs([]);
      pushToast("success", "本工具的操作记录已清空。");
      return null;
    } catch {
      const message = "无法清除本机记录，请重试。";
      pushToast("error", message);
      return message;
    }
  }, [pushToast]);

  const handleSelectCavalry = useCallback((path: string): Promise<string | null> => {
    if (targetSwitchRequest.current) return targetSwitchRequest.current;
    setTargetSwitching(true);
    const request = (async () => {
      try {
        await api.setTargetCavalry(path);
        // The write is acknowledged; reflect it even if the following read fails.
        setCavalryInstalls(items => items.map(item => ({ ...item, selected: item.path === path })));
        addLog(`已切换目标 Cavalry：${path}`);
        await refresh();
        pushToast("success", "目标已切换。请确认当前状态后再应用双语。");
        return null;
      } catch (reason) {
        const message = errorText(reason);
        addLog(`切换 Cavalry 失败 — ${message}`);
        pushToast("error", "未完成目标切换，可重新选择或重试。");
        return message;
      } finally {
        setTargetSwitching(false);
        targetSwitchRequest.current = null;
      }
    })();
    targetSwitchRequest.current = request;
    return request;
  }, [addLog, pushToast, refresh]);

  const handleBrowseCavalry = useCallback(async (): Promise<string | null> => {
    try {
      const path = await api.chooseCavalryDirectory();
      return path ? handleSelectCavalry(path) : null;
    } catch (reason) {
      return errorText(reason);
    }
  }, [handleSelectCavalry]);

  const handleReportComplete = useCallback((receipt: ReportReceipt) => {
    if (receipt.delivery === "submitted" || receipt.delivery === "mail-sent") addLog(`反馈报告已提交 — 编号 ${receipt.id}`);
    else addLog(`反馈报告已保存：${receipt.path ?? "本机"}`);
  }, [addLog]);

  const handleSaveConfig = useCallback(
    async (
      template: string,
      lang: string,
      zhFont: string,
      enFont: string,
    ): Promise<string | null> => {
      try {
        const next = await api.saveConfig(template, lang, zhFont, enFont);
        setConfig(next);
        addLog(
          `配置已保存 — 模板 ${next.template} · 语言 ${langLabel(next.lang)} · 字体 ${next.zhFont || "系统默认"} / ${next.enFont || "系统默认"}`,
        );
        pushToast("success", "设置已保存；请在状态页应用双语，再重新打开 Cavalry。");
        await refresh();
        return null;
      } catch (error) {
        const message = errorText(error);
        addLog(`保存配置失败 — ${message}`);
        pushToast("error", "设置保存未完成，详细原因已保留在保存栏。");
        return message;
      }
    },
    [addLog, pushToast, refresh],
  );

  const detected = status?.detected ?? false;
  const applied = status?.state === "ours";
  const capsuleText = statusError ? (status ? "状态未刷新" : "检测未完成") : !detected
    ? "未检测到 Cavalry"
    : applied
      ? "双语已应用"
      : "未应用";

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="tb-brand">
          <img className="tb-logo" src="/app-icon.png" alt="" aria-hidden="true" />
          <span className="tb-wordmark">Cavalry Bilingual</span>
        </div>
        <div className="tb-right">
          <span className="status-capsule" role="status">
            <span
              className={`status-dot ${applied && !statusError && !targetSwitching ? "on" : ""} ${refreshing || targetSwitching ? "pulse" : ""}`}
              aria-hidden
            />
            {targetSwitching ? "正在切换目标…" : refreshing && !status ? "检测中…" : capsuleText}
          </span>
          <button
            type="button"
            className={`tb-refresh ${refreshPulse > 0 ? "refresh-pulse" : ""}`}
            data-tip="重新检测状态"
            aria-label="刷新状态"
            disabled={refreshing || operationBusy || targetSwitching}
            onClick={() => { setRefreshPulse(value => value + 1); void refresh(); if (configError) void loadConfig(); }}
          >
            <Icon key={refreshPulse} name="refresh" />
          </button>
        </div>
      </header>

      <div className="body-row">
        <aside className="sidebar" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              type="button"
              className={`side-item ${view === item.view ? "active" : ""}`}
              aria-current={view === item.view ? "page" : undefined}
              aria-label={item.label}
              disabled={operationBusy || targetSwitching}
              onClick={() => setView(item.view)}
            >
              <span className={`side-icon ${item.icon}`} aria-hidden />
              <span className="side-label">{item.label}</span>
            </button>
          ))}
        </aside>
        <main className="content" ref={contentRef}>
          <div className="view">
            {view === "status" && (
              <StatusSection
                status={status}
                buildInfo={buildInfo}
                installs={cavalryInstalls}
                loadError={statusError}
                loading={refreshing}
                switching={targetSwitching}
                onRetry={refresh}
                onApply={handleApply}
                onRestoreLatest={() => handleRestore("")}
                onNavigate={setView}
                onSelectCavalry={handleSelectCavalry}
                onBrowseCavalry={handleBrowseCavalry}
                update={update}
                operationBusy={operationBusy}
              />
            )}
            <div className="type-view" hidden={view !== "type"}>
              <TypeSection config={config} active={view === "type"} loading={configLoading} loadError={configError} onRetry={retryConfig} onFontReadError={recordFontReadError} onSave={handleSaveConfig} onNotify={pushToast} />
            </div>
            {view === "backup" && (
              <BackupSection backups={backups} loaded={backupsLoaded} loading={backupsLoading} loadError={backupsError} onRetry={loadBackups} onRestore={handleRestore} onDelete={handleDeleteBackup} operationBusy={operationBusy} />
            )}
            {view === "log" && <LogSection logs={logs} cavalryVersion={status?.cavalryVersion ?? null} onReportComplete={handleReportComplete} onClearLogs={handleClearLogs} />}
          </div>
        </main>
      </div>

      <footer className="bottom-bar">
        <span>v{buildInfo?.appVersion ?? "0.1.5"}{isMock ? " · 界面演示" : " · 验证中"}</span>
        <span>仅供学习用途 · 与 Scene Group 无关</span>
      </footer>

      <UpdateDialog update={update} />
      <div className="toast-stack" aria-live="polite" aria-label="通知">
        {toasts.map(notice => <ToastNotice key={notice.id} notice={notice} onDismiss={dismissToast} />)}
      </div>
    </div>
  );
}
