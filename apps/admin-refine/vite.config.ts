import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/gdrive": { target: "http://127.0.0.1:8085", changeOrigin: true },
      "/api/stream-gdrive": { target: "http://127.0.0.1:8085", changeOrigin: true },
      "/api/jobs": { target: "http://127.0.0.1:8085", changeOrigin: true },
      "/api": { target: "http://127.0.0.1:8081", changeOrigin: true },
      "/uploads": { target: "http://127.0.0.1:8081", changeOrigin: true },
    },
  },
});
