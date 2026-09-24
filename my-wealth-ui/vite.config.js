import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Which commit this bundle was built from. Render sets RENDER_GIT_COMMIT
  // during the build as well as at runtime, so the app can compare itself
  // with the server (/api/health) and offer to reload when they differ.
  define: {
    __APP_COMMIT__: JSON.stringify((process.env.RENDER_GIT_COMMIT || 'local').slice(0, 7)),
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
