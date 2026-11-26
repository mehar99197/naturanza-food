import path from "path"
import { fileURLToPath } from "url"
import react from "@vitejs/plugin-react-swc"
import { defineConfig, loadEnv } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const exposeToNetwork = process.env.VITE_HOST_NETWORK === 'true'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const resolvedGoogleClientId = String(
    env.VITE_GOOGLE_CLIENT_ID ||
      process.env.VITE_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      '',
  ).trim()

  return {
  base: '/',
  plugins: [react()],
  define: resolvedGoogleClientId
    ? {
        'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(resolvedGoogleClientId),
      }
    : undefined,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: exposeToNetwork ? true : '127.0.0.1',
    port: 5173,
    strictPort: true, // Keep frontend fixed to 5173
    open: false,
    hmr: {
      overlay: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', '@radix-ui/react-slot', 'class-variance-authority', 'clsx', 'tailwind-merge'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}
})
