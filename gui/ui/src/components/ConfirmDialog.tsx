import { useState, type ReactNode } from "react";
import { Modal } from "./Modal";
import type { IconName } from "./Icon";
interface Props { title: string; children: ReactNode; confirmLabel: string; danger?: boolean; icon?: IconName; onCancel: () => void; onConfirm: () => Promise<string | null> }
export function ConfirmDialog({ title, children, confirmLabel, danger = false, icon, onCancel, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async (close: () => void) => {
    if (busy) return;
    setBusy(true); setError(null);
    try { const result = await onConfirm(); if (result) setError(result); else close(); }
    catch { setError("操作未完成，请重试。"); }
    finally { setBusy(false); }
  };
  return <Modal title={title} onClose={onCancel} busy={busy} icon={icon ?? (danger ? "trash" : "restore")} tone={danger ? "danger" : "neutral"} actions={(close) => <>
    <button type="button" className="secondary-button" disabled={busy} onClick={close}>取消</button>
    <button type="button" className={danger ? "danger-button" : "cta-coral"} disabled={busy} onClick={() => void confirm(close)}>{busy ? "处理中…" : confirmLabel}</button>
  </>}><div className="dialog-description">{children}</div>{error && <p className="field-error" role="alert">{error}</p>}</Modal>;
}
