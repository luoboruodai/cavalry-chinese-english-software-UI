import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
interface Props { title: string; children: ReactNode; actions: ReactNode | ((close: () => void) => ReactNode); onClose: () => void; busy?: boolean; icon?: IconName; tone?: "neutral" | "danger"; className?: string; closeLabel?: string; focusKey?: string }
export function Modal({ title, children, actions, onClose, busy = false, icon = "info", tone = "neutral", className = "", closeLabel = "关闭弹窗", focusKey }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const requestClose = useCallback(() => {
    if (busy || closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onCloseRef.current(); return; }
    setClosing(true);
    closeTimer.current = window.setTimeout(() => onCloseRef.current(), 240);
  }, [busy, closing]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    if (node) node.dataset.keyboard = String(previous?.matches(":focus-visible") ?? true);
    node?.showModal();
    return () => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); node?.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  useEffect(() => {
    if (dialog.current) dialog.current.inert = closing;
  }, [closing]);
  useEffect(() => {
    // A new preview must focus its content, never an action occupying the previous button position.
    const target = dialog.current?.querySelector<HTMLElement>("[data-autofocus]") ?? heading.current;
    target?.focus({ preventScroll: true });
  }, [focusKey]);
  return <dialog ref={dialog} className={`confirm-dialog app-modal ${className}`} aria-labelledby={titleId} data-tone={tone} data-closing={closing ? "true" : "false"} aria-busy={busy || closing} onCancel={event => { event.preventDefault(); requestClose(); }}>
    <div className="modal-heading"><span className="modal-symbol"><Icon name={icon} /></span><h2 ref={heading} tabIndex={-1} id={titleId}>{title}</h2><button type="button" className="icon-button modal-close" aria-label={closeLabel} disabled={busy || closing} onClick={requestClose}><Icon name="close" /></button></div>
    <div className="modal-body">{children}</div>
    <div className="dialog-actions">{typeof actions === "function" ? actions(requestClose) : actions}</div>
  </dialog>;
}
