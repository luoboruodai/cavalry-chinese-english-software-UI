import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

/**
 * Tauri 调用封装:在 Tauri 环境走 invoke;在普通浏览器(无头截图、开发预览)
 * 返回内置 fixture,让界面完整渲染。isMock 供 App 侧做 mock 专属逻辑(种子日志)。
 */
const inTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const isMock = !inTauri;

export type View = "status" | "type" | "backup" | "log";

export interface CavalryInstall {
  path: string;
  version: string;
  displayName: string;
  running: boolean;
  selected: boolean;
}

export interface SigningInfo {
  identifier: string | null;
  flags: string | null;
  signature: string | null;
}

export interface StatusInfo {
  detected: boolean;
  appPath?: string;
  cavalryVersion?: string | null;
  executable?: string | null;
  state?: "vendor" | "daftai" | "ours" | "incomplete" | null;
  lang?: string | null;
  signing?: SigningInfo;
  latestBackup?: string | null;
  pendingSettings?: boolean;
  running?: boolean;
  compatibility?: { canApply: boolean; level: string; message: string; qtVersion?: string };
}

export interface ConfigInfo {
  path: string;
  template: string;
  lang: string;
  zhFont: string;
  enFont: string;
}

export interface BackupInfo {
  name: string;
  path: string;
  time: string;
  version: string;
  kind: string;
  recoverable?: boolean;
}

export interface BuildInfo {
  dylibPath: string;
  dylibExists: boolean;
  dylibSha12: string | null;
  dylib280Path: string;
  dylib280Exists: boolean;
  dylib280Sha12: string | null;
  cavalry280AssetsPath: string | null;
  cavalry280AssetsExists: boolean;
  configPath: string;
  configExists: boolean;
  template: string | null;
  lang: string | null;
  appVersion: string;
  supportedLangs: string[];
}

export interface CavalryRelease {
  version: string; notesUrl: string; sourceUrl: string; checkedAt: number; downloadSupported: boolean;
}
export interface DownloadProgress { phase: "downloading" | "verifying"; downloaded: number; total: number | null }
export interface DownloadResult { status: "downloaded" | "cancelled"; path: string | null; version: string }
export interface EmailJsSession { serviceId: string; templateId: string; publicKey: string }
export interface ReportPreview { id: string; preview: string; logCount: number; delivery: "service" | "mail" | "export"; serviceName: string; note: string | null }
export interface ReportReceipt { id: string; delivery: "submitted" | "mail-sent" | "mail-draft" | "exported"; path: string | null }

export interface ApplyResult {
  ok: boolean;
  app: string;
  stateBefore: string;
  assetStringsUpdated?: number;
  backupDir: string;
}

export interface RestoreResult {
  ok: boolean;
  app: string;
  backupDir: string;
  restored: string[];
  removed: string[];
}

// ---------------------------------------------------------------------------
// Mock fixtures(浏览器/无头截图环境)
// ---------------------------------------------------------------------------

const MOCK_BACKUP_ROOT = "/Users/example/.cavalry-bilingual/backups";

const MOCK_STATUS: StatusInfo = {
  detected: true,
  appPath: "/Applications/Cavalry.app",
  cavalryVersion: "2.7.2",
  executable: "CavalryLauncher",
  state: "ours",
  lang: "zh-Hans",
  signing: {
    identifier: "com.scenegroup.cavalry",
    flags: "0x2(adhoc)",
    signature: "adhoc",
  },
  latestBackup: "2026-09-15 21:33",
  compatibility: { canApply: true, level: "candidate", message: "Cavalry 2.7.2 / Qt 6.6.3：匹配当前适配目标；完整覆盖仍需实机验收。" },
};

const MOCK_CONFIG: ConfigInfo = {
  path: "/Users/example/cavalry-bilingual/composer/bilingual.config.json",
  template: "{zh}（{en}）",
  lang: "zh-Hans",
  zhFont: "",
  enFont: "",
};

const MOCK_BACKUPS: BackupInfo[] = [
  {
    name: "2.7.2-1757938382",
    path: `${MOCK_BACKUP_ROOT}/2.7.2-1757938382`,
    time: "2026-09-15 21:33",
    version: "2.7.2",
    kind: "双语补丁",
  },
  {
    name: "2.7.1-1756884120",
    path: `${MOCK_BACKUP_ROOT}/2.7.1-1756884120`,
    time: "2026-09-02 10:02",
    version: "2.7.1",
    kind: "双语补丁",
  },
  {
    name: "2.7.1-1756884000-2",
    path: `${MOCK_BACKUP_ROOT}/2.7.1-1756884000-2`,
    time: "2026-09-02 10:00",
    version: "2.7.1",
    kind: "原始文件",
  },
  {
    name: "2.7.2-1750000000",
    path: `${MOCK_BACKUP_ROOT}/2.7.2-1750000000`,
    time: "2026-09-01 09:00",
    version: "2.7.2",
    kind: "旧备份 / 清单无效",
    recoverable: false,
  },
];

