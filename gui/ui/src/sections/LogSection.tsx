import { useState, type CSSProperties } from "react";
import type { LogEntry } from "../App";
import type { ReportReceipt } from "../api";
import { SectionHeader } from "../SectionHeader";
import { EmptyState } from "../EmptyState";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ReportDialog } from "../components/ReportDialog";
import { Icon } from "../components/Icon";
import { logPresentation } from "../logPresentation";
interface Props { logs:LogEntry[]; cavalryVersion:string|null; onReportComplete:(receipt:ReportReceipt)=>void; onClearLogs:()=>Promise<string|null> }
export function LogSection({logs,cavalryVersion,onReportComplete,onClearLogs}:Props) {
  const [pending,setPending]=useState<"clear"|"report"|null>(null);
  return <>
    <SectionHeader title="日志" desc="查看最近的操作，遇到问题时发送反馈。" action={<button type="button" className="secondary-button report-button" onClick={()=>setPending("report")}><Icon name="feedback"/>反馈问题</button>}/>
    <div className="collection-toolbar log-toolbar">
      <div className="log-collection-label"><span className="collection-count log-count" aria-label={`操作记录 ${logs.length} 条，仅保存在本机`}><Icon name="info" />操作记录 <b>{logs.length}</b></span></div>
      <button type="button" className="secondary-button danger-quiet" disabled={logs.length===0} onClick={()=>setPending("clear")}><Icon name="trash"/>清除全部日志</button>
    </div>
    <section className="collection-panel log-card" data-empty={logs.length===0} aria-label="操作日志">
      {logs.length===0?<EmptyState text="尚无操作记录" description="之后的应用、还原和设置变更会显示在这里。"/>:<ol className="log-rows">{logs.map((entry,index)=>{
        const {level,summary}=logPresentation(entry.text);
        const state=level==="error"?"未完成":level==="success"?"已完成":"记录";
        return <li className={`log-row log-${level}`} key={`${entry.time}-${index}`} style={{ "--row-delay": `${Math.min(index, 8) * 45.5}ms` } as CSSProperties}>
          <span className="log-indicator" aria-label={level==="error"?"失败":level==="success"?"已完成":"信息"}><Icon name={level==="success"?"check":"info"}/></span>
          <details className="log-detail"><summary>
            <span className="log-summary"><span className="m">{summary}</span><span className="log-meta"><time className="t">{entry.time}</time><span className="log-state">{state}</span></span></span>
            <span className="detail-affordance"><span className="detail-closed">详情</span><span className="detail-open">收起</span><Icon name="chevron"/></span>
          </summary><div className="log-raw-head"><span>原始记录</span><span>完整内容 · 可选择复制</span></div><pre tabIndex={0} aria-label="操作原文">{entry.text}</pre></details>
        </li>;
      })}</ol>}
    </section>
    <p className="collection-footnote">{logs.length ? "展开条目可查看完整原文；清除记录不会删除备份。" : "记录仅保存在本机，不读取 Cavalry 的原始日志。"}</p>
    {pending==="clear"&&<ConfirmDialog title="清除操作记录？" confirmLabel="确认清除" danger onCancel={()=>setPending(null)} onConfirm={onClearLogs}><p>将清除本工具的 {logs.length} 条记录，此操作无法撤销。备份和 Cavalry 原始日志不受影响。</p></ConfirmDialog>}
    {pending==="report"&&<ReportDialog logs={logs} cavalryVersion={cavalryVersion} onClose={()=>setPending(null)} onComplete={onReportComplete}/>}
  </>;
}
