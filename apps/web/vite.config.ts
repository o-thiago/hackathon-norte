import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, new URL("../../", import.meta.url).pathname, "");
  const apiTarget = env.VITE_API_URL ?? "http://localhost:3000";
  return {
    envDir: "../../",
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes("leaflet")) return "leaflet";
            if (id.includes("node_modules")) return "vendor";
            return undefined;
          },
        },
      },
    },
  };
});
