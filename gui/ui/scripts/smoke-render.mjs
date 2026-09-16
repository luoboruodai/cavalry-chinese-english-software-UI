// 冒烟测试:用 react-dom/server 渲染,验证组件树不抛错。
// 用法: node scripts/smoke-render.mjs(在 gui/ui 下)
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import App from "../src/App.tsx";

const html = renderToString(createElement(App));
for (const marker of [
  "Cavalry Bilingual", // 工具栏 wordmark
  "CB", // logo
  "检测中…", // 状态胶囊初始
  "重新检测状态", // 刷新按钮
  "状态",
  "排版",
  "备份",
  "日志",
  "Cavalry 双语补丁的安装与检测。", // 状态区描述
  "v0.2.0",
  "仅供学习用途",
]) {
  if (!html.includes(marker)) throw new Error(`marker missing: ${marker}`);
}
console.log("smoke render ok,", html.length, "bytes");
