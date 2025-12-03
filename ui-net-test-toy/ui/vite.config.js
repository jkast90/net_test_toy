import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const buildTime = new Date().toISOString();

  // Plugin to capture bundle hash and inject it
  const bundleHashPlugin = {
    name: "bundle-hash",
    generateBundle(options, bundles) {
      // Find the main JS bundle
      const jsBundle = Object.keys(bundles).find(
        (key) => key.startsWith("assets/index-") && key.endsWith(".js"),
      );

      let bundleHash = "dev-mode";
      if (jsBundle) {
        // Extract hash from filename (e.g., "assets/index-ABC123.js" -> "ABC123")
        const hashMatch = jsBundle.match(/index-([A-Za-z0-9_-]+)\.js$/);
        if (hashMatch) {
          bundleHash = hashMatch[1];
          console.log(
            `[vite-config] Extracted bundle hash: ${bundleHash} from ${jsBundle}`,
          );
        } else {
          console.warn(
            `[vite-config] Could not extract hash from bundle: ${jsBundle}`,
          );
        }
      } else {
        console.warn(
          `[vite-config] Could not find main JS bundle. Available bundles:`,
          Object.keys(bundles),
        );
      }

      // Replace placeholders in all bundles
      for (const bundleFile of Object.values(bundles)) {
        if (bundleFile.type === "chunk" && bundleFile.code) {
          bundleFile.code = bundleFile.code
            .replace(/__BUILD_HASH_PLACEHOLDER__/g, bundleHash)
            .replace(/_LIVE_BUILD_/g, bundleHash);
        }
      }
    },
  };

  return {
    plugins: [
      react(),
      bundleHashPlugin
    ],
    resolve: {
      alias: {
        "@deployment-config": path.resolve(
          __dirname,
          "./deployment-config.js",
        ),
        "@common": path.resolve(__dirname, "./src/_common"),
        "@auth": path.resolve(__dirname, "./src/auth"),
        "@calendar": path.resolve(__dirname, "./src/calendar"),
        "@feed": path.resolve(__dirname, "./src/feed"),
        "@memories": path.resolve(__dirname, "./src/memories"),
        "@profile": path.resolve(__dirname, "./src/profile"),
        "@wishlist": path.resolve(__dirname, "./src/wishlist"),
        "@yearly-summary": path.resolve(__dirname, "./src/yearly-summary"),
        "@browse": path.resolve(__dirname, "./src/browse"),
        "@about": path.resolve(__dirname, "./src/about"),
      },
    },
    server: {
      fs: {
        // Allow serving files from project root and parent directory
        allow: ["..", process.cwd()],
      },
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: ['mini-pc.kast-dev.net', 'localhost'],
      https: env.VITE_ENABLE_HTTPS === 'true' ? {
        key: '/ssl/privkey.pem',
        cert: '/ssl/fullchain.pem',
      } : false,
      watch: {
        usePolling: true, // For Docker compatibility
      },
    },
    define: {
      "process.env.VITE_COGNITO_DOMAIN": JSON.stringify(
        env.VITE_COGNITO_DOMAIN,
      ),
      "process.env.VITE_COGNITO_CLIENT_ID": JSON.stringify(
        env.VITE_COGNITO_CLIENT_ID,
      ),
      "process.env.VITE_WORKSPACE_API_BASE_URL": JSON.stringify(
        env.VITE_WORKSPACE_API_BASE_URL,
      ),
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || mode),
      __BUILD_INFO__: JSON.stringify({
        hash: "__BUILD_HASH_PLACEHOLDER__",
        time: buildTime,
        version: "_LIVE_BUILD_",
      }),
    },
    optimizeDeps: {
      exclude: ["fsevents"],
    },
    build: {
      // Generate source maps for better debugging
      sourcemap: true,
      // Don't minify function names for better error tracking
      minify: mode === "production" ? "esbuild" : false,
      rollupOptions: {
        external: ["fsevents"],
        output: {
          // Preserve function names for better error tracking
          format: "es",
          // Create more readable chunk names
          chunkFileNames: "assets/[name]-[hash].js",
          entryFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
    },
  };
});
