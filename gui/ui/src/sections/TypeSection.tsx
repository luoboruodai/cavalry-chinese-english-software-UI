import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { api, errorText, type ConfigInfo } from "../api";
import { SectionHeader } from "../SectionHeader";
import { FontPicker } from "../components/FontPicker";
import { Icon } from "../components/Icon";
import { ResourceState } from "../components/ResourceState";
import type { Notice } from "../components/ToastNotice";

interface Props {
  config: ConfigInfo | null;
  active: boolean;
  loading: boolean;
  loadError: string | null;
  onRetry: () => Promise<void>;
  onFontReadError: (message: string) => void;
  onSave: (template: string, lang: string, zhFont: string, enFont: string) => Promise<string | null>;
  onNotify: (kind: Notice["kind"], body: string, title?: string) => void;
}
const DEFAULT = "{zh}（{en}）";
const MODES = [DEFAULT, "{en}（{zh}）", "custom"];
const MODE_LABELS = ["中文（English）", "English（中文）", "自定义"];
function validate(template: string) {
  if (template.split("{zh}").length !== 2 || template.split("{en}").length !== 2) return "请各保留一次 {zh} 和 {en}，确保中英都可见。";
  if (template.length > 80 || /[{}<>%&\x00-\x1f]/.test(template.replace("{zh}", "").replace("{en}", ""))) return "请使用普通文字或分隔符，不要添加换行、HTML 或其他占位符。";
  return null;
}
function Label({ template, zh, en, zhFont, enFont }: { template: string; zh: string; en: string; zhFont: string; enFont: string }) {
  return <>{template.split(/(\{zh\}|\{en\})/g).map((part, i) => (
    <span key={i} style={{fontFamily: part === "{zh}" && zhFont ? `"${zhFont.replace(/["\\]/g, "")}"` : part === "{en}" && enFont ? `"${enFont.replace(/["\\]/g, "")}"` : undefined}}>
      {part === "{zh}" ? zh : part === "{en}" ? en : part}
    </span>
  ))}</>;
}
export function TypeSection({ config, active, loading, loadError, onRetry, onFontReadError, onSave, onNotify }: Props) {
  const footer = useRef<HTMLDivElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const retryFocus = useRef<"settings" | "fonts" | null>(null);
  const [draft, setDraft] = useState<ConfigInfo | null>(null);
  const [custom, setCustom] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fonts, setFonts] = useState<string[]>([]);
  const [fontError, setFontError] = useState<string | null>(null);
  const [fontsLoading, setFontsLoading] = useState(true);
  const fontsRequest = useRef<Promise<void> | null>(null);
  const loadFonts = useCallback((): Promise<void> => {
    if (fontsRequest.current) return fontsRequest.current;
    setFontsLoading(true);
    const request = api.listFonts().then(value => { setFonts(value); setFontError(null); })
      .catch(reason => { const message = errorText(reason); setFontError(message); onFontReadError(message); })
      .finally(() => { fontsRequest.current = null; setFontsLoading(false); });
    fontsRequest.current = request;
    return request;
  }, [onFontReadError]);
  useEffect(() => { void loadFonts(); }, [loadFonts]);
  const current = draft ?? config;
  useLayoutEffect(() => {
    const bar = footer.current;
    const scroller = bar?.closest<HTMLElement>(".content");
    if (!active || !bar || !scroller) return;
    // Let native focus scrolling reserve the *actual* sticky bar height, including errors.
    const reserve = () => scroller.style.setProperty("--settings-bar-space", `${Math.ceil(bar.getBoundingClientRect().height) + 24}px`);
    reserve();
    const observer = new ResizeObserver(reserve);
    observer.observe(bar);
    return () => { observer.disconnect(); scroller.style.removeProperty("--settings-bar-space"); };
  }, [active, !!current]);
  useLayoutEffect(() => {
    if (!active || !current || busy) return;
    if (retryFocus.current === "settings" && !loading && !loadError) {
      workspace.current?.querySelector<HTMLElement>('.segment[aria-checked="true"]')?.focus();
      retryFocus.current = null;
    } else if (retryFocus.current === "fonts" && !fontsLoading && !fontError) {
      document.getElementById("zh-font")?.focus();
      retryFocus.current = null;
    }
  }, [active, !!current, busy, loading, loadError, fontsLoading, fontError]);
  const retrySettings = () => { retryFocus.current = "settings"; return onRetry(); };
  const retryFonts = () => { retryFocus.current = "fonts"; return loadFonts(); };
  if (!current) return <>
    <SectionHeader title="排版与字体" desc="先读取已保存的设置，不会用默认值覆盖原文件。"/>
    <div className="collection-panel"><ResourceState title={loading ? "正在读取已保存的设置…" : "设置读取失败"} description={loading ? "稍候即可预览排版和字体。" : "原设置未更改。请重新读取；仍有问题时可在日志查看原因。"} loading={loading} onRetry={loadError ? retrySettings : undefined} retryLabel="重新读取设置"/></div>
  </>;
  const dirty = !!draft && (draft.template !== config?.template || draft.zhFont !== config?.zhFont || draft.enFont !== config?.enFont);
  const mode = custom || !MODES.slice(0, 2).includes(current.template) ? 2 : MODES.indexOf(current.template);
  const invalid = validate(current.template);
  const update = (patch: Partial<ConfigInfo>) => { setDraft({ ...current, ...patch }); setError(null); };
  const selectMode = (index: number, keyboard = false) => {
    setKeyboardMode(keyboard);
    setCustom(index === 2);
    if (index !== 2) update({ template: MODES[index] });
  };
  const arrows = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const index = event.key === "ArrowRight" || event.key === "ArrowDown" ? (i + 1) % 3 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (i + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
    if (index >= 0) { event.preventDefault(); selectMode(index, true); document.getElementById(`template-mode-${index}`)?.focus(); }
  };
  const save = async () => {
    if (invalid || busy || !dirty) return;
    setBusy(true); setError(null);
    try {
      const result = await onSave(current.template, current.lang, current.zhFont, current.enFont);
      if (result) setError(result); else setDraft(null);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  };
  const restoreDefaults = () => {
    const next = { ...current, template: DEFAULT, zhFont: "", enFont: "" };
    const changed = current.template !== next.template || current.zhFont !== next.zhFont || current.enFont !== next.enFont;
    const willDirty = next.template !== config?.template || next.zhFont !== config?.zhFont || next.enFont !== config?.enFont;
    setCustom(false);
    if (!changed) { setError(null); return; }
    setDraft(willDirty ? next : null); setError(null);
    onNotify("info", willDirty ? "默认排版与字体已恢复为草稿，保存后生效。" : "已恢复为已保存的默认排版与字体。", "已恢复默认草稿");
  };
  const cancelChanges = () => {
    if (!dirty) return;
    setDraft(null); setCustom(false); setError(null);
    onNotify("info", "未保存的更改已撤销。", "已取消更改");
  };
  const label = (zh: string, en: string) => <Label template={invalid ? DEFAULT : current.template} zh={zh} en={en} zhFont={current.zhFont} enFont={current.enFont} />;
  return <>
    <SectionHeader title="排版与字体" desc="先预览，再保存。应用到 Cavalry 后，重新打开软件生效。" />
    {loadError && <ResourceState compact title={loading ? "正在重新读取设置…" : "设置读取失败"} description="已保留当前设置和草稿，可稍后重试。" loading={loading} onRetry={retrySettings} retryLabel="重新读取设置"/>}
    <div className="type-workspace" ref={workspace}>
    <fieldset className="settings-fields" disabled={busy}>
      <div className="settings-group">
        <div className="group-heading"><h2>双语顺序</h2><span>中英文始终保留</span></div>
        <div className="segmented" data-keyboard={keyboardMode} role="radiogroup" aria-label="双语顺序" style={{ "--segments": 3 } as CSSProperties}>
          <span className="segment-thumb" style={{ transform: `translateX(${mode * 100}%)` }} aria-hidden />
          {MODE_LABELS.map((text, i) => <button key={text} id={`template-mode-${i}`} type="button" role="radio" aria-checked={mode === i} tabIndex={mode === i ? 0 : -1} className={`segment ${mode === i ? "selected" : ""}`} onClick={event => selectMode(i, event.detail === 0)} onKeyDown={e => arrows(e, i)}>{text}</button>)}
        </div>
        {mode === 2 && <div className="field"><label htmlFor="template">显示模板</label><input id="template" className="template-input" value={current.template} onChange={e => update({ template: e.target.value })} aria-invalid={!!invalid} aria-describedby="template-help" maxLength={80} /><p id="template-help" className={invalid ? "field-error" : "field-help"}>{invalid ?? "{zh} 是中文，{en} 是英文。例如：{zh} / {en}"}</p></div>}
      </div>
      <div className="card font-card">
        <div className="group-heading"><h2>Cavalry 界面字体</h2><span role="status" data-failed={!!fontError && !fontsLoading}>{fontsLoading ? "正在读取本机字体…" : fontError ? "字体列表未载入" : "使用本机已安装字体"}</span></div>
        <div className="font-grid">
          <FontPicker id="zh-font" label="中文字体" value={current.zhFont} fonts={fonts} disabled={fontsLoading || !!fontError} placeholder="系统默认（中文回退）" onChange={zhFont => update({ zhFont })} />
          <FontPicker id="en-font" label="英文字体" value={current.enFont} fonts={fonts} disabled={fontsLoading || !!fontError} onChange={enFont => update({ enFont })} />
        </div>
        <p className="field-help">留空跟随系统；英文优先、中文回退，仅影响 Cavalry 界面。</p>
        {fontError && <ResourceState compact title={fontsLoading ? "正在重新读取字体…" : "字体列表读取失败"} description="当前选择已保留，重新读取后可选择本机字体。" loading={fontsLoading} onRetry={retryFonts} retryLabel="重新读取字体"/>}
      </div>
    </fieldset>
    <section className="card preview-card" aria-label="双语界面预览">
      <div className="preview-heading"><h2>界面预览</h2><span className="preview-badge">排版示意 · 非宿主截图</span></div>
      <div className="preview-window">
        <div className="preview-menubar"><span>{label("文件", "File")}</span><span>{label("编辑", "Edit")}</span><span>{label("视图", "View")}</span></div>
        <div className="preview-body">
          <div className="preview-panel-title">{label("属性编辑器", "Attribute Editor")}</div>
          <div className="preview-property"><span>{label("不透明度", "Opacity")}</span><span className="preview-value">100 %</span></div>
          <div className="preview-property"><span>{label("显示网格", "Show Grid")}</span><span className="preview-check" aria-label="开启">✓</span></div>
          <div className="preview-layer"><i aria-hidden /><span>{label("累加器", "Accumulator")}</span></div>
        </div>
      </div>
      <p className="field-help">这里只预览文字与层级。时间线、节点图等自绘区域及实际控件宽度，需要 Cavalry 实机验证。</p>
    </section>
    </div>
    <div className="settings-footer" ref={footer}>
      {error && <div className="settings-save-error" id="settings-save-error" role="alert"><Icon name="info" /><p tabIndex={0} aria-label="保存失败原因">{error}</p></div>}
      {(busy || dirty || error) && <p className="settings-status" data-dirty={dirty} role="status">{busy ? "正在保存…" : error ? "保存未完成，更改仍保留" : "有未保存的更改"}</p>}
      <div className="settings-actions">
        <button type="button" className="inline-link" disabled={busy} onClick={restoreDefaults}>恢复默认</button>
        <button type="button" className="secondary-button" disabled={busy || !dirty} onClick={cancelChanges}>取消更改</button>
        <button type="button" className="cta-coral" aria-describedby={error ? "settings-save-error" : undefined} disabled={busy || !dirty || !!invalid} onClick={() => void save()}>保存设置</button>
      </div>
    </div>
  </>;
}
