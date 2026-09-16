import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  errorText,
  isMock,
  type BackupInfo,
  type BuildInfo,
  type ConfigInfo,
  type StatusInfo,
  type View,
} from "./api";
import { StatusSection } from "./sections/StatusSection";
import { TypeSection } from "./sections/TypeSection";
import { BackupSection } from "./sections/BackupSection";
import { LogSection } from "./sections/LogSection";
import { langLabel, stateLabel } from "./labels";

export interface LogEntry {
  time: string;
  text: string;
}

interface Toast {
  id: number;
  kind: "success" | "error";
  body: string;
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
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
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

  const pushToast = useCallback((kind: "success" | "error", body: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-3), { id, kind, body }]);
    window.setTimeout(
      () => setToasts((prev) => prev.filter((toast) => toast.id !== id)),
      3500,
    );
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setStatus(await api.getStatus());
      setStatusError(null);
    } catch (error) {
      setStatusError(errorText(error));
    }
    try {
      setBackups(await api.listBackups());
    } catch {
      setBackups([]);
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
    api
      .getConfig()
      .then(setConfig)
      .catch((error) => addLog(`读取配置失败 — ${errorText(error)}`));
    api
      .getBuildInfo()
      .then(setBuildInfo)
      .catch((error) => addLog(`读取构建信息失败 — ${errorText(error)}`));
    // 浏览器 mock 环境:种子日志,让日志区/截图有内容可看
    if (isMock) {
      addLog(
        "已应用双语补丁（原版英文 → 双语已应用），备份 ~/.cavalry-bilingual/backups/2.7.2-1757938382",
      );
      addLog(
        "已还原备份 ~/.cavalry-bilingual/backups/2.7.1-1756884120（恢复 4 项，移除 2 项）",
      );
      addLog("配置已保存 — 模板 {zh}（{en}） · 语言 简体中文 · 字体差异化 关闭");
      addLog("已应用双语补丁（社区中文运行时（daftai） → 双语已应用），备份 ~/.cavalry-bilingual/backups/2.7.2-1757938001");
    }
  }, [refresh, addLog]);

  const handleApply = useCallback(async (): Promise<string | null> => {
    try {
      const result = await api.applyPatch();
      addLog(
        `已应用双语补丁（${stateLabel(result.stateBefore)} → ${stateLabel("ours")}），备份 ${result.backupDir}`,
      );
      pushToast("success", "双语补丁已应用，备份已创建。");
      await refresh();
      return null;
    } catch (error) {
      const message = errorText(error);
      addLog(`应用双语补丁失败 — ${message}`);
      pushToast("error", message);
      return message;
    }
  }, [addLog, pushToast, refresh]);

  const handleRestore = useCallback(
    async (backupDir: string): Promise<string | null> => {
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
        pushToast("error", message);
        return message;
      }
    },
    [addLog, pushToast, refresh],
  );

  const handleSaveConfig = useCallback(
    async (
      template: string,
      lang: string,
      fontsEnabled: boolean,
    ): Promise<string | null> => {
      try {
        const next = await api.saveConfig(template, lang, fontsEnabled);
        setConfig(next);
        addLog(
          `配置已保存 — 模板 ${next.template} · 语言 ${langLabel(next.lang)} · 字体差异化 ${next.fontsEnabled ? "开启" : "关闭"}`,
        );
        pushToast("success", "排版配置已保存。");
        return null;
      } catch (error) {
        const message = errorText(error);
        addLog(`保存配置失败 — ${message}`);
        pushToast("error", message);
        return message;
      }
    },
    [addLog, pushToast],
  );

  const detected = status?.detected ?? false;
  const applied = status?.state === "ours";
  const capsuleText = !detected
    ? "未检测到 Cavalry"
    : applied
      ? "双语已应用"
      : "未应用";

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="tb-brand">
          <span className="tb-logo" aria-hidden>
            CB
          </span>
          <span className="tb-wordmark">Cavalry Bilingual</span>
        </div>
        <div className="tb-right">
          <span className="status-capsule" role="status">
            <span
              className={`status-dot ${applied ? "on" : ""} ${refreshing ? "pulse" : ""}`}
              aria-hidden
            />
            {refreshing && !status ? "检测中…" : capsuleText}
          </span>
          <button
            type="button"
            className="tb-refresh"
            data-tip="重新检测状态"
            onClick={() => void refresh()}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <polyline points="21 3 21 9 15 9" />
            </svg>
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
              data-tip={item.label}
              onClick={() => setView(item.view)}
            >
              <span className={`side-icon ${item.icon}`} aria-hidden />
              <span className="side-label">{item.label}</span>
            </button>
          ))}
        </aside>
        <main className="content">
          <div className="view" key={view}>
            {view === "status" && (
              <StatusSection
                status={status}
                buildInfo={buildInfo}
                loadError={statusError}
                onApply={handleApply}
                onRestoreLatest={() => handleRestore("")}
                onNavigate={setView}
              />
            )}
            {view === "type" && (
              <TypeSection config={config} onSave={handleSaveConfig} />
            )}
            {view === "backup" && (
              <BackupSection backups={backups} onRestore={handleRestore} />
            )}
            {view === "log" && <LogSection logs={logs} />}
          </div>
        </main>
      </div>

      <footer className="bottom-bar">
        <span>v0.2.0</span>
        <span>仅供学习用途 · 与 Scene Group 无关</span>
      </footer>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <div className="toast-title">
              {toast.kind === "success" ? "已完成" : "失败"}
            </div>
            <div className="toast-body">{toast.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
