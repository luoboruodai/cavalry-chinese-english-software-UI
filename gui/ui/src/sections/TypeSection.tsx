import { useState, type CSSProperties } from "react";
import type { ConfigInfo } from "../api";
import { SectionHeader } from "../SectionHeader";

interface Props {
  config: ConfigInfo | null;
  onSave: (
    template: string,
    lang: string,
    fontsEnabled: boolean,
  ) => Promise<string | null>;
}

const OPT_ZH_FIRST = "{zh}（{en}）";
const OPT_EN_FIRST = "{en}（{zh}）";

const SAMPLES: Array<[string, string]> = [
  ["文件", "File"],
  ["编辑", "Edit"],
  ["撤销 %1", "Undo %1"],
  ["累加器", "Accumulator"],
  ["显示网格", "Show Grid"],
  ["欢迎使用 Cavalry", "Welcome to Cavalry"],
];

function renderSample(template: string, zh: string, en: string): string {
  return template.replaceAll("{zh}", zh).replaceAll("{en}", en);
}

type Mode = "zh" | "en" | "custom";

const MODE_INDEX: Record<Mode, number> = { zh: 0, en: 1, custom: 2 };

export function TypeSection({ config, onSave }: Props) {
  // draft 非空表示本地正在编辑自定义模板(尚未保存)
  const [draft, setDraft] = useState<string | null>(null);

  const savedTemplate = config?.template ?? OPT_ZH_FIRST;
  const lang = config?.lang ?? "zh-Hans";
  const fontsEnabled = config?.fontsEnabled ?? false;
  const zhFont = config?.zhFont ?? "MiSans";
  const enFont = config?.enFont ?? "Inter";

  const mode: Mode =
    draft !== null
      ? "custom"
      : savedTemplate === OPT_ZH_FIRST
        ? "zh"
        : savedTemplate === OPT_EN_FIRST
          ? "en"
          : "custom";

  const effectiveTemplate = draft ?? savedTemplate;

  const save = async (
    template: string,
    fonts: boolean = fontsEnabled,
  ): Promise<void> => {
    await onSave(template, lang, fonts);
  };

  const selectMode = (next: Mode, template?: string) => {
    if (next === "custom") {
      if (draft === null) setDraft(savedTemplate);
    } else {
      setDraft(null);
      if (template && template !== savedTemplate) void save(template);
    }
  };

  const commitDraft = () => {
    const trimmed = effectiveTemplate.trim();
    if (trimmed && trimmed !== savedTemplate) {
      void save(trimmed);
    }
    setDraft(null);
  };

  return (
    <>
      <SectionHeader
        title="排版"
        desc="双语标签模板与实验字体选项。"
      />

      <div
        className="segmented"
        role="tablist"
        aria-label="双语模板"
        style={{ "--segments": 3 } as CSSProperties}
      >
        <span
          className="segment-thumb"
          style={{ transform: `translateX(${MODE_INDEX[mode] * 100}%)` }}
          aria-hidden
        />
        <button
          type="button"
          role="tab"
          aria-selected={mode === "zh"}
          className={`segment ${mode === "zh" ? "selected" : ""}`}
          onClick={() => selectMode("zh", OPT_ZH_FIRST)}
        >
          中文（English）
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "en"}
          className={`segment ${mode === "en" ? "selected" : ""}`}
          onClick={() => selectMode("en", OPT_EN_FIRST)}
        >
          English（中文）
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "custom"}
          className={`segment ${mode === "custom" ? "selected" : ""}`}
          onClick={() => selectMode("custom")}
        >
          自定义
        </button>
      </div>

      {mode === "custom" && (
        <input
          className="template-input"
          value={effectiveTemplate}
          placeholder="{zh}（{en}）"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitDraft();
          }}
          autoFocus
        />
      )}

      <div className="card preview-card">
        <div className="preview-title">预览</div>
        <div className="preview-lines">
          {SAMPLES.map(([zh, en]) => (
            <div className="preview-line" key={en}>
              {renderSample(effectiveTemplate || savedTemplate, zh, en)}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="toggle-row">
          <span className="toggle-note">
            <span className="toggle-title">
              字体差异化（{zhFont} / {enFont}）
            </span>
            {" — "}实验功能，v0.3 注入器生效
            {fontsEnabled && (
              <span className="toggle-warning">（当前未生效）</span>
            )}
          </span>
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={fontsEnabled}
            aria-label="字体差异化开关"
            onClick={() => void save(savedTemplate, !fontsEnabled)}
          />
        </div>
      </div>
    </>
  );
}
