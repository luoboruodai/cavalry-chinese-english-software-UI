import { isMock, type EmailJsSession } from "./api";

export function emailJsConfig(): EmailJsSession {
  if (isMock) {
    if (new URLSearchParams(location.search).get("mock") === "report-oauth-cancel") {
      throw new Error("外部授权已取消，未发送邮件");
    }
    return { serviceId: "service_mock", templateId: "template_mock", publicKey: "public_mock" };
  }
  const serviceId = String(import.meta.env.VITE_EMAILJS_SERVICE_ID ?? "").trim();
  const templateId = String(import.meta.env.VITE_EMAILJS_TEMPLATE_ID ?? "").trim();
  const publicKey = String(import.meta.env.VITE_EMAILJS_PUBLIC_KEY ?? "").trim();
  if (!serviceId || !templateId || !publicKey) {
    throw new Error("发送功能尚未配置，可先保存报告");
  }
  return { serviceId, templateId, publicKey };
}

export async function sendEmailJsBrowser(body: string): Promise<void> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (response.ok) return;
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) {
        throw new Error(`发送过于频繁，请 ${seconds} 秒后再试`);
      }
      throw new Error("发送过于频繁，请稍后重试且不要重复提交");
    }
    throw new Error("发送未完成，请稍后重试或保存报告");
  } catch (reason) {
    if (reason instanceof Error && reason.message.startsWith("发送")) throw reason;
    if (reason instanceof Error && reason.name === "AbortError") {
      throw new Error("未收到发送确认，请检查网络后重试或保存报告");
    }
    throw new Error("未收到发送确认，请检查网络后重试或保存报告");
  } finally {
    window.clearTimeout(timeout);
  }
}