const MOCK_BUILD_INFO: BuildInfo = {
  dylibPath:
    "/Users/example/cavalry-bilingual/dist/libCavalryTranslatorInjector.dylib",
  dylibExists: true,
  dylibSha12: "9f2c1ab7e04d",
  dylib280Path: "/Users/example/cavalry-bilingual/dist/libCavalryTranslatorInjector-280.dylib",
  dylib280Exists: true,
  dylib280Sha12: "3f7a91c2e08b",
  cavalry280AssetsPath: "/Users/example/cavalry-bilingual/assets/cavalry-28",
  cavalry280AssetsExists: true,
  configPath: MOCK_CONFIG.path,
  configExists: true,
  template: MOCK_CONFIG.template,
  lang: MOCK_CONFIG.lang,
  appVersion: "0.1.6",
  supportedLangs: ["en", "zh-Hans", "zh-Hant", "ja_JP"],
};

let mockBackups = MOCK_BACKUPS.map(backup => ({ ...backup }));

const mockMode = () => new URLSearchParams(location.search).get("mock") ?? "";
let mockDownloadCancelled = false;
let mockDownloadRunning = false;
async function mockDownload(version: string): Promise<DownloadResult> {
  if (mockDownloadRunning) throw new Error("已有下载正在进行");
  mockDownloadRunning = true; mockDownloadCancelled = false;
  localStorage.setItem("cb-mock-download-count", String(Number(localStorage.getItem("cb-mock-download-count") ?? 0) + 1));
  try {
    for (const downloaded of [0,25,60,100]) {
      await new Promise(resolve => window.setTimeout(resolve, 220));
      if (mockDownloadCancelled) return {status:"cancelled",path:null,version};
      if (mockMode() === "update-download-error" && downloaded > 0) throw new Error("下载连接中断，未完成的文件已移除，可重试");
      window.dispatchEvent(new CustomEvent("cavalry-download-progress",{detail:{phase:downloaded === 100 ? "verifying" : "downloading",downloaded,total:100}}));
    }
    return {status:"downloaded",path:`/Users/example/Downloads/Cavalry-${version}.dmg`,version};
  } finally { mockDownloadRunning = false; }
}

