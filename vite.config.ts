import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiKey =
    env.GEMINI_API_KEY ||
    env.GOOGLE_AI_API_KEY ||
    env.VITE_GEMINI_API_KEY ||
    env.VITE_GOOGLE_AI_API_KEY ||
    "";
  const devPort = Number(env.VITE_DEV_PORT || env.DEV_PORT || "3000");

  return {
    server: {
      port: Number.isNaN(devPort) ? 3000 : devPort,
      host: "0.0.0.0",
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(apiKey),
      "process.env.GEMINI_API_KEY": JSON.stringify(apiKey),
      "process.env.GOOGLE_AI_API_KEY": JSON.stringify(apiKey),
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    build: {
      chunkSizeWarningLimit: 1200,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
