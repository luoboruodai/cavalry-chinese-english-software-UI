/** Compact human summaries; original records stay local and expandable, never rewritten. */
export function logPresentation(text: string): { level: "error" | "success" | "info"; summary: string } {
  // A diagnostic filename such as error-reports is not an operation failure.
  const safe = text.replace(/(?:\/Users\/|[A-Z]:\\Users\\)[^\s，；]+/gi, "本机路径");
  if (/失败|无法|超时|\berror\b/i.test(safe)) {
    const rollback = /回滚失败/.test(text);
    const action = text.startsWith("还原") ? "还原" : text.startsWith("应用") ? "应用双语" : "操作";
    return { level: "error", summary: rollback ? `${action}未完成，回滚失败。请保留备份。` : `${action}未完成，可展开详情查看原因。` };
  }
  if (/反馈报告已提交/.test(text)) return { level: "success", summary: "问题反馈已提交给开发者。" };
  if (/反馈报告已保存/.test(text)) return { level: "info", summary: "反馈报告已保存在本机。" };
  if (/错误报告|邮件草稿/.test(text)) return { level: "info", summary: "错误报告已准备，请检查后发送。" };
  if (/已下载.*Cavalry/.test(text)) return { level: "success", summary: "Cavalry 官方版本下载完成。" };
  if (/切换.*Cavalry/.test(text)) return { level: "success", summary: "已切换 Cavalry 目标版本。" };
  if (/废纸篓|已删除备份/.test(text)) return { level: "success", summary: "备份已移至废纸篓。" };
  if (/配置已保存|设置已保存/.test(text)) return { level: "success", summary: "排版与字体设置已保存。" };
  if (/已应用双语/.test(text)) return { level: "success", summary: "双语已应用，已保留还原快照。" };
  if (/已还原备份/.test(text)) return { level: "success", summary: "已还原所选备份。" };
  return { level: "info", summary: safe.length > 100 ? `${safe.slice(0, 100)}…` : safe };
}
