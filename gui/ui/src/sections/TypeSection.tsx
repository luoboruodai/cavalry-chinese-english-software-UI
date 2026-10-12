import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { api, errorText, type ConfigInfo } from "../api";
import { SectionHeader } from "../SectionHeader";

interface Props {
  config: ConfigInfo | null;
  onSave: (template: string, lang: string, zhFont: string, enFont: string) => Promise<string | null>;
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
export function TypeSection({ config, onSave }: Props) {
  const [draft, setDraft] = useState<ConfigInfo | null>(null);
  const [custom, setCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fonts, setFonts] = useState<string[]>([]);
  const [fontError, setFontError] = useState<string | null>(null);
  useEffect(() => { api.listFonts().then(setFonts).catch(e => setFontError(errorText(e))); }, []);
  const current = draft ?? config;
  if (!current) return <><SectionHeader title="排版与字体" desc="加载已保存的设置…" /><p className="notice" role="status">如果加载失败，请查看日志；不会用默认值覆盖原文件。</p></>;
  const dirty = !!draft && (draft.template !== config?.template || draft.zhFont !== config?.zhFont || draft.enFont !== config?.enFont);
  const mode = custom || !MODES.slice(0, 2).includes(current.template) ? 2 : MODES.indexOf(current.template);
  const invalid = validate(current.template);
  const update = (patch: Partial<ConfigInfo>) => { setDraft({ ...current, ...patch }); setError(null); };
  const selectMode = (index: number) => {
    setCustom(index === 2);
    if (index !== 2) update({ template: MODES[index] });
  };
  const arrows = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const index = event.key === "ArrowRight" || event.key === "ArrowDown" ? (i + 1) % 3 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (i + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1;
    if (index >= 0) { event.preventDefault(); selectMode(index); document.getElementById(`template-mode-${index}`)?.focus(); }
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
  const label = (zh: string, en: string) => <Label template={invalid ? DEFAULT : current.template} zh={zh} en={en} zhFont={current.zhFont} enFont={current.enFont} />;
  return <>
    <SectionHeader title="排版与字体" desc="先预览，再保存。应用到 Cavalry 后，重新打开软件生效。" />
    <fieldset className="settings-fields" disabled={busy}>
      <div className="settings-group">
        <div className="group-heading"><h2>双语顺序</h2><span>中英文始终保留</span></div>
        <div className="segmented" role="radiogroup" aria-label="双语顺序" style={{ "--segments": 3 } as CSSProperties}>
          <span className="segment-thumb" style={{ transform: `translateX(${mode * 100}%)` }} aria-hidden />
          {MODE_LABELS.map((text, i) => <button key={text} id={`template-mode-${i}`} type="button" role="radio" aria-checked={mode === i} tabIndex={mode === i ? 0 : -1} className={`segment ${mode === i ? "selected" : ""}`} onClick={() => selectMode(i)} onKeyDown={e => arrows(e, i)}>{text}</button>)}
        </div>
        {mode === 2 && <div className="field"><label htmlFor="template">显示模板</label><input id="template" className="template-input" value={current.template} onChange={e => update({ template: e.target.value })} aria-invalid={!!invalid} aria-describedby="template-help" maxLength={80} /><p id="template-help" className={invalid ? "field-error" : "field-help"}>{invalid ?? "{zh} 是中文，{en} 是英文。例如：{zh} / {en}"}</p></div>}
      </div>
      <div className="card font-card">
        <div className="group-heading"><h2>Cavalry 界面字体</h2><span>使用本机已安装字体</span></div>
        <div className="font-grid">
          <div className="field"><label htmlFor="zh-font">中文字体</label><input id="zh-font" list="installed-fonts" placeholder="系统默认（中文回退）" value={current.zhFont} onChange={e => update({ zhFont: e.target.value })} autoComplete="off" /></div>
          <div className="field"><label htmlFor="en-font">英文字体</label><input id="en-font" list="installed-fonts" placeholder="系统默认" value={current.enFont} onChange={e => update({ enFont: e.target.value })} autoComplete="off" /></div>
        </div>
        <datalist id="installed-fonts">{fonts.map(font => <option value={font} key={font} />)}</datalist>
        <p className="field-help">留空跟随系统。英文字体优先，中文字体作为字形回退；若英文字体本身含汉字，未必按语言严格分用。不会更改工程中的文本图层字体。</p>
        {fontError && <p className="field-error" role="alert">字体列表读取失败：{fontError}</p>}
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
    <div className="settings-footer">
      <p role="status">{busy ? "正在保存…" : dirty ? "有未保存的更改" : "设置已保存；应用补丁后生效"}</p>
      <div className="settings-actions">
        <button type="button" className="inline-link" disabled={busy} onClick={() => { setCustom(false); update({ template: DEFAULT, zhFont: "", enFont: "" }); }}>恢复默认</button>
        <button type="button" className="secondary-button" disabled={busy || !dirty} onClick={() => { setDraft(null); setCustom(false); setError(null); }}>取消更改</button>
        <button type="button" className="cta-coral" disabled={busy || !dirty || !!invalid} onClick={() => void save()}>保存设置</button>
      </div>
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </>;
}
