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
          "X-Client-Key": "pk_livwell_c596d4580b6001ad0668af79b593d8c09f4fd27c",
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
