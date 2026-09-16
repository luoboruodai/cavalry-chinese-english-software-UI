// 内部状态/语言代码 → 界面文案映射,避免原始值直出。

export const STATE_LABELS: Record<string, string> = {
  ours: "双语已应用",
  daftai: "社区中文运行时（daftai）",
  vendor: "原版英文",
};

export const LANG_LABELS: Record<string, string> = {
  "zh-Hans": "简体中文",
  "zh-Hant": "繁体中文",
  ja_JP: "日语",
  en: "英文",
};

export function stateLabel(state: string | null | undefined): string {
  if (!state) return "—";
  return STATE_LABELS[state] ?? state;
}

export function langLabel(lang: string | null | undefined): string {
  if (!lang) return "—";
  return LANG_LABELS[lang] ?? lang;
}
