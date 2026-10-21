import { useMemo } from "react";
import { Icon } from "./Icon";

interface ApprovedContent {
  app: string;
  appVersion: string;
  cavalryVersion: string | null;
  message: string;
  logs: Array<{ time: string; text: string }>;
}
const fields = ["app", "appVersion", "cavalryVersion", "message", "logs"];
function knownContent(raw: string): ApprovedContent | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const content = value as Record<string, unknown>;
    // Do not turn a changed report into a partial review that hides newly added data.
    if (Object.keys(content).length !== fields.length || fields.some(key => !(key in content))) return null;
    if (!["app", "appVersion", "message"].every(key => typeof content[key] === "string")) return null;
    if (content.cavalryVersion !== null && typeof content.cavalryVersion !== "string") return null;
    if (!Array.isArray(content.logs) || !content.logs.every(log => log && typeof log === "object" && !Array.isArray(log) && Object.keys(log).length === 2 && typeof log.time === "string" && typeof log.text === "string")) return null;
    return content as unknown as ApprovedContent;
  } catch { return null; }
}

/** Reads the native approved draft; never rebuilds the payload sent by report ID. */
export function ReportReview({ raw }: { raw: string }) {
  const content = useMemo(() => knownContent(raw), [raw]);
  if (!content) return <div className="review-fallback">
    <p className="report-note">报告格式有变化，请检查以下完整内容后再决定是否发送。</p>
    <pre className="report-preview" tabIndex={0} aria-label="即将提交的报告内容">{raw}</pre>
  </div>;
  return <>
    <div className="report-review" role="region" tabIndex={0} aria-label="报告内容预览">
      <section className="review-group" aria-label="问题说明">
        <h3>问题说明</h3>
        {content.message ? <p className="review-message">{content.message}</p> : <p className="review-empty">未填写问题描述。</p>}
      </section>
      <section className="review-group" aria-label="版本信息">
        <h3>版本信息</h3>
        <dl className="review-environment">
          <div><dt>工具</dt><dd>{content.app || "未提供"}</dd></div>
          <div><dt>工具版本</dt><dd>{content.appVersion || "未提供"}</dd></div>
          <div><dt>Cavalry 版本</dt><dd>{content.cavalryVersion ?? "未检测到版本信息"}</dd></div>
        </dl>
      </section>
      <section className="review-group" aria-label="附带操作记录">
        <h3>附带操作记录 <span>{content.logs.length} 条</span></h3>
        {content.logs.length ? <ol className="review-logs">{content.logs.map((entry, index) => <li key={`${index}-${entry.time}`}><time>{entry.time || "时间未提供"}</time><p>{entry.text || "空记录"}</p></li>)}</ol> : <p className="review-empty">不附带操作记录。</p>}
      </section>
    </div>
    <details className="review-raw"><summary><span>查看原始数据</span><Icon name="chevron"/></summary><pre className="report-preview" tabIndex={0} aria-label="即将提交的报告内容">{raw}</pre></details>
  </>;
}