let mockTargetPath = mockMode() === "target-switch-unselected" ? "/Applications/Cavalry-missing.app" : "/Applications/Cavalry 2.7.app";
let mockTargetSwitches = 0;
const mockReadAttempts: Record<string, number> = {};
const mockResourceNames: Record<string, string> = {get_config:"config",list_backups:"backups",list_fonts:"fonts",get_status:"status"};
function mockInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (cmd === "save_config" && new URLSearchParams(location.search).get("mock") === "save-error") return Promise.reject("模拟写入失败：原设置未更改。");
  if (cmd === "save_config" && mockMode() === "save-error-long") return Promise.reject("模拟保存失败：设置文件暂时无法写入。" + "请保留当前草稿，检查目录访问权限后重试。".repeat(24));
  const resource = mockResourceNames[cmd];
  if (resource) {
    const attempt = mockReadAttempts[cmd] = (mockReadAttempts[cmd] ?? 0) + 1;
    if (mockMode() === `${resource}-error` || mockMode() === `${resource}-error-once` && attempt === 1 || mockMode() === `${resource}-stale` && attempt === 2 || mockMode() === "target-switch-status-error" && resource === "status" && attempt === 2) {
      return Promise.reject(`模拟${resource}读取失败，原文件未更改。`);
    }
  }
  let result: unknown;
  switch (cmd) {
    case "list_fonts":
      result = mockMode() === "font-stress" ? Array.from({length:80},(_,index)=>`Studio Sans ${String(index).padStart(2,"0")} — Extended Display Variable Font Family`) : ["Arial", "Inter", "MiSans", "PingFang SC", "Microsoft YaHei"];
      break;
    case "get_status":
      if (mockMode().startsWith("target-switch") && mockTargetPath.includes("missing")) { result={detected:false,appPath:mockTargetPath}; break; }
      if (mockMode() === "status-missing") { result = {detected:false,appPath:"/Applications/Cavalry.app"}; break; }
      if (mockMode() === "status-28" || mockMode() === "status-28-missing-runtime") { result = {...MOCK_STATUS, appPath:"/Applications/Cavalry 2.8.app", cavalryVersion:"2.8.0", state:"vendor", running:false, compatibility:{canApply:true,level:"candidate",message:"Cavalry 2.8.0 / Qt 6.9.2：匹配2.8适配目标。"}}; break; }
      if (mockMode() === "status-28-unsupported") { result = {...MOCK_STATUS, appPath:"/Applications/Cavalry 2.8.app", cavalryVersion:"2.8.0", state:"vendor", running:false, compatibility:{canApply:false,level:"blocked",message:"尚未验证此组合（Cavalry 2.8.0 / Qt 6.6.3）。"}}; break; }
      result = (mockMode().startsWith("target-switch") || mockTargetPath !== "/Applications/Cavalry 2.7.app") ? {...MOCK_STATUS, appPath:mockTargetPath, cavalryVersion:mockTargetPath.includes("2.8")?"2.8.0":"2.7.2", state:mockTargetPath.includes("2.8")?"vendor":"ours", running:false, compatibility:{canApply:!mockTargetPath.includes("2.8"),level:"fixture",message:"模拟目标适配状态"}} : new URLSearchParams(location.search).get("mock") === "status-notices" ? { ...MOCK_STATUS, running: true, pendingSettings: true } : MOCK_STATUS;
      break;
    case "list_backups":
      result = mockMode() === "empty-backups" ? [] : mockBackups;
      break;
    case "get_config":
      result = mockMode().startsWith("fonts-") ? { ...MOCK_CONFIG, zhFont:"PingFang SC", enFont:"Arial" } : MOCK_CONFIG;
      break;
    case "get_build_info":
      result = mockMode() === "status-28-missing-runtime" ? {...MOCK_BUILD_INFO, dylib280Exists:false, dylib280Path:"/missing/libCavalryTranslatorInjector-280.dylib"} : MOCK_BUILD_INFO;
      break;
    case "save_config":
      result = {
        ...MOCK_CONFIG,
        template: String(args?.template ?? MOCK_CONFIG.template),
        lang: String(args?.lang ?? MOCK_CONFIG.lang),
        zhFont: String(args?.zhFont ?? ""),
        enFont: String(args?.enFont ?? ""),
      };
      break;
    case "apply_patch":
      if (mockMode() === "apply-error") return Promise.reject("模拟应用失败：当前快照已保留，请重试。");
      if (mockMode() === "apply-busy") return new Promise<T>(resolve => window.setTimeout(() => resolve({ ok: true, app: "/Applications/Cavalry.app", stateBefore: "vendor", backupDir: `${MOCK_BACKUP_ROOT}/fixture-only` } as T), 800));
      result = {
        ok: true,
        app: "/Applications/Cavalry.app",
        stateBefore: "vendor",
        backupDir: `${MOCK_BACKUP_ROOT}/2.7.2-1757938382`,
      };
      break;
    case "list_cavalry_installs":
      result = [{ path: "/Applications/Cavalry 2.7.app", version: "2.7.2", displayName: "Cavalry 2.7.2", running: true, selected: true }, { path: "/Applications/Cavalry 2.8.app", version: "2.8.0", displayName: "Cavalry 2.8.0", running: false, selected: false }];
      result = (result as CavalryInstall[]).map(item => ({...item,running:mockMode().startsWith("target-switch") ? false : item.running,selected:item.path===mockTargetPath}));
      if (mockTargetPath && !mockTargetPath.includes("missing") && !(result as CavalryInstall[]).some(item => item.path === mockTargetPath)) {
        (result as CavalryInstall[]).push({path:mockTargetPath,version:"2.7.2",displayName:"Cavalry 2.7.2",running:false,selected:true});
      }
      break;
    case "set_target_cavalry":
      if (mockMode() === "choose-path-invalid") return Promise.reject("不是可识别的 Cavalry 安装目录");
      if (mockMode().startsWith("target-switch")) {
        const attempt = ++mockTargetSwitches;
        localStorage.setItem("cb-mock-target-switch-count", String(attempt));
        return new Promise<T>((resolve,reject) => window.setTimeout(() => {
          if (mockMode() === "target-switch-error" || mockMode() === "target-switch-error-once" && attempt === 1) reject("模拟目标设置未能写入");
          else { mockTargetPath = String(args?.path); resolve({ok:true,path:mockTargetPath} as T); }
        },1000));
      }
      mockTargetPath = String(args?.path ?? "");
      result = { ok: true, path: mockTargetPath };
      break;
    case "check_cavalry_update":
      return new Promise<T>((resolve, reject) => window.setTimeout(() => {
        if (mockMode() === "update-check-error") reject("暂时无法连接官网，请检查网络后重试");
        else resolve({version:mockMode() === "update-new" ? "2.9.0" : "2.8.0", notesUrl:"https://cavalry.studio/docs/tech-info/release-notes/2.8/2-8-0-release-notes/", sourceUrl:"https://cavalry.studio/docs/", checkedAt:Math.floor(Date.now()/1000), downloadSupported:mockMode() !== "update-unsupported"} as T);
      }, mockMode() === "update-check-slow" ? 1200 : 180));
    case "download_cavalry_update":
      return mockDownload(String(args?.version ?? "2.8.0")) as Promise<T>;
    case "cancel_cavalry_download":
      mockDownloadCancelled = true; result = null; break;
    case "reveal_cavalry_download":
      result = null; break;
    case "launch_cavalry":
      result = {ok:true,path:mockTargetPath,version:mockTargetPath.includes("2.8")?"2.8.0":"2.7.2"};
      break;
    case "prepare_error_report": {
      if (mockMode() === "report-prepare-error") return Promise.reject("无法生成报告预览，请重试");
      const logs = (args?.logs ?? []) as Array<{time:string;text:string}>;
      const redact = (text: string) => text.replace(/(?:\/Users\/|[A-Z]:\\Users\\)[^\r\n，；]+/gi,"<本机路径已隐藏>").replace(/(?:api[_-]?key|password|token)\s*[:=]\s*[^\s,;，；]+/gi,"<凭据已隐藏>").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"<邮箱已隐藏>");
      const content = {app:"Cavalry Bilingual",appVersion:"0.1.6",cavalryVersion:args?.cavalryVersion ?? null,message:redact(String(args?.message ?? "")),logs:logs.slice(0,20).map(log=>({...log,text:redact(log.text)}))};
      const service = mockMode() === "report-service";
      const previewData = mockMode() === "report-extra-field" ? {...content, additionalDiagnostic:"这是新增字段，必须在完整预览中显示"} : mockMode() === "report-extra-log-field" ? {...content, logs:[{time:"2026-10-19 15:00",text:"普通诊断",additionalLogDiagnostic:"新的记录字段同样不得遗漏"}]} : content;
      result = {id:"mock-report-approved",preview:mockMode() === "report-invalid-shape" ? "暂不支持的报告格式\n完整原文必须仍能检查" : JSON.stringify(previewData,null,2),logCount:content.logs.length,delivery:service ? "service" : "mail",serviceName:service ? "feedback.example.invalid" : "EmailJS",note:service ? null : "将通过 EmailJS 外部服务发送；未配置服务不会发送邮件。"};
      break;
    }
    case "send_error_report":
      if (mockMode() === "report-rate-limit") return Promise.reject("发信过于频繁，请 60 秒后再试");
      if (mockMode() !== "report-service" && !args?.emailJs) return Promise.reject("发送功能尚未配置，可先保存报告");
      localStorage.setItem("cb-mock-report-send-count", String(Number(localStorage.getItem("cb-mock-report-send-count") ?? 0) + 1));
      if (mockMode() === "report-error") return Promise.reject("报告暂时无法发送，请重试或保存报告");
      result = {id:String(args?.reportId),delivery:mockMode() === "report-service" ? "submitted" : "mail-sent",path:null}; break;
    case "begin_emailjs_send":
      if (mockMode() === "report-rate-limit") return Promise.reject("发信过于频繁，请 60 秒后再试");
      result = JSON.stringify({service_id:"service_mock",template_id:"template_mock",user_id:"public_mock",template_params:{to_email:"nobody@example.invalid",subject:"合成反馈",message:String(args?.reportId ?? ""),report_id:String(args?.reportId ?? "")}});
      break;
    case "complete_emailjs_send":
      localStorage.setItem("cb-mock-report-send-count", String(Number(localStorage.getItem("cb-mock-report-send-count") ?? 0) + 1));
      result = {id:String(args?.reportId),delivery:"mail-sent",path:null};
      break;
    case "abort_emailjs_send":
      localStorage.setItem("cb-mock-report-abort-count", String(Number(localStorage.getItem("cb-mock-report-abort-count") ?? 0) + 1));
      result = null;
      break;
    case "export_error_report":
      result = {id:String(args?.reportId),delivery:"exported",path:"/Users/example/.cavalry-bilingual/error-reports/approved.json"}; break;
    case "delete_backup":
      if (new URLSearchParams(location.search).get("mock") === "delete-error") return Promise.reject("模拟删除失败：备份未更改。");
      mockBackups = mockBackups.filter(backup => backup.path !== args?.backupDir);
      result = { ok: true, backupDir: String(args?.backupDir ?? "") };
      break;
    case "restore_backup":
      if (mockMode() === "restore-error") return Promise.reject("模拟还原失败：原状态已保留，可重试。");
      result = {
        ok: true,
        app: "/Applications/Cavalry.app",
        backupDir:
          typeof args?.backupDir === "string" && args.backupDir
            ? args.backupDir
            : `${MOCK_BACKUP_ROOT}/2.7.2-1757938382`,
        restored: [
          "Contents/Frameworks/libCavalryTranslatorInjector.dylib",
          "Contents/Resources/cavalry-i18n-lang.txt",
        ],
        removed: ["Contents/Resources/cavalry-bilingual.json"],
      };
      break;
    default:
      result = null;
  }
  if (resource && mockMode() === `${resource}-slow`) return new Promise<T>(resolve => window.setTimeout(() => resolve(result as T), 1200));
  return Promise.resolve(result as T);
}

