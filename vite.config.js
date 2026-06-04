import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      // Proxy for Nominatim geocoding to bypass CORS
      "/api/nominatim": {
        target: "https://nominatim.openstreetmap.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nominatim/, ""),
        headers: {
          "User-Agent": "SheMove-App/1.0 (https://shemove.ke)",
          Referer: "https://shemove.ke",
          Accept: "application/json",
        },
      },
      // Proxy for OSRM routing to bypass CORS
      "/api/osrm": {
        target: "https://router.project-osrm.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/osrm/, ""),
      },
    },
  },
});
