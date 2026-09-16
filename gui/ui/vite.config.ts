import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 约定:开发服务器固定 1420 端口,且监听时忽略 Rust 侧目录变动。
// https://v2.tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  // 构建产物由 Tauri 嵌入,保持相对路径
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    outDir: "dist",
    target: "es2021",
    minify: true,
    sourcemap: false,
  },
}));