async function call<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (isMock) return mockInvoke<T>(cmd, args);
  return invoke<T>(cmd, args);
}

/**
 * Status detection crosses a native process/filesystem boundary. A stuck
 * Windows process query must not leave the refresh button disabled forever;
 * the next refresh can retry while the previous native worker finishes.
 */
function callWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) window.clearTimeout(timer);
  });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const api = {
  getStatus: () =>
    callWithTimeout(
      call<StatusInfo>("get_status"),
      8_000,
      "检测 Cavalry 超时；请确认 Cavalry 已打开且工具有读取进程路径的权限，然后再次刷新。",
    ),
  applyPatch: () => call<ApplyResult>("apply_patch"),
  restoreBackup: (backupDir: string) =>
    call<RestoreResult>("restore_backup", { backupDir }),
  listBackups: () => call<BackupInfo[]>("list_backups"),
  deleteBackup: (backupDir: string) => call<{ ok: boolean; backupDir: string }>("delete_backup", { backupDir }),
  getConfig: () => call<ConfigInfo>("get_config"),
  saveConfig: (template: string, lang: string, zhFont: string, enFont: string) =>
    call<ConfigInfo>("save_config", { template, lang, zhFont, enFont }),
  listFonts: () => call<string[]>("list_fonts"),
  getBuildInfo: () => call<BuildInfo>("get_build_info"),
  listCavalryInstalls: () => call<CavalryInstall[]>("list_cavalry_installs"),
  setTargetCavalry: (path: string) => call<{ ok: boolean; path: string }>("set_target_cavalry", { path }),
  launchCavalry: () => call<{ ok: boolean; path: string; version: string | null }>("launch_cavalry"),
  chooseCavalryDirectory: async (): Promise<string | null> => {
    if (isMock) return mockMode() === "choose-path-cancel" ? null : "E:\\Cavalry";
    const selected = await openDialog({ directory: true, multiple: false, title: "选择 Cavalry 安装目录" });
    return typeof selected === "string" ? selected : null;
  },
  checkCavalryUpdate: () => callWithTimeout(call<CavalryRelease>("check_cavalry_update"), 25_000, "检查官网版本超时，请重试。"),
  downloadCavalryUpdate: (version: string) => call<DownloadResult>("download_cavalry_update", { version }),
  cancelCavalryDownload: () => call<void>("cancel_cavalry_download"),
  revealCavalryDownload: (path: string) => call<void>("reveal_cavalry_download", { path }),
  onDownloadProgress: async (callback: (progress: DownloadProgress) => void): Promise<() => void> => {
    if (!isMock) return listen<DownloadProgress>("cavalry-download-progress", event => callback(event.payload));
    const handler = (event: Event) => callback((event as CustomEvent<DownloadProgress>).detail);
    window.addEventListener("cavalry-download-progress", handler);
    return () => window.removeEventListener("cavalry-download-progress", handler);
  },
  prepareErrorReport: (message: string, logs: Array<{time:string;text:string}>, cavalryVersion: string | null) => call<ReportPreview>("prepare_error_report", { message, logs, cavalryVersion }),
  sendErrorReport: (reportId: string, emailJs?: EmailJsSession) => call<ReportReceipt>("send_error_report", { reportId, emailJs }),
  beginEmailJsSend: (reportId: string, emailJs: EmailJsSession) => call<string>("begin_emailjs_send", { reportId, emailJs }),
  completeEmailJsSend: (reportId: string) => call<ReportReceipt>("complete_emailjs_send", { reportId }),
  abortEmailJsSend: (reportId: string) => call<void>("abort_emailjs_send", { reportId }),
  exportErrorReport: (reportId: string) => call<ReportReceipt>("export_error_report", { reportId }),
};

export function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}
