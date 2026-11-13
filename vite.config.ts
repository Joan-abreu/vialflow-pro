import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/relay-charge": {
        target: "https://payment-processor-middleware-nine.vercel.app",
        changeOrigin: true,
        rewrite: (path) => "/api/v1/payment/process",
        headers: {
          "X-Site-Id": "livwell",
          "X-Client-Key": "ck_live_5e4daa2df7b941e0945e85e598fc9e3608e18d0eb8103699",
        },
      },
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
