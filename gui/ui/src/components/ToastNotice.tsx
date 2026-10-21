import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "./Icon";
export interface Notice {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  body: string;
  delayMs: number;
}
export function ToastNotice({ notice, onDismiss }: { notice: Notice; onDismiss: (id: number) => void }) {
  const [mounted, setMounted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (paused || closing) return;
    const timer = window.setTimeout(() => setClosing(true), notice.delayMs + (notice.kind === "success" ? 5000 : 8000));
    return () => window.clearTimeout(timer);
  }, [notice.id, notice.kind, notice.delayMs, paused, closing]);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => onDismiss(notice.id), 160);
    return () => window.clearTimeout(timer);
  }, [closing, notice.id, onDismiss]);
  return <div className={`toast ${closing ? "toast-leaving" : ""}`} data-kind={notice.kind} data-mounted={mounted} style={{ "--toast-delay": `${notice.delayMs}ms` } as CSSProperties} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <span className="toast-symbol"><Icon name={notice.kind === "success" ? "check" : "info"} /></span>
    <div className="toast-content"><div className="toast-title">{notice.title}</div><div className="toast-body">{notice.body}</div></div>
    <button type="button" className="toast-close" aria-label={`关闭通知：${notice.title}`} onClick={() => setClosing(true)}><Icon name="close" /></button>
  </div>;
}
