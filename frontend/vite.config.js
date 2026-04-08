import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import cesium from 'vite-plugin-cesium'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    cesium()
  ],
  server: {
    host: process.env.HOST || 'localhost',
    port: parseInt(process.env.PORT || '5173'),
    strictPort: true,
    hmr: {
      host: 'localhost',
      port: 5173
    },
    watch: {
      usePolling: true  // Docker环境必需
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // 'proj4': 'proj4/dist/proj4.js'
    },
  },
})
