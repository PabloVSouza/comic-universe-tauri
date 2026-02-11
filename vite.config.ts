import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const host = process.env.TAURI_DEV_HOST

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), tsconfigPaths()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ['**/src-tauri/**']
    }
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: /^components$/, replacement: resolve(__dirname, './src/components/index') },
      { find: /^components\/(.*)$/, replacement: resolve(__dirname, './src/components/$1') },
      { find: /^hooks$/, replacement: resolve(__dirname, './src/hooks/index') },
      { find: /^hooks\/(.*)$/, replacement: resolve(__dirname, './src/hooks/$1') },
      { find: /^providers$/, replacement: resolve(__dirname, './src/providers/index') },
      { find: /^providers\/(.*)$/, replacement: resolve(__dirname, './src/providers/$1') },
      { find: /^routes$/, replacement: resolve(__dirname, './src/routes/index') },
      { find: /^routes\/(.*)$/, replacement: resolve(__dirname, './src/routes/$1') },
      { find: /^store$/, replacement: resolve(__dirname, './src/store/index') },
      { find: /^store\/(.*)$/, replacement: resolve(__dirname, './src/store/$1') },
      { find: /^style$/, replacement: resolve(__dirname, './src/style/index') },
      { find: /^style\/(.*)$/, replacement: resolve(__dirname, './src/style/$1') },
      { find: /^template$/, replacement: resolve(__dirname, './src/template/index') },
      { find: /^template\/(.*)$/, replacement: resolve(__dirname, './src/template/$1') },
      { find: /^utils$/, replacement: resolve(__dirname, './src/utils/index') },
      { find: /^utils\/(.*)$/, replacement: resolve(__dirname, './src/utils/$1') },
      { find: /^windows$/, replacement: resolve(__dirname, './src/windows/index') },
      { find: /^windows\/(.*)$/, replacement: resolve(__dirname, './src/windows/$1') },
      { find: /^assets$/, replacement: resolve(__dirname, './src/assets/index') },
      { find: /^assets\/(.*)$/, replacement: resolve(__dirname, './src/assets/$1') },
      { find: /^i18n$/, replacement: resolve(__dirname, './src/i18n/index') },
      { find: /^i18n\/(.*)$/, replacement: resolve(__dirname, './src/i18n/$1') }
    ]
  }
}))
