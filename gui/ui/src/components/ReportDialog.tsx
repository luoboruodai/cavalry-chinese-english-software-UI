import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, errorText, type ReportPreview, type ReportReceipt } from "../api";
import type { LogEntry } from "../App";
import { Modal } from "./Modal";
import { Icon } from "./Icon";
import { ToastNotice } from "./ToastNotice";
import { ReportReview } from "./ReportReview";
import { emailJsConfig, sendEmailJsBrowser } from "../emailJs";
interface Props { logs: LogEntry[]; cavalryVersion: string|null; onClose:()=>void; onComplete:(receipt:ReportReceipt)=>void }
function ReportDeliveryInfo({preview}:{preview:ReportPreview}) {
  const [open,setOpen]=useState(true);
  const [offset,setOffset]=useState({top:76,right:16});
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(!open)return;
    const update=()=>{
      const rect=root.current?.closest("dialog")?.getBoundingClientRect();
      if(rect)setOffset({top:76-rect.top,right:16-rect.left});
    };
    const dialog=root.current?.closest("dialog");
    update();
    const frame=window.requestAnimationFrame(update);
    dialog?.addEventListener("transitionstart",update);
    dialog?.addEventListener("transitionend",update);
    dialog?.addEventListener("transitioncancel",update);
    window.addEventListener("resize",update);
    return()=>{
      window.cancelAnimationFrame(frame);
      dialog?.removeEventListener("transitionstart",update);
      dialog?.removeEventListener("transitionend",update);
      dialog?.removeEventListener("transitioncancel",update);
      window.removeEventListener("resize",update);
    };
  },[open]);
  useEffect(()=>setOpen(true),[preview.id]);
  useEffect(()=>{
    if(!open)return;
    const pointer=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const focusHeading=()=>root.current?.closest("dialog")?.querySelector<HTMLElement>("h2")?.focus({preventScroll:true});
    const keyboard=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();setOpen(false);focusHeading();}};
    const dialog=root.current?.closest("dialog");
    const cancel=(event:Event)=>{event.preventDefault();event.stopPropagation();setOpen(false);focusHeading();};
    dialog?.addEventListener("cancel",cancel,true);
    document.addEventListener("pointerdown",pointer);
    document.addEventListener("keydown",keyboard);
    return()=>{dialog?.removeEventListener("cancel",cancel,true);document.removeEventListener("pointerdown",pointer);document.removeEventListener("keydown",keyboard);};
  },[open]);
  return <div className="report-delivery-info" ref={root}>
    {open&&<div id="report-delivery-popover" className="report-delivery-popover" role="group" aria-label="发送方式" style={offset}>
      <ToastNotice notice={{id:0,kind:"info",title:"发送说明",body:preview.delivery==="export"?"当前不会发送邮件，可先保存报告。":"报告只会在你确认后发送；若暂时无法发送，可先保存报告。",delayMs:0}} onDismiss={()=>{const restore=!!root.current?.contains(document.activeElement);setOpen(false);if(restore)root.current?.closest("dialog")?.querySelector<HTMLElement>("h2")?.focus({preventScroll:true});}}/>
    </div>}
  </div>;
}
export function ReportDialog({logs,cavalryVersion,onClose,onComplete}:Props) {
  const [message,setMessage]=useState("");
  const [includeLogs,setIncludeLogs]=useState(true);
  const [preview,setPreview]=useState<ReportPreview|null>(null);
  const [receipt,setReceipt]=useState<ReportReceipt|null>(null);
  const [busy,setBusy]=useState<"preview"|"send"|"export"|null>(null);
  const [error,setError]=useState<string|null>(null);
  const prepare=async()=>{if(busy)return;setBusy("preview");setError(null);try{setPreview(await api.prepareErrorReport(message,includeLogs?logs:[],cavalryVersion));}catch(reason){setError(errorText(reason));}finally{setBusy(null);}};
  const deliver=async(kind:"send"|"export")=>{
    if(!preview||busy)return;setBusy(kind);setError(null);
    try{
      if(kind==="send"){
        const result=await (async()=>{
          if(preview.delivery==="mail"){
            const body=await api.beginEmailJsSend(preview.id,emailJsConfig());
            try{await sendEmailJsBrowser(body);}catch(reason){await api.abortEmailJsSend(preview.id).catch(()=>{});throw reason;}
            return api.completeEmailJsSend(preview.id);
          }
          return api.sendErrorReport(preview.id);
        })();
        setReceipt(result);onComplete(result);
      }else{
        const result=await api.exportErrorReport(preview.id);
        setReceipt(result);onComplete(result);
      }
    }catch(reason){setError(errorText(reason));}finally{setBusy(null);}
  };
  const doneTitle=receipt?.delivery==="submitted"||receipt?.delivery==="mail-sent"?"反馈已提交":receipt?.delivery==="mail-draft"?"邮件草稿已准备":"报告已保存";
  return <Modal focusKey={receipt?.delivery ?? (preview ? "preview" : "compose")} title={receipt?doneTitle:preview?"确认反馈内容":"反馈问题"} icon={receipt?"check":"feedback"} onClose={onClose} busy={!!busy} className="report-dialog" actions={(close) => receipt?<button type="button" className="primary-button" data-autofocus onClick={close}>完成</button>:preview?<>
    <button type="button" className="quiet-button" disabled={!!busy} onClick={()=>{setPreview(null);setError(null);}}>返回修改</button>
    <button type="button" className="secondary-button" disabled={!!busy} onClick={()=>void deliver("export")}>{busy==="export"?"正在保存…":"保存报告"}</button>
    {preview.delivery!=="export"&&<button type="button" className="primary-button" disabled={!!busy} onClick={()=>void deliver("send")}><Icon name={preview.delivery==="service"?"feedback":"mail"}/>{busy==="send"?"正在处理…":"发送报告"}</button>}
  </>:<><button type="button" className="secondary-button" disabled={!!busy} onClick={close}>取消</button><button type="button" className="primary-button" disabled={!!busy} onClick={()=>void prepare()}>{busy==="preview"?"正在生成…":"预览报告"}<Icon name="arrow"/></button></>}>
    {receipt?<div className="operation-state"><span className="state-symbol success"><Icon name="check"/></span><p>{receipt.delivery==="submitted"||receipt.delivery==="mail-sent"?"报告已提交，感谢你的反馈。":receipt.delivery==="mail-draft"?"邮件草稿已准备，请检查后发送。":"已在本机保存，可留存或稍后发送。"}</p>{receipt.delivery==="mail-draft"&&<p className="muted">尚未自动发送任何邮件。</p>}{receipt.path&&<details className="report-location"><summary><span>查看保存位置</span><Icon name="chevron"/></summary><p>{receipt.path}</p></details>}</div>
      :preview?<>
        <p className="dialog-description">只会提交下方已预览的内容。请确认其中没有不想分享的信息。</p>
        <div className="report-preview-shell"><ReportDeliveryInfo preview={preview}/><ReportReview raw={preview.preview}/></div>
      </>:<>
        <p className="dialog-description">描述本次问题，可选择附带最近的操作记录。</p>
        <label className="report-message-label" htmlFor="feedback-message">问题描述</label>
        <textarea id="feedback-message" data-autofocus aria-describedby="feedback-description-hint" rows={4} maxLength={2000} value={message} placeholder="例如：点击了什么，随后出现了什么问题…" onChange={event=>setMessage(event.target.value)}/>
        <div className="report-input-hint" id="feedback-description-hint"><span aria-label="已填写字符数">{message.length} / 2000</span></div>
        <label className="report-checkbox"><input type="checkbox" checked={includeLogs} onChange={event=>setIncludeLogs(event.target.checked)}/><span>附带最近 {Math.min(logs.length,20)} 条本工具操作记录</span></label>
        <p className="report-privacy">不读取工程文件或 Cavalry 原始日志。先检查脱敏预览，再决定是否发送。</p>
      </>}
    {error&&<p className="field-error" role="alert">{error}</p>}
  </Modal>;
}
