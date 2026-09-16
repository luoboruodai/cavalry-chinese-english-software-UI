import { invoke } from "@tauri-apps/api/core";

/**
 * Tauri 调用封装:在 Tauri 环境走 invoke;在普通浏览器(无头截图、开发预览)
 * 返回内置 fixture,让界面完整渲染。isMock 供 App 侧做 mock 专属逻辑(种子日志)。
 */
const inTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const isMock = !inTauri;

export type View = "status" | "type" | "backup" | "log";

export interface SigningInfo {
  identifier: string | null;
  flags: string | null;
  signature: string | null;
}

export interface StatusInfo {
  detected: boolean;
  cavalryVersion?: string | null;
  executable?: string | null;
  state?: "vendor" | "daftai" | "ours" | null;
  lang?: string | null;
  signing?: SigningInfo;
  latestBackup?: string | null;
}

export interface ConfigInfo {
  path: string;
  template: string;
  lang: string;
  fontsEnabled: boolean;
  zhFont: string;
  enFont: string;
}

export interface BackupInfo {
  name: string;
  path: string;
  time: string;
  version: string;
  kind: string;
}

export interface BuildInfo {
  dylibPath: string;
  dylibExists: boolean;
  dylibSha12: string | null;
  configPath: string;
  configExists: boolean;
  template: string | null;
  lang: string | null;
  fontsEnabled: boolean | null;
  appVersion: string;
  supportedLangs: string[];
}

export interface ApplyResult {
  ok: boolean;
  app: string;
  stateBefore: string;
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
};

const MOCK_CONFIG: ConfigInfo = {
  path: "/Users/example/cavalry-bilingual/composer/bilingual.config.json",
  template: "{zh}（{en}）",
  lang: "zh-Hans",
  fontsEnabled: false,
  zhFont: "MiSans",
  enFont: "Inter",
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
];

const MOCK_BUILD_INFO: BuildInfo = {
  dylibPath:
    "/Users/example/cavalry-bilingual/dist/libCavalryTranslatorInjector.dylib",
  dylibExists: true,
  dylibSha12: "9f2c1ab7e04d",
  configPath: MOCK_CONFIG.path,
  configExists: true,
  template: MOCK_CONFIG.template,
  lang: MOCK_CONFIG.lang,
  fontsEnabled: false,
  appVersion: "0.2.0",
  supportedLangs: ["en", "zh-Hans", "zh-Hant", "ja_JP"],
};

function mockInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  let result: unknown;
  switch (cmd) {
    case "get_status":
      result = MOCK_STATUS;
      break;
    case "list_backups":
      result = MOCK_BACKUPS;
      break;
    case "get_config":
      result = MOCK_CONFIG;
      break;
    case "get_build_info":
      result = MOCK_BUILD_INFO;
      break;
    case "save_config":
      result = {
        ...MOCK_CONFIG,
        template: String(args?.template ?? MOCK_CONFIG.template),
        lang: String(args?.lang ?? MOCK_CONFIG.lang),
        fontsEnabled: Boolean(args?.fontsEnabled ?? false),
      };
      break;
    case "apply_patch":
      result = {
        ok: true,
        app: "/Applications/Cavalry.app",
        stateBefore: "vendor",
        backupDir: `${MOCK_BACKUP_ROOT}/2.7.2-1757938382`,
      };
      break;
    case "restore_backup":
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
  return Promise.resolve(result as T);
}

async function call<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (isMock) return mockInvoke<T>(cmd, args);
  return invoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const api = {
  getStatus: () => call<StatusInfo>("get_status"),
  applyPatch: () => call<ApplyResult>("apply_patch"),
  restoreBackup: (backupDir: string) =>
    call<RestoreResult>("restore_backup", { backupDir }),
  listBackups: () => call<BackupInfo[]>("list_backups"),
  getConfig: () => call<ConfigInfo>("get_config"),
  saveConfig: (template: string, lang: string, fontsEnabled: boolean) =>
    call<ConfigInfo>("save_config", { template, lang, fontsEnabled }),
  getBuildInfo: () => call<BuildInfo>("get_build_info"),
};

export function errorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return String(error);
}
